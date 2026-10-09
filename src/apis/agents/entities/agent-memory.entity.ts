import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'agent_memories' })
@Index(['scope', 'key'])
export class AgentMemory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  scope: string; // e.g. GLOBAL, OPERATOR, VENUE

  @Column()
  key: string;

  @Column('jsonb')
  value: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
