import { cn } from "@/lib/tiptap/lib/utils";
import { HTMLProps } from "react";

export const Spinner = (
  {
    ref,
    className,
    ...rest
  }: HTMLProps<HTMLDivElement> & {
    ref: React.RefObject<HTMLDivElement>;
  }
) => {
  const spinnerClass = cn(
    "animate-spin rounded-full border-2 border-current border-t-transparent h-4 w-4",
    className,
  );

  return <div className={spinnerClass} ref={ref} {...rest} />;
};

Spinner.displayName = "Spinner";
