import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { getUserByEmail } from "@/lib/user";

export async function Nav() {
  const session = await auth();
  const user = session?.user?.email ? await getUserByEmail(session.user.email) : null;

  const initials = (user?.name ?? "?").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="rec-dot" aria-hidden="true" />VC
          <span className={`font-display text-lg tracking-tight text-foreground`}>
            Movie<span className="text-accent">Night</span>
          </span>
        </Link>

        {user && (
          <nav className="flex items-center gap-6 text-[11px] uppercase tracking-[0.24em]">
            <Link href="/wheel" className="text-muted transition-colors hover:text-accent">
              Spin
            </Link>
            <Link href="/pool" className="text-muted transition-colors hover:text-accent">
              Pool
            </Link>
            <Link href="/archive" className="text-muted transition-colors hover:text-accent">
              Archive
            </Link>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
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
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-xs text-muted uppercase tracking-[0.18em]">{user.name}</p>
              </div>
              <SignOutButton />
            </>
          ) : (
            <SignInButton />
          )}
        </div>
      </div>
    </header>
  );
}