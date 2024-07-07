import { useCallback, useEffect, useState } from "react";
import { BasicInput } from "@/components/dashboard/form/inputs/input.basic";
import { ComboBoxInput } from "@/components/dashboard/form/inputs/input.comboBox";
import { MultiSelectorInput } from "@/components/dashboard/form/inputs/input.multiSelector";
import { SelectInput } from "@/components/dashboard/form/inputs/input.select";
import { TimeInput } from "@/components/dashboard/form/inputs/input.timeSlot";
import { DateInput } from "@/components/dashboard/form/inputs/input.date";
import { getUsersNamesByRole } from "@/actions/users.actions";
import { SafeUser } from "@/types/drizzle.types";
import { useCourseState } from "@/providers/CourseState.provider";
import { ComboBoxOption } from "@/types/formInputs.types";

export function CourseMetadata({
  editMode,
  fellow,
}: {
  editMode: boolean;
  fellow: SafeUser | undefined;
}) {
  const [fellowsNames, setFellowsNames] = useState<ComboBoxOption[]>([]);
  const { fellow: fellowState } = useCourseState();
  const [defaultOption, setDefaultOption] = useState<
    ComboBoxOption | undefined
  >(undefined);
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
      const data = await getUsersNamesByRole("fellow");
      const dataFormatted = data.map((fellow) => {
        return {
          id: fellow.id,
          name: `${fellow.firstName} ${fellow.lastName}`,
        };
      });
      setFellowsNames(dataFormatted);
      setLoading(false);
    } catch (error) {
      if (error instanceof Error)
        console.log(`Getting Fellows Names Failed! ${error.message}`);
    }
  }, []);

  return (
    <fieldset className="grid gap-6 rounded-lg border p-4 shadow-sm">
      <legend className="-ml-1 px-1 text-sm font-medium">
        Course Metadata
      </legend>
      <div className="grid justify-center gap-10 lg:grid-cols-2">
        <DateInput
          name="startDate"
          label="Start Date"
          placeholder="Pick a date"
        />

        <DateInput name="endDate" label="End Date" placeholder="Pick a date" />

        <SelectInput
          name="isRegistrationOpen"
          label="Registration Status"
          placeholder="Select status"
          options={[{ selectItems: ["Open", "Closed"] }]}
        />
        <BasicInput
          name="applyUrl"
          label="Registration Form"
          placeholder="Registration Form Url"
          type="url"
        />

        <SelectInput
          name="category"
          label="Category"
          placeholder="Select category"
          options={[
            { selectItems: ["Seasonal Course", "Workshop"] },
            {
              groupLabel: "Seasonal Semester",
              selectItems: ["Thematic Course", "Lab"],
            },
          ]}
        />

        <MultiSelectorInput
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

        <ComboBoxInput
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

        <BasicInput
          type="url"
          name="courseFlowUrl"
          label="Course Flow"
          placeholder="Course Flow Url"
        />
        <BasicInput
          type="file"
          placeholder="Choose Poster"
          name="image"
          label="Course Poster"
        />
        <BasicInput
          name="price"
          label="Price"
          placeholder="Enter price"
          type="number"
        />

        <SelectInput
          name="attendance"
          label="Attendance"
          placeholder="Select mode"
          options={[{ selectItems: ["Online", "Offline", "Hybrid"] }]}
        />

        <TimeInput name="timeSlot" label="Time Slot" placeholder="Start Time" />
      </div>
    </fieldset>
  );
}
