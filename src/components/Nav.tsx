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
    <header className="sticky top-0 z-40 border-b border-edge/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="text-accent">🎬</span> Movie Night
        </Link>

        {user && (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/wheel" className="text-muted hover:text-foreground transition-colors">
              Spin
            </Link>
            <Link href="/pool" className="text-muted hover:text-foreground transition-colors">
              Pool
            </Link>
            <Link href="/archive" className="text-muted hover:text-foreground transition-colors">
              Archive
            </Link>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt={user.name ?? "User"} width={30} height={30} className="rounded-full" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                  {initials}
                </span>
              )}
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-sm font-medium">{user.name}</p>
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