"use client";

import { isObjectEmpty, shake } from "@/lib/utils/utils";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/hoc/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthState } from "@/lib/users/users.actions.types";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { redirect } from "next/navigation";

type SigninValues = {
  email: string;
  password: string;
};

type SignupValues = {
  email: string;
  password: string;
  passwordConfirmation: string | null;
};

type AuthFormProps =
  | {
      authMode: "signin";
      formMethods: UseFormReturn<SigninValues>;
      formAction: (payload: FormData) => void;
      formState: AuthState;
    }
  | {
      authMode: "signup";
      formMethods: UseFormReturn<SignupValues>;
      formAction: (payload: FormData) => void;
      formState: AuthState;
    };

export function AuthForm({
  authMode,
  formMethods,
  formAction,
  formState,
}: AuthFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formState.error) {
      toast.error(formState.message);
      shake(mainCardRef);
    }
    if (formState.success) {
      toast.success(formState.message);
      formState.redirectPath && redirect(formState.redirectPath);
    }
  }, [formState]);

  function handleSubmitClick() {
    if (!isObjectEmpty(formMethods.formState.errors)) shake(mainCardRef);
  }

  return (
    <div className="flex h-screen scale-90 items-center justify-center">
      {/* @ts-expect-error */}
      <Form {...formMethods}>
        <form
          ref={formRef}
          action={formAction}
          onSubmit={(e) => {
            e.preventDefault();
            formMethods.handleSubmit(() => {
              formAction(new FormData(formRef.current!));
            })(e);
          }}
        >
          <Card ref={mainCardRef} className="w-96">
            <CardHeader>
              <CardTitle className="text-2xl">
                {authMode === "signin" ? "Sign in" : "Sign up"}
              </CardTitle>
              <CardDescription>
                {authMode === "signin"
                  ? "Enter your email and password below to sign in to your account"
                  : "Enter your email and password below to create new account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-1">
                <FormField
                  // @ts-expect-error
                  control={formMethods.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="username" {...field} />
                      </FormControl>
                      <FormDescription />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  // @ts-expect-error
                  control={formMethods.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <PasswordInput
                          autoComplete={
                            authMode === "signin" ? "current-password" : "new-password"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormDescription />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {authMode === "signup" && (
                  <FormField
                    control={formMethods.control}
                    name="passwordConfirmation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          {/* @ts-expect-error */}
                          <PasswordInput autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormDescription />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <div className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full cursor-pointer"
                  onClick={handleSubmitClick}
                >
                  {authMode === "signin" ? "Sign in" : "Sign up"}
                </Button>
                <Link href="/signin/google">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex w-full cursor-pointer items-center gap-2"
                  >
                    <SiGoogle size={15} /> Continue with Google
                  </Button>
                </Link>

                <div className="mt-2 text-center text-sm">
                  <div>
                    {authMode === "signin"
                      ? "Don't have an account "
                      : `Already have an account `}
                    <Link
                      href={`/${authMode === "signin" ? "signup" : "signin"}`}
                      className="underline"
                    >
                      {authMode === "signin" ? "Sign up" : "Sign in"}
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
