import { generateCodeVerifier, generateState } from "arctic";
import { google } from "@/lib/apis/auth.api";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(): Promise<Response> {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url: URL = await google.createAuthorizationURL(state, codeVerifier, {
    scopes: ["openid", "profile", "email"],
  });
console.log(url)
  cookies().set("google_oauth_state", state, {
    secure: process.env.NODE_ENV === "production",
    path: "/",
    httpOnly: true,
    maxAge: 60 * 10, // 10 min
  });

  cookies().set("google_code_verifier", codeVerifier, {
    secure: process.env.NODE_ENV === "production",
    path: "/",
    httpOnly: true,
    maxAge: 60 * 10, // 10 min
  });
  return NextResponse.redirect(url);
}
