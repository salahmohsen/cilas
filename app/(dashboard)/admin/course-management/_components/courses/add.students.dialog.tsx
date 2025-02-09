"use client";

import { MultiSelectorInput, SubmitButton } from "@/components/form-inputs";
import { FormWrapper } from "@/components/form-inputs/form.wrapper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Option } from "@/components/ui/multipleSelector";
import { searchUsers, updateCourseEnrollments } from "@/lib/actions/users.actions";
import { useCourseStore } from "@/lib/store/course.slice";
import { AddStudentSchema, addStudentSchema } from "@/lib/types/forms.schema";
import { AddStudentToCourseState } from "@/lib/types/users.actions.types";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogDescription } from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";

type AddStudentsDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  courseId: number;
  courseStudents: Option[];
};

export const AddStudentsDialog = ({
  isOpen,
  setIsOpen,
  courseId,
  courseStudents,
}: AddStudentsDialogProps) => {
  const formMethods = useForm<AddStudentSchema>({
    resolver: zodResolver(addStudentSchema.schema),
    defaultValues: addStudentSchema.defaults(courseId, courseStudents),
    mode: "onSubmit",
  });

  const { revalidateCourse: updateCourse } = useCourseStore();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent aria-description="add students to course">
        <DialogHeader>
          <DialogTitle>Add Students</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Start typing the name of the student you want to add to this course.
          </DialogDescription>
        </DialogHeader>

        <FormWrapper<AddStudentSchema, AddStudentToCourseState>
          formMethods={formMethods}
          serverAction={updateCourseEnrollments}
          onSuccess={() => {
            setIsOpen(false);
            updateCourse(courseId);
          }}
        >
          {({ isPending }) => (
            <>
              <MultiSelectorInput<AddStudentSchema, "students">
                name="students"
                placeholder="Select students"
                onSearch={searchUsers}
                triggerSearchOnFocus
                emptyMsg="No Users found!"
              />

              <input type="hidden" readOnly name="courseId" value={courseId} />

              <DialogFooter className="mt-4">
                <Button variant="secondary" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton isLoading={isPending}>
                  Update course enrollments
                </SubmitButton>
              </DialogFooter>
            </>
          )}
        </FormWrapper>
      </DialogContent>
    </Dialog>
  );
};
