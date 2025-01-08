import { useCourseStore } from "@/lib/store/course.slice";
import { useCallback, useEffect, useMemo, useState } from "react";

export const useCourseNavigation = (
  containerRef?: React.RefObject<HTMLUListElement>,
) => {
  const {
    courseInfo,
    isCourseSelected: isCourseSelectedObject,
    optimisticCourses,
    setCourseInfo,
    setCourseSelected,
  } = useCourseStore();

  const [scrollIndex, setScrollIndex] = useState<number | null>(null);

  const idArr = useMemo(
    () => optimisticCourses.map((item) => item.id),
    [optimisticCourses],
  );

  const isCourseSelected = useMemo(
    () => Object.values(isCourseSelectedObject ?? {}).some(Boolean),
    [isCourseSelectedObject],
  );

  const resetSelection = useCallback(
    (isLast: boolean = false) => {
      if (optimisticCourses.length === 0) return;

      const selectedCourse = isLast
        ? optimisticCourses.at(-1)
        : optimisticCourses[0];
      const selectedId = selectedCourse?.id;

      if (selectedCourse && selectedId !== undefined) {
        setCourseInfo(selectedCourse);
        setCourseSelected({ [selectedId]: true });
      }
    },
    [setCourseInfo, setCourseSelected, optimisticCourses],
  );

  const setSelection = useCallback(
    (id: number) => {
      const SelectedCourse = optimisticCourses.find((item) => item.id === id);
      if (SelectedCourse) {
        setCourseSelected({ [id]: true });
        setCourseInfo(SelectedCourse);
      }
    },
    [setCourseSelected, setCourseInfo, optimisticCourses],
  );

  const handleNext = useCallback(() => {
    if (!courseInfo || !isCourseSelected || optimisticCourses.length === 0) {
      resetSelection();
      setScrollIndex(0);
      return;
    }

    const currIndex = idArr.indexOf(courseInfo.id);
    if (currIndex < idArr.length - 1) {
      setSelection(idArr[currIndex + 1]);
      setScrollIndex(currIndex + 1);
    } else {
      resetSelection();
      setScrollIndex(0);
    }
  }, [
    courseInfo,
    idArr,
    isCourseSelected,
    optimisticCourses.length,
    resetSelection,
    setSelection,
  ]);

  const handlePrev = useCallback(() => {
    if (!courseInfo || !isCourseSelected || optimisticCourses.length === 0) {
      resetSelection(true);

      setScrollIndex(idArr.length - 1);

      return;
    }

    const currIndex = idArr.indexOf(courseInfo.id);
    if (currIndex > 0) {
      setSelection(idArr[currIndex - 1]);
      setScrollIndex(currIndex - 1);
    } else {
      resetSelection(true);
      setScrollIndex(idArr.length - 1);
    }
  }, [
    courseInfo,
    idArr,
    isCourseSelected,
    optimisticCourses.length,
    resetSelection,
    setSelection,
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

  useEffect(() => {
    if (!containerRef || !containerRef.current || scrollIndex === null) return;

    const container = containerRef.current;
    const elements = container.querySelectorAll("[data-course-id]");

    if (scrollIndex >= 0 && scrollIndex < elements.length) {
      const element = elements[scrollIndex];
      if (element instanceof HTMLElement) {
        const headerOffset = 70;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.scrollY - headerOffset;

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
  }, [containerRef, scrollIndex]);

  return { handleNext, handlePrev };
};
