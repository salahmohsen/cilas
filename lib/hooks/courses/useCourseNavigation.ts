import { useCallback, useEffect, useMemo, useState } from "react";

interface ItemsNavigationProps<T> {
  itemInfo: T | null;
  isItemSelected: Record<number, boolean> | null;
  items: T[] | null;
  setItemInfo: (course: T | null) => void;
  setItemSelected: (selected: Record<number, boolean> | null) => void;
  containerRef?: React.RefObject<HTMLUListElement>;
}

export const useItemsNavigation = <T extends { id: number }>({
  itemInfo,
  isItemSelected,
  items,
  setItemInfo,
  setItemSelected,
  containerRef,
}: ItemsNavigationProps<T>) => {
  const [scrollIndex, setScrollIndex] = useState<number | null>(null);

  const idArr = useMemo(() => items?.map((item) => item.id), [items]);

  const isCourseSelected = useMemo(
    () => Object.values(isItemSelected ?? {}).some(Boolean),
    [isItemSelected],
  );

  const resetSelection = useCallback(
    (isLast: boolean = false) => {
      if (items?.length === 0) return;

      const selectedItem = isLast ? items?.at(-1) : items?.[0];
      const selectedId = selectedItem?.id;

      if (selectedItem && selectedId !== undefined) {
        setItemInfo(selectedItem);
        setItemSelected({ [selectedId]: true });
      }
    },
    [setItemInfo, setItemSelected, items],
  );

  const setSelection = useCallback(
    (id: number) => {
      const selectedItem = items?.find((item) => item.id === id);
      if (selectedItem) {
        setItemSelected({ [id]: true });
        setItemInfo(selectedItem);
      }
    },
    [setItemSelected, setItemInfo, items],
  );

  const handleNext = useCallback(() => {
    if (!itemInfo || !isItemSelected || items?.length === 0) {
      resetSelection();
      setScrollIndex(0);
      return;
    }

    const currIndex = idArr?.indexOf(itemInfo.id);
    console.log("idArr", idArr, "currIndex", currIndex);
    if (idArr && typeof currIndex === "number" && currIndex < idArr.length - 1) {
      setSelection(idArr[currIndex + 1]);
      setScrollIndex(currIndex + 1);
    } else {
      resetSelection();
      setScrollIndex(0);
    }
  }, [itemInfo, idArr, isItemSelected, items?.length, resetSelection, setSelection]);

  const handlePrev = useCallback(() => {
    if (!itemInfo || !isCourseSelected || items?.length === 0) {
      resetSelection(true);
      idArr && setScrollIndex(idArr.length - 1);
      return;
    }

    const currIndex = idArr?.indexOf(itemInfo.id);
    if (currIndex && idArr && currIndex > 0) {
      setSelection(idArr[currIndex - 1]);
      setScrollIndex(currIndex - 1);
    } else {
      resetSelection(true);
      idArr && setScrollIndex(idArr.length - 1);
    }
  }, [itemInfo, isCourseSelected, items?.length, idArr, resetSelection, setSelection]);

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
