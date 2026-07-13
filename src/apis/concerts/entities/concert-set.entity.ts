import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Concert } from './concert.entity';
import { Band } from '../../bands/entities/band.entity';

@Entity({ name: 'concert_sets' })
export class ConcertSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'concert_id', type: 'uuid' })
  concertId: string;

  @Column({ name: 'band_id', type: 'uuid' })
  bandId: string;

  @ManyToOne(() => Concert, (concert) => concert.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concert_id' })
  concert: Concert;

  @ManyToOne(() => Band, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'band_id' })
  band: Band;

  @Column({ name: 'stage_name', type: 'varchar', length: 255 })
  stageName: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
