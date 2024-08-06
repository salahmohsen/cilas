import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCourseState } from "@/providers/CourseState.provider";

export const useCourseNavigation = () => {
  const {
    state: { courseInfo, isCourseSelected: isCourseSelectedObject },
    dispatch,
    optimisticCourses,
  } = useCourseState();

  const containerRef = useRef<HTMLUListElement | null>(null);

  const idArr = useMemo(
    () => optimisticCourses.map((item) => item.id),
    [optimisticCourses],
  );
  const isCourseSelected = useMemo(
    () => Object.values(isCourseSelectedObject ?? {}).some(Boolean),
    [isCourseSelectedObject],
  );

  const scrollToElement = useCallback(
    (index: number) => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const elements = container.querySelectorAll("[data-course-id]");

      if (index >= 0 && index < elements.length) {
        const element = elements[index];
        if (element instanceof HTMLElement) {
          const headerOffset = 70;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition =
            elementPosition + window.scrollY - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
          });
        } else {
          console.error("Selected element is not an HTMLElement");
        }
      } else {
        console.error("Invalid index or element not found");
      }
    },
    [containerRef],
  );

  const resetSelection = useCallback(
    (isLast: boolean = false) => {
      if (optimisticCourses.length === 0) return;

      const newCourse = isLast
        ? optimisticCourses.at(-1)
        : optimisticCourses[0];
      const newId = newCourse?.id;

      if (newCourse && newId !== undefined) {
        dispatch({ type: "SET_COURSE_INFO", payload: newCourse });
        dispatch({ type: "SET_COURSE_SELECTED", payload: { [newId]: true } });
      }
    },
    [dispatch, optimisticCourses],
  );

  const setSelection = useCallback(
    (id: number) => {
      const newCourse = optimisticCourses.find((item) => item.id === id);
      if (newCourse) {
        dispatch({ type: "SET_COURSE_SELECTED", payload: { [id]: true } });
        dispatch({ type: "SET_COURSE_INFO", payload: newCourse });
      }
    },
    [dispatch, optimisticCourses],
  );

  const handleNext = useCallback(() => {
    if (!courseInfo || !isCourseSelected || optimisticCourses.length === 0) {
      resetSelection();
      scrollToElement(0);
      return;
    }

    const currIndex = idArr.indexOf(courseInfo.id);
    if (currIndex < idArr.length - 1) {
      setSelection(idArr[currIndex + 1]);
      scrollToElement(currIndex + 1);
    } else {
      resetSelection();
      scrollToElement(0);
    }
  }, [
    courseInfo,
    idArr,
    isCourseSelected,
    optimisticCourses.length,
    resetSelection,
    setSelection,
    scrollToElement,
  ]);

  const handlePrev = useCallback(() => {
    if (!courseInfo || !isCourseSelected || optimisticCourses.length === 0) {
      resetSelection(true);
      scrollToElement(optimisticCourses.length - 1);

      return;
    }

    const currIndex = idArr.indexOf(courseInfo.id);
    if (currIndex > 0) {
      setSelection(idArr[currIndex - 1]);
      scrollToElement(currIndex - 1);
    } else {
      resetSelection(true);
      scrollToElement(optimisticCourses.length - 1);
    }
  }, [
    courseInfo,
    idArr,
    isCourseSelected,
    optimisticCourses.length,
    resetSelection,
    setSelection,
    scrollToElement,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        handlePrev();
      } else if (event.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleNext, handlePrev]);

  return { handleNext, handlePrev, containerRef };
};
