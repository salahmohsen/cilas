import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SquarePen } from "lucide-react";

export default function BlogManagement() {
  return (
    <main className="flex w-full flex-col gap-5">
      <Card className="flex flex-wrap items-end justify-between gap-5 p-6">
        <CardHeader className="p-0">
          <CardTitle>Blog Management</CardTitle>
          <CardDescription className="max-w-lg text-balance leading-relaxed">
            Manage blogs: create, update, delete, and filter with ease.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap items-center gap-2 p-0">
          <Link href="/dashboard/blog-management/create-blog">
            <Button>
              <SquarePen className="mr-2 h-4 w-4" />
              New Blog
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
