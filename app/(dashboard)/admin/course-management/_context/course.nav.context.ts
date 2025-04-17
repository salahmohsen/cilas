import { createContext } from "react";

export type CourseNavContext = {
  handleNext: () => void;
  handlePrev: () => void;
  containerRef: React.RefObject<HTMLUListElement>;
};

export const courseNavContext = createContext<CourseNavContext | null>(null);
