import { assertTestDatabase, createFixture, journeys } from './fixtures';
export default async function setup() {
  assertTestDatabase();
  const { db } = await import('../../server/src/config/database');
  try {
    for (const language of ['en', 'ar'] as const) {
      for (const journey of journeys) {
        const data = await createFixture(language, journey);
        process.env[`DAILY_${language}_${journey}`] = JSON.stringify(data);
        if (journey === 'checkout') process.env[`E2E_FIXTURE_${language}`] = JSON.stringify(data);
      }
    }
  } finally {
    await db.destroy();
  }
}
