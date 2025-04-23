import { serverActionStateBase } from "@/lib/types/server.actions";

export interface CourseFormState extends serverActionStateBase {
  courseId?: number;
}

export interface DeleteCourseState extends serverActionStateBase {
  deletedId?: number;
}
