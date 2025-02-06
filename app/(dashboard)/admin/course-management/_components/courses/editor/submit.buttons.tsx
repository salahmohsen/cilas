import { SubmitButton } from "@/components/form-inputs/input.submit";
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
      <SubmitButton
        isLoading={isLoading.secondaryButton}
        value={editMode && !draftMode ? "Convert To Draft" : "Save Draft"}
        className="px-2 sm:px-3"
        variant="secondary"
        handleOnClick={() => {
          setDraftMode(true);
          setFilter(CoursesFilter.Draft);
        }}
      />

      <SubmitButton
        variant="default"
        isLoading={isLoading.primaryButton}
        value={editMode && !draftMode ? "Save Changes" : "Publish Course"}
        className="px-2 sm:px-3"
        handleOnClick={() => {
          setDraftMode(false);
          setFilter(CoursesFilter.AllPublished);
        }}
      />
    </div>
  );
};
