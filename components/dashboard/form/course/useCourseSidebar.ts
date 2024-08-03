import { SidebarState } from "@/tipTap/hooks/useSidebar";
import { useCallback, useState } from "react";

type useCourseSidebarProps = {
  enLeftSidebar: SidebarState;
  arLeftSidebar: SidebarState;
};

export const useCourseSidebar = ({
  enLeftSidebar,
  arLeftSidebar,
}: useCourseSidebarProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
    enLeftSidebar.toggle();
    arLeftSidebar.toggle();
  }, [enLeftSidebar, arLeftSidebar]);

  return { isSidebarOpen, toggleSidebar };
};
