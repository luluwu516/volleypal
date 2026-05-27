import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type AdminSession } from "./session";

export async function getAdminSession() {
  const store = await cookies();
  return getIronSession<AdminSession>(store, sessionOptions);
}

export async function requireAdminSession(): Promise<AdminSession> {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return sess as AdminSession;
}
