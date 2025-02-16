"use client";

import { AuthForm } from "@/app/(Auth)/_components/auth";
import { signup } from "@/lib/actions/auth.actions";
import { useUserStore } from "@/lib/store/user.slice";
import { signupSchema } from "@/lib/types/auth.schema";
import { AuthState } from "@/lib/types/users.actions.types";
import { zodResolver } from "@hookform/resolvers/zod";
import { redirect } from "next/navigation";
import { useFormState } from "react-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";

export default function SignupPage() {
  const { isLogged, userInfo } = useUserStore();
  if (isLogged && userInfo) redirect(`/${userInfo.role}`);

  const [signupState, signupAction] = useFormState(signup, {} as AuthState);

  const formMethods = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    progressive: false,
    mode: "onSubmit",
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });

  return (
    <AuthForm
      authMode="signup"
      formMethods={formMethods}
      formAction={signupAction}
      formState={signupState}
    />
  );
}
