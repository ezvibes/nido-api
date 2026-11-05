import { MigrationInterface, QueryRunner } from 'typeorm';

interface VenueSeedUpdate {
  id?: string;
  matchName?: string;
  name: string;
  address: string | null;
  city: string;
  citySlug: string;
  region: string;
  regionSlug: string;
  postalCode: string | null;
  capacity: number | null;
  verificationState: 'unverified' | 'verified' | 'canonical' | 'flagged';
}

const VENUE_UPDATES: VenueSeedUpdate[] = [
  {
    matchName: "Cat's Cradle",
    name: "Cat's Cradle",
    address: '300 E Main St',
    city: 'Carrboro',
    citySlug: 'carrboro',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27510',
    capacity: 750,
    verificationState: 'canonical',
  },
  {
    id: 'adb90151-507b-445c-9056-27500818c3a0',
    name: "Cat's Cradle Backroom",
    address: '300 E Main St',
    city: 'Carrboro',
    citySlug: 'carrboro',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27510',
    capacity: 160,
    verificationState: 'canonical',
  },
  {
    id: 'e6efac75-ab36-46fb-a79d-4c3807a083f0',
    name: 'Bowstring Brewyard',
    address: '1930 Wake Forest Rd',
    city: 'Raleigh',
    citySlug: 'raleigh',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27608',
    capacity: 500,
    verificationState: 'canonical',
  },
  {
    id: 'e5e9f41f-d2de-4e34-affa-971c9ac9e89a',
    name: 'Bowstring Brewyard Wilmington',
    address: '1002 N 4th St',
    city: 'Wilmington',
    citySlug: 'wilmington',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28401',
    capacity: 400,
    verificationState: 'verified',
  },
  {
    id: '19e888c5-a777-4174-a506-94c34f38480b',
    name: 'The Pour House Music Hall',
    address: '224 S Blount St',
    city: 'Raleigh',
    citySlug: 'raleigh',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27601',
    capacity: 289,
    verificationState: 'canonical',
  },
  {
    id: 'ad85e015-a8dd-49ff-8d2a-8cf8b6601f9e',
    name: 'Rubies on Five Points',
    address: '347 W Main St',
    city: 'Durham',
    citySlug: 'durham',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27701',
    capacity: 150,
    verificationState: 'canonical',
  },
  {
    matchName: 'Carolina Theatre',
    name: 'Carolina Theatre',
    address: '309 W Morgan St',
    city: 'Durham',
    citySlug: 'durham',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27701',
    capacity: 1040,
    verificationState: 'canonical',
  },
  {
    matchName: 'Haw River Ballroom',
    name: 'Haw River Ballroom',
    address: '1711 Saxapahaw-Bethlehem Church Rd',
    city: 'Saxapahaw',
    citySlug: 'saxapahaw',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27340',
    capacity: 700,
    verificationState: 'canonical',
  },
  {
    matchName: 'Koka Booth Amphitheatre',
    name: 'Koka Booth Amphitheatre',
    address: '8001 Regent Pkwy',
    city: 'Cary',
    citySlug: 'cary',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27518',
    capacity: 7000,
    verificationState: 'canonical',
  },
  {
    matchName: 'Lenovo Center',
    name: 'Lenovo Center',
    address: '1400 Edwards Mill Rd',
    city: 'Raleigh',
    citySlug: 'raleigh',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27607',
    capacity: 19500,
    verificationState: 'canonical',
  },
  {
    matchName: 'Lincoln Theatre',
    name: 'Lincoln Theatre',
    address: '126 E Cabarrus St',
    city: 'Raleigh',
    citySlug: 'raleigh',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27601',
    capacity: 825,
    verificationState: 'canonical',
  },
  {
    matchName: 'Motorco Music Hall',
    name: 'Motorco Music Hall',
    address: '723 Rigsbee Ave',
    city: 'Durham',
    citySlug: 'durham',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27701',
    capacity: 450,
    verificationState: 'canonical',
  },
  {
    matchName: 'Neighborhood Theatre',
    name: 'Neighborhood Theatre',
    address: '511 E 36th St',
    city: 'Charlotte',
    citySlug: 'charlotte',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28205',
    capacity: 956,
    verificationState: 'canonical',
  },
  {
    matchName: 'Neptunes Parlour',
    name: 'Neptunes Parlour',
    address: '14 W Martin St',
    city: 'Raleigh',
    citySlug: 'raleigh',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27601',
    capacity: 100,
    verificationState: 'canonical',
  },
  {
    matchName: 'Red Hat Amphiteatre',
    name: 'Red Hat Amphitheater',
    address: '500 S McDowell St',
    city: 'Raleigh',
    citySlug: 'raleigh',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27601',
    capacity: 5990,
    verificationState: 'canonical',
  },
  {
    matchName: 'The Fruit',
    name: 'The Fruit',
    address: '305 S Dillard St',
    city: 'Durham',
    citySlug: 'durham',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27701',
    capacity: 800,
    verificationState: 'canonical',
  },
  {
    matchName: 'The Rialto',
    name: 'The Rialto',
    address: '1620 Glenwood Ave',
    city: 'Raleigh',
    citySlug: 'raleigh',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27608',
    capacity: 450,
    verificationState: 'canonical',
  },
  {
    matchName: 'The Ritz',
    name: 'The Ritz',
    address: '2820 Industrial Dr',
    city: 'Raleigh',
    citySlug: 'raleigh',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27609',
    capacity: 1400,
    verificationState: 'canonical',
  },
  {
    matchName: 'The Underground',
    name: 'The Underground',
    address: '820 Hamilton St',
    city: 'Charlotte',
    citySlug: 'charlotte',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28206',
    capacity: 750,
    verificationState: 'canonical',
  },
  {
    matchName: 'Greenfield Lake Amphitheater',
    name: 'Greenfield Lake Amphitheater',
    address: '1941 Amphitheatre Dr',
    city: 'Wilmington',
    citySlug: 'wilmington',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28401',
    capacity: 1200,
    verificationState: 'canonical',
  },
  {
    id: '7b120fec-564f-46f2-a72a-5307d98f4b92',
    name: "Harrah's Cherokee Center - Asheville",
    address: '87 Haywood St',
    city: 'Asheville',
    citySlug: 'asheville',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28801',
    capacity: 7600,
    verificationState: 'verified',
  },
  {
    id: '47cac33f-8671-4738-ba06-4f560be64627',
    name: 'Center City Park - Downtown Greensboro',
    address: '200 N Elm St',
    city: 'Greensboro',
    citySlug: 'greensboro',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27401',
    capacity: 5000,
    verificationState: 'verified',
  },
  {
    id: 'aec37b18-ce80-4953-b2f3-a1287660dcd1',
    name: 'Downtown Lansing Historic District',
    address: '114 S Main St',
    city: 'Lansing',
    citySlug: 'lansing',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28643',
    capacity: 500,
    verificationState: 'verified',
  },
  {
    matchName: 'Asheville Music Hall',
    name: 'Asheville Music Hall',
    address: '31 Patton Ave',
    city: 'Asheville',
    citySlug: 'asheville',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28801',
    capacity: 360,
    verificationState: 'verified',
  },
  {
    matchName: "Betsy's Barn",
    name: "Betsy's Barn",
    address: "1324 Betsy's Gap Rd",
    city: 'Todd',
    citySlug: 'todd',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28684',
    capacity: 100,
    verificationState: 'verified',
  },
  {
    matchName: 'Downtown Hillsborough',
    name: 'Downtown Hillsborough',
    address: '104 E King St',
    city: 'Hillsborough',
    citySlug: 'hillsborough',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27278',
    capacity: 500,
    verificationState: 'verified',
  },
  {
    matchName: 'Eastside Music Venue',
    name: 'Eastside Music Venue',
    address: '1005 E Main St',
    city: 'Cary',
    citySlug: 'cary',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27511',
    capacity: 150,
    verificationState: 'verified',
  },
  {
    matchName: 'Eno River State Park',
    name: 'Eno River State Park',
    address: '6101 Cole Mill Rd',
    city: 'Durham',
    citySlug: 'durham',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27705',
    capacity: 2000,
    verificationState: 'verified',
  },
  {
    matchName: 'Jive Hive',
    name: 'Jive Hive',
    address: '211 Monroe St',
    city: 'Carthage',
    citySlug: 'carthage',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28327',
    capacity: 100,
    verificationState: 'verified',
  },
  {
    matchName: 'Lost Province Center for Cultural Arts',
    name: 'Lost Province Center for Cultural Arts',
    address: '145 Main St',
    city: 'Lansing',
    citySlug: 'lansing',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28643',
    capacity: 250,
    verificationState: 'verified',
  },
  {
    matchName: 'Shakori Hills GrassRoots Festival of Music & Dance',
    name: 'Shakori Hills GrassRoots Festival of Music & Dance',
    address: '1439 Henderson Tanyard Rd',
    city: 'Pittsboro',
    citySlug: 'pittsboro',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27312',
    capacity: 4000,
    verificationState: 'verified',
  },
  {
    matchName: 'Sierra Nevada',
    name: 'Sierra Nevada Brewing Co.',
    address: '100 Sierra Nevada Way',
    city: 'Mills River',
    citySlug: 'mills-river',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28732',
    capacity: 1200,
    verificationState: 'verified',
  },
  {
    matchName: 'State Theatre',
    name: 'State Theatre',
    address: '110 W 5th St',
    city: 'Greenville',
    citySlug: 'greenville',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27858',
    capacity: 800,
    verificationState: 'verified',
  },
  {
    matchName: 'Switchyards Raleigh',
    name: 'Switchyards Raleigh',
    address: '209 Fayetteville St',
    city: 'Raleigh',
    citySlug: 'raleigh',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27601',
    capacity: 150,
    verificationState: 'verified',
  },
  {
    matchName: 'The Music Yard at SouthBound',
    name: 'The Music Yard at SouthBound',
    address: '2433 South Blvd',
    city: 'Charlotte',
    citySlug: 'charlotte',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28203',
    capacity: 350,
    verificationState: 'verified',
  },
  {
    matchName: 'The Sunrise Theater',
    name: 'The Sunrise Theater',
    address: '250 NW Broad St',
    city: 'Southern Pines',
    citySlug: 'southern-pines',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28387',
    capacity: 495,
    verificationState: 'verified',
  },
  {
    matchName: 'Van Hoy Farms',
    name: 'Van Hoy Farms',
    address: '742 Jericho Rd',
    city: 'Harmony',
    citySlug: 'harmony',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '28634',
    capacity: 5000,
    verificationState: 'verified',
  },
  {
    matchName: 'Venue TBD',
    name: 'Venue TBD',
    address: null,
    city: 'Durham',
    citySlug: 'durham',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: null,
    capacity: null,
    verificationState: 'unverified',
  },
];

