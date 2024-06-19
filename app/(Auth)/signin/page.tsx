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
import {
  signInAction,
  signUpAction,
  signinAction,
} from "@/actions/auth.actions";
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
import { signinSchema } from "@/types/auth.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { useEffect, useRef } from "react";
import { redirect } from "next/navigation";

export default function Signin() {
  const [formState, formAction] = useFormState(signinAction, {});

  const formMethods = useForm<z.infer<typeof signinSchema>>({
    resolver: zodResolver(signinSchema),
    progressive: false,
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (formState.error) toast.error(formState.error);
    if (formState.success) redirect("/dashboard");
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
        className="flex h-screen w-full items-center justify-center overflow-x-hidden"
        onSubmit={(e) => {
          e.preventDefault();

          formMethods.handleSubmit(() => {
            formAction(new FormData(formRef.current!));
          })(e);
        }}
      >
        <Card className="h-max max-h-screen w-1/4 scale-90" ref={mainCardRef}>
          <CardHeader>
            <CardTitle className="text-2xl">Signin</CardTitle>
            <CardDescription>
              Enter your email and password below to login to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-8 flex flex-col gap-2">
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
            </div>
            <div className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full"
                onClick={handleSignUpClick}
              >
                signin
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
              <div className="mt-4 text-center text-sm">
                <div>
                  Don't have an account{" "}
                  <Link href="/signup" className="underline">
                    Signup
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
