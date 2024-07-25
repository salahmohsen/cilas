"use client";

import { forwardRef, useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { FormProvider, useForm } from "react-hook-form";
import { useCourseState } from "@/providers/CourseState.provider";
import { FellowState, addFellow } from "@/actions/users.actions";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FellowSchema, fellowDefaultValues } from "@/types/fellow.schema";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { TipTapInput } from "@/components/dashboard/form/inputs/input.tipTap";
import { SubmitButton } from "@/components/dashboard/form/inputs/input.submit";
import { BasicInput } from "@/components/dashboard/form/inputs/input.basic";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SquarePlus } from "lucide-react";

type NewFellowProps = {
  mode: "button" | "commandItem";
  fellowData?: z.infer<typeof FellowSchema> | undefined;
};

export const FellowForm = forwardRef<HTMLButtonElement, NewFellowProps>(
  ({ mode, fellowData }, ref) => {
    const [fellowState, fellowAction] = useFormState(
      addFellow,
      {} as FellowState,
    );
    const [open, setOpen] = useState(false);

    const { dispatch } = useCourseState();

    const [isPending, startTransition] = useTransition();

    const formMethods = useForm<z.infer<typeof FellowSchema>>({
      resolver: zodResolver(FellowSchema),
      mode: "onChange",
      defaultValues: { ...fellowDefaultValues, ...(fellowData ?? {}) },
    });

    useEffect(() => {
      if (fellowState.success) {
        toast.success(fellowState.message);
        dispatch({ type: "SET_FELLOW", payload: fellowState.fellow });
        setOpen(false);
      }
      if (fellowState.error) toast.error(fellowState.message);
    }, [fellowState, dispatch]);

    const formRef = useRef<HTMLFormElement>(null);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant={mode === "button" ? "outline" : "ghost"}
            ref={ref}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setOpen(true);
            }}
            className={`flex gap-2 text-sm font-normal ${
              mode === "commandItem"
                ? "mt-1 h-auto w-full px-2 py-1.5"
                : "mx-auto mt-1 h-auto w-32 py-1.5"
            }`}
          >
            <SquarePlus strokeWidth={1} size={18} /> Add New Fellow
          </Button>
        </DialogTrigger>
        <DialogPortal>
          <DialogOverlay className="z-[499] bg-foreground/50 backdrop-blur-sm">
            <DialogContent className="z-[500] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Fellow</DialogTitle>
              </DialogHeader>
              <ScrollArea className="-mr-1 max-h-[calc(100vh-200px)] pr-3">
                <FormProvider {...formMethods}>
                  <Form {...formMethods}>
                    <form
                      ref={formRef}
                      action={fellowAction}
                      onSubmit={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        formMethods.handleSubmit(() => {
                          startTransition(() => {
                            const formData = new FormData(formRef.current!);
                            fellowAction(formData);
                          });
                        })(e); // immediately invokes the handleSubmit with the original event object.
                      }}
                    >
                      <div className="grid gap-4 py-4 pr-2">
                        <BasicInput
                          name="firstName"
                          type="text"
                          placeholder="Paulo"
                          label="First Name"
                          direction="horizontal"
                        />
                        <BasicInput
                          name="lastName"
                          type="text"
                          placeholder="Freire"
                          label="Last Name"
                          direction="horizontal"
                        />
                        <BasicInput
                          name="email"
                          type="email"
                          placeholder="PauloFreire@domain.com"
                          label="Email"
                          direction="horizontal"
                        />

                        <div className="grid grid-cols-7 items-center gap-2">
                          <Label htmlFor="bio" className="col-span-2">
                            Bio
                          </Label>
                          <TipTapInput
                            className="col-span-5"
                            editorToolbar={false}
                            name="bio"
                            placeholder="Marxist Brazilian educator and philosopher who was a leading advocate of critical pedagogy."
                          />
                        </div>

                        <BasicInput
                          name="tel"
                          type="tel"
                          placeholder="+201012345678"
                          label="Tel"
                          direction="horizontal"
                        />
                      </div>
                      <DialogFooter className="mr-2 mt-2">
                        <SubmitButton
                          value="Add Fellow"
                          className="max-w-max px-10"
                          isLoading={isPending}
                        />
                      </DialogFooter>
                    </form>
                  </Form>
                </FormProvider>
              </ScrollArea>
            </DialogContent>
          </DialogOverlay>
        </DialogPortal>
      </Dialog>
    );
  },
);

FellowForm.displayName = "FellowForm";
