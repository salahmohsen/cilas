import { useCourseStore } from "@/app/(dashboard)/admin/course-management/_lib/course.slice";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CourseInfo } from "./info";
import { InfoFooter } from "./info.footer";

export const CourseInfoModal = () => {
  const { courseInfo, selectedCourse, setSelectedCourse } = useCourseStore();

  if (!courseInfo) return;

  const id = courseInfo.id;

  return (
    <Dialog
      open={selectedCourse?.[id]}
      onOpenChange={(open) => setSelectedCourse({ [id]: open })}
    >
      <DialogContent
        className={`h-[calc(100%-20px)] scale-90 rounded-md border-none p-0`}
      >
        <CourseInfo className={"mb-10 overflow-y-auto border-0"} mode="dialog" />
        <InfoFooter className="fixed bottom-0 rounded-md" />
      </DialogContent>
    </Dialog>
  );
};
