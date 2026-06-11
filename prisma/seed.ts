import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const PERMISSIONS = [
  { key: "users.list", resource: "users", action: "list", description: "List and search all users" },
  { key: "users.read", resource: "users", action: "read", description: "View any user profile" },
  { key: "users.update_role", resource: "users", action: "update_role", description: "Promote or demote a user" },
  { key: "users.ban", resource: "users", action: "ban", description: "Ban or unban a user" },
  { key: "users.delete", resource: "users", action: "delete", description: "Delete any user" },
  { key: "boards.list_all", resource: "boards", action: "list_all", description: "List all boards on the platform" },
  { key: "boards.delete_any", resource: "boards", action: "delete_any", description: "Delete any board (moderation)" },
  { key: "system.view_stats", resource: "system", action: "view_stats", description: "View platform stats" },
  { key: "system.view_activity", resource: "system", action: "view_activity", description: "View audit and activity logs" },
];

async function main() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: p.key }, update: p, create: p });
  }

  const adminRole = await prisma.role.upsert({
    where: { key: "admin" },
    update: {},
    create: { key: "admin", name: "Admin", description: "Platform administrator", isSystem: true },
  });
  const userRole = await prisma.role.upsert({
    where: { key: "user" },
    update: {},
    create: { key: "user", name: "User", description: "Default role", isSystem: true },
  });

  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@trello.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@123456";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: "Admin", email: adminEmail, passwordHash },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: userRole.id } },
    update: {},
    create: { userId: admin.id, roleId: userRole.id },
  });

  console.log(`Seeded ${PERMISSIONS.length} permissions, roles admin/user, admin account ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
