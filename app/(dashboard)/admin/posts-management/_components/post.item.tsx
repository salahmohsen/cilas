"use client";

import { useState } from "react";

import { format } from "date-fns";

import { Button } from "@/components/hoc/button";
import { ConfirmationDialog } from "@/components/ui/dialog-confirmation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserStore } from "@/lib/store/user.slice";
import { Calendar, Ellipsis } from "lucide-react";
import { useRouter } from "next/navigation";
import { Post } from "../_lib/posts.actions.type";
import { usePostsStore } from "../_lib/posts.slice";

type PostItemProps = { post: Post };

export const PostItem = ({ post }: PostItemProps) => {
  const { handleDelete, setPostSelected, setPostInfo, isPostSelected } = usePostsStore();

  const { userInfo } = useUserStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState<boolean>(false);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState<boolean>(false);

  const handleSelect = (id: number) => {
    setPostSelected({ [id]: !isPostSelected?.[id] });
    setPostInfo(isPostSelected?.[id] ? null : post);
  };

  const router = useRouter();

  const postTitle = post.enTitle || post.arTitle;

  return (
    <>
      <li
        className={`lg:hover:bg-accent flex cursor-pointer items-center gap-4 rounded-md py-6 text-sm font-medium transition-all duration-300 hover:-mx-4 hover:px-5 lg:group-hover/list:opacity-50 lg:hover:opacity-100! ${isPostSelected?.[post.id] || isMenuOpen ? "bg-accent -mx-4 px-5 opacity-100!" : "bg-transparent"}`}
        onClick={() => handleSelect(post.id)}
        data-course-id={post.id}
      >
        <div className="flex w-full justify-between">
          <div className="flex flex-1 flex-col gap-4">
            <p className="line-clamp-3 leading-relaxed lg:line-clamp-1">{postTitle}</p>
            <div className="flex items-center gap-5">
              {post.publishedAt && (
                <span className="flex gap-1 text-xs font-light">
                  <Calendar size={16} strokeWidth={1.5} />
                  {format(post.publishedAt, "MMMM dd yyyy")}
                </span>
              )}
            </div>
          </div>
          <DropdownMenu onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                icon={<Ellipsis />}
                variant="outline"
                className={"border-0"}
              >
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() =>
                  router.push(`/admin/posts-management/edit-post?id=${post.id}`)
                }
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer"
              >
                Edit
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() =>
                  router.push(
                    `/admin/course-management/create-post?duplicate-course=${post.id}`,
                  )
                }
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer"
              >
                Duplicate
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => setIsStudentDialogOpen(true)}
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer"
              >
                Update enrollments
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                onSelect={() => setIsDeleteDialogVisible(true)}
                onClick={(e) => e.stopPropagation()}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </li>

      <ConfirmationDialog
        isOpen={isDeleteDialogVisible}
        setIsOpen={setIsDeleteDialogVisible}
        title={`Delete ${postTitle ?? "Post"}`}
        onConfirm={() => handleDelete(post.id)}
      />
    </>
  );
};
