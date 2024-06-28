import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { useCourseState } from "@/providers/CourseState.provider";
import CourseInfo from "./CourseInfo";

const CourseInfoModal = () => {
  const { isSelected, setIsSelected, courseInfo } = useCourseState();

  if (!courseInfo) return;

  const id = courseInfo.course.id;

  return (
    <Dialog
      open={isSelected[id]}
      onOpenChange={() => setIsSelected((prev) => ({ [id]: !prev[id] }))}
    >
      <DialogContent
        className={`h-[calc(100vh-20px)] scale-90 overflow-y-auto rounded-md border-none p-0`}
      >
        <CourseInfo className={"border-0"} />
      </DialogContent>
    </Dialog>
  );
};

export default CourseInfoModal;
