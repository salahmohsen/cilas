import { cn } from "@/lib/utils";
import { format } from "date-fns";

import {
  Blend,
  Calendar,
  Circle,
  CircleOff,
  Flower,
  Leaf,
  Snowflake,
  Sun,
  Wifi,
  WifiOff,
} from "lucide-react";

const CourseMetadata = ({
  dateRange,
  cycle,
  attendance_type,
  registration_status,
  className,
}) => {
  const year = Number(format(dateRange.from, "yyyy"));
  return (
    <div
      className={cn(
        "flex gap-4 text-xs leading-none text-muted-foreground",
        className,
      )}
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

const CourseMetaDataIcon = ({ metadata, ...props }) => {
  if (typeof metadata === "number") return <Calendar {...props} />;
  if (metadata === true) return <Circle {...props} />;
  if (metadata === false) return <CircleOff {...props} />;

  switch (String(metadata).toLowerCase()) {
    case "spring":
      return <Flower {...props} />;
    case "summer":
      return <Sun {...props} />;
    case "autumn":
      return <Leaf {...props} />;
    case "winter":
      return <Snowflake {...props} />;
    case "online":
      return <Wifi {...props} />;
    case "offline":
      return <WifiOff {...props} />;
    case "hybrid":
      return <Blend {...props} />;
    default:
      return null;
  }
};

export default CourseMetadata;
