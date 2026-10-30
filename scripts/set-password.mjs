// Set or reset a user's password in the MySQL database.
//
//   node --env-file=.env.local scripts/set-password.mjs <email> <password>

import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: node --env-file=.env.local scripts/set-password.mjs <email> <password>");
  process.exit(1);
}

if (password.length < 6) {
  console.error("Password should be at least 6 characters.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [result] = await connection.query("update users set password_hash = ? where email = ?", [
  await bcrypt.hash(password, 12),
  email.trim().toLowerCase(),
]);
await connection.end();

if (result.affectedRows === 0) {
  console.error(`No user with email ${email}.`);
  process.exit(1);
}

console.log(`Password updated for ${email}.`);
