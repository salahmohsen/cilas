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
import { addStudentToCourse, searchUsers } from "@/lib/actions/users.actions";
import { AddStudentSchema, addStudentSchema } from "@/lib/types/forms.schema";
import { AddStudentToCourseState } from "@/lib/types/users.actions.types";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogDescription } from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";

type AddStudentsDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  courseId: number;
};

export const AddStudentsDialog = ({
  isOpen,
  setIsOpen,
  courseId,
}: AddStudentsDialogProps) => {
  const formMethods = useForm<AddStudentSchema>({
    resolver: zodResolver(addStudentSchema.schema),
    defaultValues: addStudentSchema.defaults(courseId),
    mode: "onSubmit",
  });

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
          serverAction={addStudentToCourse}
          onSuccess={() => setIsOpen(false)}
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
                <SubmitButton isLoading={isPending}>Add Students</SubmitButton>
              </DialogFooter>
            </>
          )}
        </FormWrapper>
      </DialogContent>
    </Dialog>
  );
};
