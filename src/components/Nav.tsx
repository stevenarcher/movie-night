import Link from "next/link";
import { auth } from "@/lib/auth";
import { getUserNav } from "@/lib/user";
import { NavLinks } from "@/components/NavLinks";

export async function Nav() {
  const session = await auth();
  const nav = session?.user?.id ? await getUserNav(session.user.id) : null;

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
            nav
              ? { name: nav.name, image: nav.image }
              : null
          }
          isAdmin={nav?.isAdmin ?? false}
        />
      </div>
    </header>
  );
}