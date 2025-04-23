import { z } from "zod";

import { Option } from "@/components/ui/multipleSelector";
import { required_number } from "@/lib/utils/zod.utils";

const studentSchema = {
  schema: z.object({
    students: z.array(z.object({})),
    courseId: required_number,
  }),
  defaults: (courseId: number, students: Option[]) => ({
    students: students || [],
    courseId,
  }),
};

export type StudentSchema = z.infer<typeof studentSchema.schema>;
export default studentSchema;
