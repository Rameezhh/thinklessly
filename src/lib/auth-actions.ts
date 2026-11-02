"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@shared/db";
import { loginSchema, registerSchema, type AuthFormState } from "@shared/auth";
import { clearSessionCookie, setSessionCookie } from "./session";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function registerAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email").trim().toLowerCase(),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid registration details." };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let session: { userId: string; teamId: string };
  try {
    session = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, name },
      });
      const team = await tx.team.create({
        data: { name: `${name}'s team` },
      });
      await tx.membership.create({
        data: { userId: user.id, teamId: team.id, role: "OWNER" },
      });
      return { userId: user.id, teamId: team.id };
    });
  } catch {
    return { error: "Could not create the account. Please try again." };
  }

  await setSessionCookie(session);
  redirect("/dashboard");
}

export async function loginAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email").trim().toLowerCase(),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid login details." };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const passwordMatches = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;

  if (!user || !passwordMatches) {
    return { error: "Invalid email or password." };
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { teamId: "asc" },
  });

  if (!membership) {
    return { error: "This account is not a member of a team." };
  }

  await setSessionCookie({ userId: user.id, teamId: membership.teamId });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
