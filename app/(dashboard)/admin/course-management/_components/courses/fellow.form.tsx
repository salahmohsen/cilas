"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FellowState, addFellow } from "@/lib/actions/users.actions";
import { FellowSchema, fellowSchema } from "@/lib/types/forms.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { forwardRef, useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { BasicInput, SubmitButton, TipTapInput } from "@/components/form-inputs";

import { useCourseStore } from "@/lib/store/course.slice";
import { SquarePlus } from "lucide-react";

type NewFellowProps = {
  mode: "button" | "commandItem";
  fellowData?: FellowSchema | undefined;
};

export const FellowForm = forwardRef<HTMLButtonElement, NewFellowProps>(
  ({ mode, fellowData }, ref) => {
    const [fellowState, fellowAction] = useFormState(addFellow, {} as FellowState);
    const [open, setOpen] = useState(false);

    const { setFellow } = useCourseStore();
    const [isPending, startTransition] = useTransition();

    const formMethods = useForm<FellowSchema>({
      resolver: zodResolver(fellowSchema.schema),
      mode: "onChange",
      defaultValues: { ...fellowSchema.defaults, ...(fellowData ?? {}) },
    });

    useEffect(() => {
      if (fellowState.success) {
        toast.success(fellowState.message);
        setFellow(fellowState.fellow);
        setOpen(false);
      }
      if (fellowState.error) toast.error(fellowState.message);
    }, [fellowState, setFellow]);

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
        <DialogContent className="z-50 sm:max-w-lg" tabIndex={undefined}>
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
                    <BasicInput<FellowSchema, "firstName">
                      name="firstName"
                      type="text"
                      placeholder="Paulo"
                      label="First Name"
                      direction="horizontal"
                    />
                    <BasicInput<FellowSchema, "lastName">
                      name="lastName"
                      type="text"
                      placeholder="Freire"
                      label="Last Name"
                      direction="horizontal"
                    />
                    <BasicInput<FellowSchema, "email">
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
                      <TipTapInput<FellowSchema, "bio">
                        name="bio"
                        className="col-span-5"
                        editorToolbar={false}
                        placeholder="Marxist Brazilian educator and philosopher who was a leading advocate of critical pedagogy."
                      />
                    </div>

                    <BasicInput<FellowSchema, "tel">
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
      </Dialog>
    );
  },
);

FellowForm.displayName = "FellowForm";
