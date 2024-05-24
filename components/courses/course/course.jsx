import Link from "next/link";
import { cn } from "@/lib/utils";
import CourseMetadata from "./courseMetadata";
import FacilitatorHoverCard from "./facilitatorHoverCard";
import { Yeseva_One } from "next/font/google";
import { getAuthor } from "@/actions/coursesActions";

const yesevaOne = Yeseva_One({
  subsets: ["latin"],
  weight: "400",
});

const Course = async ({
  id,
  title,
  authorId,
  courseType,
  content,
  imageUrl,
  seasonName,
  year,
  attendanceType,
  registrationStatus,
  startDate,
  sessionStartTime,
  sessionEndTime,
  days,
  durationInWeeks,
  courseFlowUrl,
  applyUrl,
  price,
  createdAt,
  updatedAt,
  isOpen = false,
  className,
}) => {
  const firstPostLetter = content.charAt(0);
  const postWithoutFirstLetter = content.substr(1);
  const facilitatorData = await getAuthor(authorId);
  const facilitatorName =
    facilitatorData[0]["firstName"] + " " + facilitatorData[0]["lastName"];
  console.log(facilitatorData[0]);

  return (
    <article
      className={cn(
        "mb-10 flex flex-col items-start justify-center gap-3",
        className,
      )}
    >
      <div
        id="article-header"
        className={`flex w-full flex-col justify-center   border-b pb-9 ${isOpen ? "items-center " : "items-start"}`}
      >
        <div className="flex flex-col gap-3">
          <CourseMetadata
            year={year}
            cycle={seasonName}
            attendance_type={attendanceType}
            registration_status={registrationStatus}
          />
          {isOpen && (
            <h2
              className={`${yesevaOne.className} prose flex text-4xl  capitalize`}
            >
              {title}
            </h2>
          )}
          {!isOpen && (
            <Link
              href={`/courses/'titleSlug'`}
              className="decoration-1 hover:underline"
            >
              <h2
                className={`${yesevaOne.className} prose flex text-4xl capitalize`}
              >
                {title}
              </h2>
            </Link>
          )}

          <FacilitatorHoverCard
            facilitator={facilitatorName}
            facilitatorInfo={facilitatorData[0]["bio"]}
            className="flex"
          />
        </div>
      </div>
      {isOpen && (
        <div id="article-body" className="prose mx-auto ">
          <p
            className={`${yesevaOne.className}  float-left mb-0 mr-3  mt-5 h-min text-7xl uppercase tracking-widest text-slate-900`}
          >
            {firstPostLetter}
          </p>
          <p>{postWithoutFirstLetter}</p>
        </div>
      )}
    </article>
  );
};

export default Course;
