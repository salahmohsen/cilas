"use client";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@radix-ui/react-label";
import { CalendarCheck, Clock, Repeat, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const Course = ({
  id,
  title,
  titleSlug,
  describtion,
  image,
  facilitator,
  facilitatorInfo,
  startingDate,
  sessionStarts,
  sessionEnds,
  days,
  durationInWeeks,
  courseFlow,
  applyLink,
  isSlug = true,
  className,
}) => {
  return (
    <Card
      className={`mb-10 ${!isSlug ? " h-auto overflow-hidden" : null} ${className}`}
    >
      <CardHeader>
        <CardTitle className=" leading-snug">
          <Link href={`/courses/${titleSlug}`}>{title}</Link>
        </CardTitle>
        <CardDescription>{facilitator}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-5 md:flex-row md:items-start xl:justify-start">
          <div className="relative mr-6 h-auto w-3/12 max-w-[400px] rounded-lg border bg-card text-card-foreground shadow-md lg:w-3/12  ">
            <AspectRatio ratio={16 / 9}>
              <Image
                src={image}
                alt={title}
                fill
                className="absolute rounded-md object-cover"
              />
            </AspectRatio>
          </div>
          <div className=" flex w-11/12 flex-col gap-5">
            <p
              className={`  w-auto first-letter:float-left
          first-letter:mr-3 first-letter:text-7xl first-letter:font-bold
          first-letter:text-slate-900 first-line:uppercase first-line:tracking-widest ${!isSlug ? "line-clamp-6" : null}`}
            >
              {describtion}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <Label>Tags:</Label>
                <Button variant="outline" size={"sm"}>
                  Spring Cycle
                </Button>
                <Button variant="outline">Bridge Programme</Button>
                <Button variant="outline">2013</Button>
              </div>
              <Button variant="outline" size={"sm"} className="w-full">
                Read More...
              </Button>
            </div>
          </div>
        </div>
        {isSlug && (
          <>
            <hr className="my-8 h-[1px] border-t-0 bg-neutral-100 dark:bg-white/10" />
            <p className="prose-sm">
              <User className="float-left mr-2 h-4 w-4" />
              <span className="font-bold"> {facilitator} </span>
              {facilitatorInfo}
            </p>
          </>
        )}
      </CardContent>
      {isSlug && (
        <CardFooter className="prose-sm flex flex-col items-center justify-between gap-5 border pt-5 md:flex-row">
          <div className=" flex flex-col items-center gap-0 text-center sm:gap-2 md:flex-row">
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} />
              <p>Starting {startingDate} </p>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <p>
                {sessionStarts} : {sessionEnds}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Repeat size={16} />
              <p>
                {durationInWeeks} Consecutive {days}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 ">
            <a href={courseFlow}>
              <Button variant="secondary">Course Flow</Button>
            </a>
            <a href={applyLink}>
              <Button>Apply</Button>
            </a>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default Course;
