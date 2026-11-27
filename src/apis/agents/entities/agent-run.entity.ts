import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AgentRunStatus, AgentUsageTotals } from '../../../contracts';
import { User } from '../../users/entities/user.entity';
import { AgentRunEvent } from './agent-run-event.entity';
import { AgentApprovalRequest } from './agent-approval-request.entity';

@Entity({ name: 'agent_runs' })
@Index('IDX_agent_runs_agent_key_created_at', ['agentKey', 'createdAt'])
@Index('IDX_agent_runs_status_created_at', ['status', 'createdAt'])
@Index('IDX_agent_runs_mission_key', ['missionKey'])
@Index('IDX_agent_runs_parent_run_id', ['parentRunId'])
export class AgentRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agent_key', type: 'varchar', length: 64 })
  agentKey: string;

  @Column({
    name: 'workflow_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  workflowId: string | null;

  @Column({
    name: 'mission_key',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  missionKey: string | null;

  @Column({
    name: 'external_evidence_ref',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  externalEvidenceRef: string | null;

  @Column({ name: 'parent_run_id', type: 'uuid', nullable: true })
  parentRunId: string | null;

  @ManyToOne(() => AgentRun, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_run_id' })
  parentRun?: AgentRun | null;

  @Column({ name: 'initiated_by_user_id', type: 'integer', nullable: true })
  initiatedByUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'initiated_by_user_id' })
  initiatedByUser?: User | null;

  @Column({ type: 'varchar', length: 32, default: 'queued' })
  status: AgentRunStatus;

  @Column({
    name: 'input_summary',
    type: 'jsonb',
    default: () => "'{}'",
  })
  inputSummary: Record<string, unknown>;

  @Column({
    name: 'output_summary',
    type: 'jsonb',
    nullable: true,
  })
  outputSummary: Record<string, unknown> | null;

  @Column({
    name: 'terminal_error_category',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  terminalErrorCategory: string | null;

  @Column({
    name: 'usage_totals',
    type: 'jsonb',
    nullable: true,
  })
  usageTotals: AgentUsageTotals | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => AgentRunEvent, (event) => event.run)
  events?: AgentRunEvent[];

  @OneToMany(() => AgentApprovalRequest, (approval) => approval.run)
  approvalRequests?: AgentApprovalRequest[];
}
