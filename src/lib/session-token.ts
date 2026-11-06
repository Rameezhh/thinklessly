import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "thinklessly_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  teamId: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters. Check your .env file.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ teamId: payload.teamId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const secret = getSecret();

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.teamId !== "string") {
      return null;
    }
    return { userId: payload.sub, teamId: payload.teamId };
  } catch {
    return null;
  }
}
