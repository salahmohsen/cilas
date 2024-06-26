"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { UseFormReturn } from "react-hook-form";
import { SigninState, SignupState } from "@/actions/auth.actions";
import { toast } from "sonner";
import { isObjectEmpty, shake } from "@/lib/utils";

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
      formState: SigninState;
    }
  | {
      authMode: "signup";
      formMethods: UseFormReturn<SignupValues>;
      formAction: (payload: FormData) => void;
      formState: SignupState;
    };

export default function AuthForm({
  authMode,
  formMethods,
  formAction,
  formState,
}: AuthFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formState.error) {
      toast.error(formState.error);
      shake(mainCardRef);
    }
    if (formState.success) {
      toast.success(formState.success);
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
                        <Input type="email" {...field} />
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
                        <Input type="password" {...field} />
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
                          {/*  @ts-expect-error */}
                          <Input type="password" {...field} />
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
                  className="w-full"
                  onClick={handleSubmitClick}
                >
                  {authMode === "signin" ? "Sign in" : "Sign up"}
                </Button>
                <Link href="/signin/google">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex w-full items-center gap-2"
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
