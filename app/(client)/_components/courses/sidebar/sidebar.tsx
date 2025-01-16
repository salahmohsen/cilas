import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { SidebarAvailableFilter } from "./filter.available";
import { SidebarTypeFilter } from "./filter.type";

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
      </Card>
    </aside>
  );
};
