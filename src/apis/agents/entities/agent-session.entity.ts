import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'agent_sessions' })
export class AgentSession {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'app_name' })
  appName: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column('jsonb', { default: {} })
  state: Record<string, unknown>;

  @Column('jsonb', { default: [] })
  events: any[];

  @Column({ name: 'last_update_time', type: 'bigint' })
  lastUpdateTime: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
