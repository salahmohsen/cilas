import { cn } from "@/lib/tiptap/lib/utils";

export const DropdownCategoryTitle = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mb-1 px-1.5 text-[.65rem] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
      {children}
    </div>
  );
};

export const DropdownButton = ({
  children,
  isActive,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) => {
  const buttonClass = cn(
    "flex items-center gap-2 p-2 text-sm font-medium text-muted-foreground text-left bg-transparent w-full rounded-md",
    !isActive && !disabled && "hover:bg-accent hover:text-accent-foreground",
    isActive && !disabled && "bg-secondary text-secondary-foreground",
    disabled && "text-muted cursor-not-allowed",
    className,
  );

  return (
    <button className={buttonClass} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
};
