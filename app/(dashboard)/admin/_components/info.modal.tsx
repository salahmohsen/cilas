import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CourseWithFellowAndStudents } from "@/lib/drizzle/drizzle.types";
import { CourseInfo } from "../course-management/_components/info/course.info";
import { PostInfo } from "../post-management/_components/post.info";
import { Post } from "../post-management/_lib/posts.actions.type";
import { InfoFooter } from "./info.footer";

type InfoModal = {
  info: CourseWithFellowAndStudents | Post | null;
  selectedItem: Record<number, boolean> | null;
  setSelectedItem: (selected: Record<number, boolean> | null) => void;
  type: "course" | "post";
};

export const InfoModal = ({ info, selectedItem, setSelectedItem, type }: InfoModal) => {
  if (!info) return;

  const id = info.id;

  return (
    <Dialog
      open={selectedItem?.[id]}
      onOpenChange={(open) => setSelectedItem({ [id]: open })}
    >
      <DialogContent
        className={`h-[calc(100%-20px)] scale-90 rounded-md border-none p-0`}
      >
        {type === "course" && (
          <CourseInfo className={"mb-10 overflow-y-auto border-0"} mode="dialog" />
        )}
        {type === "post" && (
          <PostInfo className={"mb-10 overflow-y-auto border-0"} mode="dialog" />
        )}
        <InfoFooter updatedAt={info.updatedAt} className="fixed bottom-0 rounded-md" />
      </DialogContent>
    </Dialog>
  );
};
