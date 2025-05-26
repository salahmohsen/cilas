'use server';

import { auth } from '@/lib/auth/auth-server';
import { APIError } from 'better-auth/api';
import { headers } from 'next/headers';

export const protectedAction = async () => {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  console.log(session?.user);
};

export const signUp = async () => {
  try {
    await auth.api.signUpEmail({
      body: {
        email: 'contact@salahmohsen.com',
        password: 'HelloWorld!',
        name: 'salah mohsen'
      }
    });
  } catch (error) {
    if (error instanceof APIError) {
      console.error(error.message);
    }
  }
};

export const signIn = async () => {
  try {
    await auth.api.signInEmail({
      body: {
        email: 'contact@salahmohsen.com',
        password: 'HelloWorld!'
      }
    });
  } catch (error) {
    if (error instanceof APIError) {
      console.error(error.message);
    }
  }
};

export const signOut = async () => {
  try {
    await auth.api.signOut({
      headers: await headers()
    });
  } catch (error) {
    if (error instanceof APIError) {
      console.error(error.message);
    }
  }
};
