import { cn } from "@/lib/utils";
import CourseMetaDataIcon from "./courseMetaDataIcon";

const CourseMetadata = ({
  year,
  cycle,
  attendance_type,
  registration_status,
  className,
}) => {
  return (
    <div
      className={`${cn(className)} flex gap-4  text-xs leading-none text-muted-foreground`}
    >
      <Meta meta={year} />
      <Meta meta={cycle} />
      <Meta meta={attendance_type} />
      <Meta meta={registration_status} />
    </div>
  );
};

const Meta = ({ meta }) => {
  return (
    <div className="flex items-center gap-1 capitalize">
      <CourseMetaDataIcon metadata={meta} size={16} strokeWidth={0.5} />
      {meta === true && <span>Open for Registration</span>}
      {meta === false && <span>Archived</span>}
      <span>{meta}</span>
    </div>
  );
};

export default CourseMetadata;
