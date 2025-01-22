import { NotFound } from "@/components/not-found";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { useCourseStore } from "@/lib/store/course.slice";
import { Tab } from "@/lib/types/course.slice.types";
import { useEffect } from "react";
import { BundleItem } from "../bundles/bundle.item";
import { BundleSkeleton } from "../bundles/bundle.skeleton";

export const BundlesTab = () => {
  const { isLoading, bundles, getBundles } = useCourseStore();

  useEffect(() => {
    getBundles();
  }, [getBundles]);

  return (
    <TabsContent value={Tab.Bundles}>
      <Card>
        <CardHeader className="px-7">
          <CardTitle>Courses Bundles</CardTitle>
          <CardDescription>Manage courses bundles.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="group/list space-y-3">
            {isLoading ? (
              <BundleSkeleton itemsNumber={5} />
            ) : bundles && bundles.length > 0 ? (
              bundles.map((bundle) => (
                <BundleItem key={`${bundle.id}-${bundle.updatedAt}`} bundle={bundle} />
              ))
            ) : (
              <NotFound message="No Bundles Found!" />
            )}
          </ul>
        </CardContent>
      </Card>
    </TabsContent>
  );
};
