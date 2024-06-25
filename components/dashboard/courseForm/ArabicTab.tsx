import { TabsContent } from "@/components/ui/tabs";
import { memo } from "react";
import { BasicInput } from "./InputBasic";
import { TipTapInput } from "./InputTipTap";

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

export default ArabicTab;
