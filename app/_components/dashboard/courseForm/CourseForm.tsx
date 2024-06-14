"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { useForm, FormProvider } from "react-hook-form";

import { courseAction } from "@/actions/courses.actions";
import { getUserById, getUsersNames } from "@/actions/users.actions";

import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseFormSchema } from "@/types/courseForm.schema";

import { BasicInput } from "./InputBasic";
import { TipTapInput } from "./InputTipTap";
import { ComboBoxInput } from "./InputComboBox";
import { MultiSelectorInput } from "./InputMultiSelector";
import { SelectInput } from "./InputSelect";
import { DateRangeInput } from "./InputDateRange";
import { TimeInput } from "./InputTimeSlot";
import { SubmitButton } from "./SubmitButton";

import { toast } from "sonner";
import { redirect } from "next/navigation";

type CourseFormPropTypes = { editMode?: boolean; courseId: number };

const courseFormDefaultValues: z.infer<typeof courseFormSchema> = {
  enTitle: "",
  enContent: "",
  arTitle: "",
  arContent: "",
  authorId: 0,
  category: "",
  image: "",
  attendance: "",
  registrationStatus: "",
  price: 0,
  timeSlot: {
    from: new Date(),
    to: new Date(),
  },
  days: [],
  courseFlowUrl: "",
  applyUrl: "",
  dateRange: {
    from: new Date(),
    to: new Date(),
  },
};

export default function CourseForm({
  editMode = false,
  courseId,
}: CourseFormPropTypes) {
  const [formState, formAction] = useFormState(courseAction, {
    isPending: true, // initial state of isPending
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const formMethods = useForm({
    resolver: zodResolver(courseFormSchema),
    progressive: false,
    mode: "onChange",
    defaultValues: {
      ...courseFormDefaultValues,
      ...(formState.fields ?? {}),
    },
  });
  console.log("isLoading from main component", isLoading);
  useEffect(() => {
    if (!formState.isPending) setIsLoading(false);
    if (formState.success) toast.success(formState.success);
    if (formState.error) toast.error(formState.error);
    if (!formState.isPending && formState.success)
      redirect("/dashboard/courses");
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
                    console.log("isPending", formState.isPending);
                    console.log("isLoading", isLoading);
                    if (Object.keys(formMethods.formState.errors).length === 0)
                      setIsLoading(true);

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
                <SubmitButton isLoading={isLoading} />
              </form>
            </Form>
          </div>
        </main>
      </FormProvider>
    </>
  );
}
