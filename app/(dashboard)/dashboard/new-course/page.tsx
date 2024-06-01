"use client";

import { useFormState } from "react-dom";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormInputs, createCourseSchema } from "@/schemas/createCourseSchema";

import { createCourseAction, getUsers } from "@/actions/dashboardActions";

import { Toaster, toast } from "sonner";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRightFromLine } from "lucide-react";

import {
  CCFtextInput,
  CCFtextAreaInput,
  CCFFileInput,
  CCFSelectInput,
  CCFcomboBoxInput,
  CCFtimeSInput,
  CCFmultiSelectorInput,
  CCFdateRange,
  CCFtipTapInput,
} from "@/components/dashboard/CreateCourseInputs";

import SubmitButton from "@/components/dashboard/SubmitButton";

const CreateCoursePage = () => {
  const startMinuteRef = useRef(null);
  const endHourRef = useRef(null);
  const endMinuteRef = useRef(null);
  const startHourRef = useRef(null);
  const form = useForm<FormInputs>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: {
      dateRange: {
        from: new Date(),
        to: new Date(),
      },
    },
  });
  const [formState, formAction] = useFormState(
    createCourseAction.bind(null, form.getValues()),
    { success: "", error: undefined },
  );

  function action({ formData }) {
    form.handleSubmit(() => formAction(formData))();
  }

  useEffect(() => {
    if (formState.success) {
      toast.success(formState.success);
    }
    if (formState.error) {
      toast.error(formState.error);
    }
  }, [formState]);

  return (
    <main className=" mx-auto max-w-6xl overflow-auto p-4 ">
      <Toaster richColors />
      <div className="grid w-full items-start gap-6">
        <Form {...form}>
          <form action={action} className="space-y-8">
            <fieldset className="grid gap-6 rounded-lg border p-4 shadow-sm">
              <legend className="-ml-1 px-1 text-sm font-medium">
                Course Content
              </legend>
              <Tabs defaultValue="EnVersion">
                <TabsList className="mb-3 grid w-full grid-cols-2">
                  <TabsTrigger value="EnVersion">English</TabsTrigger>
                  <TabsTrigger value="ArVersion">
                    Arabic
                    <span className=" pl-2 text-xs opacity-50">optional</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="EnVersion">
                  <div className="flex flex-col gap-6">
                    <CCFtextInput
                      control={form.control}
                      name="enTitle"
                      formLabel="Title"
                      placeholder="English Title"
                    />
                    <CCFtipTapInput
                      control={form.control}
                      name="enContent"
                      placeholder="Write English course description here..."
                    />
                    {/* <CCFtextAreaInput
                      control={form.control}
                      name="enContent"
                      formLabel="Content"
                      placeholder="Write English course description here..." 
                    /> */}
                  </div>
                </TabsContent>
                <TabsContent value="ArVersion">
                  <div className="flex flex-col gap-6">
                    <CCFtextInput
                      control={form.control}
                      name="arTitle"
                      formLabel="Title"
                      placeholder="Arabic Title"
                    />
                    <CCFtipTapInput
                      control={form.control}
                      name="arContent"
                      placeholder="Write Arabic course description here..."
                    />

                    {/* <CCFtextAreaInput
                      control={form.control}
                      name="arContent"
                      formLabel="Content"
                      placeholder="Write Arabic course details here..."
                    /> */}
                  </div>
                </TabsContent>
              </Tabs>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <CCFcomboBoxInput
                  control={form.control}
                  name="authorId"
                  formLabel="Facilitator"
                  commandEmptyMsg="Facilitator Not Found"
                  placeholder="Select facilitator..."
                  action={getUsers}
                  searchPlaceholder="Search facilitators..."
                />
                <CCFtextInput
                  control={form.control}
                  name="courseFlowUrl"
                  formLabel="Course Flow"
                  placeholder="Course Flow Url"
                />

                <CCFFileInput
                  control={form.control}
                  name="imageUrl"
                  formLabel="Course Poster"
                />
              </div>
            </fieldset>

            <fieldset className="grid gap-6 rounded-lg border p-4 shadow-sm">
              <legend className="-ml-1 px-1 text-sm font-medium">
                Course Metadata
              </legend>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <CCFdateRange
                  control={form.control}
                  name="dateRange"
                  formLabel="Start and End Date"
                />
                <CCFSelectInput
                  control={form.control}
                  name="registrationStatus"
                  formLabel="Registration Status"
                  placeholder="Select status"
                  options={["Open", "Closed"]}
                />
                <CCFtextInput
                  control={form.control}
                  name="applyUrl"
                  formLabel="Registration Form"
                  placeholder="Registration Form Url"
                />
                <CCFSelectInput
                  control={form.control}
                  name="attendance"
                  formLabel="Attendance"
                  placeholder="Select mode"
                  options={["Online", "Offline", "Hybrid"]}
                />
                <CCFtextInput
                  control={form.control}
                  name="price"
                  formLabel="Price"
                  placeholder="Enter price"
                />
                <CCFSelectInput
                  control={form.control}
                  name="category"
                  formLabel="Category"
                  placeholder="Select category"
                  options={["Thematic", "Lab"]}
                />

                <CCFSelectInput
                  control={form.control}
                  name="seasonCycle"
                  formLabel="Season Cycle"
                  placeholder="Select cycle"
                  options={["Winter", "Spring", "Summer", "Autumn"]}
                />

                <CCFSelectInput
                  control={form.control}
                  name="weekDuration"
                  placeholder="Select Weeks number"
                  formLabel="Week Duration"
                  options={Array.from({ length: 15 }, (_, i) => String(1 + i))}
                />
                <CCFmultiSelectorInput
                  control={form.control}
                  name="days"
                  formLabel={"Days"}
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
                <div className=" -ml-4 flex w-full scale-90 items-center gap-2  md:ml-0 md:scale-100  ">
                  <CCFtimeSInput
                    control={form.control}
                    name="sessionStartTime"
                    formLabel="Time Slot"
                    placeholder="Start Time"
                    hourRef={startHourRef}
                    minuteRef={startMinuteRef}
                    transitionRef={endHourRef}
                  />
                  <span className="mt-[53px] md:hidden">:</span>
                  <ArrowRightFromLine
                    strokeWidth={0.8}
                    className="mt-[53px] hidden md:block"
                  />
                  <CCFtimeSInput
                    control={form.control}
                    name="sessionEndTime"
                    formLabel={"‎"}
                    placeholder="End Time"
                    hourRef={endHourRef}
                    minuteRef={endMinuteRef}
                    transitionRef={startMinuteRef}
                  />
                </div>
              </div>
            </fieldset>
            <SubmitButton />
          </form>
        </Form>
      </div>
    </main>
  );
};

export default CreateCoursePage;
