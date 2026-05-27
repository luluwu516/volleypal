import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key). Safe to use from client components.
 * Reads only — writes from the client always go through API routes.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
