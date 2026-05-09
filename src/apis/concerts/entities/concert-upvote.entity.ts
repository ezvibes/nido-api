import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Concert } from './concert.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'concert_upvotes' })
@Unique('UQ_concert_upvotes_concert_user', ['concert', 'user'])
@Index('IDX_concert_upvotes_concert', ['concert'])
@Index('IDX_concert_upvotes_created_at', ['createdAt'])
@Index('IDX_concert_upvotes_concert_created_at', ['concert', 'createdAt'])
export class ConcertUpvote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Concert, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'concert_id' })
  concert: Concert;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
