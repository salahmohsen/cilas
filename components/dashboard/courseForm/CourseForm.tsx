"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { useForm, FormProvider } from "react-hook-form";

import { courseAction } from "@/actions/CoursesActions";
import { getUserById, getUsersNames } from "@/actions/usersActions";

import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CourseFormSchema,
  courseFormDefaultValues,
  courseFormSchema,
} from "@/components/dashboard/courseForm/courseFormSchema";

import { BasicInput } from "./input-basic";
import { TipTapInput } from "./input-tipTap";
import { ComboBoxInput } from "./input-combobox";
import { MultiSelectorInput } from "./input-multiselector";
import { SelectInput } from "./input-select";
import { DateRangeInput } from "./input-dateRange";
import { TimeInput } from "./input-timeSlot";
import SubmitButton from "@/components/dashboard/SubmitButton";

import { toast } from "sonner";

type CourseFormPropTypes = { editMode?: boolean; courseId: number };

export default function CourseForm({
  editMode = false,
  courseId,
}: CourseFormPropTypes) {
  const [formState, formAction] = useFormState(courseAction, {});

  const formMethods = useForm<CourseFormSchema>({
    resolver: zodResolver(courseFormSchema),
    progressive: false,
    mode: "onChange",
    defaultValues: {
      ...courseFormDefaultValues,
      ...(formState.fields ?? {}),
    },
  });

  useEffect(() => {
    if (formState?.success) toast.success(formState?.success);
    if (formState?.error) toast.error(formState?.error);
  }, [formState]);

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <FormProvider {...formMethods}>
        <main className="mx-auto max-w-6xl overflow-auto scroll-smooth p-4 lg:w-5/6">
          <div className="grid w-full items-start gap-10">
            <Form {...formMethods}>
              <form
                ref={formRef}
                className="space-y-8"
                action={formAction}
                onSubmit={(e) => {
                  e.preventDefault();
                  formMethods.handleSubmit(() => {
                    formAction(new FormData(formRef.current!));
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
                    <TabsContent
                      value="EnVersion"
                      forceMount
                      className="data-[state=inactive]:hidden"
                    >
                      <div className={`flex flex-col gap-6`}>
                        <BasicInput
                          type="text"
                          label="Title"
                          placeholder="English Title"
                          name={"enTitle"}
                        />
                        <TipTapInput
                          name="enContent"
                          placeholder="Write English course description here..."
                        />
                      </div>
                    </TabsContent>
                    <TabsContent
                      value="ArVersion"
                      forceMount
                      className="data-[state=inactive]:hidden"
                    >
                      <div className="flex flex-col gap-6">
                        <BasicInput
                          type="text"
                          name="arTitle"
                          label="Title"
                          placeholder="Arabic Title"
                        />
                        <TipTapInput
                          name="arContent"
                          placeholder="Write Arabic course description here..."
                        />
                      </div>
                    </TabsContent>
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
                      fetchItemsAction={getUsersNames}
                      editMode={editMode}
                      id={courseId}
                      fetchItemByIdAction={getUserById}
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
                <SubmitButton />
              </form>
            </Form>
          </div>
        </main>
      </FormProvider>
    </>
  );
}