export class ModernizeVenuesAndDeduplicateCatalog1760000019000
  implements MigrationInterface
{
  name = 'ModernizeVenuesAndDeduplicateCatalog1760000019000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Deduplicate Cat's Cradle (straight vs curly apostrophe)
    // Find canonical straight apostrophe Cat's Cradle
    const straightCatsCradle = await queryRunner.query(
      `SELECT "id" FROM "venues" WHERE "name" = 'Cat''s Cradle' LIMIT 1`,
    );
    if (straightCatsCradle.length > 0) {
      const canonicalId = straightCatsCradle[0].id;
      // Re-link concerts and uploads from curly apostrophe to straight apostrophe
      await queryRunner.query(
        `UPDATE "concerts" SET "venue_id" = $1 WHERE "venue_id" IN (SELECT "id" FROM "venues" WHERE "name" = 'Cat’s Cradle' AND "id" != $1)`,
        [canonicalId],
      );
      await queryRunner.query(
        `UPDATE "concert_uploads" SET "venue_id" = $1 WHERE "venue_id" IN (SELECT "id" FROM "venues" WHERE "name" = 'Cat’s Cradle' AND "id" != $1)`,
        [canonicalId],
      );
      await queryRunner.query(
        `DELETE FROM "venues" WHERE "name" = 'Cat’s Cradle' AND "id" != $1`,
        [canonicalId],
      );
    }

    // 2. Deduplicate Bowstring Brewyard Raleigh
    const bowstringRaleigh = await queryRunner.query(
      `SELECT "id" FROM "venues" WHERE "id" = 'e6efac75-ab36-46fb-a79d-4c3807a083f0' LIMIT 1`,
    );
    if (bowstringRaleigh.length > 0) {
      const canonicalId = bowstringRaleigh[0].id;
      const dupIds = [
        '2102c0a1-589d-4796-8b77-fcf6dd7d9c37',
        '063550ea-30a7-4ae3-8fb6-28cc39ef5bdd',
      ];
      for (const dupId of dupIds) {
        await queryRunner.query(
          `UPDATE "concerts" SET "venue_id" = $1 WHERE "venue_id" = $2`,
          [canonicalId, dupId],
        );
        await queryRunner.query(
          `UPDATE "concert_uploads" SET "venue_id" = $1 WHERE "venue_id" = $2`,
          [canonicalId, dupId],
        );
        await queryRunner.query(`DELETE FROM "venues" WHERE "id" = $1`, [dupId]);
      }
    }

    // 3. Deduplicate The Pour House Music Hall
    const pourHouseCanonical = await queryRunner.query(
      `SELECT "id" FROM "venues" WHERE "id" = '19e888c5-a777-4174-a506-94c34f38480b' LIMIT 1`,
    );
    if (pourHouseCanonical.length > 0) {
      const canonicalId = pourHouseCanonical[0].id;
      const dupId = 'facc1f13-2bb2-4deb-883c-9b391298f7fa';
      await queryRunner.query(
        `UPDATE "concerts" SET "venue_id" = $1 WHERE "venue_id" = $2`,
        [canonicalId, dupId],
      );
      await queryRunner.query(
        `UPDATE "concert_uploads" SET "venue_id" = $1 WHERE "venue_id" = $2`,
        [canonicalId, dupId],
      );
      await queryRunner.query(`DELETE FROM "venues" WHERE "id" = $1`, [dupId]);
    }

    // 4. Resolve Rubies / Pinhook joint compound venue into separate rooms
    const rubiesCanonical = await queryRunner.query(
      `SELECT "id" FROM "venues" WHERE "id" = 'ad85e015-a8dd-49ff-8d2a-8cf8b6601f9e' LIMIT 1`,
    );
    const rubiesPinhookDupId = 'e03bf2f6-804d-4d12-a7c3-39b43e87d238';
    if (rubiesCanonical.length > 0) {
      const canonicalRubiesId = rubiesCanonical[0].id;
      await queryRunner.query(
        `UPDATE "concerts" SET "venue_id" = $1 WHERE "venue_id" = $2`,
        [canonicalRubiesId, rubiesPinhookDupId],
      );
      await queryRunner.query(
        `UPDATE "concert_uploads" SET "venue_id" = $1 WHERE "venue_id" = $2`,
        [canonicalRubiesId, rubiesPinhookDupId],
      );
      await queryRunner.query(`DELETE FROM "venues" WHERE "id" = $1`, [
        rubiesPinhookDupId,
      ]);
    }

    // 5. Ensure The Pinhook exists as its own separate venue in Durham
    const existingPinhook = await queryRunner.query(
      `SELECT "id" FROM "venues" WHERE "name" ILIKE '%pinhook%' LIMIT 1`,
    );
    if (existingPinhook.length === 0) {
      await queryRunner.query(
        `
        INSERT INTO "venues" (
          "name", "address", "city", "city_slug", "region", "region_slug",
          "postal_code", "capacity", "verification_state"
        ) VALUES (
          'The Pinhook', '117 W Main St', 'Durham', 'durham', 'North Carolina', 'nc',
          '27701', 250, 'canonical'
        )
      `,
      );
    }

    // 6. Ensure The Orange Peel, The Evening Muse, and Bourgie Nights exist
    const ensureVenues = [
      {
        name: 'The Orange Peel',
        address: '101 Biltmore Ave',
        city: 'Asheville',
        citySlug: 'asheville',
        region: 'North Carolina',
        regionSlug: 'nc',
        postalCode: '28801',
        capacity: 1050,
        verificationState: 'canonical',
      },
      {
        name: 'The Evening Muse',
        address: '3227 N Davidson St',
        city: 'Charlotte',
        citySlug: 'charlotte',
        region: 'North Carolina',
        regionSlug: 'nc',
        postalCode: '28205',
        capacity: 120,
        verificationState: 'canonical',
      },
      {
        name: 'Bourgie Nights',
        address: '127 N Front St',
        city: 'Wilmington',
        citySlug: 'wilmington',
        region: 'North Carolina',
        regionSlug: 'nc',
        postalCode: '28401',
        capacity: 125,
        verificationState: 'verified',
      },
    ];

    for (const v of ensureVenues) {
      const found = await queryRunner.query(
        `SELECT "id" FROM "venues" WHERE "name" = $1 LIMIT 1`,
        [v.name],
      );
      if (found.length === 0) {
        await queryRunner.query(
          `
          INSERT INTO "venues" (
            "name", "address", "city", "city_slug", "region", "region_slug",
            "postal_code", "capacity", "verification_state"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
          [
            v.name,
            v.address,
            v.city,
            v.citySlug,
            v.region,
            v.regionSlug,
            v.postalCode,
            v.capacity,
            v.verificationState,
          ],
        );
      }
    }

    // 7. Update all existing catalog venues with street address, postal code, capacity, and status
    for (const update of VENUE_UPDATES) {
      if (update.id) {
        await queryRunner.query(
          `
          UPDATE "venues"
          SET
            "name" = $1,
            "address" = $2,
            "city" = $3,
            "city_slug" = $4,
            "region" = $5,
            "region_slug" = $6,
            "postal_code" = $7,
            "capacity" = $8,
            "verification_state" = $9,
            "updated_at" = now()
          WHERE "id" = $10
        `,
          [
            update.name,
            update.address,
            update.city,
            update.citySlug,
            update.region,
            update.regionSlug,
            update.postalCode,
            update.capacity,
            update.verificationState,
            update.id,
          ],
        );
      } else if (update.matchName) {
        await queryRunner.query(
          `
          UPDATE "venues"
          SET
            "name" = $1,
            "address" = $2,
            "city" = $3,
            "city_slug" = $4,
            "region" = $5,
            "region_slug" = $6,
            "postal_code" = $7,
            "capacity" = $8,
            "verification_state" = $9,
            "updated_at" = now()
          WHERE "name" = $10
        `,
          [
            update.name,
            update.address,
            update.city,
            update.citySlug,
            update.region,
            update.regionSlug,
            update.postalCode,
            update.capacity,
            update.verificationState,
            update.matchName,
          ],
        );
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive rollback: venue addresses remain intact.
  }
}
