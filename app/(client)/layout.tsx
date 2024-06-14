import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Cairo } from "next/font/google";
import "@/app/globals.css";
import { MainNav } from "@/components/client/HeaderMainNav";
import logo from "@/public/logo.png";
import Image from "next/image";
import { FloatingNav } from "@/components/client/HeaderFloatingNav";
import { Bird, Brain, HomeIcon, Map, Rss } from "lucide-react";
import Link from "next/link";

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
  title: "Cairo Institute of Liberal Arts and Sciences",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${cairo.variable} min-w-screen mx-10 mt-10`}
      >
        <header className="mb-20 flex flex-col items-center justify-between gap-5 md:flex-row md:gap-10">
          <Link
            href="/"
            className="flex h-auto flex-col items-center gap-5 md:flex-row"
          >
            <Image
              src={logo}
              width={25}
              alt="Cairo Institute of Liberal Arts and Sciences"
            />
            <h1 className="text-center font-bold md:text-left">
              Cairo Institute of Liberal Arts and Sciences
            </h1>
          </Link>
          <MainNav />
          <FloatingNav
            navItems={[
              {
                name: "Home",
                link: "/",
                icon: <HomeIcon size={16} strokeWidth={1} />,
              },
              {
                name: "Courses",
                link: "/",
                icon: <Brain size={16} strokeWidth={1} />,
              },
              {
                name: "People",
                link: "/",
                icon: <Bird size={16} strokeWidth={1} />,
              },
              {
                name: "Space",
                link: "/",
                icon: <Map size={16} strokeWidth={1} />,
              },
              {
                name: "Blog",
                link: "/",
                icon: <Rss size={16} strokeWidth={1} />,
              },
            ]}
          />
        </header>

        {children}
      </body>
    </html>
  );
}
