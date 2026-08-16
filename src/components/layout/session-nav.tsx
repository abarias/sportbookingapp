import Link from "next/link";

import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import type { Session } from "next-auth";

type SessionNavProps = {
  session: Session | null;
};

export function SessionNav({ session }: SessionNavProps) {
  if (!session?.user) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/login" className="hover:text-white">
          Sign In
        </Link>
        <Button asChild variant="secondary">
          <Link href="/register">Register</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-stone-400 md:inline">{session.user.name}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <Button type="submit" variant="secondary">
          Sign Out
        </Button>
      </form>
    </div>
  );
}
