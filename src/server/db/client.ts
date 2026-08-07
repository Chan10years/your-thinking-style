import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getAppEdition } from "../../config/edition";

type Environment = Record<string, string | undefined>;

type Database = ReturnType<typeof drizzle>;

let pool: Pool | undefined;
let database: Database | undefined;

export function getDatabase(env: Environment = process.env): Database {
  if (getAppEdition(env) !== "hosted") {
    throw new Error("DATABASE_DISABLED");
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in hosted mode");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  if (!database) {
    database = drizzle({ client: pool });
  }

  return database;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    database = undefined;
  }
}
