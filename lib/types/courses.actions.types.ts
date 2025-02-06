export type CourseFormState = {
  success?: boolean;
  error?: boolean;
  courseId?: number;
  message: string;
};

export type DeleteCourseState = {
  success?: boolean;
  error?: boolean;
  deletedId?: number;
  message?: string;
};
