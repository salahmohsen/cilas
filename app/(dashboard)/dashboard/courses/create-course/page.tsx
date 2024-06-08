"use client";

import { useFormState } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormInputs, createCourseSchema } from "@/schemas/newCourseSchema";

import { createCourseAction, getCourseById } from "@/actions/CoursesActions";
import { getUsers } from "@/actions/usersActions";

import { Toaster, toast } from "sonner";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRightFromLine, Squirrel } from "lucide-react";

import {
  TextInput,
  FileInput,
  SelectInput,
  ComboBoxInput,
  TimeInput,
  MultiSelectorInput,
  DateRangeInput,
  TipTapInput,
} from "@/components/dashboard/FormInputs";

import SubmitButton from "@/components/dashboard/SubmitButton";

export default function CreateCoursePage({
  isEditForm = false,
  courseId = null,
}) {
  // Time Refs passed to start and end session input to change focus between them automatically
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

  const {  reset, getValues, formState } = form;


/* This `useEffect` checking if the component is in edit mode (`isEditForm`). 
If yes it calls the `getCourseById` function to fetch course data based on the `courseId` provided from edit page */

  useEffect(() => {
    if (isEditForm && courseId) {
      try {
        getCourseById(courseId).then((course) => {
          const startTimeParts = course.sessionStartTime.split(":");
          const endTimeParts = course.sessionEndTime.split(":");
          const courseValues: FormInputs = {
            enTitle: course.enTitle || '',
            arTitle: course.arTitle || '',
            enContent: course.enContent || '',
            arContent: course.arContent || '',
            authorId: String(course.authorId),
            imageUrl: course.imageUrl || '',
            category: course.category,
            attendance: course.attendance as "offline" | "online" | "hybrid",
            registrationStatus: course.registrationStatus ? "open" : "closed" as "open" | "closed",
            price:  String(course.price) || '',
            sessionStartTime: new Date(
              0,
              0,
              0,
              Number(startTimeParts[0]),
              Number(startTimeParts[1]),
            ),
            sessionEndTime: new Date(
              0,
              0,
              0,
              Number(endTimeParts[0]),
              Number(endTimeParts[1]),
            ),
            days: course.days as { value: string; label: string; disable?: boolean }[],
            courseFlowUrl: course.courseFlowUrl || '',
            applyUrl: course.applyUrl || '',
            dateRange: {
              from: new Date(course.startDate),
              to: new Date(course.endDate),
            },
          };
          reset(courseValues);
        });
      } catch (error) {
        toast.error(
          <div className="flex gap-2">
            <Squirrel />
            <span>Failed fetching course data, Please try again later!</span>
          </div>,
        );
      }
    }
  }, [courseId, isEditForm, reset]);

  const [formStatus, formAction] = useFormState(
    createCourseAction.bind(null, form.getValues()),
    { success: "", error: undefined },
  );

  function action() {
    form.handleSubmit(() => formAction())();
  }

  useEffect(() => {
    if (formStatus.success) {
      toast.success(formStatus.success);
    }
    if (formStatus.error) {
      toast.error(formStatus.error);
    }
  }, [formStatus]);

  return (
    <main className="mx-auto max-w-6xl overflow-auto p-4">
      <div className="grid w-full items-start gap-6">
        <Form {...form}>
          <form action={action} className="group/inputs space-y-8">
            <fieldset className="grid gap-6 rounded-lg border p-4 shadow-sm">
              <legend className="-ml-1 px-1 text-sm font-medium">
                Course Content
              </legend>
              <Tabs defaultValue="EnVersion">
                <TabsList className="mb-3 grid w-full grid-cols-2">
                  <TabsTrigger value="EnVersion">English</TabsTrigger>
                  <TabsTrigger value="ArVersion">
                    Arabic
                    <span className="pl-2 text-xs opacity-50">optional</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="EnVersion">
                  <div className="flex flex-col gap-6">
                    <TextInput
                      control={form.control}
                      name="enTitle"
                      formLabel="Title"
                      placeholder="English Title"
                      
                    />
                    <TipTapInput
                      control={form.control}
                      name="enContent"
                      placeholder="Write English course description here..."
                      
                    />
                  </div>
                </TabsContent>
                <TabsContent value="ArVersion">
                  <div className="flex flex-col gap-6">
                    <TextInput
                      control={form.control}
                      name="arTitle"
                      formLabel="Title"
                      placeholder="Arabic Title"
                      
                    />
                    <TipTapInput
                      control={form.control}
                      name="arContent"
                      placeholder="Write Arabic course description here..."
                      
                    />
                  </div>
                </TabsContent>
              </Tabs>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <ComboBoxInput
                  control={form.control}
                  name="authorId"
                  formLabel="Facilitator"
                  commandEmptyMsg="Facilitator Not Found"
                  placeholder="Select facilitator..."
                  action={getUsers}
                  searchPlaceholder="Search facilitators..."
                  
                  isEditForm={isEditForm}
                  preValue={getValues('authorId')}
                />
                <TextInput
                  control={form.control}
                  name="courseFlowUrl"
                  formLabel="Course Flow"
                  placeholder="Course Flow Url"
                  
                />

                <FileInput
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
              <div className="flex flex-col gap-6">
                <DateRangeInput
                  control={form.control}
                  name="dateRange"
                  formLabel="Start and End Date"
                  
                />
                <SelectInput
                  control={form.control}
                  name="registrationStatus"
                  formLabel="Registration Status"
                  placeholder="Select status"
                  selects={[{ selectItems: ["Open", "Closed"] }]}
                  
                />
                <TextInput
                  control={form.control}
                  name="applyUrl"
                  formLabel="Registration Form"
                  placeholder="Registration Form Url"
                  
                />
                <SelectInput
                  control={form.control}
                  name="attendance"
                  formLabel="Attendance"
                  placeholder="Select mode"
                  selects={[{ selectItems: ["Online", "Offline", "Hybrid"] }]}
                  
                />
                <TextInput
                  control={form.control}
                  name="price"
                  formLabel="Price"
                  placeholder="Enter price"
                  
                />
                <SelectInput
                  control={form.control}
                  name="category"
                  formLabel="Category"
                  placeholder="Select category"
                  selects={[
                    { selectItems: ["Seasonal Course", "Workshop"] },
                    {
                      groupLabel: "Seasonal Semester",
                      selectItems: ["Thematic Course", "Lab"],
                    },
                  ]}
                  
                />

                <MultiSelectorInput
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
                <div className="-ml-4 flex w-full scale-90 items-center gap-2 md:ml-0 md:scale-100">
                  <TimeInput
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
                  <TimeInput
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
}
