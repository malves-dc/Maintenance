import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// Time-based one-time passwords (RFC 6238: HMAC-SHA1, 30-second steps, 6 digits), as made by any authenticator app,
// plus one-time recovery codes. Pure (no database) so the maths can be unit-tested; lib/two-factor.ts stores them.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;
/** Codes from one step either side are accepted, for phone clocks that are a little off. */
const WINDOW = 1;

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("Invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret, base32 (what the authenticator app stores). */
export const newTotpSecret = () => base32Encode(randomBytes(20));

export const stepAt = (ms: number) => Math.floor(ms / 1000 / STEP_SECONDS);

/** The 6-digit code for one time step. */
export function totpCode(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  const n = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(n).padStart(6, "0");
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * The time step `code` belongs to, or null when it's wrong, expired, or not newer than `lastStep` (each code works
 * once, so a code seen over someone's shoulder can't be replayed).
 */
export function verifyTotp(secret: string, code: string, now = Date.now(), lastStep: number | null = null) {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const current = stepAt(now);
  for (let s = current - WINDOW; s <= current + WINDOW; s++) {
    if (lastStep !== null && s <= lastStep) continue;
    if (same(totpCode(secret, s), digits)) return s;
  }
  return null;
}

/** The link the QR code carries: otpauth://totp/Issuer:account?secret=…&issuer=… */
export function otpauthUrl(issuer: string, account: string, secret: string) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const q = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${q}`;
}

// ── Recovery codes: 10 characters from an alphabet without look-alikes, shown as xxxxx-xxxxx.

const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const RECOVERY_COUNT = 8;

export function newRecoveryCodes(count = RECOVERY_COUNT) {
  return Array.from({ length: count }, () => {
    const s = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join("");
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

/** Recovery codes are stored hashed; typing is forgiving about case, spaces and the dash. */
export const normalizeRecovery = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, "");
export const hashRecovery = (code: string) => createHash("sha256").update(normalizeRecovery(code)).digest("hex");

/** Whether what was typed looks like a recovery code rather than an app code. */
export const isRecoveryCode = (code: string) => normalizeRecovery(code).length === 10;
