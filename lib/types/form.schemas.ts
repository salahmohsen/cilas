import { z } from "zod";

export const addStudentSchema = {
  schema: z.object({
    students: z.array(z.string()).min(1, "Select at least one student."),
  }),
  defaultValues: { students: [] },
};

export type AddStudentSchema = z.infer<typeof addStudentSchema.schema>;
