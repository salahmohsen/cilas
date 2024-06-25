"use client";

import Link from "next/link";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { useFormState } from "react-dom";
import { signupAction } from "@/actions/auth.actions";
import { FormProvider, useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { signupSchema } from "@/types/auth.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { useEffect, useRef } from "react";

export default function Signup() {
  const [formState, formAction] = useFormState(signupAction, {
    error: undefined,
    success: undefined,
  });

  const formMethods = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    progressive: false,
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });
  console.log(formMethods.watch());

  useEffect(() => {
    if (formState.error) toast.error(formState.error);
    if (formState.success) toast.success(formState.success);
  }, [formState]);

  const formRef = useRef<HTMLFormElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);

  function handleSignUpClick() {
    if (Object.keys(formMethods.formState.errors).length !== 0) {
      mainCardRef.current?.classList.add("animate-shake");
      setTimeout(() => {
        mainCardRef.current?.classList.remove("animate-shake");
      }, 1000);
    }
  }

  return (
    <Form {...formMethods}>
      <form
        ref={formRef}
        action={formAction}
        className="flex items-center justify-center"
        onSubmit={(e) => {
          e.preventDefault();

          formMethods.handleSubmit(() => {
            formAction(new FormData(formRef.current!));
          })(e);
        }}
      >
        <Card className="w-1/5" ref={mainCardRef}>
          <CardHeader>
            <CardTitle className="text-2xl">Signup</CardTitle>
            <CardDescription>
              Enter your email and password below to create new account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-1">
              <FormField
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
              <FormField
                control={formMethods.control}
                name="passwordConfirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormDescription />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full"
                onClick={handleSignUpClick}
              >
                Signup
              </Button>
              <Link href="/login/google">
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
                  Already have an account{" "}
                  <Link href="/login" className="underline">
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}