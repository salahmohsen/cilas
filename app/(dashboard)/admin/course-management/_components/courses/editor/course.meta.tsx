import { forwardRef, memo } from "react";

import {
  BasicInput,
  ComboBoxInput,
  DateInput,
  MultiSelectorInput,
  SelectInput,
  SliderInput,
  TimeSlotInput,
} from "@/components/form-inputs";
import { searchUsers } from "@/lib/users/users.actions";
import { CourseSchema } from "../../../_lib/course.schema";
import { getCategoriesOptions } from "../../../_lib/courses.actions";
import { PrivateCourse } from "../../../_lib/courses.actions.types";
import { FellowForm } from "../fellow.form";

type CourseMetadataProps = {
  editMode: boolean;
  course: PrivateCourse | null | undefined;
};

export const CourseMeta = memo(
  forwardRef<HTMLDivElement, CourseMetadataProps>(({ editMode, course }, ref) => {
    const defaultCategory = (() => {
      if (!course || !course.category.id || !course.category.enName) return undefined;
      return {
        value: String(course.category.id),
        label: course.category.enName,
      };
    })();

    const defaultFellow = (() => {
      if (!course) return undefined;
      return {
        value: course.fellows[0].id,
        label: `${course.fellows[0].firstName} ${course.fellows[0].lastName}`,
      };
    })();

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

        <BasicInput<CourseSchema, "slug">
          name="slug"
          label="Course slug"
          placeholder="Course slug"
          type="text"
        />

        <ComboBoxInput<CourseSchema, "category">
          name="category"
          label="Category"
          disableSearch
          emptyMsg="No categories found!"
          action={getCategoriesOptions}
          defaultOption={defaultCategory}
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
          emptyMsg="User Not Found"
          searchPlaceholder="Search users..."
          action={searchUsers}
          defaultOption={defaultFellow}
        >
          <FellowForm
            mode="button"
            triggerClasses="w-full bg-primary text-primary-foreground"
          />
        </ComboBoxInput>

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
      </div>
    );
  }),
);

CourseMeta.displayName = "CourseMetadata";
