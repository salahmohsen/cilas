import { serverActionStateBase } from "@/lib/types/server.actions";
import { useEffect, useRef, useTransition, useActionState } from "react";
import { FieldValues, FormProvider, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

type FormWrapperProps<
  Schema extends FieldValues,
  serverActionState extends serverActionStateBase,
> = {
  children: ({ isPending }: { isPending: boolean }) => JSX.Element;
  formMethods: UseFormReturn<Schema>;
  serverAction: (
    prevState: Awaited<serverActionState>,
    formData: FormData,
  ) => Promise<serverActionState>;
  onSuccess?: () => void;
  onError?: () => void;
  className?: string;
};

/**
 * A wrapper component for forms that integrates react-hook-form with server actions
 * and handles form submission states.
 *
 * @template TSchema - The form schema type extending FieldValues
 * @template TServerState - The server action response type extending ServerActionStateBase
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
 * type ServerState = ServerActionStateBase & { data?: User };
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

export const FormWrapper = <
  Schema extends FieldValues,
  serverActionState extends serverActionStateBase,
>({
  children,
  formMethods,
  serverAction,
  onSuccess,
  onError,
  className,
}: FormWrapperProps<Schema, serverActionState>) => {
  const [formState, formAction] = useActionState(
    serverAction,
    {} as Awaited<serverActionState>,
  );
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (formState.success) {
      toast.success(formState.message);
      onSuccess?.();
      formMethods.reset();
    }
    if (formState.error) {
      toast.error(formState.message);
      onError?.();
    }
  }, [formState, onSuccess, onError, formMethods]);

  return (
    <FormProvider {...formMethods}>
      <form
        ref={formRef}
        className={className}
        onSubmit={(e) => {
          const nativeEvent = e.nativeEvent as SubmitEvent;
          const submitter = (nativeEvent.submitter as HTMLButtonElement).classList;

          if (submitter.contains("submit-btn")) {
            e.preventDefault();
            formMethods.handleSubmit(() => {
              const formData = new FormData(formRef.current!);

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
