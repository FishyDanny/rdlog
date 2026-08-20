export interface SignedPayload {
  expiresAt: number;
  kind: "workspace" | "task";
  proofId?: string;
  subject: string;
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBytes(value: string): Uint8Array {
  const normalised = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function isSignedPayload(value: unknown): value is SignedPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.expiresAt === "number" &&
    (candidate.kind === "workspace" || candidate.kind === "task") &&
    typeof candidate.subject === "string" &&
    (candidate.proofId === undefined || typeof candidate.proofId === "string")
  );
}

function signaturesMatch(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export async function signToken(payload: SignedPayload, secret: string): Promise<string> {
  const encodedPayload = encodeBytes(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = encodeBytes(await hmac(encodedPayload, secret));
  return `${encodedPayload}.${signature}`;
}

export async function verifyToken(token: string, secret: string, now: Date): Promise<SignedPayload | null> {
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra !== undefined) {
    return null;
  }
  try {
    const actualSignature = decodeBytes(encodedSignature);
    const expectedSignature = await hmac(encodedPayload, secret);
    if (!signaturesMatch(actualSignature, expectedSignature)) {
      return null;
    }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(decodeBytes(encodedPayload)));
    if (!isSignedPayload(parsed) || parsed.expiresAt <= now.getTime()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
