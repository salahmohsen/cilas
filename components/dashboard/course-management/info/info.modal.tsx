import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCourseState } from "@/providers/CourseState.provider";
import { CourseInfo } from "./info";
import { InfoFooter } from "./info.footer";
import { useWindowSize } from "@uidotdev/usehooks";

export const CourseInfoModal = () => {
  const {
    state: { courseInfo, isCourseSelected },
    dispatch,
  } = useCourseState();
  const { width } = useWindowSize();
  if (!courseInfo) return;

  const id = courseInfo.id;

  return (
    <Dialog
      open={isCourseSelected?.[id]}
      onOpenChange={() =>
        dispatch({
          type: "SET_COURSE_SELECTED",
          payload: { [id]: isCourseSelected?.[id] ? true : false },
        })
      }
    >
      <DialogContent
        className={`h-[calc(100%-20px)] scale-90 rounded-md border-none p-0`}
      >
        <CourseInfo className={"mb-10 overflow-y-auto border-0"} />
        {width && width < 1024 && (
          <InfoFooter className="fixed bottom-0 rounded-md" />
        )}
      </DialogContent>
    </Dialog>
  );
};
