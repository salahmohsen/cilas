import { SidebarState } from "@/lib/tiptap/hooks/useSidebar";
import { useCallback, useState } from "react";

type usePostSidebarProps = {
  enLeftSidebar: SidebarState;
  arLeftSidebar: SidebarState;
};

export const usePostSidebar = ({ enLeftSidebar, arLeftSidebar }: usePostSidebarProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
    enLeftSidebar.toggle();
    arLeftSidebar.toggle();
  }, [enLeftSidebar, arLeftSidebar]);

  return { isSidebarOpen, toggleSidebar };
};
