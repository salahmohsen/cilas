import { Flower, Leaf, Snowflake, Sun, SunSnow } from "lucide-react";
import { CourseSeason } from "./courses.enums";

export const getSeason = (date: string | Date): CourseSeason => {
  let seasonDate = new Date(date);

  // Extract the month and day
  const month = seasonDate.getMonth() + 1; // getMonth() is zero-based
  const day = seasonDate.getDate();

  // Create a numeric representation for easier comparison (month * 100 + day)
  // This gives us values like 321 for March 21, 1223 for December 23, etc.
  const monthDay = month * 100 + day;

  switch (true) {
    // Winter: December 21 - March 20
    case (monthDay >= 1221 && monthDay <= 1231) || (monthDay >= 101 && monthDay <= 320):
      return CourseSeason.winter;

    // Spring: March 21 - June 20
    case monthDay >= 321 && monthDay <= 620:
      return CourseSeason.spring;

    // Summer: June 21 - September 22
    case monthDay >= 621 && monthDay <= 922:
      return CourseSeason.summer;

    // Fall: September 23 - December 20
    case monthDay >= 923 && monthDay <= 1220:
      return CourseSeason.fall;

    default:
      return CourseSeason.unknown;
  }
};

export const getSeasonIcon = (season: CourseSeason) => {
  switch (season) {
    case CourseSeason.winter:
      return <Snowflake size={16} strokeWidth={1.5} />;
    case CourseSeason.spring:
      return <Flower size={16} strokeWidth={1.5} />;
    case CourseSeason.summer:
      return <Sun size={16} strokeWidth={1.5} />;
    case CourseSeason.fall:
      return <Leaf size={16} strokeWidth={1.5} />;
    default:
      return <SunSnow size={16} strokeWidth={1.5} />;
  }
};
