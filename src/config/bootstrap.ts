import bcrypt from "bcrypt";
import { prisma } from "./prisma.js";

const PERMISSIONS = [
  { key: "users.list", resource: "users", action: "list" },
  { key: "users.read", resource: "users", action: "read" },
  { key: "users.update_role", resource: "users", action: "update_role" },
  { key: "users.ban", resource: "users", action: "ban" },
  { key: "users.delete", resource: "users", action: "delete" },
  { key: "boards.list_all", resource: "boards", action: "list_all" },
  { key: "boards.delete_any", resource: "boards", action: "delete_any" },
  { key: "system.view_stats", resource: "system", action: "view_stats" },
  { key: "system.view_activity", resource: "system", action: "view_activity" },
];

/** Idempotent: ensures roles, permissions and the admin account exist. */
export const ensureSeedData = async () => {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: p.key }, update: {}, create: p });
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

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    const admin =
      existing ??
      (await prisma.user.create({
        data: {
          name: "Admin",
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPassword, 10),
        },
      }));
    for (const roleId of [adminRole.id, userRole.id]) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: admin.id, roleId } },
        update: {},
        create: { userId: admin.id, roleId },
      });
    }
  }
  console.log("Seed data ensured (roles, permissions, admin)");
};
