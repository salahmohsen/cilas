import Link from "next/link";
import { cn } from "@/lib/utils";
import CourseMetadata from "./CourseMetadata";
import FacilitatorHoverCard from "./CourseFacilitatorHoverCard";
import { Yeseva_One } from "next/font/google";
import { getUserById } from "@/actions/usersActions";

const yesevaOne = Yeseva_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-yeseva",
  adjustFontFallback: false,
});

const Course = async ({ isOpen = false, className, ...props }) => {
  const {
    id,
    enTitle,
    arTitle,
    titleSlug,
    image,
    authorId,
    enContent,
    arContent,
    startDate,
    seasonCycle,
    category,
    attendance,
    registrationStatus,
    price,
    weekDuration,
    days,
    sessionStartTime,
    sessionEndTime,
    courseFlowUrl,
    applyUrl,
    createdAt,
    updatedAt,
  } = props;

  const authorData = await getUserById(authorId);
  const authorName = authorData["firstName"] + " " + authorData["lastName"];

  return (
    <article
      className={cn(
        "mb-10 flex flex-col items-start justify-center gap-3",
        className,
      )}
    >
      <div
        id="article-header"
        className={`flex w-full flex-col justify-center border-b pb-9 ${isOpen ? "items-center" : "items-start"}`}
      >
        <div className="flex flex-col gap-3">
          <CourseMetadata
            startDate={startDate}
            cycle={seasonCycle}
            attendance_type={attendance}
            registration_status={registrationStatus}
          />
          {isOpen && (
            <h3
              className={`${yesevaOne.variable} prose flex text-3xl capitalize`}
            >
              {enTitle ? enTitle : arTitle}
            </h3>
          )}
          {!isOpen && (
            <Link
              href={`/courses/${titleSlug}`}
              className="decoration-1 hover:underline"
            >
              <h3
                className={`${yesevaOne.variable} prose flex text-3xl capitalize`}
              >
                {enTitle ? enTitle : arTitle}
              </h3>
            </Link>
          )}

          <FacilitatorHoverCard
            authorSlug={`courses/author/${authorId}`}
            authorName={authorName}
            authorBio={authorData["bio"]}
          />
        </div>
      </div>
      {isOpen && (
        <div
          id="article-body"
          className="prose mx-auto"
          dangerouslySetInnerHTML={{ __html: enContent }}
        ></div>
      )}
    </article>
  );
};

export default Course;
