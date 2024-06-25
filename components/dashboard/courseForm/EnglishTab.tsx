import { TabsContent } from "@/components/ui/tabs";
import { memo } from "react";
import { BasicInput } from "./InputBasic";
import { TipTapInput } from "./InputTipTap";

const EnglishTab = memo(() => {
  return (
    <TabsContent
      value="EnVersion"
      forceMount
      className="data-[state=inactive]:hidden"
    >
      <div className={`flex flex-col gap-6`}>
        <BasicInput
          type="text"
          label="Title"
          placeholder="English Title"
          name={"enTitle"}
        />
        <TipTapInput
          name="enContent"
          placeholder="Write English course description here..."
        />
      </div>
    </TabsContent>
  );
});

export default EnglishTab;
