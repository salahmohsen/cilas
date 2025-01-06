"use client";

import Loading from "@/app/(dashboard)/admin/course-management/create-bundle/loading";
import BundleForm from "@/components/dashboard/form/bundle/bundle";
import { ErrorPage } from "@/components/ui/error";
import { getBundleById } from "@/lib/actions/bundles.actions";
import { BundleSchema } from "@/lib/types/bundle.schema";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

const EditBundle = () => {
  const searchParam = useSearchParams();
  const bundleId = searchParam?.get("id");
  let bundleValues = useRef<BundleSchema | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBundle = async () => {
      try {
        setIsLoading(true);
        if (!Number(bundleId)) {
          throw new Error("Bundle Id is not valid");
        }
        const result = await getBundleById(Number(bundleId));
        if (result.success && result.bundle) {
          bundleValues.current = {
            ...result.bundle,
            year: result.bundle.year.toString(),
            courses: result.bundle.courses.map((course) => ({
              value: course.id.toString(),
              label: (course.enTitle || course.arTitle) as string,
            })),
          };
        }
        if (result.error) throw new Error(result.message);
      } catch (error) {
        if (error instanceof Error) setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBundle();
  }, [bundleId]);

  if (error) {
    return <ErrorPage message={error} />;
  } else if (isLoading) {
    return <Loading />;
  } else {
    return (
      <Suspense fallback={<Loading />}>
        <BundleForm
          bundleToEditValues={bundleValues.current}
          bundleId={Number(bundleId)}
          editMode={true}
        />
      </Suspense>
    );
  }
};
export default EditBundle;
