import { AccountInbox } from "@/components/account/account-inbox";
import { AccountInboxReadMarker } from "@/components/account/account-inbox-read-marker";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { SectionHeading } from "@/components/shared/section-heading";
import { requireUserSession } from "@/lib/auth/session";
import { getAccountProfile, getCustomerAccountData } from "@/server/account/queries";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type AccountPageProps = { searchParams: Promise<{ inboxPage?: string; inboxPageSize?: string; inboxSearch?: string }> };

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const session = await requireUserSession();
  const isCustomer = session.user.role === "CUSTOMER";
  const isAdmin = session.user.role === "ADMIN";
  if (!isCustomer && !isAdmin) redirect("/forbidden");

  const profile = await getAccountProfile(session.user.id);
  if (!profile) return null;

  if (!isCustomer) {
    return (
      <main className="space-y-8 pb-16">
        <SectionHeading eyebrow="My account" title="Your account" description="Review your profile and update your password." />
        <div className="max-w-xl space-y-6">
          <ProfileCard profile={profile} />
          <SecurityCard />
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const pageSize = [10, 25, 50].includes(Number(params.inboxPageSize)) ? Number(params.inboxPageSize) : 10;
  const page = Math.max(1, Number(params.inboxPage) || 1);
  const account = await getCustomerAccountData(session.user.id, { page, pageSize, search: params.inboxSearch });
  if (!account) return null;
  const totalPages = Math.max(1, Math.ceil(account.totalInboxCount / pageSize));
  if (page > totalPages) redirect(`/account?inboxPage=${totalPages}&inboxPageSize=${pageSize}${params.inboxSearch ? `&inboxSearch=${encodeURIComponent(params.inboxSearch)}` : ""}`);

  return (
    <main className="space-y-8 pb-16">
      <AccountInboxReadMarker />
      <SectionHeading eyebrow="My account" title="Your account and updates" description="Review booking actions and payment updates in one place." />
      <div className="grid items-start gap-6 lg:grid-cols-[0.3fr_0.7fr]">
        <div className="space-y-6"><ProfileCard profile={profile} /><SecurityCard /></div>
        <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6"><div className="mb-5"><p className="text-sm uppercase tracking-[0.18em] text-amber-300">Inbox</p><h2 className="mt-2 text-2xl font-semibold text-white">Booking and payment updates</h2><p className="mt-2 text-sm text-stone-400">Actionable updates link directly to the relevant payment or booking screen.</p></div><AccountInbox items={account.inbox} page={page} pageSize={pageSize} totalCount={account.totalInboxCount} search={params.inboxSearch ?? ""} /></section>
      </div>
    </main>
  );
}

function ProfileCard({ profile }: { profile: { fullName: string; email: string; phone: string | null; emailVerifiedAt: Date | null } }) {
  return <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6"><p className="text-sm uppercase tracking-[0.18em] text-amber-300">Profile</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-stone-500">Full name</dt><dd className="mt-1 text-white">{profile.fullName}</dd></div><div><dt className="text-stone-500">Email</dt><dd className="mt-1 break-all text-white">{profile.email}</dd></div><div><dt className="text-stone-500">Mobile number</dt><dd className="mt-1 text-white">{profile.phone ?? "Not provided"}</dd></div><div><dt className="text-stone-500">Email status</dt><dd className="mt-1 text-emerald-200">{profile.emailVerifiedAt ? "Verified" : "Needs verification"}</dd></div></dl></section>;
}

function SecurityCard() {
  return <details className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6"><summary className="cursor-pointer list-none"><p className="text-sm uppercase tracking-[0.18em] text-amber-300">Security</p><h2 className="mt-2 text-xl font-semibold text-white">Change password</h2><p className="mt-2 text-sm text-stone-400">Open this section only when you need to update your password.</p></summary><div className="mt-5"><ChangePasswordForm /></div></details>;
}

