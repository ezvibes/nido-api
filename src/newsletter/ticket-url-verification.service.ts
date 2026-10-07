import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';
import { isIP, LookupFunction } from 'node:net';
import { MAX_TICKET_URLS_PER_CHECK } from './newsletter.constants';

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 5_000;

export type TicketUrlVerificationStatus =
  | 'reachable'
  | 'unreachable'
  | 'blocked'
  | 'indeterminate';

export interface TicketUrlVerificationResult {
  url: string;
  finalUrl?: string;
  status: TicketUrlVerificationStatus;
  statusCode?: number;
  method?: 'HEAD' | 'GET';
  reason?: string;
}

interface PublicDestination {
  url: URL;
  address: string;
  family: 4 | 6;
}

interface TicketHttpResponse {
  status: number;
  location?: string;
}

@Injectable()
export class TicketUrlVerificationService {
  async verifyUrls(urls: string[]): Promise<TicketUrlVerificationResult[]> {
    if (urls.length === 0 || urls.length > MAX_TICKET_URLS_PER_CHECK) {
      throw new RangeError(
        `Ticket URL verification requires between 1 and ${MAX_TICKET_URLS_PER_CHECK} URLs.`,
      );
    }
    return Promise.all(urls.map((url) => this.verifyUrl(url)));
  }

  private async verifyUrl(url: string): Promise<TicketUrlVerificationResult> {
    try {
      return await this.requestWithRedirects(url, 'HEAD');
    } catch (error) {
      return {
        url,
        status: 'indeterminate',
        reason: this.describeRequestFailure(error),
      };
    }
  }

  private async requestWithRedirects(
    originalUrl: string,
    method: 'HEAD' | 'GET',
  ): Promise<TicketUrlVerificationResult> {
    let currentUrl = originalUrl;

    for (
      let redirectCount = 0;
      redirectCount <= MAX_REDIRECTS;
      redirectCount += 1
    ) {
      const validation = await this.validateDestination(currentUrl);
      if ('blockReason' in validation) {
        return {
          url: originalUrl,
          finalUrl: currentUrl === originalUrl ? undefined : currentUrl,
          status: 'blocked',
          reason: validation.blockReason,
        };
      }

      const response = await this.performPinnedRequest(
        validation.destination,
        method,
      );

      if (response.status >= 300 && response.status < 400) {
        if (!response.location) {
          return {
            url: originalUrl,
            finalUrl: currentUrl === originalUrl ? undefined : currentUrl,
            status: 'indeterminate',
            statusCode: response.status,
            method,
            reason: 'Redirect response did not include a location.',
          };
        }
        if (redirectCount === MAX_REDIRECTS) {
          return {
            url: originalUrl,
            finalUrl: currentUrl,
            status: 'indeterminate',
            statusCode: response.status,
            method,
            reason: 'Redirect limit exceeded.',
          };
        }
        currentUrl = new URL(response.location, currentUrl).toString();
        continue;
      }

      if (method === 'HEAD' && [403, 405, 501].includes(response.status)) {
        return this.requestWithRedirects(originalUrl, 'GET');
      }

      return {
        url: originalUrl,
        finalUrl: currentUrl === originalUrl ? undefined : currentUrl,
        status:
          response.status >= 200 && response.status < 300
            ? 'reachable'
            : 'unreachable',
        statusCode: response.status,
        method,
      };
    }

    return {
      url: originalUrl,
      status: 'indeterminate',
      reason: 'Redirect limit exceeded.',
    };
  }

  private async validateDestination(
    rawUrl: string,
  ): Promise<{ destination: PublicDestination } | { blockReason: string }> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return { blockReason: 'URL is invalid.' };
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      return { blockReason: 'Only public HTTP(S) URLs are allowed.' };
    }
    if (url.username || url.password) {
      return { blockReason: 'URLs containing credentials are not allowed.' };
    }
    if (
      (url.protocol === 'http:' && url.port && url.port !== '80') ||
      (url.protocol === 'https:' && url.port && url.port !== '443')
    ) {
      return { blockReason: 'Only standard HTTP(S) ports are allowed.' };
    }

    const hostname = url.hostname
      .toLowerCase()
      .replace(/\.$/, '')
      .replace(/^\[|\]$/g, '');
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    ) {
      return {
        blockReason: 'Local and private network destinations are not allowed.',
      };
    }

    const literalFamily = isIP(hostname);
    if (literalFamily) {
      if (!this.isPublicIp(hostname)) {
        return {
          blockReason:
            'Local and private network destinations are not allowed.',
        };
      }
      return {
        destination: {
          url,
          address: hostname,
          family: literalFamily as 4 | 6,
        },
      };
    }

    try {
      const addresses = await this.resolveAddresses(hostname);
      if (
        addresses.length === 0 ||
        addresses.some(({ address }) => !this.isPublicIp(address))
      ) {
        return {
          blockReason:
            'Host must resolve exclusively to public network addresses.',
        };
      }
      const selected = addresses[0];
      return {
        destination: {
          url,
          address: selected.address,
          family: selected.family as 4 | 6,
        },
      };
    } catch {
      return { blockReason: 'Host could not be resolved.' };
    }
  }

  protected resolveAddresses(hostname: string) {
    return lookup(hostname, { all: true, verbatim: true });
  }

  protected performPinnedRequest(
    destination: PublicDestination,
    method: 'HEAD' | 'GET',
  ): Promise<TicketHttpResponse> {
    const { address, family, url } = destination;
    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) {
        callback(null, [{ address, family }]);
        return;
      }
      callback(null, address, family);
    };

    return new Promise((resolve, reject) => {
      const request = (url.protocol === 'https:' ? requestHttps : requestHttp)(
        url,
        {
          method,
          lookup: pinnedLookup,
          servername: url.hostname,
          headers: {
            ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
            'User-Agent': 'NidoTicketLinkVerifier/1.0',
          },
        },
        (response) => {
          const locationHeader = response.headers.location;
          response.destroy();
          resolve({
            status: response.statusCode ?? 0,
            location: Array.isArray(locationHeader)
              ? locationHeader[0]
              : locationHeader,
          });
        },
      );

      request.setTimeout(REQUEST_TIMEOUT_MS, () => {
        const timeoutError = new Error('Request timed out.');
        timeoutError.name = 'TimeoutError';
        request.destroy(timeoutError);
      });
      request.on('error', reject);
      request.end();
    });
  }

  private isPublicIp(address: string): boolean {
    const version = isIP(address);
    if (version === 4) {
      const [a, b, c] = address.split('.').map(Number);
      return !(
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 0 && (c === 0 || c === 2)) ||
        (a === 192 && b === 88 && c === 99) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && c === 100) ||
        (a === 203 && b === 0 && c === 113) ||
        a >= 224
      );
    }

    if (version === 6) {
      const normalized = address.toLowerCase();
      if (normalized.startsWith('::ffff:')) {
        return this.isPublicIp(normalized.slice('::ffff:'.length));
      }
      return /^[23]/.test(normalized) && !normalized.startsWith('2001:db8');
    }

    return false;
  }

  private describeRequestFailure(error: unknown): string {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return 'Request timed out.';
    }
    return 'URL could not be verified.';
  }
}
