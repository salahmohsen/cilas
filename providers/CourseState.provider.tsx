import { courseTable, userTable } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";
import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useState,
} from "react";

type DateRange = {
  from: Date;
  to: Date;
};

type Days = {
  label: string;
  value: string;
  disable?: boolean;
}[];
export type CourseType = {
  course: InferSelectModel<typeof courseTable> & {
    dateRange: DateRange;
    days: Days;
  };
  user: InferSelectModel<typeof userTable> | null;
};

type isSelected = { [key: number]: boolean };
type setIsSelected = Dispatch<SetStateAction<isSelected>>;
type courseInfo = CourseType | undefined;
type setCourseInfo = Dispatch<SetStateAction<courseInfo>>;

type CourseStateType = {
  isSelected: isSelected;
  setIsSelected: setIsSelected;
  courseInfo: courseInfo;
  setCourseInfo: setCourseInfo;
};

const CourseStateContext = createContext<CourseStateType>(
  {} as CourseStateType,
);

export const CourseStateProvider = ({ children }) => {
  const [isSelected, setIsSelected] = useState<isSelected>({});
  const [courseInfo, setCourseInfo] = useState<courseInfo>(undefined);

  const contextValue: CourseStateType = {
    isSelected: isSelected,
    setIsSelected: setIsSelected,
    courseInfo,
    setCourseInfo,
  };

  return (
    <CourseStateContext.Provider value={contextValue}>
      {children}
    </CourseStateContext.Provider>
  );
};

export const useCourseState = (): CourseStateType => {
  const courseStateContext = useContext(CourseStateContext);
  if (!courseStateContext)
    throw new Error("useCourseState must be used within course state context.");
  return courseStateContext;
};
