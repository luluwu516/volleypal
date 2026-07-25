import { z } from "zod";

// Single source of truth for env-var expectations. Import this from anywhere
// that reads process.env — the schema.parse below fails fast with a clear
// error if a required variable is missing, instead of surfacing as a cryptic
// runtime error deep inside a request path.
//
// Optional entries (email alerting) are opt-in — the app still boots without
// them, they just disable the corresponding feature.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid https URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  SESSION_COOKIE_SECRET: z
    .string()
    .min(
      32,
      "SESSION_COOKIE_SECRET must be ≥ 32 chars — generate with `openssl rand -hex 32`",
    ),
  // Floor is 8 to avoid forcing rotation on existing installs; use ≥ 16
  // for new setups.
  FORM_WEBHOOK_SHARED_SECRET: z.string().min(8),

  NEXT_PUBLIC_APP_TZ: z.string().default("America/Los_Angeles"),

  // --- Email alerting (opt-in). All three must be set together or feature
  //     stays dark.
  RESEND_API_KEY: z.string().optional(),
  ALERT_EMAIL_TO: z.string().email().optional(),
  ALERT_EMAIL_FROM: z.string().email().optional(),
});

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n\n` +
        "Copy .env.example → .env.local and fill in the required values.",
    );
  }
  cached = parsed.data;
  return cached;
}

/** True when the alerting trio (RESEND_API_KEY + ALERT_EMAIL_TO/FROM) is set. */
export function isAlertingEnabled(): boolean {
  const e = env();
  return Boolean(e.RESEND_API_KEY && e.ALERT_EMAIL_TO && e.ALERT_EMAIL_FROM);
}
