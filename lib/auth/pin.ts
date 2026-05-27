import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../supabase/server";

export interface AdminRecord {
  id: string;
  name: string;
}

/**
 * Look up admins from the DB and find the first one whose hashed PIN matches.
 * Returns null on no match. Constant-ish time: checks every admin regardless.
 */
export async function findAdminByPin(pin: string): Promise<AdminRecord | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("admins").select("id, name, pin_hash");
  if (error) throw error;
  let match: AdminRecord | null = null;
  for (const row of data ?? []) {
    const ok = await bcrypt.compare(pin, row.pin_hash);
    if (ok && !match) {
      match = { id: row.id, name: row.name };
    }
  }
  return match;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}
