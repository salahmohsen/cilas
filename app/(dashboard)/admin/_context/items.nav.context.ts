import { createContext, useContext } from "react";

export type ItemsNavContextType = {
  handleNext: () => void;
  handlePrev: () => void;
  containerRef: React.RefObject<HTMLUListElement>;
};

export const ItemsNavContext = createContext<ItemsNavContextType | null>(null);

export const useItemsNavContext = () => {
  const context = useContext(ItemsNavContext);
  if (!context) throw new Error("ItemsNavContext must be used within its provider");

  return context;
};
