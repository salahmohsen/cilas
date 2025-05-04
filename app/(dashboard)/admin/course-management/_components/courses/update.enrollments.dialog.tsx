"use client";

import { useCourseStore } from "@/app/(dashboard)/admin/course-management/_lib/course.slice";
import { Button } from "@/components/button";
import { FormFieldWrapper } from "@/components/form-inputs/form.field.wrapper";
import { FormWrapper } from "@/components/form-inputs/form.wrapper";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchUsers } from "@/lib/users/users.actions";
import { arktypeResolver } from "@hookform/resolvers/arktype";
import { DialogDescription } from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { updateEnrollments } from "../../_lib/courses.actions";
import { Enrollment } from "../../_lib/courses.actions.types";
import {
  updateEnrollmentsSchema,
  UpdateEnrollmentsSchema,
} from "../../_lib/update.enrollments.schema";

type updateEnrollmentsDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  courseId: number;
  enrollments: Enrollment[];
};

export const UpdateEnrollmentsDialog = ({
  isOpen,
  setIsOpen,
  courseId,
  enrollments,
}: updateEnrollmentsDialogProps) => {
  const formMethods = useForm<UpdateEnrollmentsSchema>({
    resolver: arktypeResolver(updateEnrollmentsSchema.schema),
    defaultValues: updateEnrollmentsSchema.defaults(enrollments, courseId),
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: formMethods.control,
    name: "enrollments",
  });

  const { revalidateCourse } = useCourseStore();

  const newEnrollment = {
    status: "unpaid" as const,
    enrollmentDate: new Date(),
    paidAmount: null,
    paymentDate: null,
    courseId: courseId,
    userId: "",
  };

  useEffect(() => {
    if (!isOpen)
      formMethods.reset(updateEnrollmentsSchema.defaults(enrollments, courseId));
  }, [isOpen, enrollments, courseId, formMethods.reset]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        formMethods.reset();
      }}
    >
      <DialogContent
        aria-description="Update course enrollments"
        className="max-w-full md:max-w-[calc(100vw-20rem)]"
      >
        <DialogHeader>
          <DialogTitle>Update course enrollments</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Start typing to add new students or remove existing ones from this course.
          </DialogDescription>
        </DialogHeader>

        <FormWrapper<UpdateEnrollmentsSchema>
          formMethods={formMethods}
          serverAction={updateEnrollments}
          onSuccess={() => {
            setIsOpen(false);
            revalidateCourse(courseId);
          }}
        >
          {({ isPending }) => (
            <>
              <div className="flex max-h-[calc(100vh-20rem)] flex-wrap gap-5 overflow-y-auto">
                <input
                  type="hidden"
                  {...formMethods.register("courseId", { value: courseId })}
                />
                {fields.map((field, index) => {
                  return (
                    <div
                      key={field.id}
                      className="bg-muted relative flex h-[410px] w-full flex-col items-start gap-2 overflow-y-auto rounded-md p-5 lg:w-[31%]"
                    >
                      <input
                        hidden
                        {...formMethods.register(`enrollments.${index}.courseId`)}
                      />

                      <FormFieldWrapper
                        label="User"
                        control={formMethods.control}
                        name={`enrollments.${index}.userId`}
                        itemClasses="w-full"
                      >
                        {({ field }) => {
                          return (
                            <Combobox
                              {...field}
                              notFoundMsg="No users found!"
                              btnPlaceholder="Select User"
                              searchPlaceholder="Search users..."
                              asyncSearch={searchUsers}
                            />
                          );
                        }}
                      </FormFieldWrapper>

                      <FormFieldWrapper
                        label="Status"
                        name={`enrollments.${index}.status`}
                        itemClasses="w-full"
                      >
                        {({ field }) => {
                          const { disabled, name, onBlur, onChange, ref, value } = field;
                          return (
                            <Select
                              value={value}
                              onValueChange={onChange}
                              name={name}
                              disabled={disabled}
                            >
                              <SelectTrigger
                                disabled={disabled}
                                onBlur={onBlur}
                                ref={ref}
                              >
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="enrolled">Enrolled</SelectItem>
                                <SelectItem value="certified">Certified</SelectItem>
                              </SelectContent>
                            </Select>
                          );
                        }}
                      </FormFieldWrapper>

                      {/* <FormFieldWrapper
                        label="Paid Amount"
                        control={formMethods.control}
                        name={`enrollments.${index}.paidAmount`}
                        itemClasses="w-full"
                      >
                        {({ field }) => {
                          return (
                            // @ts-ignore
                            <Input
                              {...field}
                              type="number"
                              placeholder="Paid Amount"
                              className="shadow-none"
                            />
                          );
                        }}
                      </FormFieldWrapper> */}

                      <FormFieldWrapper
                        label="Paid Amount"
                        control={formMethods.control}
                        name={`enrollments.${index}.paidAmount`}
                        itemClasses="w-full"
                      >
                        {({ field }) => {
                          return (
                            // @ts-ignore
                            <Input
                              {...field}
                              type="number"
                              placeholder="Paid Amount"
                              className="shadow-none"
                            />
                          );
                        }}
                      </FormFieldWrapper>

                      <FormFieldWrapper
                        label="Enrollment Date"
                        control={formMethods.control}
                        name={`enrollments.${index}.enrollmentDate`}
                        itemClasses="w-full"
                      >
                        {({ field }) => {
                          const onChange = (e: Date | undefined) => {
                            field.onChange(e ?? new Date());
                          };

                          return (
                            <DatePicker
                              {...field}
                              onChange={onChange}
                              placeholder="Enrollment Date"
                            />
                          );
                        }}
                      </FormFieldWrapper>

                      <FormFieldWrapper
                        label="Payment Date"
                        control={formMethods.control}
                        name={`enrollments.${index}.paymentDate`}
                        itemClasses="w-full"
                      >
                        {({ field }) => {
                          const onChange = (e: Date | undefined) => {
                            field.onChange(e ?? null);
                          };

                          return (
                            <DatePicker
                              {...field}
                              onChange={onChange}
                              placeholder="Payment Date"
                            />
                          );
                        }}
                      </FormFieldWrapper>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="absolute top-2 right-2 h-5 w-5"
                      >
                        <X className="h-4 w-4 rounded-full border" />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="ghost"
                  className="hover:bg-muted flex h-[406px] w-full items-center justify-center gap-2 overflow-y-auto rounded-md border p-5 hover:border-0 lg:w-[31%]"
                  onClick={() => append(newEnrollment)}
                >
                  <Plus className="h-6 w-6 rounded-full border" />
                  <span>Add Student</span>
                </Button>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="secondary" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isPending} disabled={isPending}>
                  Save Changes
                </Button>
              </DialogFooter>
            </>
          )}
        </FormWrapper>
      </DialogContent>
    </Dialog>
  );
};
