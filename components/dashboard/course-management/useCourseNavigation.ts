import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCourseState } from "@/providers/CourseState.provider";

export const useCourseNavigation = (
  containerRef?: React.RefObject<HTMLUListElement>,
) => {
  const {
    state: { courseInfo, isCourseSelected: isCourseSelectedObject },
    dispatch,
    optimisticCourses,
  } = useCourseState();

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
        dispatch({ type: "SET_COURSE_INFO", payload: selectedCourse });
        dispatch({
          type: "SET_COURSE_SELECTED",
          payload: { [selectedId]: true },
        });
      }
    },
    [dispatch, optimisticCourses],
  );

  const setSelection = useCallback(
    (id: number) => {
      const SelectedCourse = optimisticCourses.find((item) => item.id === id);
      if (SelectedCourse) {
        dispatch({ type: "SET_COURSE_SELECTED", payload: { [id]: true } });
        dispatch({ type: "SET_COURSE_INFO", payload: SelectedCourse });
      }
    },
    [dispatch, optimisticCourses],
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
    console.log(containerRef?.current);
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
