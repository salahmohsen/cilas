"use client";

import { useState } from "react";

import { format } from "date-fns";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/hoc/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Ellipsis } from "lucide-react";
import { useRouter } from "next/navigation";
import { Post } from "../_lib/posts.actions.type";
import { usePostsStore } from "../_lib/posts.slice";

type PostItemProps = { post: Post };

export const PostItem = ({ post }: PostItemProps) => {
  const { handleDelete, setSelectedPost, setPostInfo, selectedPost } = usePostsStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState<boolean>(false);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState<boolean>(false);

  const handleSelect = (id: number) => {
    setSelectedPost({ [id]: !selectedPost?.[id] });
    setPostInfo(selectedPost?.[id] ? null : post);
  };

  console.log(post);

  const router = useRouter();

  const postTitle = post.enTitle || post.arTitle;

  return (
    <>
      <li
        className="content-list-item flex"
        onClick={() => handleSelect(post.id)}
        data-item-id={post.id}
        data-selected={selectedPost?.[post.id] || isMenuOpen}
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
              <span className="flex gap-1 text-xs font-light">
                {post.authors.map(
                  (author, i) =>
                    author && (
                      <Avatar
                        key={author.user.id}
                        user={author.user}
                        className="h-4 w-4"
                      />
                    ),
                )}
                {post.authors.map(
                  (author) =>
                    author && `${author.user.firstName} ${author.user.lastName}`,
                )}
              </span>
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
                  router.push(`/admin/course-management/edit-post?id=${post.id}`)
                }
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer"
              >
                Edit
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() =>
                  router.push(
                    `/admin/posts-management/create-post?duplicate-course=${post.id}`,
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
      {/* <AddStudentsDialog
      courseId={course.id}
      isOpen={isStudentDialogOpen}
      setIsOpen={setIsStudentDialogOpen}
      courseStudents={course.students.map((student) => ({
        value: student.id,
        label: `${student.firstName} ${student.lastName}`,
      }))}
    />
    <ConfirmationDialog
      isOpen={isDeleteDialogVisible}
      setIsOpen={setIsDeleteDialogVisible}
      title={`Delete ${(course.enTitle || course.arTitle) ?? "Course"}`}
      onConfirm={() => handleDelete(course.id)}
    /> */}
    </>
  );
};
