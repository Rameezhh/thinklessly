import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@shared/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  teamId: string;
  teamName: string;
  role: string;
};

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await signSessionToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, teamId: session.teamId },
    include: { user: true, team: true },
  });

  if (!membership) {
    redirect("/login");
  }

  return {
    id: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    teamId: membership.team.id,
    teamName: membership.team.name,
    role: membership.role,
  };
}
