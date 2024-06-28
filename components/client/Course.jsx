import Link from "next/link";
import { cn } from "@/lib/utils";
import CourseMetadata from "./CourseMetadata";
import UserHoverCard from "./UserHoverCard";
import { Amiri, Yeseva_One } from "next/font/google";
import { getUserById } from "@/actions/users.actions";

const yesevaOne = Yeseva_One({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
});

const amiri = Amiri({
  subsets: ["arabic"],
  weight: "700",
  display: "swap",
});

const Course = async ({
  isOpen = false,
  className,
  titleSlug,
  course,
  user,
}) => {
  const {
    id,
    enTitle,
    arTitle,
    image,
    authorId,
    enContent,
    arContent,
    dateRange,
    seasonCycle,
    category,
    attendance,
    registrationStatus,
    price,
    weekDuration,
    days,
    timeSlot,
    courseFlowUrl,
    applyUrl,
    createdAt,
    updatedAt,
  } = course;

  const authorName = user["firstName"] + " " + user["lastName"];

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
            dateRange={dateRange}
            cycle={seasonCycle}
            attendance_type={attendance}
            registration_status={registrationStatus}
          />
          {isOpen && (
            <h3
              className={`${yesevaOne.className} ${amiri.className} prose flex text-3xl capitalize`}
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
                className={`${yesevaOne.className} ${amiri.className} prose flex text-3xl capitalize`}
              >
                {enTitle ? enTitle : arTitle}
              </h3>
            </Link>
          )}

          <UserHoverCard
            userName={authorName}
            userBio={user["bio"]}
            userSlug={`courses/author/${authorId}`}
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
