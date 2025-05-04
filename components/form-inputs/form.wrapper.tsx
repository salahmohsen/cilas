import { ServerActionReturn } from "@/lib/types/server.actions";
import { useEffect, useTransition } from "react";
import { useFormState } from "react-dom";
import { FieldValues, FormProvider, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

type FormWrapperProps<TFieldValues extends FieldValues> = {
  children: ({ isPending }: { isPending: boolean }) => JSX.Element;
  formMethods: UseFormReturn<TFieldValues>;
  serverAction: (
    prevState: ServerActionReturn,
    formData: FormData,
  ) => Promise<ServerActionReturn>;
  onSuccess?: () => void;
  onError?: () => void;
  className?: string;
};

/**
 * A wrapper component for forms that integrates react-hook-form with server actions
 * and handles form submission states.
 *
 * @template TSchema - The form schema type extending FieldValues
 *
 * Features:
 * - Integrates react-hook-form with server actions
 * - Handles form submission states (pending, success, error)
 * - Provides toast notifications for submission results
 * - Supports success and error callbacks
 * - Type-safe form handling
 *
 * @example
 * ```tsx
 * type FormSchema = { email: string; password: string };
 *
 * const MyForm = () => {
 *   const formMethods = useForm<FormSchema>();
 *
 *   return (
 *     <FormWrapper<FormSchema, ServerState>
 *       formMethods={formMethods}
 *       serverAction={loginUser}
 *       onSuccess={() => router.push('/dashboard')}
 *     >
 *       {({ isPending }) => (
 *         <>
 *           <Input name="email" />
 *           <Input name="password" />
 *           <Button disabled={isPending}>Submit</Button>
 *         </>
 *       )}
 *     </FormWrapper>
 *   );
 * };
 * ```
 */

export const FormWrapper = <TFieldValues extends FieldValues>({
  children,
  formMethods,
  serverAction,
  onSuccess,
  onError,
  className,
}: FormWrapperProps<TFieldValues>) => {
  const [formState, formAction] = useFormState(
    serverAction,
    {} as Awaited<ServerActionReturn>,
  );
  const [isPending, startTransition] = useTransition();
  // const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (formState.success) {
      toast.success(formState.message);
      onSuccess?.();
      formMethods.reset();
    }
  }, [formState, onSuccess, formMethods]);

  useEffect(() => {
    if (formState.error) {
      toast.error(formState.message);
      onError?.();
    }
  }, [formState, onError]);

  return (
    <FormProvider {...formMethods}>
      <form
        // ref={formRef}
        className={className}
        onSubmit={(e) => {
          const nativeEvent = e.nativeEvent as SubmitEvent;
          const submitter = (nativeEvent.submitter as HTMLButtonElement).classList;

          if (submitter.contains("submit-btn")) {
            e.preventDefault();
            formMethods.handleSubmit((data) => {
              const formData = new FormData();
              formData.append("data", JSON.stringify(data));

              startTransition(() => {
                formAction(formData);
              });
            })(e);
          } else {
            e.preventDefault();
          }
        }}
        action={formAction}
      >
        {children({ isPending })}
      </form>
    </FormProvider>
  );
};
