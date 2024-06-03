import Image from "next/image";
import Link from "next/link";

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
  FileCode2Icon,
  Home,
  LifeBuoyIcon,
  Settings2Icon,
  SquareLibrary,
  SquareUserIcon,
} from "lucide-react";

export default function LayoutSidebar() {
  return (
    <aside className="inset-y fixed  left-0 z-20 hidden h-full flex-col border-r sm:flex">
      <div className="border-b p-2">
        <Button aria-label="Home" size="icon" variant="outline">
          <Image src={logo} alt="Cilas" width={16} className="h-auto" />
        </Button>
      </div>
      <nav className="grid gap-1 p-2 ">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={"/dashboard"}>
                <Button
                  aria-label="Home"
                  className="rounded-lg"
                  size="icon"
                  variant="ghost"
                >
                  <Home className="size-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5}>
              Home
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={"/dashboard/courses"}>
                <Button
                  aria-label="Courses"
                  className="rounded-lg bg-muted"
                  size="icon"
                  variant="ghost"
                >
                  <SquareLibrary className="size-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5}>
              Courses
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
  );
}
