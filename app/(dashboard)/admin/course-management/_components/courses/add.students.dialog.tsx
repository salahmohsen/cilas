"use client";

import { MultiSelectorInput, SubmitButton } from "@/components/form-inputs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { addStudentToCourse, searchUsers } from "@/lib/actions/users.actions";
import { AddStudentSchema, addStudentSchema } from "@/lib/types/forms.schema";
import { AddStudentToCourseState } from "@/lib/types/users.actions.types";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogDescription } from "@radix-ui/react-dialog";
import { useEffect, useRef, useTransition } from "react";
import { useFormState } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
  const [formState, formAction] = useFormState(
    addStudentToCourse,
    {} as AddStudentToCourseState,
  );

  const [isPending, startTransition] = useTransition();

  const formMethods = useForm<AddStudentSchema>({
    resolver: zodResolver(addStudentSchema.schema),
    defaultValues: addStudentSchema.defaults(courseId),
    mode: "onSubmit",
  });

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (formState.success) {
      toast.success(formState.message);
      setIsOpen(false);
    }
    if (formState.error) toast.error(formState.message);
  }, [formState, setIsOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent aria-description="add students to course">
        <DialogHeader>
          <DialogTitle>Add Students</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Start typing the name of the student you want to add to this course.
          </DialogDescription>
        </DialogHeader>

        <Form {...formMethods}>
          <form
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(() => {
                formMethods.handleSubmit(() => {
                  formAction(new FormData(formRef.current!));
                })(e);
              });
            }}
            action={formAction}
          >
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
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
