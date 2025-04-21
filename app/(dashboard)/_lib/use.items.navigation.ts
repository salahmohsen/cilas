import { useCallback, useEffect, useMemo, useState } from "react";

interface ItemsNavigationProps<T extends { id: number }> {
  itemInfo: T | null;
  isItemSelected: Record<number, boolean> | null;
  items: T[] | null;
  setItemInfo: (item: T | null) => void;
  setItemSelected: (selected: Record<number, boolean> | null) => void;
  containerRef?: React.RefObject<HTMLUListElement>;
  scrollOffset?: number; // Optional parameter to adjust scroll position
}

/**
 * Custom hook for managing item navigation with keyboard controls
 * and automatic scrolling to the selected item
 */
export const useItemsNavigation = <T extends { id: number }>({
  itemInfo,
  isItemSelected,
  items,
  setItemInfo,
  setItemSelected,
  containerRef,
  scrollOffset = 160, // Default header offset
}: ItemsNavigationProps<T>) => {
  const [scrollIndex, setScrollIndex] = useState<number | null>(null);

  // Extract IDs from items for efficient lookup
  const itemIds = useMemo(() => items?.map((item) => item.id) || [], [items]);

  // Check if any item is currently selected
  const isAnyItemSelected = useMemo(
    () => Boolean(isItemSelected && Object.values(isItemSelected).some(Boolean)),
    [isItemSelected],
  );

  // Reset selection to first or last item
  const resetSelection = useCallback(
    (isLast: boolean = false) => {
      if (!items?.length) return;

      const selectedItem = isLast ? items[items.length - 1] : items[0];
      const selectedId = selectedItem.id;

      setItemInfo(selectedItem);
      setItemSelected({ [selectedId]: true });
    },
    [items, setItemInfo, setItemSelected],
  );

  // Select a specific item by ID
  const setSelection = useCallback(
    (id: number) => {
      const selectedItem = items?.find((item) => item.id === id);
      if (selectedItem) {
        setItemInfo(selectedItem);
        setItemSelected({ [id]: true });
      }
    },
    [items, setItemInfo, setItemSelected],
  );

  // Navigate to next item
  const handleNext = useCallback(() => {
    // Initialize if nothing is selected
    if (!itemInfo || !isItemSelected || !items?.length) {
      resetSelection();
      setScrollIndex(0);
      return;
    }

    const currIndex = itemIds.indexOf(itemInfo.id);

    // Handle valid indices and navigation
    if (currIndex !== -1 && currIndex < itemIds.length - 1) {
      setSelection(itemIds[currIndex + 1]);
      setScrollIndex(currIndex + 1);
    } else {
      // Wrap around to the first item
      resetSelection();
      setScrollIndex(0);
    }
  }, [itemInfo, itemIds, isItemSelected, items?.length, resetSelection, setSelection]);

  // Navigate to previous item
  const handlePrev = useCallback(() => {
    // Initialize if nothing is selected
    if (!itemInfo || !isAnyItemSelected || !items?.length) {
      resetSelection(true);
      setScrollIndex(items?.length ?? 1 - 1);
      return;
    }

    const currIndex = itemIds.indexOf(itemInfo.id);

    // Handle valid indices and navigation
    if (currIndex > 0) {
      setSelection(itemIds[currIndex - 1]);
      setScrollIndex(currIndex - 1);
    } else {
      // Wrap around to the last item
      resetSelection(true);
      setScrollIndex(items.length - 1);
    }
  }, [itemInfo, isAnyItemSelected, items, itemIds, resetSelection, setSelection]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent default behavior for arrow keys to avoid page scrolling
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();

        if (event.key === "ArrowLeft") {
          handlePrev();
        } else {
          handleNext();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  // Scroll to selected item - fixed to properly scroll within container
  useEffect(() => {
    if (scrollIndex === null || !containerRef?.current) return;

    const container = containerRef.current;
    const elements = Array.from(container.querySelectorAll("[data-item-id]"));

    if (scrollIndex >= 0 && scrollIndex < elements.length) {
      const element = elements[scrollIndex] as HTMLElement;

      if (element) {
        // Scroll the element into view within its container
        // instead of scrolling the entire page
        element.scrollIntoView({
          behavior: "smooth",
          block: "nearest", // This keeps the container properly filled
        });

        // Apply the offset to adjust for headers if needed
        if (scrollOffset) {
          // Use a small timeout to allow the scrollIntoView to complete first
          setTimeout(() => {
            const currentScrollPos = window.scrollY;
            window.scrollTo({
              top: currentScrollPos - scrollOffset,
              behavior: "smooth",
            });
          }, 100);
        }
      }
    }
  }, [containerRef, scrollIndex, scrollOffset]);

  return {
    handleNext,
    handlePrev,
    currentIndex: itemInfo ? itemIds.indexOf(itemInfo.id) : null,
    totalItems: items?.length || 0,
    isAnyItemSelected,
  };
};
