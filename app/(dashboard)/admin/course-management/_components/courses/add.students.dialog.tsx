"use client";

import { MultiSelectorInput } from "@/components/form-inputs";
import { FormWrapper } from "@/components/form-inputs/form.wrapper";
import { Button } from "@/components/hoc/button";
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
import { BasePrevState } from "@/lib/types/users.actions.types";
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

  const { revalidateCourse } = useCourseStore();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent aria-description="Update course enrollments">
        <DialogHeader>
          <DialogTitle>Update course enrollments</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Start typing to add new students or remove existing ones from this course.
          </DialogDescription>
        </DialogHeader>

        <FormWrapper<AddStudentSchema, BasePrevState>
          formMethods={formMethods}
          serverAction={updateCourseEnrollments}
          onSuccess={() => {
            setIsOpen(false);
            revalidateCourse(courseId);
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
                <Button type="submit" isLoading={isPending}>
                  Update
                </Button>
              </DialogFooter>
            </>
          )}
        </FormWrapper>
      </DialogContent>
    </Dialog>
  );
};
