"use client";

import { SignInButton } from "@/components/SignInButton";

export function SignInPrompt({
  message,
  label = "Sign in to continue",
  callbackUrl = "/choose",
}: {
  message: string;
  label?: string;
  callbackUrl?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-edge bg-panel-2 px-6 py-6 text-center">
      <p className="max-w-sm text-sm text-muted">{message}</p>
      <SignInButton label={label} callbackUrl={callbackUrl} />
    </div>
  );
}