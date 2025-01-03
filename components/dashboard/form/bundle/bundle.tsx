"use client";

import { useEffect, useRef, useTransition } from "react";
import { useFormState } from "react-dom";
import { redirect } from "next/navigation";
import Link from "next/link";

import {
  BundleState,
  createBundle,
  editBundle,
} from "@/lib/actions/bundles.actions";
import { getUnbundledCourses } from "@/lib/actions/courses.actions";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useCourseState } from "@/lib/providers/CourseState.provider";
import {
  MultiSelectorInput,
  SelectInput,
  DateInput,
  SubmitButton,
} from "@/components/dashboard/form/inputs/";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  bundleDefaultValues,
  bundleSchema,
  BundleSchema,
} from "@/lib/types/bundle.schema";

export default function BundleForm({
  bundleToEditValues,
  editMode = false,
  bundleId,
}: {
  bundleToEditValues?: BundleSchema;
  editMode?: boolean;
  bundleId?: number;
}) {
  const { forceUpdateBundles, dispatch } = useCourseState();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const [bundleState, bundleAction] = useFormState(
    editMode && bundleId ? editBundle : createBundle,
    {} as BundleState,
  );

  const formMethods = useForm<BundleSchema>({
    resolver: zodResolver(bundleSchema),
    mode: "onChange",
    defaultValues: { ...bundleDefaultValues, ...(bundleToEditValues ?? {}) },
  });
  useEffect(() => {
    if (bundleState.success) {
      forceUpdateBundles();
      toast.success(bundleState.message);
      dispatch({ type: "SET_COURSE_SELECTED", payload: null });
      dispatch({ type: "SET_ACTIVE_TAB", payload: "bundles" });
      redirect("/dashboard/course-management?tab=bundles");
    }
    if (bundleState.error) toast.error(bundleState.message);
  }, [bundleState, forceUpdateBundles, dispatch]);

  return (
    <FormProvider {...formMethods}>
      <Form {...formMethods}>
        <form
          ref={formRef}
          className="mx-5"
          action={bundleAction}
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();

            formMethods.handleSubmit(() => {
              startTransition(() => {
                const formData = new FormData(formRef.current!);
                bundleAction(formData);
              });
            })(e);
          }}
        >
          <fieldset className="grid gap-6 rounded-lg border p-4 shadow-sm lg:grid-cols-2">
            <legend className="text-sm font-medium">Bundle</legend>
            <input hidden name="bundleId" value={bundleId} readOnly />
            <SelectInput
              name="year"
              label="Year"
              options={[
                {
                  selectItems: Array.from({ length: 14 }, (_, i) =>
                    (new Date().getFullYear() - i).toString(),
                  ),
                },
              ]}
              placeholder="Select a year"
            />
            <SelectInput
              name="cycle"
              label="Cycle"
              options={[
                { selectItems: ["Spring", "Summer", "Fall", "Winter"] },
              ]}
              placeholder="Select a cycle"
            />
            <SelectInput
              name="category"
              label="Category"
              options={[
                {
                  selectItems: [
                    "Seasonal",
                    "Second Trimester",
                    "Third Trimester",
                    "Labs",
                  ],
                },
              ]}
              placeholder="Select a category"
            />
            <SelectInput
              name="attendance"
              label="Attendance"
              options={[{ selectItems: ["Online", "Offline", "Hybrid"] }]}
              placeholder="Select a attendance"
            />
            <DateInput
              name="deadline"
              label="Registration deadline"
              placeholder="Select a deadline"
            />
            <MultiSelectorInput
              name="courses"
              label="Courses"
              placeholder="Select unbundled courses"
              onSearch={getUnbundledCourses}
              triggerSearchOnFocus={true}
              emptyMsg="No Courses found!"
            />
          </fieldset>
          <div className="my-8 flex gap-5">
            <Link
              href={"/dashboard/course-management#bundles"}
              className="w-full"
            >
              <Button variant="secondary" className="w-full">
                Cancel
              </Button>
            </Link>
            <SubmitButton
              value={`${editMode ? "Save Changes" : "Create Bundle"}`}
              isLoading={isPending}
            />
          </div>
        </form>
      </Form>
    </FormProvider>
  );
}
