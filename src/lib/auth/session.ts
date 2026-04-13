import { redirect } from "next/navigation";

import { auth } from "@/auth";

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

  return session;
}
