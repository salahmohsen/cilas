import { Button } from "@/components/hoc/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/utils";
import { format } from "date-fns";

import { Avatar } from "@/components/avatar";
import { Separator } from "@/components/ui/separator";
import { TailwindBreakpoint } from "@/lib/types/geniric.enums";
import { useWindowSize } from "@uidotdev/usehooks";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Copy, SwatchBook, TagsIcon } from "lucide-react";
import { forwardRef } from "react";
import { toast } from "sonner";
import { InfoFooter } from "../../_components/info.footer";
import { Post } from "../_lib/posts.actions.type";
import { usePostsStore } from "../_lib/posts.slice";

type PostInfoProps = {
  className?: string;
  mode: "dialog" | "flex";
};

export const PostInfo = forwardRef<HTMLDivElement, PostInfoProps>(
  ({ className, mode }, ref) => {
    const { postInfo: post, selectedPost } = usePostsStore();

    const { width } = useWindowSize();

    const isSelectedPost = Object.values(selectedPost ?? false)[0] ?? false;

    return (
      <AnimatePresence>
        {isSelectedPost && post && (
          <motion.div
            className={cn(`flex w-full flex-col justify-between`, className)}
            initial={mode === "flex" && { x: "50vw", width: 0 }}
            animate={mode === "flex" && { x: 0, width: "50%" }}
            exit={mode === "flex" ? { x: "50vw", width: 0 } : undefined}
            ref={ref}
          >
            <Card className="overflow-y-auto">
              <ScrollArea type="hover" className="h-[calc(100%-60px)]">
                <Header post={post} />

                <CardContent className="flex flex-col gap-6 pt-6 text-sm">
                  <PostDetails post={post} />
                  <Separator />
                  <Excerpt post={post} />
                  <Separator />
                  <Authors post={post} />
                </CardContent>
              </ScrollArea>
              {width && width >= TailwindBreakpoint.LG && (
                <InfoFooter updatedAt={post.updatedAt} />
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

const Header = ({ post }: { post: Post }) => {
  return (
    <CardHeader className={cn("bg-accent relative z-0 flex flex-row items-start")}>
      <div className="grid gap-0.5">
        <CardTitle className="group flex items-center gap-2 text-lg">
          <span dir={post.enTitle ? "ltr" : "rtl"}>{post.enTitle || post.arTitle}</span>
          <Button
            size="icon"
            variant="outline"
            icon={<Copy className="p-0.5" />}
            className="**:text-foreground! h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => {
              navigator.clipboard
                .writeText((post.enTitle || post.arTitle) as string)
                .then(() => {
                  toast.success("Copied!");
                });
            }}
          >
            <span className="sr-only">Copy Course Name</span>
          </Button>
        </CardTitle>
        {post.publishedAt && (
          <CardDescription>
            <span>Published Date: {format(post.publishedAt, "dd MMMM yyyy")}</span>
          </CardDescription>
        )}
      </div>
    </CardHeader>
  );
};

const PostDetails = ({ post }: { post: Post }) => {
  const tags = post.tags;

  return (
    <div className="grid gap-5">
      <Categories post={post} />
      <Separator />
      <Tags post={post} />
      <Separator />
      <PublishedAt post={post} />
    </div>
  );
};

const Categories = ({ post }: { post: Post }) => {
  const categories = post.categories;

  return (
    <div className="grid grid-cols-2 gap-3">
      <span className="text-muted-foreground flex items-center gap-2 font-medium">
        <SwatchBook strokeWidth={0.8} />
        Categories
      </span>
      <div className="flex flex-col items-end gap-2">
        {categories.map(
          (category) =>
            category && (
              <span key={category.id} className="capitalize">
                {category.enName}
              </span>
            ),
        )}
      </div>
    </div>
  );
};

const PublishedAt = ({ post }: { post: Post }) => {
  const publishedAt = post.publishedAt && format(post.publishedAt, "dd MMMM yyyy");
  if (!publishedAt) return;

  return (
    <div className="grid grid-cols-2 gap-3">
      <span className="text-muted-foreground flex items-center gap-2 font-medium">
        <Calendar strokeWidth={0.8} />
        Published At
      </span>
      <div className="flex flex-col items-end gap-2">{publishedAt}</div>
    </div>
  );
};

const Tags = ({ post }: { post: Post }) => {
  const tags = post.tags;

  return (
    <div className="grid grid-cols-2 gap-3">
      <span className="text-muted-foreground flex items-center gap-2 font-medium">
        <TagsIcon strokeWidth={0.8} />
        Tags
      </span>
      <div className="flex flex-col items-end gap-2">
        {tags.map(
          (tag) =>
            tag && (
              <span key={tag.id} className="capitalize">
                {tag.enName}
              </span>
            ),
        )}
      </div>
    </div>
  );
};

const Excerpt = ({ post }: { post: Post }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="font-semibold">Excerpt</div>
      <span>{post.excerpt}</span>
    </div>
  );
};

const Authors = ({ post }: { post: Post }) => {
  const authors = post?.authors.map((author) => {
    return {
      ...author.user,
      authorRole: author.role,
      isMainAuthor: author.isMainAuthor,
    };
  });

  const mainAuthors = authors.filter((author) => Boolean(author.isMainAuthor));
  const subAuthors = authors.filter((author) => !Boolean(author.isMainAuthor));

  return (
    <div className="grid gap-3">
      <h3 className="text-md font-bold">Authors</h3>
      {mainAuthors.map((author) => (
        <div
          key={author.id}
          className="grid grid-cols-2 items-center justify-between gap-5"
        >
          <span className="text-muted-foreground font-medium capitalize">
            {author.authorRole?.enName}
          </span>
          <div className="flex items-center gap-4">
            <Avatar user={author} />
            <span>{`${author.firstName} ${author.lastName}`}</span>
          </div>
        </div>
      ))}
      {subAuthors.map((author) => (
        <div
          key={author.id}
          className="grid grid-cols-2 items-center justify-between gap-5"
        >
          <span className="text-muted-foreground font-medium capitalize">
            {author.authorRole?.enName}
          </span>
          <div className="flex items-center gap-4">
            <Avatar user={author} />
            <span>{`${author.firstName} ${author.lastName}`}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

PostInfo.displayName = "CourseInfo";
