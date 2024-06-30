"use client";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LayoutBreadcrumb() {
  const path = usePathname();

  let items: { name: string; href: string }[] = [];
  const paths = path.split("/").filter((p) => p !== "");
  paths.map((p, i) => {
    if (i !== paths.length - 1)
      items.push({
        name: p.replace(/-/g, " ").trim(),
        href: `/${paths.slice(0, i + 1).join("/")}`,
      });
  });

  return (
    <Breadcrumb className="mx-4 my-4 hidden md:flex">
      <BreadcrumbList>
        {items.map((item) => (
          <Item item={item} key={item.name} />
        ))}
        <BreadcrumbItem className="capitalize">
          <BreadcrumbPage>
            {paths[paths.length - 1] &&
            paths[paths.length - 2] !== "edit-course"
              ? paths[paths.length - 1].replace(/-/g, " ").trim()
              : paths[paths.length - 1]
                  .replace(/-/g, " ")
                  .trim()
                  .split(" ")
                  .slice(0, -1)
                  .join(" ")}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function Item({ item }) {
  return (
    <>
      <BreadcrumbItem>
        <BreadcrumbLink asChild>
          <Link className="capitalize" href={item.href}>
            {item.name}
          </Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
    </>
  );
}
