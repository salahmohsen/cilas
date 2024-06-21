import { generateCodeVerifier, generateState } from "arctic";
import { google } from "@/lib/auth";

import { cookies } from "next/headers";

export async function GET(): Promise<Response> {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = await google.createAuthorizationURL(state, codeVerifier, {
    scopes: ["profile", "email"],
  });

  cookies().set("google_oauth_state", state, {
    secure: process.env.COOKIE_SECURE === "true", //ToDo // set to false in localhost
    path: "/",
    httpOnly: true,
    maxAge: 60 * 10, // 10 min
  });

  cookies().set("google_code_verifier", codeVerifier, {
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    httpOnly: true,
    maxAge: 60 * 10, // 10 min
  });

  return Response.redirect(url);
}
