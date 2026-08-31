import { PrismaClient, UserRole } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/features/auth/schemas";

const prisma = new PrismaClient();

const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const adminFullName = process.env.ADMIN_BOOTSTRAP_FULL_NAME?.trim() || "Facility Administrator";
const adminPhone = process.env.ADMIN_BOOTSTRAP_PHONE?.trim();

function getBootstrapInput() {
  if (!adminEmail) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL is required.");
  }

  if (!adminPassword) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD is required.");
  }

  const validation = registerSchema.safeParse({
    fullName: adminFullName,
    email: adminEmail,
    phone: adminPhone ?? "+639000000000",
    password: adminPassword,
    confirmPassword: adminPassword,
    companyWebsite: ""
  });

  if (!validation.success) {
    const message = validation.error.issues.map((issue) => issue.message).join(" ");
    throw new Error(`Invalid admin bootstrap input. ${message}`);
  }

  return {
    email: adminEmail,
    password: adminPassword,
    fullName: adminFullName,
    phone: adminPhone
  };
}

async function main() {
  const input = getBootstrapInput();

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, role: true }
  });

  if (existing && existing.role !== UserRole.ADMIN) {
    throw new Error("A non-admin user already exists with ADMIN_BOOTSTRAP_EMAIL.");
  }

  const admin = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      fullName: input.fullName,
      passwordHash: await hashPassword(input.password),
      phone: input.phone,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: input.phone ? new Date() : null,
      role: UserRole.ADMIN,
      adminAccessActive: true
    },
    create: {
      email: input.email,
      fullName: input.fullName,
      passwordHash: await hashPassword(input.password),
      phone: input.phone,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: input.phone ? new Date() : null,
      role: UserRole.ADMIN,
      adminAccessActive: true
    }
  });

  const superAdminRole = await prisma.role.findUnique({ where: { systemKey: "SUPER_ADMIN" }, select: { id: true } });
  if (!superAdminRole) throw new Error("RBAC migration is not deployed: Super Admin role is missing.");
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id, assignedByUserId: admin.id }
  });

  console.log(`Admin bootstrap complete for ${input.email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
