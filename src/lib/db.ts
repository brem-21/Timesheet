import { Pool } from "pg";

// Reuse the pool across module reloads in both dev and production
const globalForPg = globalThis as unknown as { _pgPool: Pool | undefined };

if (!globalForPg._pgPool) {
  globalForPg._pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
}

export const pool: Pool = globalForPg._pgPool;
