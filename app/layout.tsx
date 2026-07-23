import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { BottomNav } from "@/components/nav/BottomNav";
import { getAdminSession } from "@/lib/auth/getSession";
import { Toaster } from "@/components/ui/sonner";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { AnnouncementCenter } from "@/components/AnnouncementCenter";
import { AnnouncementsProvider } from "@/components/AnnouncementsProvider";
import {
  getCurrentTournament,
  listAnnouncements,
} from "@/lib/db/repository";
import type { Announcement } from "@/lib/db/types";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VolleyPal",
  description: "Tournament tracker for our annual volleyball get-together",
  applicationName: "VolleyPal",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "VolleyPal",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let isAdmin = false;
  let locked = false;
  let lockedMatchId: string | undefined;
  try {
    const sess = await getAdminSession();
    isAdmin = Boolean(sess.adminId);
    locked = Boolean(sess.locked);
    lockedMatchId = sess.lockedMatchId;
  } catch {
    // Session cookie not configured yet — keep nav as public
  }
  let initialAnnouncements: Announcement[] = [];
  try {
    const tournament = await getCurrentTournament();
    if (tournament) {
      initialAnnouncements = await listAnnouncements(tournament.id);
    }
  } catch {
    // DB unavailable — banner will hydrate from /api/announcements poll
  }
  return (
    <html
      lang="zh-Hant"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-dvh antialiased dark`}
    >
      <body className="min-h-dvh flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AnnouncementsProvider initial={initialAnnouncements}>
            <main
              className="flex-1 mx-auto w-full max-w-md"
              style={{
                paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
                paddingBottom: "calc(env(safe-area-inset-bottom) + 5.5rem)",
                paddingLeft: "max(1rem, env(safe-area-inset-left))",
                paddingRight: "max(1rem, env(safe-area-inset-right))",
              }}
            >
              {children}
            </main>
            <BottomNav isAdmin={isAdmin} locked={locked} lockedMatchId={lockedMatchId} />
            <AnnouncementCenter />
          </AnnouncementsProvider>
          <Toaster richColors theme="dark" />
          <RegisterServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
