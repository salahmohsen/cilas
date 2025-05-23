import { CourseWithFellow } from "@/lib/drizzle/drizzle.types";
import { cn } from "@/lib/utils/utils";
import { Amiri, Yeseva_One } from "next/font/google";
import Link from "next/link";
import { CourseMetadata } from "./meta";
import { UserHoverCard } from "./user.hoverCard";

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

type CourseProps = {
  isOpen?: boolean;
  className?: string;
  titleSlug?: string;
  course: CourseWithFellow;
};

export const Course = async ({
  isOpen = false,
  className,
  titleSlug,
  course,
}: CourseProps) => {
  const {
    id,
    enTitle,
    arTitle,
    featuredImage,
    enContent,
    arContent,
    startDate,
    endDate,
    category,
    attendance,
    isRegistrationOpen,
    suggestedPrice,
    days,
    timeSlot,
    applyUrl,
    createdAt,
    updatedAt,
    fellow,
  } = course;

  const authorName = fellow["firstName"] + " " + fellow["lastName"];

  return (
    <article
      className={cn("mb-10 flex flex-col items-start justify-center gap-3", className)}
    >
      <div
        id="article-header"
        className={`flex w-full flex-col justify-center border-b pb-9 ${isOpen ? "items-center" : "items-start"}`}
      >
        <div className="flex flex-col gap-3">
          <CourseMetadata
            startDate={startDate}
            attendance={attendance}
            isRegistrationOpen={isRegistrationOpen}
          />
          {isOpen && (
            <h3
              className={`${yesevaOne.className} ${amiri.className} prose flex text-3xl capitalize`}
            >
              {enTitle ? enTitle : arTitle}
            </h3>
          )}
          {!isOpen && (
            <Link href={`/courses/${titleSlug}`} className="decoration-1 hover:underline">
              <h3
                className={`${yesevaOne.className} ${amiri.className} prose flex text-3xl capitalize`}
              >
                {enTitle ? enTitle : arTitle}
              </h3>
            </Link>
          )}

          <UserHoverCard
            userName={authorName}
            userBio={fellow?.bio}
            userSlug={`courses/author/${fellow.id}`}
          />
        </div>
      </div>
      {/* {isOpen && (
        <div
          id="article-body"
          className="prose mx-auto"
          dangerouslySetInnerHTML={{ __html: enContent as string }}
        ></div>
      )} */}
    </article>
  );
};
