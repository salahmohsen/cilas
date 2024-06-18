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
import { signInAction, signUpAction } from "@/actions/auth.actions";
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
import { signInSchema } from "@/types/auth.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { useRef } from "react";

export default function SignUp() {
  const [formState, formAction] = useFormState(signUpAction, {});

  const formMethods = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    progressive: false,
    mode: "onChange",
    defaultValues: {
      // ...(formState.fields ?? {}),
    },
  });

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Form {...formMethods}>
      <form
        ref={formRef}
        action={formAction}
        className="flex h-screen w-screen items-center justify-center"
        onSubmit={(e) => {
          e.preventDefault();
          formMethods.handleSubmit(() => {
            formAction(new FormData(formRef.current!));
          })(e);
        }}
      >
        <Card className="mx-auto h-max w-1/4 max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Enter your email below to login to your account
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
              <Button type="submit" className="w-full">
                Signup
              </Button>
              <Link href="/login/google">
                <Button
                  type="button"
                  variant="outline"
                  className="flex w-full items-center gap-2"
                >
                  <SiGoogle size={15} /> Login with Google
                </Button>
              </Link>
              <div className="mt-4 text-center text-sm">
                <div>
                  Already have an account{" "}
                  <Link href="/signin" className="underline">
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
