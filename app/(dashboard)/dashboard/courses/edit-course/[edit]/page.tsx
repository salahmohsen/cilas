"use client";

import CreateCoursePage from "../../create-course/page";
import { Squirrel } from "lucide-react";

export default function EditCoursePage({ params }) {
  const parts = params.edit?.split("-");
  const id = parts[parts.length - 1];

  if (!id)
    return (
      <div className="flex h-[calc(100vh-73px)] flex-col items-center justify-center space-y-10">
        <Squirrel size={200} strokeWidth={0.6} />
        <p className="text-2xl font-medium tracking-widest">No courses found</p>
      </div>
    );

  return <CreateCoursePage isEditForm={true} courseId={id} />;
}
