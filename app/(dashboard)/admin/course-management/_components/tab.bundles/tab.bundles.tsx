import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { useCourseStore } from "@/lib/store/course.slice";
import { useEffect } from "react";
import { NoCoursesFound } from "../notFound";
import { BundleItem } from "./bundle.item";
import { BundleSkeleton } from "./bundle.skeleton";

export const BundlesTab = () => {
  const { isLoading, bundles, getBundles } = useCourseStore();

  useEffect(() => {
    getBundles();
  }, [getBundles]);

  return (
    <TabsContent value="bundles">
      <Card>
        <CardHeader className="px-7">
          <CardTitle>Courses Bundles</CardTitle>
          <CardDescription>Manage courses bundles.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="group/list space-y-3">
            {isLoading ? (
              <BundleSkeleton itemsNumber={5} />
            ) : bundles.length > 0 ? (
              bundles.map((bundle) => (
                <BundleItem
                  key={`${bundle.id}-${bundle.updatedAt}`}
                  bundle={bundle}
                />
              ))
            ) : (
              <NoCoursesFound message="No Bundles Found!" />
            )}
          </ul>
        </CardContent>
      </Card>
    </TabsContent>
  );
};
