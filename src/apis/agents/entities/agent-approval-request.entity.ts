import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  AgentApprovalOutputType,
  AgentApprovalStatus,
} from '../../../contracts';
import { User } from '../../users/entities/user.entity';
import { AgentRun } from './agent-run.entity';

@Entity({ name: 'agent_approval_requests' })
@Index('IDX_agent_approval_requests_run_id', ['runId'])
@Index('IDX_agent_approval_requests_status_created_at', ['status', 'createdAt'])
export class AgentApprovalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => AgentRun, (run) => run.approvalRequests, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'run_id' })
  run?: AgentRun;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: AgentApprovalStatus;

  @Column({ name: 'output_type', type: 'varchar', length: 48 })
  outputType: AgentApprovalOutputType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @Column({ name: 'decided_by_user_id', type: 'integer', nullable: true })
  decidedByUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'decided_by_user_id' })
  decidedByUser?: User | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
