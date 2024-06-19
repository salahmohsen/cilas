import db from "@/db/drizzle";
import { sessionTable, userTable } from "@/db/schema";
import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";

import { Lucia } from "lucia";
import { cookies } from "next/headers";

const adapter = new DrizzlePostgreSQLAdapter(db, sessionTable, userTable);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    // this sets cookies with super long expiration
    // since Next.js doesn't allow Lucia to extend cookie expiration when rendering pages
    expires: false,
    attributes: {
      // set to `true` when using HTTPS
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      googleId: attributes.google_id,
      username: attributes.username,
    };
  },
});

// IMPORTANT!
declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string;
      google_id: string;
      username: string;
    };
  }
}

export async function createAuthSession(user_id) {
  const session = await lucia.createSession(user_id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );
  cookies().set("user_id", user_id);
}

export async function verifyAuth() {
  const sessionCookie = cookies().get(lucia.sessionCookieName);
  if (!sessionCookie) return { user: null, session: null };
  const sessionId = sessionCookie.value;
  if (!sessionId) return { user: null, session: null };
  const result = await lucia.validateSession(sessionId);
  try {
    if (result.session && result.session.fresh) {
      const sessionCookie = lucia.createSessionCookie(result.session.id);
      cookies().set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );
      cookies().set("user_id", user_id);
    }
    if (!result.session) {
      const sessionCoockie = lucia.createBlankSessionCookie();
      cookies().set(
        sessionCoockie.name,
        sessionCoockie.value,
        sessionCoockie.attributes,
      );
    }
  } catch {}
  return result;
}

export async function destroySession() {
  const { session } = await verifyAuth();
  if (!session) return { error: "Unauthorized" };
  await lucia.invalidateSession(session.id);
  const sessionCoockie = lucia.createBlankSessionCookie();
  cookies().set(
    sessionCoockie.name,
    sessionCoockie.value,
    sessionCoockie.attributes,
  );
  cookies().delete("user_id");
}
