// Note: @clerk/nextjs v7 removed SignedIn/SignedOut — use <Show when="signed-in"|"signed-out">
// or prefer server-side auth() from '@clerk/nextjs/server' for page-level checks.
'use client';
import { Show, SignInButton, UserButton } from '@clerk/nextjs';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Show when="signed-out">
        <SignInButton mode="modal" />
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </main>
  );
}