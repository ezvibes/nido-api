import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import {
  INSTAGRAM_REQUIRED_SCOPES,
  InstagramConnectionStatus,
  InstagramConnectionStatusSchema,
} from '../contracts/instagram.contract';
import { InstagramConnection } from './entities/instagram-connection.entity';
import {
  decryptInstagramToken,
  encryptInstagramToken,
} from './utils/instagram-token-crypto.util';

const INSTAGRAM_OAUTH_AUTHORIZE_URL =
  'https://api.instagram.com/oauth/authorize';
const INSTAGRAM_OAUTH_TOKEN_URL =
  'https://api.instagram.com/oauth/access_token';
const INSTAGRAM_GRAPH_BASE_URL = 'https://graph.instagram.com';
const DEFAULT_STATE_TTL_SECONDS = 600;

export interface OAuthStatePayload {
  nonce: string;
  iat: number;
  exp: number;
  email?: string;
}

export interface InstagramAuthorizeResult {
  authorizeUrl: string;
  state: string;
  expiresAt: string;
}

@Injectable()
export class InstagramAuthService {
  private readonly logger = new Logger(InstagramAuthService.name);

  constructor(
    @InjectRepository(InstagramConnection)
    private readonly connectionRepo: Repository<InstagramConnection>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generates a signed, expiring CSRF state token for the Instagram OAuth flow.
   */
  generateOAuthState(
    adminEmail?: string,
    ttlSeconds = DEFAULT_STATE_TTL_SECONDS,
  ): { state: string; expiresAt: string } {
    const secret = this.getStateSigningSecret();
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + ttlSeconds;
    const payload: OAuthStatePayload = {
      nonce: randomBytes(16).toString('hex'),
      iat: nowSec,
      exp: expSec,
      ...(adminEmail ? { email: adminEmail.trim().toLowerCase() } : {}),
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    );
    const signature = this.signStatePayload(encodedPayload, secret);

    return {
      state: `${encodedPayload}.${signature}`,
      expiresAt: new Date(expSec * 1000).toISOString(),
    };
  }

  /**
   * Verifies the HMAC signature and expiration of an OAuth CSRF state token.
   */
  verifyOAuthState(state: string): OAuthStatePayload {
    if (!state || typeof state !== 'string') {
      throw new BadRequestException('Missing OAuth state parameter.');
    }

    const parts = state.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new UnauthorizedException('Malformed OAuth state parameter.');
    }

    const [encodedPayload, providedSig] = parts;
    const secret = this.getStateSigningSecret();
    const expectedSig = this.signStatePayload(encodedPayload, secret);

    const providedBuf = Buffer.from(providedSig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (
      providedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(providedBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('Invalid OAuth state signature.');
    }

    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as OAuthStatePayload;
    } catch {
      throw new UnauthorizedException('Corrupted OAuth state payload.');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || typeof payload.exp !== 'number' || payload.exp < nowSec) {
      throw new UnauthorizedException('OAuth state has expired.');
    }

    return payload;
  }

  /**
   * Builds the Meta Instagram Business Login OAuth authorization URL.
   */
  buildAuthorizeUrl(adminEmail?: string): InstagramAuthorizeResult {
    const appId = this.getRequiredConfig('META_APP_ID');
    const redirectUri = this.getRequiredConfig('META_INSTAGRAM_REDIRECT_URI');
    const { state, expiresAt } = this.generateOAuthState(adminEmail);

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: INSTAGRAM_REQUIRED_SCOPES.join(','),
      state,
    });

