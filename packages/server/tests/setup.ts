import { db } from '../src/config/database';

afterAll(async () => {
  await db.destroy();
});
