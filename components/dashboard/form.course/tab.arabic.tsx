import { memo } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { BasicInput } from "@/components/dashboard/form.inputs/form.input.basic";
import { TipTapInput } from "@/components/dashboard/form.inputs/form.input.tipTap";

const ArabicTab = memo(() => {
  return (
    <TabsContent
      value="ArVersion"
      forceMount
      className="data-[state=inactive]:hidden"
    >
      <div className="flex flex-col gap-6">
        <BasicInput
          type="text"
          name="arTitle"
          label="Title"
          placeholder="Arabic Title"
        />
        <TipTapInput
          name="arContent"
          placeholder="Write Arabic course description here..."
        />
      </div>
    </TabsContent>
  );
});

ArabicTab.displayName = "ArabicTab";

export default ArabicTab;
