import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  address: string;

  @Column()
  city: string;

  @Column({ name: 'city_slug' })
  @Index('IDX_venues_city_slug')
  citySlug: string;

  @Column()
  region: string;

  @Column({ name: 'region_slug' })
  regionSlug: string;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  lat: number;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  lng: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
