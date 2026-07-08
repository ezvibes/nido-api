import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Venue } from '../apis/venues/entities/venue.entity';

dotenv.config();

const sampleNcVenues = [
  {
    name: 'The Evening Muse',
    address: '3227 N Davidson St, Charlotte, NC 28205',
    city: 'Charlotte',
    citySlug: 'charlotte',
    region: 'North Carolina',
    regionSlug: 'nc',
    lat: 35.24729,
    lng: -80.80559,
  },
  {
    name: 'Neighborhood Theatre',
    address: '511 E 36th St, Charlotte, NC 28205',
    city: 'Charlotte',
    citySlug: 'charlotte',
    region: 'North Carolina',
    regionSlug: 'nc',
    lat: 35.24623,
    lng: -80.80612,
  },
  {
    name: 'Bourgie Nights',
    address: '127 N Front St, Wilmington, NC 28401',
    city: 'Wilmington',
    citySlug: 'wilmington',
    region: 'North Carolina',
    regionSlug: 'nc',
    lat: 34.23612,
    lng: -77.94911,
  },
  {
    name: 'Greenfield Lake Amphitheater',
    address: '1941 Amphitheatre Dr, Wilmington, NC 28401',
    city: 'Wilmington',
    citySlug: 'wilmington',
    region: 'North Carolina',
    regionSlug: 'nc',
    lat: 34.21208,
    lng: -77.93529,
  },
  {
    name: "Cat's Cradle",
    address: '300 E Main St, Carrboro, NC 27510',
    city: 'Carrboro',
    citySlug: 'carrboro',
    region: 'North Carolina',
    regionSlug: 'nc',
    lat: 35.91039,
    lng: -79.07095,
  },
  {
    name: 'The Orange Peel',
    address: '101 Biltmore Ave, Asheville, NC 28801',
    city: 'Asheville',
    citySlug: 'asheville',
    region: 'North Carolina',
    regionSlug: 'nc',
    lat: 35.59124,
    lng: -82.55102,
  },
  {
    name: 'Lincoln Theatre',
    address: '126 E Cabarrus St, Raleigh, NC 27601',
    city: 'Raleigh',
    citySlug: 'raleigh',
    region: 'North Carolina',
    regionSlug: 'nc',
    lat: 35.77459,
    lng: -78.63852,
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
    entities: [Venue],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Database initialized successfully.');

  try {
    const venueRepository = dataSource.getRepository(Venue);

    for (const seed of sampleNcVenues) {
      const existing = await venueRepository.findOne({
        where: { name: seed.name, citySlug: seed.citySlug },
      });

      if (existing) {
        console.log(`Venue "${seed.name}" in ${seed.city} already exists. Skipping.`);
        continue;
      }

      const venue = venueRepository.create(seed);
      await venueRepository.save(venue);
      console.log(`Seeded venue: "${seed.name}" in ${seed.city}.`);
    }

    console.log('Seeding complete!');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await dataSource.destroy();
  }
}

main();
