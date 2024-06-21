import { google, lucia } from "@/lib/auth";
import { cookies } from "next/headers";
import { GoogleTokens, OAuth2RequestError } from "arctic";
import { generateIdFromEntropySize } from "lucia";
import db from "@/db/drizzle";
import { eq } from "drizzle-orm";
import { userTable } from "@/db/schema";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookies().get("google_oauth_state")?.value ?? null;
  const storedCodeVerifier =
    cookies().get("google_code_verifier")?.value ?? null;

  console.log(
    "code",
    code,
    "state",
    state,
    "storedState",
    storedState,
    "storedCodeVerifier",
    storedCodeVerifier,
  );

  if (
    !code ||
    !state ||
    !storedState ||
    !storedCodeVerifier ||
    state !== storedState
  ) {
    return new Response(null, {
      status: 400,
    });
  }

  let tokens;
  try {
    tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);
  } catch (e) {
    if (e instanceof OAuth2RequestError) {
      const { request, message, description } = e;
      console.log(message);
    }
  }

  try {
    const url: URL = await google.createAuthorizationURL(
      state,
      storedCodeVerifier,
      { scopes: ["profile", "email"] },
    );

    const googleUserResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      },
    );
    const googleUser: GoogleUser = await googleUserResponse.json();

    const existingUser = await db
      .select()
      .from(userTable)
      .where(eq(userTable.googleId, googleUser.sub));

    if (existingUser[0]) {
      const session = await lucia.createSession(existingUser[0].id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      cookies().set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/dashboard",
        },
      });
    }
    const userId = generateIdFromEntropySize(10); // 16 characters long
    try {
      console.log("inserting to database ran");
      await db.insert(userTable).values({
        id: userId,
        googleId: googleUser.sub,
        userName: googleUser.name.replace(/\s/g, ""),
        firstName: googleUser.given_name,
        lastName: googleUser.family_name,
        email: googleUser.email,
        avatar: googleUser.picture,
      });
    } catch (error) {
      if (error instanceof Error) console.log(error.message);
    }
    try {
      const session = await lucia.createSession(userId, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      cookies().set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );
    } catch (error) {
      if (error instanceof Error) console.log(error.message);
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/dashboard",
      },
    });
  } catch (e) {
    // the specific error message depends on the provider
    if (e instanceof OAuth2RequestError) {
      // invalid code
      console.log(e.message);
      return new Response(null, {
        status: 400,
      });
    }
    return new Response(null, {
      status: 500,
    });
  }
}

interface GoogleUser {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}
