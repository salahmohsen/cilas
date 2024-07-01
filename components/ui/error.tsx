"use client";

import { Squirrel } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ErrorPage({ message }: { message: string }) {
  const squirrelRef = useRef<SVGSVGElement>(null);
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (squirrelRef.current) {
        const { left, width } = squirrelRef.current.getBoundingClientRect();
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
    <div className="flex h-[calc(100vh-73px)] flex-col items-center justify-center space-y-10">
      <Squirrel
        size={200}
        strokeWidth={0.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        ref={squirrelRef}
        className={`transition-all duration-75 ease-linear ${angle === 180 ? "scale-x-[-1]" : ""}`}
      />
      <p className="max-w-xl text-center text-2xl font-light tracking-widest">
        {message}
      </p>
    </div>
  );
}
