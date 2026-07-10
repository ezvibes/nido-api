import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'artists' })
export class Artist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  @Index('IDX_artists_slug')
  slug: string;

  @Column('text', { array: true, nullable: true })
  genres: string[];

  @Column({ name: 'promo_image_url', nullable: true })
  promoImageUrl?: string;

  @Column({ name: 'spotify_url', nullable: true })
  spotifyUrl?: string;

  @Column({ name: 'instagram_handle', nullable: true })
  instagramHandle?: string;

  @Column({ name: 'website_url', nullable: true })
  websiteUrl?: string;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
