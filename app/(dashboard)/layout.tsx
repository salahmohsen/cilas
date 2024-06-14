import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";

import "@/app/globals.css";

import LayoutSidebar from "@/components/dashboard/LayoutSidebar";
import LayoutHeader from "@/components/dashboard/LayoutHeader";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/client/ThemeProvider";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${cairo.variable} `}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster richColors />
          <main>
            <LayoutSidebar />
            <LayoutHeader>{children}</LayoutHeader>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
