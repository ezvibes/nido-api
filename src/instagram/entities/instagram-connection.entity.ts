import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { InstagramAuthMethod } from '../../contracts/instagram.contract';

export type InstagramConnectionEntityStatus =
  | 'connected'
  | 'revoked'
  | 'expired';

@Entity('instagram_connections')
export class InstagramConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'instagram_user_id',
    type: 'varchar',
    length: 128,
    unique: true,
  })
  instagramUserId: string;

  @Column({
    name: 'auth_method',
    type: 'varchar',
    length: 32,
    default: 'facebook_login',
  })
  authMethod: InstagramAuthMethod;

  @Column({ type: 'varchar', length: 128, nullable: true })
  username?: string | null;

  @Column({ name: 'account_type', type: 'varchar', length: 64, nullable: true })
  accountType?: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  scopes: string[];

  @Column({ name: 'access_token_encrypted', type: 'text', nullable: true })
  accessTokenEncrypted?: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt?: Date | null;

  @Column({ name: 'last_refreshed_at', type: 'timestamptz', nullable: true })
  lastRefreshedAt?: Date | null;

  @Index('IDX_instagram_connections_status')
  @Column({ type: 'varchar', length: 32, default: 'connected' })
  status: InstagramConnectionEntityStatus;

  @Column({
    name: 'connected_by_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  connectedByEmail?: string | null;

  @Column({ name: 'connected_at', type: 'timestamptz', nullable: true })
  connectedAt?: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
