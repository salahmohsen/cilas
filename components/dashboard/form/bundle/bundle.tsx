"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { BundleState, createBundle } from "@/actions/bundles.actions";
import { DateInput } from "@/components/dashboard/form/inputs/input.date";
import { MultiSelectorInput } from "@/components/dashboard/form/inputs/input.multiSelector";
import { SelectInput } from "@/components/dashboard/form/inputs/input.select";
import { SubmitButton } from "@/components/dashboard/form/inputs/input.submit";
import { Form } from "@/components/ui/form";
import {
  bundleDefaultValues,
  bundleSchema,
  BundleSchema,
} from "@/types/bundle.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormState } from "react-dom";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { getUnbundledCourses } from "@/actions/courses.actions";

export default function BundleForm({
  bundleToEditValues,
  editMode = false,
}: {
  bundleToEditValues?: BundleSchema;
  editMode?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const [bundleState, bundleAction] = useFormState(
    createBundle,
    {} as BundleState,
  );

  const formMethods = useForm<BundleSchema>({
    resolver: zodResolver(bundleSchema),
    mode: "onChange",
    defaultValues: { ...bundleDefaultValues, ...(bundleToEditValues ?? {}) },
  });
  useEffect(() => {
    if (bundleState.success) toast.success(bundleState.message);
    if (bundleState.error) toast.error(bundleState.message);
  }, [bundleState]);

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
          <SubmitButton
            value="Create bundle"
            isLoading={isPending}
            className="mt-8"
          />
        </form>
      </Form>
    </FormProvider>
  );
}
