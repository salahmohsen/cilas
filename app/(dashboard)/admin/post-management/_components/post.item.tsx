"use client";

import { useMemo, useState } from "react";

import { format } from "date-fns";

import { AvatarGroup } from "@/components/avatar";
import { Button } from "@/components/button";
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

  const router = useRouter();

  const postTitle = post.enTitle || post.arTitle;

  const users = post.authors.map((author) => {
    return {
      ...author.user,
      authorRole: author.role,
      isMainAuthor: author.isMainAuthor,
    };
  });

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      // First check if user is main author
      const aIsMain = a.isMainAuthor || false;
      const bIsMain = b.isMainAuthor || false;

      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;

      // If both are main authors or both are not, sort alphabetically by name
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [users]);

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
            <div className="flex items-center gap-2">
              {sortedUsers && <AvatarGroup users={sortedUsers} />}

              <span className="line-clamp-3 leading-relaxed lg:line-clamp-1">
                {postTitle}
              </span>
            </div>
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
                onSelect={() => router.push(`/admin/post-management/edit?id=${post.id}`)}
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer"
              >
                Edit
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() =>
                  router.push(`/admin/post-management/new?duplicate=${post.id}`)
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
