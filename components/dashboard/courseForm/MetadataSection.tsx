import { useCallback } from "react";
import { BasicInput } from "./inputs/InputBasic";
import { ComboBoxInput } from "./inputs/InputComboBox";
import { MultiSelectorInput } from "./inputs/InputMultiSelector";
import { SelectInput } from "./inputs/InputSelect";
import { TimeInput } from "./inputs/InputTimeSlot";
import { getUsersNamesByRole } from "@/actions/users.actions";
import { User } from "@/types/drizzle.types";
import { DateInput } from "./inputs/InputDate";

export default function CourseMetadata({
  editMode,
  author,
}: {
  editMode: boolean;
  author: User | undefined;
}) {
  const fetchUsersNamesByRole = useCallback(() => {
    return getUsersNamesByRole("author");
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
          name="authorId"
          label="Facilitator"
          placeholder="Select facilitator..."
          emptyMsg="Facilitator Not Found"
          searchPlaceholder="Search facilitators..."
          fetchItemsAction={fetchUsersNamesByRole}
          editMode={editMode}
          preData={author}
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

        <div className="-ml-4 flex w-full scale-90 items-center gap-2 md:ml-0 md:scale-100">
          <TimeInput
            name="timeSlot"
            label="Time Slot"
            placeholder="Start Time"
          />
        </div>
      </div>
    </fieldset>
  );
}
