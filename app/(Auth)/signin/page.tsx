"use client";

import { AuthForm } from "@/app/(Auth)/_components/auth";
import { signin } from "@/app/(Auth)/_lib/auth.actions";
import { useUserStore } from "@/lib/users/user.slice";
import { AuthState } from "@/lib/users/users.actions.types";
import { zodResolver } from "@hookform/resolvers/zod";
import { redirect } from "next/navigation";
import { useFormState } from "react-dom";
import { useForm } from "react-hook-form";
import signinSchema, { SigninSchema } from "../_lib/signin.schema";

export default function SigninPage() {
  const { isLogged, userInfo } = useUserStore();
  if (isLogged && userInfo) redirect(`/${userInfo.role}`);

  const [signinState, signinAction] = useFormState(signin, {} as AuthState);

  const formMethods = useForm<SigninSchema>({
    resolver: zodResolver(signinSchema),
    progressive: false,
    mode: "onSubmit",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <AuthForm
      authMode="signin"
      formMethods={formMethods}
      formAction={signinAction}
      formState={signinState}
    />
  );
}
