import { useCourseState } from "@/providers/CourseState.provider";
import { SubmitButton } from "../inputs/input.submit";
import { Dispatch, SetStateAction } from "react";

type SubmitButtonsProps = {
  isLoading: {
    primaryButton: boolean;
    secondaryButton: boolean;
  };
  editMode: boolean;
  draftMode: boolean;
  setDraftMode: Dispatch<SetStateAction<boolean>>;
};

export const SubmitButtons = ({
  isLoading,
  editMode,
  draftMode,
  setDraftMode,
}: SubmitButtonsProps) => {
  const { dispatch } = useCourseState();
  return (
    <div className="flex gap-2">
      <SubmitButton
        isLoading={isLoading.secondaryButton}
        value={editMode && !draftMode ? "Convert To Draft" : "Save Draft"}
        className="px-2 sm:px-3"
        variant="secondary"
        handleOnClick={() => {
          setDraftMode(true);
          dispatch({ type: "SET_FILTER", payload: "draft" });
        }}
      />

      <SubmitButton
        variant="default"
        isLoading={isLoading.primaryButton}
        value={editMode && !draftMode ? "Save Changes" : "Publish Course"}
        className="px-2 sm:px-3"
        handleOnClick={() => {
          setDraftMode(false);
          dispatch({ type: "SET_FILTER", payload: "published" });
        }}
      />
    </div>
  );
};
