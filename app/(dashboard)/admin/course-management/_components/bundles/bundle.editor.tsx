"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { useFormState } from "react-dom";

import { BundleState, createBundle, editBundle } from "@/lib/actions/bundles.actions";
import { getUnbundledCourses } from "@/lib/actions/courses.actions";

import { DateInput, MultiSelectorInput, SelectInput } from "@/components/form-inputs";
import { Button } from "@/components/hoc/button";
import { Form } from "@/components/ui/form";
import { useCourseStore } from "@/lib/store/course.slice";
import { Tab } from "@/lib/types/course.slice.types";
import { bundleSchema, BundleSchema } from "@/lib/types/forms.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export default function BundleForm({
  bundleToEditValues,
  editMode = false,
  bundleId,
}: {
  bundleToEditValues?: BundleSchema;
  editMode?: boolean;
  bundleId?: number;
}) {
  const { getBundles, setCourseSelected, setActiveTab } = useCourseStore();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const [bundleState, bundleAction] = useFormState(
    editMode && bundleId ? editBundle : createBundle,
    {} as BundleState,
  );

  const formMethods = useForm<BundleSchema>({
    resolver: zodResolver(bundleSchema.schema),
    mode: "onChange",
    defaultValues: { ...bundleSchema.defaults, ...(bundleToEditValues ?? {}) },
  });
  useEffect(() => {
    if (bundleState.success) {
      getBundles();
      toast.success(bundleState.message);
      setCourseSelected(null);
      setActiveTab(Tab.Bundles);
      redirect(`/admin/course-management?tab=${Tab.Bundles}`);
    }
    if (bundleState.error) toast.error(bundleState.message);
  }, [bundleState, getBundles, setCourseSelected, setActiveTab]);

  return (
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
        <fieldset className="grid gap-6 rounded-lg border p-4 shadow-xs lg:grid-cols-2">
          <legend className="text-sm font-medium">Bundle</legend>
          <input hidden name="bundleId" value={bundleId} readOnly />
          <SelectInput<BundleSchema, "year">
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
          <SelectInput<BundleSchema, "cycle">
            name="cycle"
            label="Cycle"
            options={[{ selectItems: ["Spring", "Summer", "Fall", "Winter"] }]}
            placeholder="Select a cycle"
          />
          <SelectInput<BundleSchema, "category">
            name="category"
            label="Category"
            options={[
              {
                selectItems: ["Seasonal", "Second Trimester", "Third Trimester", "Labs"],
              },
            ]}
            placeholder="Select a category"
          />
          <SelectInput<BundleSchema, "attendance">
            name="attendance"
            label="Attendance"
            options={[{ selectItems: ["Online", "Offline", "Hybrid"] }]}
            placeholder="Select a attendance"
          />
          <DateInput<BundleSchema, "deadline">
            name="deadline"
            label="Registration deadline"
            placeholder="Select a deadline"
          />
          <MultiSelectorInput<BundleSchema, "courses">
            name="courses"
            label="Courses"
            placeholder="Select unbundled courses"
            onSearch={getUnbundledCourses}
            triggerSearchOnFocus={true}
            emptyMsg="No Courses found!"
          />
        </fieldset>
        <div className="my-8 flex gap-5">
          <Link href={`/admin/course-management?tab=${Tab.Bundles}`} className="w-full">
            <Button variant="secondary" className="w-full">
              Cancel
            </Button>
          </Link>
          <Button
            className="w-full"
            type="submit"
            isLoading={isPending}
          >{`${editMode ? "Save Changes" : "Create Bundle"}`}</Button>
        </div>
      </form>
    </Form>
  );
}
