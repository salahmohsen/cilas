import { useCourseStore } from "@/lib/store/course.slice";
import { useCallback, useEffect, useMemo, useState } from "react";

export const useCourseNavigation = (
  containerRef?: React.RefObject<HTMLUListElement>,
) => {
  const {
    courseInfo,
    isCourseSelected: isCourseSelectedObject,
    courses,
    setCourseInfo,
    setCourseSelected,
  } = useCourseStore();

  const [scrollIndex, setScrollIndex] = useState<number | null>(null);

  const idArr = useMemo(() => courses?.map((item) => item.id), [courses]);

  const isCourseSelected = useMemo(
    () => Object.values(isCourseSelectedObject ?? {}).some(Boolean),
    [isCourseSelectedObject],
  );

  const resetSelection = useCallback(
    (isLast: boolean = false) => {
      if (courses?.length === 0) return;

      const selectedCourse = isLast ? courses?.at(-1) : courses?.[0];
      const selectedId = selectedCourse?.id;

      if (selectedCourse && selectedId !== undefined) {
        setCourseInfo(selectedCourse);
        setCourseSelected({ [selectedId]: true });
      }
    },
    [setCourseInfo, setCourseSelected, courses],
  );

  const setSelection = useCallback(
    (id: number) => {
      const SelectedCourse = courses?.find((item) => item.id === id);
      if (SelectedCourse) {
        setCourseSelected({ [id]: true });
        setCourseInfo(SelectedCourse);
      }
    },
    [setCourseSelected, setCourseInfo, courses],
  );

  const handleNext = useCallback(() => {
    if (!courseInfo || !isCourseSelected || courses?.length === 0) {
      resetSelection();
      setScrollIndex(0);
      return;
    }

    const currIndex = idArr?.indexOf(courseInfo.id);
    console.log("idArr", idArr, "currIndex", currIndex);
    if (
      idArr &&
      typeof currIndex === "number" &&
      currIndex < idArr.length - 1
    ) {
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
    courses?.length,
    resetSelection,
    setSelection,
  ]);

  const handlePrev = useCallback(() => {
    if (!courseInfo || !isCourseSelected || courses?.length === 0) {
      resetSelection(true);
      idArr && setScrollIndex(idArr.length - 1);
      return;
    }

    const currIndex = idArr?.indexOf(courseInfo.id);
    if (currIndex && idArr && currIndex > 0) {
      setSelection(idArr[currIndex - 1]);
      setScrollIndex(currIndex - 1);
    } else {
      resetSelection(true);
      idArr && setScrollIndex(idArr.length - 1);
    }
  }, [
    courseInfo,
    idArr,
    isCourseSelected,
    courses?.length,
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
        const headerOffset = 160;
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
