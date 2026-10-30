import "server-only";

import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from "mysql2/promise";

type Queryable = Pool | PoolConnection;
export type DbRow = Record<string, unknown>;

const globalForDb = globalThis as unknown as { bolihonDbPool?: Pool };

export function hasDatabaseEnv() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * One pool per server process. Dev hot reloads re-evaluate this module, so the
 * pool is parked on globalThis to avoid leaking a new pool on every edit.
 */
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");

  if (!globalForDb.bolihonDbPool) {
    const pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      connectionLimit: 10,
      timezone: "Z",
      decimalNumbers: true,
      // Match the shapes the app got from Supabase: DATE as "YYYY-MM-DD" and
      // timestamps as ISO strings. Timestamps are stored in UTC.
      typeCast(field, next) {
        if (field.type === "DATE") return field.string();
        if (field.type === "DATETIME" || field.type === "TIMESTAMP") {
          const value = field.string();
          return value ? new Date(`${value.replace(" ", "T")}Z`).toISOString() : null;
        }
        return next();
      },
    });

    pool.pool.on("connection", (connection) => {
      connection.query("SET time_zone = '+00:00'");
    });

    globalForDb.bolihonDbPool = pool;
  }

  return globalForDb.bolihonDbPool;
}

export async function query<T extends DbRow = DbRow>(sql: string, params: unknown[] = [], db: Queryable = getPool()) {
  const [rows] = await db.query(sql, params);
  return rows as T[];
}

export async function queryOne<T extends DbRow = DbRow>(sql: string, params: unknown[] = [], db: Queryable = getPool()) {
  const rows = await query<T>(sql, params, db);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: unknown[] = [], db: Queryable = getPool()) {
  const [result] = await db.query(sql, params);
  return result as ResultSetHeader;
}

export async function transaction<T>(work: (connection: PoolConnection) => Promise<T>) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Builds "col = ?, col2 = ?" for an UPDATE from a plain object. */
export function toSetClause(values: Record<string, unknown>) {
  const columns = Object.keys(values);
  return {
    sql: columns.map((column) => `\`${column}\` = ?`).join(", "),
    params: columns.map((column) => toDbValue(values[column])),
  };
}

/** Builds the column list and placeholders for an INSERT from a plain object. */
export function toInsertClause(values: Record<string, unknown>) {
  const columns = Object.keys(values);
  return {
    columns: columns.map((column) => `\`${column}\``).join(", "),
    placeholders: columns.map(() => "?").join(", "),
    params: columns.map((column) => toDbValue(values[column])),
  };
}

/** Arrays and objects go into JSON text columns; ISO timestamps become UTC DATETIME. */
export function toDbValue(value: unknown) {
  if (Array.isArray(value) || (value && typeof value === "object" && !(value instanceof Date))) {
    return JSON.stringify(value);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)) {
    return value.replace("T", " ").replace("Z", "");
  }
  return value;
}

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function toBoolean(value: unknown) {
  return value === true || value === 1 || value === "1";
}

export function isMissingTableError(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "ER_NO_SUCH_TABLE");
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
