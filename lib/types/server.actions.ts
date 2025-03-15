export interface serverActionStateBase {
  success?: boolean;
  error?: boolean;
  message: string;
}

export interface CourseFormState extends serverActionStateBase {
  courseId?: number;
}

export interface DeleteCourseState extends serverActionStateBase {
  deletedId?: number;
}
