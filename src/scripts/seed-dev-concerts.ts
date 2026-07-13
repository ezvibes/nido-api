import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import * as dotenv from 'dotenv';
import { Concert } from '../apis/concerts/entities/concert.entity';
import { ConcertUpvote } from '../apis/concerts/entities/concert-upvote.entity';
import { User } from '../apis/users/entities/user.entity';
import { Venue } from '../apis/venues/entities/venue.entity';
import { Band } from '../apis/bands/entities/band.entity';
import { ConcertBandLineup, PerformanceRole } from '../apis/concerts/entities/concert-band-lineup.entity';
import { ConcertSet } from '../apis/concerts/entities/concert-set.entity';

dotenv.config();

const devUser = {
  uid: process.env.DEV_SEED_USER_UID || 'bruno-user',
  email: process.env.DEV_SEED_USER_EMAIL || 'bruno@example.local',
  name: process.env.DEV_SEED_USER_NAME || 'Bruno User',
};

const seedMarker = '[dev-seed]';

const seededConcerts = [
  {
    title: 'Nido Rooftop Sessions',
    genre: 'Indie',
    startsAt: '2026-06-15T20:00:00.000Z',
    venues: [{ name: 'Skyline Loft', city: 'Brooklyn', state: 'NY' }],
    artists: [
      { name: 'The Signal Lights', role: 'Headliner', genre: 'Indie' },
    ],
    description: `${seedMarker} Warm rooftop set for testing the local events feed.`,
    isTopPick: true,
    topPickScore: 0.94,
    upvotes: 5,
  },
  {
    title: 'Warehouse Bass Night',
    genre: 'Electronic',
    startsAt: '2026-06-18T02:00:00.000Z',
    venues: [{ name: 'The Foundry', city: 'Queens', state: 'NY' }],
    artists: [
      { name: 'Night Circuit', role: 'DJ', genre: 'Electronic' },
      { name: 'Low Bloom', role: 'Support', genre: 'Electronic' },
    ],
    description: `${seedMarker} Late-night electronic event with strong trending weight.`,
    isTopPick: true,
    topPickScore: 0.88,
    upvotes: 8,
  },
  {
    title: 'Latin Jazz Patio',
    genre: 'Jazz',
    startsAt: '2026-06-20T23:30:00.000Z',
    venues: [{ name: 'Crescent Yard', city: 'Manhattan', state: 'NY' }],
    artists: [{ name: 'Marisol Vega Quartet', role: 'Headliner', genre: 'Jazz' }],
    description: `${seedMarker} Outdoor latin jazz concert for venue and artist rendering.`,
    isTopPick: false,
    topPickScore: null,
    upvotes: 3,
  },
  {
    title: 'Neighborhood Hip Hop Showcase',
    genre: 'Hip Hop',
    startsAt: '2026-06-23T01:00:00.000Z',
    venues: [{ name: 'Blockhouse', city: 'Brooklyn', state: 'NY' }],
    artists: [
      { name: 'Eastline', role: 'Headliner', genre: 'Hip Hop' },
      { name: 'DJ Table One', role: 'DJ', genre: 'Hip Hop' },
    ],
    description: `${seedMarker} Multi-artist showcase to exercise list density.`,
    isTopPick: false,
    topPickScore: null,
    upvotes: 1,
  },
  {
    title: 'Sunday Country Brunch',
    genre: 'Country',
    startsAt: '2026-06-28T16:00:00.000Z',
    venues: [{ name: 'Juniper Hall', city: 'Jersey City', state: 'NJ' }],
    artists: [{ name: 'Mason Creek', role: 'Headliner', genre: 'Country' }],
    description: `${seedMarker} Daytime show for date and timezone checks.`,
    isTopPick: false,
    topPickScore: null,
    upvotes: 2,
  },
];

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [User, Concert, ConcertUpvote, Venue, Band, ConcertBandLineup, ConcertSet],
    synchronize: false,
  });

  await dataSource.initialize();

  try {
    const userRepository = dataSource.getRepository(User);
    const concertRepository = dataSource.getRepository(Concert);
    const upvoteRepository = dataSource.getRepository(ConcertUpvote);
    const venueRepository = dataSource.getRepository(Venue);
    const bandRepository = dataSource.getRepository(Band);

    const owner = await findOrCreateUser(userRepository, devUser);
    const audience = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        findOrCreateUser(userRepository, {
          uid: `dev-audience-${index + 1}`,
          email: `dev-audience-${index + 1}@example.local`,
          name: `Dev Audience ${index + 1}`,
        }),
      ),
    );

    for (const seed of seededConcerts) {
      const concert = await upsertConcert(
        concertRepository,
        venueRepository,
        bandRepository,
        owner,
        seed,
      );
      await seedUpvotes(upvoteRepository, concert, owner, audience, seed.upvotes);
    }

    const count = await concertRepository.count({ where: { owner: { id: owner.id } } });
    console.log(`Seeded ${seededConcerts.length} dev concerts for ${owner.email}.`);
    console.log(`Owner now has ${count} concerts.`);
    console.log('Use these Bruno headers:');
    console.log(`x-dev-user-uid: ${owner.uid}`);
    console.log(`x-dev-user-email: ${owner.email}`);
    console.log(`x-dev-user-name: ${owner.name || devUser.name}`);
  } finally {
    await dataSource.destroy();
  }
}

