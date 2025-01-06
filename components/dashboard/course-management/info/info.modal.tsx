import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCourseState } from "@/lib/providers/CourseState.provider";
import { CourseInfo } from "./info";
import { InfoFooter } from "./info.footer";

export const CourseInfoModal = () => {
  const {
    state: { courseInfo, isCourseSelected },
    dispatch,
  } = useCourseState();
  if (!courseInfo) return;

  const id = courseInfo.id;

  return (
    <Dialog
      open={isCourseSelected?.[id]}
      onOpenChange={(open) => {
        dispatch({
          type: "SET_COURSE_SELECTED",
          payload: { [id]: open },
        });
      }}
    >
      <DialogContent
        className={`h-[calc(100%-20px)] scale-90 rounded-md border-none p-0`}
      >
        <CourseInfo
          className={"mb-10 overflow-y-auto border-0"}
          mode="dialog"
        />
        <InfoFooter className="fixed bottom-0 rounded-md" />
      </DialogContent>
    </Dialog>
  );
};
