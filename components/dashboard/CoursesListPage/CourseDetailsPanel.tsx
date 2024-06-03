import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";

import { Button } from "../../ui/button";

import {
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  MoreVertical,
  Truck,
} from "lucide-react";
import { Separator } from "../../ui/separator";
import PegonsAvatar from "./PegonAvatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export default function CourseDetailsPanel() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start bg-muted/50">
        <div className="grid gap-0.5">
          <CardTitle className="group flex items-center gap-2 text-lg">
            ​On the decline of the Ivory Tower & the emergence of Pigeon Towers
            <Button
              size="icon"
              variant="outline"
              className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Copy className="h-3 w-3" />
              <span className="sr-only">Copy Order ID</span>
            </Button>
          </CardTitle>
          <CardDescription>Date: November 23, 2023</CardDescription>
        </div>
        <div className="ml-auto ">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" className="h-8 w-8">
                <MoreVertical className="h-3.5 w-3.5" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className=" bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-6 text-sm">
        <div className="grid gap-3">
          <div className="font-semibold">Course Details</div>
          <ul className="grid gap-3">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Facilitator</span>
              <span>Karim-Yassin GOESSINGER</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Category</span>
              <span>Seasonal Course</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Season Cycle</span>
              <span>Winter</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Registration</span>
              <span>Closed</span>
            </li>
          </ul>
          <Separator className="my-2" />
          <ul className="grid gap-3">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span>10/2/2024</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">End Date</span>
              <span>10/3/2024</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span>4 Weeks</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Days</span>
              <span>Every Saturday</span>
            </li>
          </ul>
        </div>
        <Separator className="my-4" />
        <div className="grid gap-3">
          <div className="font-semibold">Facilitator Information</div>
          <dl className="grid gap-3">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd>Liam Johnson</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>
                <a href="mailto:">liam@acme.com</a>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>
                <a href="tel:">+1 234 567 890</a>
              </dd>
            </div>
          </dl>
        </div>

        <Separator className="my-4" />
        <div className="grid auto-rows-max gap-3">
          <div className="font-semibold">Pegons</div>
          <ScrollArea className="w-full rounded-md  p-4">
            <div className="flex gap-1  text-muted-foreground">
              <PegonsAvatar />
              <PegonsAvatar />
              <PegonsAvatar />
              <PegonsAvatar />
              <PegonsAvatar />
              <PegonsAvatar />
              <PegonsAvatar />
              <PegonsAvatar />
              <PegonsAvatar />
              <PegonsAvatar />
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </CardContent>
      <CardFooter className="flex flex-row items-center border-t bg-muted/50 px-6 py-3">
        <div className="text-xs text-muted-foreground">
          Updated <time dateTime="2023-11-23">November 23, 2023</time>
        </div>
        <Pagination className="ml-auto mr-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <Button size="icon" variant="outline" className="h-6 w-6">
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="sr-only">Previous Order</span>
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button size="icon" variant="outline" className="h-6 w-6">
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="sr-only">Next Order</span>
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </CardFooter>
    </Card>
  );
}
