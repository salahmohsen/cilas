"use client";

import { MultiSelectorInput } from "@/components/form-inputs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { searchUsers } from "@/lib/actions/users.actions";
import { AddStudentSchema, addStudentSchema } from "@/lib/types/forms.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogDescription } from "@radix-ui/react-dialog";
import { useCallback, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

export const AddStudentsDialog = ({ isOpen, setIsOpen }) => {
  const [loading, setLoading] = useState(false);

  const getUsersOptions = useCallback(async (query: string) => {
    setLoading(true);
    const data = await searchUsers(query);
    const dataFormatted = data.map((user) => {
      return {
        value: user.id,
        label: `${user.firstName} ${user.lastName}`,
      };
    });
    setLoading(false);
    return dataFormatted;
  }, []);

  const formMethods = useForm<AddStudentSchema>({
    resolver: zodResolver(addStudentSchema.schema),
    defaultValues: addStudentSchema.defaults,
  });

  function onSubmit(values: AddStudentSchema) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log("submitted");
    console.log("submitted values", values);
  }

  return (
    <FormProvider {...formMethods}>
      <Form {...formMethods}>
        <form onSubmit={formMethods.handleSubmit(onSubmit)}>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent aria-description="add students to course">
              <DialogHeader>
                <DialogTitle>Add Students</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <DialogDescription>
                  Start typing the name of the student you want to add to this course.
                </DialogDescription>

                <MultiSelectorInput<AddStudentSchema, "students">
                  name="students"
                  placeholder="Select students"
                  onSearch={getUsersOptions}
                  triggerSearchOnFocus={true}
                  emptyMsg="No Users found!"
                />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Students</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </form>
      </Form>
    </FormProvider>
  );
};
