import { Bird } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

export const NoCoursesFound = ({ message }: { message: string }) => {
  const birdRef = useRef<SVGSVGElement>(null);
  const [angle, setAngle] = useState<number>(0);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (birdRef.current) {
        const { left, width } = birdRef.current.getBoundingClientRect();
        const centerX = left + width / 2;
        const radians = Math.atan2(0, event.clientX - centerX); // Only consider horizontal movement
        const degrees = radians * (180 / Math.PI);
        setAngle(degrees);
      }
    };
    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-2">
      <Bird
        size={60}
        strokeWidth={0.8}
        ref={birdRef}
        className={` ${angle === 180 && "scale-x-[-1]"}`}
      />
      <p className="text-lg">{message}</p>
    </div>
  );
};
