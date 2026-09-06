import { Pool } from 'pg';

export interface Database {
  close(): Promise<void>;
  ping(): Promise<void>;
}

export function createDatabase(connectionString: string): Database {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 3_000,
    max: 10,
  });

  return {
    async close() {
      await pool.end();
    },
    async ping() {
      await pool.query('SELECT 1');
    },
  };
}
