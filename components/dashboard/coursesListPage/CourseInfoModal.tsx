import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { useCourseState } from "@/providers/CourseState.provider";
import CourseInfo from "./CourseInfo";

const CourseInfoModal = () => {
  const {
    isSelected: isClicked,
    setIsSelected: setIsClicked,
    courseInfo,
  } = useCourseState();

  if (!courseInfo) return;

  const id = courseInfo.course.id;

  return (
    <Dialog
      open={isClicked[id]}
      onOpenChange={() => setIsClicked((prev) => ({ [id]: !prev[id] }))}
    >
      <DialogContent className="h-[calc(100vh-20px)] scale-90 overflow-y-auto p-0">
        <CourseInfo />
      </DialogContent>
    </Dialog>
  );
};

export default CourseInfoModal;
