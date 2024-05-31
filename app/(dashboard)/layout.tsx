import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import {
  TooltipTrigger,
  TooltipContent,
  Tooltip,
  TooltipProvider,
} from "@/components/ui/tooltip";
import logo from "@/public/logo.png";
import { Button } from "@/components/ui/button";
import {
  BookIcon,
  BotIcon,
  FileCode2Icon,
  LifeBuoyIcon,
  Settings2Icon,
  ShareIcon,
  SquareTerminalIcon,
  SquareUserIcon,
  TriangleIcon,
} from "lucide-react";
import Image from "next/image";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en">
      <body className={`${inter.className}`}>
        <div className="grid h-screen w-full pl-[56px]">
          <aside className="inset-y fixed  left-0 z-20 flex h-full flex-col border-r">
            <div className="border-b p-2">
              <Button aria-label="Home" size="icon" variant="outline">
                <Image src={logo} alt="Cilas" width={16} className="h-auto" />
              </Button>
            </div>
            <nav className="grid gap-1 p-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Playground"
                      className="rounded-lg bg-muted"
                      size="icon"
                      variant="ghost"
                    >
                      <SquareTerminalIcon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    Playground
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Models"
                      className="rounded-lg"
                      size="icon"
                      variant="ghost"
                    >
                      <BotIcon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    Models
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="API"
                      className="rounded-lg"
                      size="icon"
                      variant="ghost"
                    >
                      <FileCode2Icon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    API
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Documentation"
                      className="rounded-lg"
                      size="icon"
                      variant="ghost"
                    >
                      <BookIcon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    Documentation
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Settings"
                      className="rounded-lg"
                      size="icon"
                      variant="ghost"
                    >
                      <Settings2Icon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    Settings
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </nav>
            <nav className="mt-auto grid gap-1 p-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Help"
                      className="mt-auto rounded-lg"
                      size="icon"
                      variant="ghost"
                    >
                      <LifeBuoyIcon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    Help
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Account"
                      className="mt-auto rounded-lg"
                      size="icon"
                      variant="ghost"
                    >
                      <SquareUserIcon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    Account
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </nav>
          </aside>
          <div className="flex flex-col">
            <header className="sticky top-0 z-10 flex h-[57px] items-center gap-1 border-b bg-background px-4">
              <h1 className="text-xl font-semibold">Dashboard</h1>
              <Button
                className="ml-auto gap-1.5 text-sm"
                size="sm"
                variant="outline"
              >
                <ShareIcon className="size-3.5" />
                Cilas
              </Button>
            </header>

            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
