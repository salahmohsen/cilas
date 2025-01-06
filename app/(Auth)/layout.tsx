import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";

import "@/app/globals.css";

import { validateRequest } from "@/lib/apis/auth.api";
import { SessionProvider } from "@/lib/providers/Session.provider";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  adjustFontFallback: false,
  display: "swap",
});
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["200", "400", "700"],
  variable: "--font-ibm-plex-sans-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Generated by create next app",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionData = await validateRequest();

  return (
    <html lang="en" suppressHydrationWarning>
      <SessionProvider value={sessionData}>
        <body className={`${inter.variable} ${ibmPlexSansArabic.variable} `}>
          <Toaster richColors />
          <main>{children}</main>
        </body>
      </SessionProvider>
    </html>
  );
}
