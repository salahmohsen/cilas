import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EnglishTab from "./form.course.tab.english";
import ArabicTab from "./form.course.tab.arabic";

export default function CourseContent() {
  return (
    <fieldset className="grid gap-6 rounded-lg border p-4 shadow-sm">
      <legend className="-ml-1 px-1 text-sm font-medium">Course Content</legend>
      <Tabs defaultValue="EnVersion">
        <TabsList className="mb-3 grid w-full grid-cols-2">
          <TabsTrigger value="EnVersion">English</TabsTrigger>
          <TabsTrigger value="ArVersion">
            Arabic
            <span className="pl-2 text-xs opacity-50">optional</span>
          </TabsTrigger>
        </TabsList>
        <EnglishTab />
        <ArabicTab />
      </Tabs>
    </fieldset>
  );
}
