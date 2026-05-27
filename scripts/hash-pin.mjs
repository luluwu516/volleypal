#!/usr/bin/env node
/**
 * Quick helper: hash a PIN for inserting into the `admins` table.
 *
 * Usage:
 *   node scripts/hash-pin.mjs 123456 Alice
 *   node scripts/hash-pin.mjs 654321 Bob
 *
 * Output is an INSERT statement you can paste into the Supabase SQL editor.
 * Do NOT commit real PINs anywhere — generate and paste once.
 */
import bcrypt from "bcryptjs";

const [, , pin, name] = process.argv;
if (!pin || !name) {
  console.error("Usage: node scripts/hash-pin.mjs <pin> <name>");
  process.exit(1);
}
if (pin.length < 4) {
  console.error("PIN must be at least 4 characters");
  process.exit(1);
}

const hash = await bcrypt.hash(pin, 10);
console.log(
  `insert into admins (name, pin_hash) values ('${name.replace(/'/g, "''")}', '${hash}');`,
);
