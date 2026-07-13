import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Concert } from './apis/concerts/entities/concert.entity';
import { ConcertUpvote } from './apis/concerts/entities/concert-upvote.entity';
import { User } from './apis/users/entities/user.entity';
import { ConcertUpload } from './ingestion/entities/concert-upload.entity';
import { IngestionJob } from './ingestion/entities/ingestion-job.entity';
import { Venue } from './apis/venues/entities/venue.entity';
import { Band } from './apis/bands/entities/band.entity';
import { ConcertBandLineup } from './apis/concerts/entities/concert-band-lineup.entity';
import { ConcertSet } from './apis/concerts/entities/concert-set.entity';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    User,
    Concert,
    ConcertUpvote,
    ConcertUpload,
    IngestionJob,
    Venue,
    Band,
    ConcertBandLineup,
    ConcertSet,
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
