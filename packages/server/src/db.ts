import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrateSql } from "./migrate";
import * as schema from "./schema";

export type Orm = PgliteDatabase<typeof schema>;

export class Database {
  private constructor(
    readonly pg: PGlite,
    readonly orm: Orm,
  ) {}

  static async open(dataDir: string): Promise<Database> {
    const pg = new PGlite(dataDir);
    await pg.waitReady;
    await pg.exec(migrateSql);
    const orm = drizzle(pg, { schema });
    return new Database(pg, orm);
  }

  async all<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pg.query<T>(sql, params);
    return result.rows;
  }

  async one<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.all<T>(sql, params);
    return rows[0] ?? null;
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await this.pg.query(sql, params);
  }
}
