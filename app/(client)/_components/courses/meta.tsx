import { cn, getSeason } from "@/lib/utils/utils";
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

type CourseMetadataProps = {
  startDate: Date;
  attendance: string;
  isRegistrationOpen: boolean;
  className?: string;
};

export const CourseMetadata = ({
  startDate,
  attendance,
  isRegistrationOpen,
  className,
}: CourseMetadataProps) => {
  const year = Number(format(startDate, "yyyy"));
  const season = getSeason(startDate);
  return (
    <div
      className={cn("flex gap-4 text-xs leading-none text-muted-foreground", className)}
    >
      <Meta meta={year} />
      <Meta meta={attendance} />
      <Meta meta={isRegistrationOpen} />
      <Meta meta={season} />
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
    case "fall":
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
