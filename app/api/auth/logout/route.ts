import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/getSession";

export async function POST() {
  const sess = await getAdminSession();
  sess.destroy();
  return NextResponse.json({ ok: true });
}
