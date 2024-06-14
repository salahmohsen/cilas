import CourseForm from "@/components/dashboard/courseForm/CourseForm";

export default function CreateCoursePage() {
  // const { reset, getValues, formState } = form;

  /* This `useEffect` checking if the component is in edit mode (`isEditForm`). 
If yes it calls the `getCourseById` function to fetch course data based on the `courseId` provided from edit page */

  // useEffect(() => {
  //   if (isEditForm && courseId) {
  //     try {
  //       getCourseById(courseId).then((course) => {
  //         const startTimeParts = course.sessionStartTime.split(":");
  //         const endTimeParts = course.sessionEndTime.split(":");
  //         const courseValues: FormInputs = {
  //           enTitle: course.enTitle || "",
  //           arTitle: course.arTitle || "",
  //           enContent: course.enContent || "",
  //           arContent: course.arContent || "",
  //           authorId: String(course.authorId),
  //           imageUrl: course.imageUrl ? course.imageUrl : undefined,
  //           category: course.category,
  //           attendance: course.attendance as "offline" | "online" | "hybrid",
  //           registrationStatus: course.registrationStatus
  //             ? "open"
  //             : ("closed" as "open" | "closed"),
  //           price: String(course.price) || "",
  //           sessionStartTime: new Date(
  //             0,
  //             0,
  //             0,
  //             Number(startTimeParts[0]),
  //             Number(startTimeParts[1]),
  //           ),
  //           sessionEndTime: new Date(
  //             0,
  //             0,
  //             0,
  //             Number(endTimeParts[0]),
  //             Number(endTimeParts[1]),
  //           ),
  //           days: course.days as {
  //             value: string;
  //             label: string;
  //             disable?: boolean;
  //           }[],
  //           courseFlowUrl: course.courseFlowUrl || "",
  //           applyUrl: course.applyUrl || "",
  //           dateRange: {
  //             from: new Date(course.startDate),
  //             to: new Date(course.endDate),
  //           },
  //         };
  //         reset(courseValues);
  //       });
  //     } catch (error) {
  //       toast.error(
  //         <div className="flex gap-2">
  //           <Squirrel />
  //           <span>Failed fetching course data, Please try again later!</span>
  //         </div>,
  //       );
  //     }
  //   }
  // }, [courseId, isEditForm, reset]);

  // async function action() {
  //   const handleSubmit = form.handleSubmit(() => formAction());
  // const imageUrl = form.getValues("imageUrl");
  // if (imageUrl instanceof File) {
  //   try {
  //     const imageUrl = await uploadImage(imageUrl, "courses");
  //     form.setValue("imageUrl", imageUrl);
  //     handleSubmit();
  //   } catch (error) {
  //     console.log(error);
  //     toast.error("Failed to upload image. Please try again.");
  //   }
  // } else handleSubmit();
  //   handleSubmit();
  // }

  return <CourseForm />;
}
