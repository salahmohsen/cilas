import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Label,
} from "@/components/ui";

import { SidebarAvailableFilter } from "@/components/client/courses/sidebar/filter.available";
import { SidebarTypeFilter } from "@/components/client/courses/sidebar/filter.type";

export const Sidebar = () => {
  return (
    <aside>
      <Card className="">
        <CardHeader>
          <CardDescription>Filters</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col space-y-1.5">
            <Label>Available</Label>
            <SidebarAvailableFilter className="col-span-2" />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label>Type</Label>
            <SidebarTypeFilter className="col-span-2" />
          </div>
        </CardContent>
        {/* <CardFooter>
          <p>Card Footer</p>
        </CardFooter> */}
      </Card>
    </aside>
  );
};
