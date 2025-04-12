import { cn } from "@/lib/tiptap/lib/utils";
import { HTMLProps } from "react";

export type SurfaceProps = HTMLProps<HTMLDivElement> & {
  withShadow?: boolean;
  withBorder?: boolean;
};

export const Surface = (
  {
    ref,
    children,
    className,
    withShadow = true,
    withBorder = true,
    ...props
  }: SurfaceProps & {
    ref: React.RefObject<HTMLDivElement>;
  }
) => {
  const surfaceClass = cn(
    className,
    "rounded-lg bg-background",
    withShadow ? "shadow-xs" : "",
    withBorder ? "border  " : "",
  );

  return (
    <div className={surfaceClass} {...props} ref={ref}>
      {children}
    </div>
  );
};

Surface.displayName = "Surface";
