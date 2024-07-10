import { useCourseState } from "@/providers/CourseState.provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { BundleSkeleton } from "./bundle.skeleton";
import { BundleItem } from "./bundle.item";
import { NoCoursesFound } from "../notFound";

export const BundlesTab = () => {
  const { bundles, isLoading } = useCourseState();
  return (
    <TabsContent value="bundles">
      <Card>
        <CardHeader className="px-7">
          <CardTitle>Courses Bundles</CardTitle>
          <CardDescription>Manage courses bundles.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="group/list space-y-3">
            {isLoading && <BundleSkeleton itemsNumber={10} />}
            {!isLoading && bundles?.map((bundle) => <BundleItem key={bundle.id} bundle={bundle} />)}
            {!isLoading && bundles?.length === 0 && <NoCoursesFound message="No Bundles Found!" />}
          </ul>
        </CardContent>
      </Card>
    </TabsContent>
  );
};
