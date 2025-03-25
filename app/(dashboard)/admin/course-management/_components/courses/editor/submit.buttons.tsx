import { Button } from "@/components/hoc/button";
import { useCourseStore } from "@/lib/store/course.slice";
import { CoursesFilter } from "@/lib/types/course.slice.types";

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
    <div className="flex gap-2">
      <Button
        isLoading={isLoading.secondaryButton}
        variant="secondary"
        type="submit"
        onClick={() => {
          setDraftMode(true);
          setFilter(CoursesFilter.Draft);
        }}
      >
        {editMode && !draftMode ? "Convert To Draft" : "Save Draft"}
      </Button>

      <Button
        variant="default"
        isLoading={isLoading.primaryButton}
        type="submit"
        onClick={() => {
          setDraftMode(false);
          setFilter(CoursesFilter.AllPublished);
        }}
      >
        {editMode && !draftMode ? "Save Changes" : "Publish Course"}
      </Button>
    </div>
  );
};
