import Link from "next/link";
import { auth } from "@/lib/auth";
import { getUserByEmail } from "@/lib/user";
import { NavLinks } from "@/components/NavLinks";

export async function Nav() {
  const session = await auth();
  const user = session?.user?.email ? await getUserByEmail(session.user.email) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="rec-dot" aria-hidden="true" />VC
          <span className={`font-display text-lg tracking-tight text-foreground`}>
            Movie<span className="text-accent">Night</span>
          </span>
        </Link>

        <NavLinks
          user={
            user
              ? { name: user.name, email: user.email, image: user.image }
              : null
          }
        />
      </div>
    </header>
  );
}