import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export async function getSession() {
  return auth();
}

export async function requireUserSession() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session;
}

export async function requireAdminSession() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  // JWT sessions can outlive a local database reset or a user deletion. Verify
  // the actor before using the session ID in audit foreign keys.
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true }
  });

  if (!admin || admin.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin&reason=session-expired");
  }

  return session;
}