    return {
      authorizeUrl: `${INSTAGRAM_OAUTH_AUTHORIZE_URL}?${params.toString()}`,
      state,
      expiresAt,
    };
  }

  /**
   * Handles the OAuth callback: verifies state, exchanges code -> short-lived token
   * -> long-lived token, fetches /me profile, encrypts token, and persists connection.
   */
  async handleOAuthCallback(
    code: string,
    state: string,
  ): Promise<InstagramConnectionStatus> {
    if (!code || typeof code !== 'string') {
      throw new BadRequestException('Missing OAuth authorization code.');
    }

    const statePayload = this.verifyOAuthState(state);
    const appId = this.getRequiredConfig('META_APP_ID');
    const appSecret = this.getRequiredConfig('META_APP_SECRET');
    const redirectUri = this.getRequiredConfig('META_INSTAGRAM_REDIRECT_URI');
    const encryptionKey = this.getRequiredConfig('INSTAGRAM_TOKEN_ENCRYPTION_KEY');

    // 1. Exchange authorization code for short-lived token
    const shortLivedBody = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: code.trim(),
    });

    const shortLivedRes = await this.fetchJson<{
      access_token?: string;
      user_id?: string | number;
    }>(INSTAGRAM_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: shortLivedBody.toString(),
    }, 'short-lived token exchange');

    if (!shortLivedRes.access_token) {
      throw new BadRequestException(
        'Instagram token exchange did not return an access token.',
      );
    }

    // 2. Exchange short-lived token for long-lived token (60 days)
    const longLivedParams = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: appSecret,
      access_token: shortLivedRes.access_token,
    });

    const longLivedRes = await this.fetchJson<{
      access_token?: string;
      token_type?: string;
      expires_in?: number;
    }>(
      `${INSTAGRAM_GRAPH_BASE_URL}/access_token?${longLivedParams.toString()}`,
      { method: 'GET' },
      'long-lived token exchange',
    );

    if (!longLivedRes.access_token) {
      throw new BadRequestException(
        'Instagram long-lived token exchange did not return an access token.',
      );
    }

    // 3. Fetch /me profile metadata
    const profileParams = new URLSearchParams({
      fields: 'user_id,username,account_type',
      access_token: longLivedRes.access_token,
    });

    const profileRes = await this.fetchJson<{
      id?: string;
      user_id?: string;
      username?: string;
      account_type?: string;
    }>(
      `${INSTAGRAM_GRAPH_BASE_URL}/me?${profileParams.toString()}`,
      { method: 'GET' },
      'Instagram profile fetch',
    );

    const instagramUserId = String(
      profileRes.user_id ?? profileRes.id ?? shortLivedRes.user_id ?? '',
    ).trim();

    if (!instagramUserId) {
      throw new BadRequestException(
        'Instagram profile response did not include a user ID.',
      );
    }

    const encryptedToken = encryptInstagramToken(
      longLivedRes.access_token,
      encryptionKey,
    );

    const now = new Date();
    const expiresInSec =
      typeof longLivedRes.expires_in === 'number' && longLivedRes.expires_in > 0
        ? longLivedRes.expires_in
        : 60 * 24 * 60 * 60;
    const tokenExpiresAt = new Date(now.getTime() + expiresInSec * 1000);

    let connection = await this.connectionRepo.findOne({
      where: { instagramUserId },
    });

    if (!connection) {
      connection = this.connectionRepo.create({
        instagramUserId,
      });
    }

    connection.username = profileRes.username ?? connection.username ?? null;
    connection.accountType =
      profileRes.account_type ?? connection.accountType ?? null;
    connection.scopes = [...INSTAGRAM_REQUIRED_SCOPES];
    connection.accessTokenEncrypted = encryptedToken;
    connection.tokenExpiresAt = tokenExpiresAt;
    connection.lastRefreshedAt = now;
    connection.status = 'connected';
    connection.connectedByEmail = statePayload.email ?? null;
    connection.connectedAt = now;
    connection.revokedAt = null;

    const saved = await this.connectionRepo.save(connection);
    this.logger.log(
      `Connected Instagram Business account ${saved.instagramUserId} (@${saved.username ?? 'unknown'})`,
    );

    return this.toSanitizedStatus(saved);
  }

  /**
   * Refreshes the long-lived Instagram access token for the active connection.
   */
  async refreshAccessToken(
    connectionId?: string,
  ): Promise<InstagramConnectionStatus> {
    const encryptionKey = this.getRequiredConfig('INSTAGRAM_TOKEN_ENCRYPTION_KEY');
    const connection = await this.findActiveConnection(connectionId);

    if (!connection.accessTokenEncrypted) {
      throw new BadRequestException(
        'Instagram connection does not have a stored token to refresh.',
      );
    }

    const currentToken = decryptInstagramToken(
      connection.accessTokenEncrypted,
      encryptionKey,
    );

    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: currentToken,
    });

    const refreshed = await this.fetchJson<{
      access_token?: string;
      token_type?: string;
      expires_in?: number;
    }>(
      `${INSTAGRAM_GRAPH_BASE_URL}/refresh_access_token?${params.toString()}`,
      { method: 'GET' },
      'long-lived token refresh',
    );

    if (!refreshed.access_token) {
      throw new BadRequestException(
        'Instagram token refresh did not return an access token.',
      );
    }

    const now = new Date();
    const expiresInSec =
      typeof refreshed.expires_in === 'number' && refreshed.expires_in > 0
        ? refreshed.expires_in
        : 60 * 24 * 60 * 60;

    connection.accessTokenEncrypted = encryptInstagramToken(
      refreshed.access_token,
      encryptionKey,
    );
    connection.lastRefreshedAt = now;
    connection.tokenExpiresAt = new Date(now.getTime() + expiresInSec * 1000);
    connection.status = 'connected';

    const saved = await this.connectionRepo.save(connection);
    this.logger.log(
      `Refreshed Instagram token for account ${saved.instagramUserId}`,
    );

    return this.toSanitizedStatus(saved);
  }

  /**
   * Returns sanitized connection status without exposing encrypted or plaintext tokens.
   */
  async getStatus(): Promise<InstagramConnectionStatus> {
    const latest = await this.findLatestConnection();
    if (!latest) {
      return InstagramConnectionStatusSchema.parse({
        connected: false,
        status: 'disconnected',
        instagramUserId: null,
        username: null,
        accountType: null,
        scopes: [],
        tokenExpiresAt: null,
        lastRefreshedAt: null,
        connectedAt: null,
        revokedAt: null,
      });
    }

    return this.toSanitizedStatus(latest);
  }

  /**
   * Disconnects the active Instagram connection: clears ciphertext and marks status as 'revoked'.
   */
  async disconnect(): Promise<InstagramConnectionStatus> {
    const connections = await this.connectionRepo.find({
      order: { updatedAt: 'DESC' },
    });

    if (connections.length === 0) {
      return this.getStatus();
    }

    const now = new Date();
    for (const conn of connections) {
      conn.accessTokenEncrypted = null;
      conn.status = 'revoked';
      conn.revokedAt = conn.revokedAt ?? now;
      await this.connectionRepo.save(conn);
    }

    this.logger.log('Disconnected Instagram Business connection and cleared token ciphertext.');
    return this.toSanitizedStatus(connections[0]);
  }

  /**
   * Internal-only helper for InstagramMediaService to retrieve a decrypted access token.
   * Never expose this method or its return value through any controller or status response.
   */
  async getValidAccessToken(): Promise<{
    accessToken: string;
    instagramUserId: string;
    connectionId: string;
  }> {
    const encryptionKey = this.getRequiredConfig('INSTAGRAM_TOKEN_ENCRYPTION_KEY');
    const connection = await this.findActiveConnection();

    if (!connection.accessTokenEncrypted) {
      throw new BadRequestException(
        'Instagram connection is missing an encrypted access token.',
      );
    }

    if (
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() <= Date.now()
    ) {
      connection.status = 'expired';
      await this.connectionRepo.save(connection);
      throw new UnauthorizedException(
        'Instagram access token has expired. Please reconnect or refresh.',
      );
    }

    const accessToken = decryptInstagramToken(
      connection.accessTokenEncrypted,
      encryptionKey,
    );

    return {
      accessToken,
      instagramUserId: connection.instagramUserId,
      connectionId: connection.id,
    };
  }

  private async findLatestConnection(): Promise<InstagramConnection | null> {
    const [latest] = await this.connectionRepo.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    return latest ?? null;
  }

  private async findActiveConnection(
    connectionId?: string,
  ): Promise<InstagramConnection> {
    const connection = connectionId
      ? await this.connectionRepo.findOne({ where: { id: connectionId } })
      : await this.connectionRepo.findOne({
          where: { status: 'connected' },
          order: { updatedAt: 'DESC' },
        });

    if (!connection || connection.status !== 'connected') {
      throw new NotFoundException('No active Instagram Business connection.');
    }

    return connection;
  }

  private toSanitizedStatus(
    connection: InstagramConnection,
  ): InstagramConnectionStatus {
    const isExpired =
      connection.status === 'connected' &&
      connection.tokenExpiresAt != null &&
      connection.tokenExpiresAt.getTime() <= Date.now();

    const effectiveStatus = isExpired ? 'expired' : connection.status;

    return InstagramConnectionStatusSchema.parse({
      connected:
        effectiveStatus === 'connected' &&
        Boolean(connection.accessTokenEncrypted),
      status: effectiveStatus,
      instagramUserId: connection.instagramUserId,
      username: connection.username ?? null,
      accountType: connection.accountType ?? null,
      scopes: Array.isArray(connection.scopes) ? connection.scopes : [],
      tokenExpiresAt: connection.tokenExpiresAt
        ? connection.tokenExpiresAt.toISOString()
        : null,
      lastRefreshedAt: connection.lastRefreshedAt
        ? connection.lastRefreshedAt.toISOString()
        : null,
      connectedAt: connection.connectedAt
        ? connection.connectedAt.toISOString()
        : null,
      revokedAt: connection.revokedAt
        ? connection.revokedAt.toISOString()
        : null,
    });
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new InternalServerErrorException(
        `Missing required Instagram configuration: ${key}`,
      );
    }
    return value;
  }

  private getStateSigningSecret(): string {
    const appSecret = this.configService.get<string>('META_APP_SECRET')?.trim();
    if (appSecret) {
      return appSecret;
    }
    const encKey = this.configService
      .get<string>('INSTAGRAM_TOKEN_ENCRYPTION_KEY')
      ?.trim();
    if (encKey) {
      return encKey;
    }
    throw new InternalServerErrorException(
      'Missing META_APP_SECRET for OAuth state signing.',
    );
  }

  private signStatePayload(encodedPayload: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('base64url');
  }

  private async fetchJson<T>(
    url: string,
    init: RequestInit,
    contextLabel: string,
  ): Promise<T> {
    let response: Response;
    try {
      response = await globalThis.fetch(url, init);
    } catch {
      throw new BadRequestException(
        `Network error during Instagram ${contextLabel}.`,
      );
    }

    let body: any = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const apiMessage =
        body?.error_message ??
        body?.error?.message ??
        `HTTP ${response.status}`;
      this.logger.warn(
        `Instagram ${contextLabel} failed with status ${response.status}: ${apiMessage}`,
      );
      throw new BadRequestException(
        `Instagram ${contextLabel} failed: ${apiMessage}`,
      );
    }

    return body as T;
  }
}
