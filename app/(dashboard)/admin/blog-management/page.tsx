import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Button } from "@/components/hoc/button";
import { cn } from "@/lib/utils";
import { Library, SquarePen } from "lucide-react";
import { PageHeader } from "../_components/page.header";

export default function BlogManagement() {
  return (
    <>
      <PageHeader
        title="Blog Management"
        description="Manage blogs: create, update, delete, and filter with ease."
      >
        <Button href="/admin/blog-management/new-post" icon={<SquarePen />}>
          New Post
        </Button>
        <Button href="/admin/blog-management/collection-new" icon={<Library />}>
          New collection
        </Button>
      </PageHeader>
      <Tabs defaultValue="published" className={cn(`px-4`)}>
        <TabsList className="*:cursor-pointer">
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="collections">Series</TabsTrigger>
        </TabsList>
        <TabsContent value="published">published.</TabsContent>
        <TabsContent value="draft">draft.</TabsContent>
        <TabsContent value="collections">collections.</TabsContent>
      </Tabs>
    </>
  );
}
