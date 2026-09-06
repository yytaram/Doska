import 'dotenv/config';

import { getConfig } from '../config.js';
import { createDatabase } from '../database.js';

async function checkDatabase() {
  const config = getConfig();
  const database = createDatabase(config.DATABASE_URL);

  try {
    await database.ping();
    console.log('Database health check passed.');
  } finally {
    await database.close();
  }
}

checkDatabase().catch((error: unknown) => {
  console.error('Database health check failed.');
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
});
