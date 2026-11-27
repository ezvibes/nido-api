import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AgentRunEventType } from '../../../contracts';
import { AgentRun } from './agent-run.entity';

@Entity({ name: 'agent_run_events' })
@Index('UQ_agent_run_events_run_id_sequence', ['runId', 'sequence'], {
  unique: true,
})
export class AgentRunEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => AgentRun, (run) => run.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run?: AgentRun;

  @Column({ type: 'integer' })
  sequence: number;

  @Column({ name: 'event_type', type: 'varchar', length: 48 })
  eventType: AgentRunEventType;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
