import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";

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
const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "800"],
  variable: "--font-cairo",
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
        className={`${inter.variable} ${cairo.variable} max-w-screen scroll-smooth text-pretty leading-relaxed antialiased`}
        id="dashboard"
      >
        <CourseStateProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <Toaster richColors />
            <main>
              <LayoutSidebar />
              <LayoutHeader>{children}</LayoutHeader>
            </main>
          </ThemeProvider>
        </CourseStateProvider>
      </body>
    </html>
  );
}
