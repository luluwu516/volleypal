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

// Write endpoints that should be disabled in referee mode (everything except scoring).
export async function requireUnlockedAdmin(): Promise<AdminSession> {
  const sess = await requireAdminSession();
  if (sess.locked) {
    throw new Response("Locked", { status: 403 });
  }
  return sess;
}

// Scoring endpoints — allowed when locked, but if locked-to-match is set,
// the request's matchId must match.
export async function requireMatchScoringSession(
  matchId: string,
): Promise<AdminSession> {
  const sess = await requireAdminSession();
  if (sess.locked && sess.lockedMatchId && sess.lockedMatchId !== matchId) {
    throw new Response("Locked to another match", { status: 403 });
  }
  return sess;
}
