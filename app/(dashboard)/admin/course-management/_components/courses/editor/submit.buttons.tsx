import { useCourseStore } from "@/app/(dashboard)/admin/course-management/_lib/course.slice";
import { CoursesFilter } from "@/app/(dashboard)/admin/course-management/_lib/courses.slice.types";
import { Button } from "@/components/hoc/button";
import { Circle, CircleDashed } from "lucide-react";

type SubmitButtonsProps = {
  isLoading: {
    primaryButton: boolean;
    secondaryButton: boolean;
  };
  editMode: boolean;
  draftMode: boolean;
  setDraftMode: (value: boolean) => void;
};

export const SubmitButtons = ({
  isLoading,
  editMode,
  draftMode,
  setDraftMode,
}: SubmitButtonsProps) => {
  const { setFilter } = useCourseStore();
  return (
    <>
      <Button
        isLoading={isLoading.secondaryButton}
        variant="secondary"
        type="submit"
        onClick={() => {
          setDraftMode(true);
          setFilter(CoursesFilter.Draft);
        }}
        className="rounded-none border-x bg-transparent"
      >
        <CircleDashed size={18} />
        {editMode && !draftMode ? "Convert to draft" : "Save draft"}
      </Button>

      <Button
        variant="default"
        isLoading={isLoading.primaryButton}
        type="submit"
        onClick={() => {
          setDraftMode(false);
          setFilter(CoursesFilter.AllPublished);
        }}
        className="rounded-none"
      >
        <Circle size={18} />
        {editMode && !draftMode ? "Save Changes" : "Publish Course"}
      </Button>
    </>
  );
};
