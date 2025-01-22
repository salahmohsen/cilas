import { google, lucia } from "@/lib/apis/auth.api";
import { userTable } from "@/lib/db/db.schema";
import db from "@/lib/db/drizzle";
import { GoogleUser } from "@/lib/types/auth.types";
import { GoogleTokens, OAuth2RequestError } from "arctic";
import { eq } from "drizzle-orm";
import { generateIdFromEntropySize } from "lucia";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookies().get("google_oauth_state")?.value ?? null;
  const storedCodeVerifier = cookies().get("google_code_verifier")?.value ?? null;

  if (!code || !state || !storedState || !storedCodeVerifier || state !== storedState) {
    return new NextResponse(null, {
      status: 400,
    });
  }

  try {
    const tokens: GoogleTokens = await google.validateAuthorizationCode(
      code,
      storedCodeVerifier,
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
      cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
      // This will redirect the user to the dashboard based on their role
      return NextResponse.redirect(
        new URL(`/${existingUser[0].role}`, process.env.NEXT_PUBLIC_BASE_URL),
        {
          status: 302,
        },
      );
    } else {
      const userId = generateIdFromEntropySize(10); // 16 characters long
      try {
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

      const session = await lucia.createSession(userId, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

      return new NextResponse(null, {
        status: 302,
        headers: {
          Location: "/admin",
        },
      });
    }
  } catch (e) {
    if (e instanceof OAuth2RequestError) {
      const { request, message, description } = e;
      console.log(message);

      return new NextResponse(null, {
        status: 400,
      });
    }
    return new NextResponse(null, {
      status: 500,
    });
  }
}
