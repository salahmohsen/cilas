'use client';

import { authClient } from '@/lib/auth';

export default function Home() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-10">
      <button
        onClick={() =>
          authClient.signUp.email({
            email: 'contact@salahmohsen.com',
            password: 'HelloWorld!',
            name: 'salah mohsen'
          })
        }
      >
        Sign Up
      </button>
      <button onClick={() => authClient.signIn}>Sign In</button>
      <button onClick={() => authClient.signOut()}>Sign Out</button>
    </div>
  );
}
