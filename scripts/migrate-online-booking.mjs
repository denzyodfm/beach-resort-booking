// Adds the columns used by online booking and the front desk: payment
// deadline, reference, invoice number and check-in time on each booking, and
// the resort-wide fees, payment instructions and invoice counter. Safe to run
// more than once.
//
//   node --env-file=.env.local scripts/migrate-online-booking.mjs

import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const columns = [
  ["bookings", "payment_deadline", "datetime(3) null after payment_status"],
  ["bookings", "payment_reference", "varchar(100) null after payment_deadline"],
  ["resort_settings", "reservation_fee_amount", "decimal(10, 2) not null default 0"],
  ["resort_settings", "premium_fee_amount", "decimal(10, 2) not null default 0"],
  ["resort_settings", "internet_fee_amount", "decimal(10, 2) not null default 0"],
  ["resort_settings", "payment_instructions", "text null"],
  // Front desk: per-person entrance fee, sales invoices and check-in.
  ["resort_settings", "entrance_fee_amount", "decimal(10, 2) not null default 0"],
  ["resort_settings", "last_invoice_number", "int not null default 0"],
  // Discounted entrance rates: null = same as the regular rate.
  ["resort_settings", "entrance_fee_child_amount", "decimal(10, 2) null"],
  ["resort_settings", "entrance_fee_senior_amount", "decimal(10, 2) null"],
  ["resort_settings", "entrance_fee_note", "varchar(300) null"],
  ["bookings", "invoice_number", "varchar(30) null after payment_reference"],
  ["bookings", "checked_in_at", "datetime(3) null after invoice_number"],
];

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [[{ db }]] = await connection.query("select database() as db");

for (const [table, column, definition] of columns) {
  const [existing] = await connection.query(
    "select 1 from information_schema.columns where table_schema = ? and table_name = ? and column_name = ?",
    [db, table, column],
  );
  if (existing.length) {
    console.log(`${table}.${column} already exists`);
    continue;
  }
  await connection.query(`alter table \`${table}\` add column \`${column}\` ${definition}`);
  console.log(`Added ${table}.${column}`);
}

const [invoiceIndex] = await connection.query(
  "select 1 from information_schema.statistics where table_schema = ? and table_name = 'bookings' and index_name = 'bookings_invoice_number_uq'",
  [db],
);
if (!invoiceIndex.length) {
  await connection.query("alter table bookings add unique index bookings_invoice_number_uq (invoice_number)");
  console.log("Added unique index bookings_invoice_number_uq");
}

const [index] = await connection.query(
  "select 1 from information_schema.statistics where table_schema = ? and table_name = 'bookings' and index_name = 'bookings_payment_reference_idx'",
  [db],
);
if (!index.length) {
  await connection.query("alter table bookings add index bookings_payment_reference_idx (payment_reference)");
  console.log("Added index bookings_payment_reference_idx");
}

await connection.end();
console.log("Online booking migration complete.");
