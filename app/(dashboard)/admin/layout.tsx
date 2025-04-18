import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";

import "@/app/globals.css";

import { LayoutHeader } from "@/app/(dashboard)/_components/layout/header";
import { ThemeProvider } from "@/lib/providers/theme.provider";

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

import { LayoutSidebar } from "@/app/(dashboard)/_components/layout/sidebar";
import { validateRequest } from "@/lib/apis/auth.api";
import { RootProvider } from "@/lib/providers";
import { redirect } from "next/navigation";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await validateRequest();

  if (!user || user.role !== "admin") {
    return redirect("/signin");
  }

  return (
    <RootProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${inter.variable} ${ibmPlexSansArabic.variable} bg-background max-w-screen leading-relaxed text-pretty antialiased`}
          id="dashboard"
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Toaster richColors />
            <main>
              <LayoutHeader className="z-40 h-16 px-5 sm:pl-0" />
              <div className="mt-16 flex w-full">
                <LayoutSidebar className="z-40 h-[calc(100%-4rem)] w-16" />
                <div className="w-full sm:ml-16">{children}</div>
              </div>
            </main>
          </ThemeProvider>
        </body>
      </html>
    </RootProvider>
  );
}
