import { Pool } from "pg";

// Reuse the pool across hot-reloads in dev (Next.js module caching)
const globalForPg = globalThis as unknown as { _pgPool: Pool | undefined };

export const pool: Pool =
  globalForPg._pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") globalForPg._pgPool = pool;
