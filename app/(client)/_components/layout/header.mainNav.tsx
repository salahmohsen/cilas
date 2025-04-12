"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/utils";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

import PigeonTower from "@/public/pigeonTower.svg";

export function MainNav() {
  return (
    <nav>
      <NavigationMenu className="[&>.absolute]:-right-3 [&>.absolute]:left-auto [&>.absolute]:mt-5 [&>.absolute>.relative]:mt-0 [&>.absolute>.relative]:rounded-t-none [&>.absolute>.relative]:border-t-0">
        <NavigationMenuList>
          <NavigationMenuItem className="right-0 left-[unset]">
            <NavigationMenuTrigger>Admissions</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                <li className="row-span-3">
                  <NavigationMenuLink asChild>
                    <a
                      className="from-muted/50 to-muted flex h-full w-full flex-col justify-end rounded-md bg-linear-to-b p-6 no-underline outline-hidden select-none focus:shadow-md"
                      href="/courses"
                    >
                      <Image src={PigeonTower} alt="bridge programme" />
                      <div className="mt-4 mb-2 text-lg font-medium">
                        Bridge programme
                      </div>
                      <p className="text-muted-foreground text-sm leading-tight">
                        CILAS invites students from all walks of life to one year
                        co-learning journey
                      </p>
                    </a>
                  </NavigationMenuLink>
                </li>
                <ListItem href="/courses" title="Seasonal Course">
                  standalone courses open to the public/visiting students.
                </ListItem>
                <ListItem href="/courses" title="Thematic Courses">
                  part of the second semester of bridge program and is open to the
                  public/visiting students.
                </ListItem>
                <ListItem href="/courses" title="Labs">
                  Styles for headings, paragraphs, lists...etc
                </ListItem>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/docs" legacyBehavior passHref>
              <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                People
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/docs" legacyBehavior passHref>
              <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                Space
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/docs" legacyBehavior passHref>
              <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                Blog
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block space-y-1 rounded-md p-3 leading-none no-underline outline-hidden transition-colors select-none",
            className,
          )}
          {...props}
        >
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="text-muted-foreground line-clamp-3 text-sm leading-snug">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
