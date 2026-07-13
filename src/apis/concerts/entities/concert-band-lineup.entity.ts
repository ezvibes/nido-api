import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Concert } from './concert.entity';
import { Band } from '../../bands/entities/band.entity';

export enum PerformanceRole {
  HEADLINER = 'headliner',
  CO_HEADLINER = 'co-headliner',
  SUPPORT = 'support',
  OPENER = 'opener',
}

@Entity({ name: 'concert_band_lineups' })
export class ConcertBandLineup {
  @PrimaryColumn({ name: 'concert_id', type: 'uuid' })
  concertId: string;

  @PrimaryColumn({ name: 'band_id', type: 'uuid' })
  bandId: string;

  @ManyToOne(() => Concert, (concert) => concert.lineup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concert_id' })
  concert: Concert;

  @ManyToOne(() => Band, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'band_id' })
  band: Band;

  @Column({ name: 'performance_order', type: 'integer', default: 0 })
  performanceOrder: number;

  @Column({
    name: 'performance_role',
    type: 'varchar',
    length: 50,
    default: PerformanceRole.SUPPORT,
  })
  performanceRole: PerformanceRole;
}
