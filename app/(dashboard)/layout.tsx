import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";

import "@/app/globals.css";

import { LayoutHeader } from "@/components/dashboard/layout/header";
import { ThemeProvider } from "@/providers/Theme.provider";

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

import { validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CourseStateProvider } from "@/providers/CourseState.provider";
import { LayoutSidebar } from "@/components/dashboard/layout/sidebar";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await validateRequest();

  if (!user) {
    return redirect("/signin");
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${ibmPlexSansArabic.variable} max-w-screen text-pretty bg-background leading-relaxed antialiased`}
        id="dashboard"
      >
        <CourseStateProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Toaster richColors />
            <main>
              <LayoutHeader userId={user.id} className="h-16 px-5 sm:pl-0" />
              <div className="mt-16 flex w-full">
                <LayoutSidebar className="h-[calc(100%-4rem)] w-16" />
                <div className="w-full sm:ml-16">{children}</div>
              </div>
            </main>
          </ThemeProvider>
        </CourseStateProvider>
      </body>
    </html>
  );
}
