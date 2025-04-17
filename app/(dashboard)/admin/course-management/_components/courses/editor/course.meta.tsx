import { getUsersNames } from "@/lib/actions/users.actions";
import { userLocalInfo } from "@/lib/types/drizzle.types";
import { ComboBoxOption } from "@/lib/types/form.inputs.types";
import { forwardRef, memo, useCallback, useEffect, useState } from "react";

import {
  BasicInput,
  ComboBoxInput,
  DateInput,
  MultiSelectorInput,
  SelectInput,
  SliderInput,
  TimeSlotInput,
} from "@/components/form-inputs";
import { useCourseStore } from "@/lib/store/course.slice";
import { CourseSchema } from "@/lib/types/form.schema";

type CourseMetadataProps = {
  editMode: boolean;
  fellow: userLocalInfo | undefined;
};

export const CourseMeta = memo(
  forwardRef<HTMLDivElement, CourseMetadataProps>(({ editMode, fellow }, ref) => {
    const [fellowsNames, setFellowsNames] = useState<ComboBoxOption[]>([]);

    const { fellow: fellowState } = useCourseStore();

    const [defaultOption, setDefaultOption] = useState<ComboBoxOption | undefined>(
      undefined,
    );

    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
      if (editMode)
        setDefaultOption({
          id: fellow?.id as string,
          name: `${fellow?.firstName} ${fellow?.lastName}`,
        });
      if (fellowState) {
        setDefaultOption({
          id: fellowState.id,
          name: `${fellowState.firstName} ${fellowState.lastName}`,
        });
      }
    }, [editMode, fellow, fellowState]);

    const getFellowsNames = useCallback(async () => {
      try {
        setLoading(true);
        const data = await getUsersNames("fellow", true);

        setFellowsNames(data as ComboBoxOption[]);
        setLoading(false);
      } catch (error) {
        if (error instanceof Error)
          console.log(`Getting Fellows Names Failed! ${error.message}`);
      }
    }, []);

    return (
      <div className="space-y-8 p-6" ref={ref}>
        <DateInput<CourseSchema, "startDate">
          name="startDate"
          label="Start Date"
          placeholder="Pick a date"
        />

        <DateInput<CourseSchema, "endDate">
          name="endDate"
          label="End Date"
          placeholder="Pick a date"
        />

        <SelectInput<CourseSchema, "isRegistrationOpen">
          name="isRegistrationOpen"
          label="Registration Status"
          placeholder="Select status"
          options={[{ selectItems: ["Open", "Closed"] }]}
        />
        <BasicInput<CourseSchema, "applyUrl">
          name="applyUrl"
          label="Registration Form"
          placeholder="Registration Form Url"
          type="url"
        />

        <SelectInput<CourseSchema, "category">
          name="category"
          label="Category"
          placeholder="Select category"
          options={[
            {
              groupLabel: "Bridge Programme",
              selectItems: ["Thematic Course", "Lab"],
            },
            {
              groupLabel: "Other",
              selectItems: ["Seasonal Course", "Workshop"],
            },
          ]}
        />

        <MultiSelectorInput<CourseSchema, "days">
          name="days"
          label={"Days"}
          placeholder="Select Days"
          emptyMsg="no results found."
          options={[
            { label: "Saturday", value: "saturday" },
            { label: "Sunday", value: "sunday" },
            { label: "Monday", value: "monday" },
            { label: "Tuesday", value: "tuesday" },
            { label: "Wednesday", value: "wednesday" },
            { label: "Thursday", value: "thursday" },
            { label: "Friday", value: "friday" },
          ]}
        />

        <ComboBoxInput<CourseSchema, "fellowId">
          name="fellowId"
          label="Fellow"
          placeholder="Select fellow..."
          emptyMsg="Fellow Not Found"
          searchPlaceholder="Search fellows..."
          action={getFellowsNames}
          options={fellowsNames}
          defaultOption={defaultOption}
          loading={loading}
        />

        <BasicInput<CourseSchema, "featuredImage">
          name="featuredImage"
          type="file"
          placeholder="Choose Poster"
          label="Featured Image"
        />
        <SliderInput<CourseSchema, "suggestedPrice">
          name="suggestedPrice"
          label="Suggested Price"
          defaultValue={[2000, 3000]}
          max={5000}
          min={1000}
          step={200}
          minStepsBetweenThumbs={1}
          formatLabelSign="EGP"
        />

        <SelectInput<CourseSchema, "attendance">
          name="attendance"
          label="Attendance"
          placeholder="Select mode"
          options={[{ selectItems: ["Online", "Offline", "Hybrid"] }]}
        />

        <TimeSlotInput<CourseSchema, "timeSlot">
          name="timeSlot"
          label="Time Slot"
          placeholder="Start Time"
        />
        {/* <SubmitButtons
          isLoading={isLoading}
          editMode={editMode}
          draftMode={draftMode}
          setDraftMode={setDraftMode}
        /> */}
      </div>
    );
  }),
);

CourseMeta.displayName = "CourseMetadata";
