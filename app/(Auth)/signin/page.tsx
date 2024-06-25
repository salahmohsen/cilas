"use client";

import { useFormState } from "react-dom";
import { SigninState, signin } from "@/actions/auth.actions";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signinSchema } from "@/types/auth.schema";
import { redirect } from "next/navigation";
import { useSession } from "@/providers/Session.provider";
import AuthForm from "@/components/auth/AuthForm";

export default function SigninPage() {
  const { user } = useSession();
  if (user) redirect("/dashboard");

  const [signinState, signinAction] = useFormState(signin, {} as SigninState);

  const formMethods = useForm<z.infer<typeof signinSchema>>({
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
