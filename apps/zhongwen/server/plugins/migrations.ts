import { resolve } from "path";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db } from "../database";

export default defineNitroPlugin(async () => {
  if (!process.env.DB_MIGRATE) {
    return;
  }
  await migrate(db, { migrationsFolder: resolve(process.cwd(), "migrations") });
});
