"use client";

import { useFormState } from "react-dom";
import { SignupState, signup } from "@/actions/auth.actions";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema } from "@/types/auth.schema";
import { AuthForm } from "@/components/auth/form/auth";
import { useSession } from "@/providers/Session.provider";
import { redirect } from "next/navigation";

export default function SignupPage() {
  const { user } = useSession();
  if (user) redirect("/dashboard");

  const [signupState, signupAction] = useFormState(signup, {} as SignupState);

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
