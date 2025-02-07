import { useEffect, useRef, useTransition } from "react";
import { useFormState } from "react-dom";
import { FieldValues, FormProvider, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

type serverActionStateBase = {
  success?: boolean;
  error?: boolean;
  message: string;
};

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
}: FormWrapperProps<Schema, serverActionState>) => {
  const [formState, formAction] = useFormState(
    serverAction,
    {} as Awaited<serverActionState>,
  );
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (formState.success) {
      toast.success(formState.message);
      onSuccess?.();
    }
    if (formState.error) {
      toast.error(formState.message);
      onError?.();
    }
  }, [formState, onSuccess, onError]);

  return (
    <FormProvider {...formMethods}>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => {
            formMethods.handleSubmit(() => {
              formAction(new FormData(formRef.current!));
            })(e);
          });
        }}
        action={formAction}
      >
        {children({ isPending })}
      </form>
    </FormProvider>
  );
};
