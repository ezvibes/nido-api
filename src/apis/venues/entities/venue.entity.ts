import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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

  @Column()
  citySlug: string;

  @Column()
  region: string;

  @Column()
  regionSlug: string;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  lat: number;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  lng: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
