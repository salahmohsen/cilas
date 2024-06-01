import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Label } from "@/components/ui/label";

import { Available } from "./SidebarAvailable";
import { Type } from "./SidebarType";

const Sidebar = () => {
  return (
    <aside>
      <Card className="">
        <CardHeader>
          <CardDescription>Filters</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col space-y-1.5">
            <Label>Available</Label>
            <Available className="col-span-2" />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label>Type</Label>
            <Type className="col-span-2" />
          </div>
        </CardContent>
        {/* <CardFooter>
          <p>Card Footer</p>
        </CardFooter> */}
      </Card>
    </aside>
  );
};

export default Sidebar;
