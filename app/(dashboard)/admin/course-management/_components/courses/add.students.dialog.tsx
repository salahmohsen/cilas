"use client";

import { useCourseStore } from "@/app/(dashboard)/admin/course-management/_lib/course.slice";
import { Button } from "@/components/button";
import { MultiSelectorInput } from "@/components/form-inputs";
import { FormWrapper } from "@/components/form-inputs/form.wrapper";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Option } from "@/components/ui/multipleSelector";
import { searchUsers, updateCourseEnrollments } from "@/lib/users/users.actions";
import { BasePrevState } from "@/lib/users/users.actions.types";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogDescription } from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import studentSchema, { StudentSchema } from "../../_lib/student.schema";

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
  const formMethods = useForm<StudentSchema>({
    resolver: zodResolver(studentSchema.schema),
    defaultValues: studentSchema.defaults(courseId, courseStudents),
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

        <FormWrapper<StudentSchema, BasePrevState>
          formMethods={formMethods}
          serverAction={updateCourseEnrollments}
          onSuccess={() => {
            setIsOpen(false);
            revalidateCourse(courseId);
          }}
        >
          {({ isPending }) => (
            <>
              <MultiSelectorInput<StudentSchema, "students">
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
