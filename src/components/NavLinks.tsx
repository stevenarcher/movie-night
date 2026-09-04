"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";

type UserProps = {
  name: string | null;
  image: string | null;
} | null;

export function NavLinks({ user }: { user: UserProps }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const initials = (user?.name ?? "?").slice(0, 2).toUpperCase();

  return (
    <>
      {/* desktop */}
      <nav className="hidden sm:flex items-center gap-6 text-[11px] uppercase tracking-[0.24em]">
        <Link href="/choose" className="text-muted transition-colors hover:text-accent">
          Choose
        </Link>
        <Link href="/pool" className="text-muted transition-colors hover:text-accent">
          Pool
        </Link>
        <Link href="/archive" className="text-muted transition-colors hover:text-accent">
          Archive
        </Link>
      </nav>

      <div className="hidden sm:flex ml-auto items-center gap-3">
        {user ? (
          <>
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name ?? "User"} width={30} height={30} className="rounded-full border border-edge" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full border border-accent/50 text-[11px] font-medium text-accent">
                {initials}
              </span>
            )}
            <div className="text-right leading-tight">
              <p className="text-xs text-muted uppercase tracking-[0.18em]">{user.name}</p>
            </div>
            <SignOutButton />
          </>
        ) : (
          <SignInButton />
        )}
      </div>

      {/* mobile */}
      <div className="sm:hidden ml-auto" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex flex-col justify-center items-center w-10 h-10 gap-[5px]"
        >
          <span
            className={`block w-5 h-px bg-muted transition-all duration-200 origin-center ${
              open ? "translate-y-[6px] rotate-45" : ""
            }`}
          />
          <span
            className={`block w-5 h-px bg-muted transition-all duration-200 ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block w-5 h-px bg-muted transition-all duration-200 origin-center ${
              open ? "-translate-y-[6px] -rotate-45" : ""
            }`}
          />
        </button>

        <div
          className={`absolute left-0 right-0 top-full bg-panel border-b border-edge transition-all duration-200 ${
            open
              ? "max-h-80 opacity-100"
              : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          <nav aria-label="Mobile navigation" className="flex flex-col px-4 pt-3 pb-2 text-[11px] uppercase tracking-[0.24em]">
            <Link href="/choose" onClick={() => setOpen(false)} className="py-2.5 text-muted transition-colors hover:text-accent">
              Choose
            </Link>
            <Link href="/pool" onClick={() => setOpen(false)} className="py-2.5 text-muted transition-colors hover:text-accent">
              Pool
            </Link>
            <Link href="/archive" onClick={() => setOpen(false)} className="py-2.5 text-muted transition-colors hover:text-accent">
              Archive
            </Link>
          </nav>

          <div className="border-t border-edge px-4 py-4">
            {user ? (
              <div className="flex items-center gap-3">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt={user.name ?? "User"} width={30} height={30} className="rounded-full border border-edge" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-accent/50 text-[11px] font-medium text-accent">
                    {initials}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted uppercase tracking-[0.18em] truncate">{user.name}</p>
                </div>
                <SignOutButton />
              </div>
            ) : (
              <SignInButton />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
