import { useFormStatus } from "react-dom";
import { Button } from "../ui/button";
import { LoaderPinwheel } from "lucide-react";
import { cn } from "@/lib/utils";

const SubmitButton = ({ className }: { className?: string }) => {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className={cn("w-full", className)}
    >
      {pending ? <LoaderPinwheel className="animate-spin" /> : "Submit"}
    </Button>
  );
};

export default SubmitButton;
