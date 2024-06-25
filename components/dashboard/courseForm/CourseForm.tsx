"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { useForm, FormProvider } from "react-hook-form";

import { createCourse } from "@/actions/courses.actions";
import { getUserById, getUsersNamesByRole } from "@/actions/users.actions";

import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  courseFormDefaultValues,
  courseSchema,
} from "@/types/courseForm.schema";

import { BasicInput } from "./InputBasic";
import { ComboBoxInput } from "./InputComboBox";
import { MultiSelectorInput } from "./InputMultiSelector";
import { SelectInput } from "./InputSelect";
import { DateRangeInput } from "./InputDateRange";
import { TimeInput } from "./InputTimeSlot";
import { SubmitButton } from "./SubmitButton";

import { toast } from "sonner";
import { redirect } from "next/navigation";
import EnglishTab from "./EnglishTab";
import ArabicTab from "./ArabicTab";

type CourseFormPropTypes = {
  editMode?: boolean;
  courseData?: z.infer<typeof courseSchema>;
  courseId?: number;
};
export default function CourseForm({
  editMode = false,
  courseData,
  courseId,
}: CourseFormPropTypes) {
  if (editMode && (!courseData || !courseId))
    throw new Error("course data or course id not provided");
  const formRef = useRef<HTMLFormElement>(null);

  const [createCourseState, createCourseAction] = useFormState(
    createCourse.bind(null, editMode, courseId),
    {
      isPending: true, // initial state of isPending
    },
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const formMethods = useForm<z.infer<typeof courseSchema>>({
    resolver: zodResolver(courseSchema),
    progressive: false,
    mode: "onChange",
    defaultValues: {
      ...courseFormDefaultValues,
      ...(courseData ?? {}),
    },
  });

  useEffect(() => {
    if (!createCourseState.isPending) setIsLoading(false);
    if (createCourseState.success) toast.success(createCourseState.success);
    if (createCourseState.error) toast.error(createCourseState.error);
    if (!createCourseState.isPending && createCourseState.success)
      redirect("/dashboard/courses");
  }, [createCourseState]);

  const fetchUserById = useCallback(() => {
    return getUserById(courseData?.authorId!);
  }, [courseData?.authorId]);

  const fetchUsersNamesByRole = useCallback(() => {
    return getUsersNamesByRole("author");
  }, []);

  return (
    <>
      <FormProvider {...formMethods}>
        <main className="mx-0 xl:mx-32">
          <div className="grid w-full items-start gap-10">
            <Form {...formMethods}>
              <form
                ref={formRef}
                className="space-y-8"
                action={createCourseAction}
                onSubmit={(e) => {
                  e.preventDefault();
                  formMethods.handleSubmit(() => {
                    if (Object.keys(formMethods.formState.errors).length === 0)
                      setIsLoading(true);
                    createCourseAction(new FormData(formRef.current!));
                  })(e);
                }}
              >
                <fieldset className="grid gap-6 rounded-lg border p-4 shadow-sm">
                  <legend className="-ml-1 px-1 text-sm font-medium">
                    Course Content
                  </legend>
                  <Tabs defaultValue="EnVersion">
                    <TabsList className="mb-3 grid w-full grid-cols-2">
                      <TabsTrigger value="EnVersion">English</TabsTrigger>
                      <TabsTrigger value="ArVersion">
                        Arabic
                        <span className="pl-2 text-xs opacity-50">
                          optional
                        </span>
                      </TabsTrigger>
                    </TabsList>
                    <EnglishTab />
                    <ArabicTab />
                  </Tabs>
                </fieldset>

                <fieldset className="grid gap-6 rounded-lg border p-4 shadow-sm">
                  <legend className="-ml-1 px-1 text-sm font-medium">
                    Course Metadata
                  </legend>
                  <div className="grid justify-center gap-10 lg:grid-cols-2">
                    <ComboBoxInput
                      name="authorId"
                      label="Facilitator"
                      placeholder="Select facilitator..."
                      emptyMsg="Facilitator Not Found"
                      searchPlaceholder="Search facilitators..."
                      fetchItemsAction={fetchUsersNamesByRole}
                      editMode={editMode}
                      fetchItemByIdAction={fetchUserById}
                    />
                    <BasicInput
                      type="url"
                      name="courseFlowUrl"
                      label="Course Flow"
                      placeholder="Course Flow Url"
                    />

                    <BasicInput
                      type="file"
                      placeholder="Choose Poster"
                      name="image"
                      label="Course Poster"
                    />
                    <DateRangeInput
                      name="dateRange"
                      label="Start and End Date"
                      placeholder=""
                    />
                    <SelectInput
                      name="isRegistrationOpen"
                      label="Registration Status"
                      placeholder="Select status"
                      options={[{ selectItems: ["Open", "Closed"] }]}
                    />
                    <BasicInput
                      name="applyUrl"
                      label="Registration Form"
                      placeholder="Registration Form Url"
                      type="url"
                    />
                    <SelectInput
                      name="attendance"
                      label="Attendance"
                      placeholder="Select mode"
                      options={[
                        { selectItems: ["Online", "Offline", "Hybrid"] },
                      ]}
                    />
                    <BasicInput
                      name="price"
                      label="Price"
                      placeholder="Enter price"
                      type="number"
                    />
                    <SelectInput
                      name="category"
                      label="Category"
                      placeholder="Select category"
                      options={[
                        { selectItems: ["Seasonal Course", "Workshop"] },
                        {
                          groupLabel: "Seasonal Semester",
                          selectItems: ["Thematic Course", "Lab"],
                        },
                      ]}
                    />

                    <MultiSelectorInput
                      name="days"
                      label={"Days"}
                      placeholder="Select Days"
                      emptyMsg="no results found."
                      options={[
                        { label: "Saturday", value: "saturday" },
                        { label: "Sunday", value: "sunday" },
                        { label: "Monday", value: "monday" },
                        { label: "Tuesday", value: "tuesday" },
                        { label: "Wednesday", value: "wednesday" },
                        { label: "Thursday", value: "thursday" },
                        { label: "Friday", value: "friday" },
                      ]}
                    />
                    <div className="-ml-4 flex w-full scale-90 items-center gap-2 md:ml-0 md:scale-100">
                      <TimeInput
                        name="timeSlot"
                        label="Time Slot"
                        placeholder="Start Time"
                      />
                    </div>
                  </div>
                </fieldset>
                <SubmitButton isLoading={isLoading} editMode={editMode} />
              </form>
            </Form>
          </div>
        </main>
      </FormProvider>
    </>
  );
}
