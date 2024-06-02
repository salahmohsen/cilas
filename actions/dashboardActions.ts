"use server";

import db from "@/db/drizzle";
import { courses, users } from "@/db/schema";
import { createCourseSchema } from "@/schemas/createCourseSchema";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";

export const createCourseAction = async (
  data,
  prevState,
  formData: FormData,
) => {
  prevState = {};
  const parsed = createCourseSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  } else {
  }
  const formatedData = {
    enTitle: data.enTitle,
    arTitle: data.arTitle,
    image: data.image,
    authorId: data.authorId,
    enContent: data.enContent,
    arContent: data.arContent,
    seasonCycle: data.seasonCycle,
    category: data.category,
    attendance: data.attendance,
    registrationStatus: data.registrationStatus === "open" ? true : false,
    price: data.price,
    startDate: data.dateRange.from,
    endDate: data.dateRange.to,
    weekDuration: data.weekDuration,
    days: data.days,
    sessionStartTime: format(data.sessionStartTime, "hh:mm"),
    sessionEndTime: format(data.sessionEndTime, "hh:mm"),
    courseFlowUrl: data.courseFlowUrl,
    applyUrl: data.applyUrl,
  };

  try {
    const statement = db
      .insert(courses)
      .values(formatedData)
      .returning({ insertedId: courses.id });

    await db.execute(statement);
    revalidatePath("/courses");

    return { success: "Course created successfully!" };
  } catch (error) {
    console.log(error);
    return { error: "Oops! Course addition failed. Please try again later." };
  }
};

export const getUsers = async () => {
  const data = await db.select().from(users);
  let authors: { value: string; label: string }[] = [];
  data.forEach((author) =>
    authors.push({
      value: author.id.toString(),
      label: `${author.firstName} ${author.lastName}`,
    }),
  );

  return authors;
};
