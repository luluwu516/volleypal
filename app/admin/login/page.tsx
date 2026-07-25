import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdminSession } from "@/lib/auth/getSession";
import { LoginForm } from "./_components/LoginForm";

export const dynamic = "force-dynamic";

// Skip the login form entirely if a valid session is already present so a
// bookmarked /admin/login doesn't send an authenticated admin back to the
// PIN prompt.
export default async function LoginPage() {
  try {
    const sess = await getAdminSession();
    if (sess.adminId) redirect("/admin");
  } catch {
    // Session cookie not configured / decryption failed → fall through to
    // the form so the user can log in.
  }
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
