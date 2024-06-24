"use client";

import { InferSelectModel } from "drizzle-orm";
import { courseTable, userTable } from "@/db/schema";
import React, { createContext, useContext } from "react";
import { CourseType } from "./CourseState.provider";

interface CourseProviderProps {
  currentCourses: CourseType[];
  draftCourses: CourseType[];
  archivedCourses: CourseType[];
}

const CoursesContext = createContext<CourseProviderProps>(
  {} as CourseProviderProps,
);

export const CourseProvider = ({
  children,
  currentCourses,
  draftCourses,
  archivedCourses,
}: {
  children: React.ReactNode;
  currentCourses: CourseType[];
  draftCourses: CourseType[];
  archivedCourses: CourseType[];
}) => {
  return (
    <CoursesContext.Provider
      value={{ currentCourses, draftCourses, archivedCourses }}
    >
      {children}
    </CoursesContext.Provider>
  );
};

export const useCourses = () => {
  const coursesContext = useContext(CoursesContext);
  if (!coursesContext)
    throw new Error("useCourses must be used within courses context.");
  return coursesContext;
};