async function findOrCreateUser(
  userRepository: Repository<User>,
  user: { uid: string; email: string; name: string },
) {
  const existing = await userRepository.findOne({ where: { uid: user.uid } });
  if (existing) {
    existing.email = user.email;
    existing.name = user.name;
    return userRepository.save(existing);
  }

  return userRepository.save(
    userRepository.create({
      uid: user.uid,
      email: user.email,
      name: user.name,
    }),
  );
}

async function upsertConcert(
  concertRepository: Repository<Concert>,
  venueRepository: Repository<Venue>,
  bandRepository: Repository<Band>,
  owner: User,
  seed: (typeof seededConcerts)[number],
) {
  const existing = await concertRepository.findOne({
    where: { owner: { id: owner.id }, title: seed.title },
  });
  const concert = existing || concertRepository.create({ owner });

  const firstVenue = seed.venues[0];
  const slugify = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '');

  const citySlug = slugify(firstVenue.city);
  let venue = await venueRepository.findOne({
    where: { name: firstVenue.name, citySlug },
  });
  if (!venue) {
    venue = await venueRepository.save(
      venueRepository.create({
        name: firstVenue.name,
        city: firstVenue.city,
        citySlug,
        region: firstVenue.state,
        regionSlug: slugify(firstVenue.state),
      }),
    );
  }

  if (concert.id) {
    await concertRepository.manager.delete(ConcertBandLineup, { concertId: concert.id });
    await concertRepository.manager.delete(ConcertSet, { concertId: concert.id });
  }

  const lineupConnections: ConcertBandLineup[] = [];
  const setTimes: ConcertSet[] = [];

  let index = 0;
  for (const seedBand of seed.artists) {
    const slug = slugify(seedBand.name);
    let band = await bandRepository.findOne({ where: { slug } });
    if (!band) {
      band = await bandRepository.save(
        bandRepository.create({
          name: seedBand.name,
          slug,
          genres: [seedBand.genre.toLowerCase()],
          socials: {
            spotify: `https://open.spotify.com/artist/${slug}`,
            instagram: `https://instagram.com/${slug}`,
          },
        }),
      );
    }

    const cbl = new ConcertBandLineup();
    if (concert.id) cbl.concertId = concert.id;
    cbl.bandId = band.id;
    cbl.band = band;
    cbl.performanceRole = index === 0 ? PerformanceRole.HEADLINER : PerformanceRole.SUPPORT;
    cbl.performanceOrder = index;
    lineupConnections.push(cbl);

    // Create a set time for each performer
    const cs = new ConcertSet();
    if (concert.id) cs.concertId = concert.id;
    cs.bandId = band.id;
    cs.band = band;
    cs.stageName = 'Main Stage';
    // Offset each set by 1 hour
    const setStart = new Date(seed.startsAt);
    setStart.setHours(setStart.getHours() + index);
    const setEnd = new Date(setStart);
    setEnd.setHours(setEnd.getHours() + 1);
    cs.startsAt = setStart;
    cs.endsAt = setEnd;
    setTimes.push(cs);

    index++;
  }

  concert.owner = owner;
  concert.title = seed.title;
  concert.genre = seed.genre;
  concert.startsAt = new Date(seed.startsAt);
  concert.endsAt = null;
  concert.venue = venue;
  concert.lineup = lineupConnections;
  concert.sets = setTimes;
  concert.description = seed.description;
  concert.isTopPick = seed.isTopPick;
  concert.topPickScore = seed.topPickScore;
  concert.topPickRefreshedAt = seed.isTopPick ? new Date() : null;

  return concertRepository.save(concert);
}

async function seedUpvotes(
  upvoteRepository: Repository<ConcertUpvote>,
  concert: Concert,
  owner: User,
  audience: User[],
  upvoteCount: number,
) {
  const voters = [owner, ...audience].slice(0, upvoteCount);
  for (const voter of voters) {
    await upvoteRepository
      .createQueryBuilder()
      .insert()
      .into(ConcertUpvote)
      .values({ concert: { id: concert.id }, user: { id: voter.id } })
      .orIgnore()
      .execute();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
