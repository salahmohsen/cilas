"use client";

import { AuthForm } from "@/app/(Auth)/_components/auth";
import { signin } from "@/lib/actions/auth.actions";
import { useUserStore } from "@/lib/store/user.slice";
import { signinSchema, SigninSchema } from "@/lib/types/auth.schema";
import { AuthState } from "@/lib/types/users.actions.types";
import { zodResolver } from "@hookform/resolvers/zod";
import { redirect } from "next/navigation";
import { useFormState } from "react-dom";
import { useForm } from "react-hook-form";

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
