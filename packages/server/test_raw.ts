import { db } from './src/config/database';

async function run() {
  const res = await db.raw('SELECT 1 as result');
  console.log(res.rows ? 'Object with rows: ' + JSON.stringify(res.rows) : 'Array: ' + JSON.stringify(res));
  process.exit(0);
}
run();
