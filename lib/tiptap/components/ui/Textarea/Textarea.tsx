import { cn } from "@/lib/tiptap/lib/utils";

export const Textarea = (
  {
    ref,
    className,
    ...rest
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    ref: React.RefObject<HTMLTextAreaElement>;
  }
) => {
  const textAreaClassName = cn(
    "bg-black/5 border-0 rounded-lg caret-black block text-black text-sm font-medium h-[4.5rem] px-2 py-1 w-full",
    "dark:bg-white/10 dark:text-white dark:caret-white",
    "hover:bg-black/10",
    "dark:hover:bg-white/20",
    "focus:bg-transparent active:bg-transparent focus:outline focus:outline-black active:outline active:outline-black",
    "dark:focus:outline-white dark:active:outline-white",
    className,
  );

  return <textarea className={textAreaClassName} ref={ref} {...rest} />;
};

Textarea.displayName = "Textarea";
