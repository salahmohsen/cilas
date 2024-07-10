import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { useCourseState } from "@/providers/CourseState.provider";
import { CourseInfo } from "./info";

export const CourseInfoModal = () => {
  const { isCourseSelected, setIsCourseSelected, courseInfo } = useCourseState();

  if (!courseInfo) return;

  const id = courseInfo.id;

  return (
    <Dialog open={isCourseSelected?.[id]} onOpenChange={() => setIsCourseSelected((prev) => ({ [id]: !prev?.[id] }))}>
      <DialogContent className={`h-[calc(100vh-20px)] scale-90 overflow-y-auto rounded-md border-none p-0`}>
        <CourseInfo className={"border-0"} />
      </DialogContent>
    </Dialog>
  );
};
