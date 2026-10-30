// One-time copy of the Supabase data into MySQL.
//
//   node --env-file=.env.local scripts/migrate-supabase-to-mysql.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL.
// Run mysql/schema.sql first. Safe to re-run: rows are upserted by primary key
// and nothing is deleted. Supabase stores passwords hashed in its own auth
// schema, so they cannot be copied; set new ones with scripts/set-password.mjs.

import mysql from "mysql2/promise";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !serviceKey || !databaseUrl) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL first.");
  process.exit(1);
}

// Parents before children so foreign keys resolve.
const tables = [
  "users",
  "room_categories",
  "rooms",
  "room_images",
  "amenities",
  "room_amenities",
  "promos",
  "bookings",
  "booking_blackout_dates",
  "payments",
  "reviews",
  "resort_settings",
  "auto_reply_knowledge",
  "site_footer_settings",
];

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

async function fetchTable(table) {
  const rows = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&offset=${offset}&limit=${pageSize}`, { headers });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);

    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function fetchDisabledUserIds() {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers });
  if (!response.ok) return new Set();

  const { users = [] } = await response.json();
  return new Set(
    users.filter((user) => user.banned_until && Date.parse(user.banned_until) > Date.now()).map((user) => user.id),
  );
}

const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function toMysqlValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && timestampPattern.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 23).replace("T", " ");
  }
  return value;
}

const connection = await mysql.createConnection(databaseUrl);
await connection.query("SET time_zone = '+00:00'");

const disabledUserIds = await fetchDisabledUserIds();

for (const table of tables) {
  const rows = await fetchTable(table);
  if (rows === null) {
    console.log(`${table.padEnd(24)} not in Supabase, kept MySQL defaults`);
    continue;
  }

  const [columnRows] = await connection.query(`show columns from \`${table}\``);
  const mysqlColumns = new Set(columnRows.map((column) => column.Field));
  let copied = 0;

  for (const source of rows) {
    const row = { ...source };
    if (table === "resort_settings") row.id = 1;
    if (table === "users") row.disabled = disabledUserIds.has(row.id);

    const columns = Object.keys(row).filter((column) => mysqlColumns.has(column));
    const updates = columns.map((column) => `\`${column}\` = values(\`${column}\`)`).join(", ");

    await connection.query(
      `insert into \`${table}\` (${columns.map((column) => `\`${column}\``).join(", ")})
       values (${columns.map(() => "?").join(", ")})
       on duplicate key update ${updates}`,
      columns.map((column) => toMysqlValue(row[column])),
    );
    copied += 1;
  }

  console.log(`${table.padEnd(24)} ${copied} row(s)`);
}

await connection.end();
console.log("\nDone. Set staff passwords with: node --env-file=.env.local scripts/set-password.mjs <email> <password>");
