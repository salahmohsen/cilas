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

export default CourseMetaDataIcon;
