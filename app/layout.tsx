import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { BottomNav } from "@/components/nav/BottomNav";
import { getAdminSession } from "@/lib/auth/getSession";
import { Toaster } from "@/components/ui/sonner";

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
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let isAdmin = false;
  try {
    const sess = await getAdminSession();
    isAdmin = Boolean(sess.adminId);
  } catch {
    // Session cookie not configured yet — keep nav as public
  }
  return (
    <html
      lang="zh-Hant"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <main className="flex-1 pb-20 mx-auto w-full max-w-md px-4 pt-4">
            {children}
          </main>
          <BottomNav isAdmin={isAdmin} />
          <Toaster richColors theme="dark" />
        </ThemeProvider>
      </body>
    </html>
  );
}
