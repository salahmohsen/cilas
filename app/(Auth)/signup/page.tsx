"use client";

import { AuthForm } from "@/app/(Auth)/_components/auth";
import { signup } from "@/app/(Auth)/_lib/auth.actions";
import { useUserStore } from "@/lib/users/user.slice";
import { AuthState } from "@/lib/users/users.actions.types";
import { zodResolver } from "@hookform/resolvers/zod";
import { redirect } from "next/navigation";
import { useFormState } from "react-dom";
import { useForm } from "react-hook-form";
import signupSchema, { SignupSchema } from "../_lib/signup.schema";

export default function SignupPage() {
  const { isLogged, userInfo } = useUserStore();
  if (isLogged && userInfo) redirect(`/${userInfo.role}`);

  const [signupState, signupAction] = useFormState(signup, {} as AuthState);

  const formMethods = useForm<SignupSchema>({
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
