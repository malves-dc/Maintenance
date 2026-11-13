import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  hashRecovery,
  isRecoveryCode,
  newRecoveryCodes,
  newTotpSecret,
  otpauthUrl,
  stepAt,
  totpCode,
  verifyTotp,
} from "@/lib/totp";
import { needsTwoFactor } from "@/lib/two-factor-rules";
import { effectivePermissions } from "@/lib/rbac";

// RFC 6238 appendix B (SHA-1): the shared secret "12345678901234567890", codes cut to 6 digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("round-trips base32", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode("gezd gnbv-gy3tqojq gezdgnbvgy3tqojq").toString()).toBe("12345678901234567890");
    expect(newTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("matches the RFC 6238 test vectors", () => {
    expect(totpCode(RFC_SECRET, stepAt(59_000))).toBe("287082");
    expect(totpCode(RFC_SECRET, stepAt(1_111_111_109_000))).toBe("081804");
    expect(totpCode(RFC_SECRET, stepAt(1_234_567_890_000))).toBe("005924");
    expect(totpCode(RFC_SECRET, stepAt(2_000_000_000_000))).toBe("279037");
  });

  it("accepts a code from one step either side, once", () => {
    const now = 1_234_567_890_000;
    const step = stepAt(now);
    expect(verifyTotp(RFC_SECRET, "005924", now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, "005 924", now)).toBe(step); // spaces are fine
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), now)).toBeNull(); // too old
    expect(verifyTotp(RFC_SECRET, "005924", now, step)).toBeNull(); // already used
    expect(verifyTotp(RFC_SECRET, "12345", now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", now)).toBeNull();
  });

  it("builds the link authenticator apps read from the QR code", () => {
    const u = new URL(otpauthUrl("VillaOps", "ana@example.pt", RFC_SECRET));
    expect(u.protocol).toBe("otpauth:");
    expect(u.host).toBe("totp");
    expect(decodeURIComponent(u.pathname)).toBe("/VillaOps:ana@example.pt");
    expect(u.searchParams.get("secret")).toBe(RFC_SECRET);
    expect(u.searchParams.get("issuer")).toBe("VillaOps");
  });
});

describe("recovery codes", () => {
  it("are distinct, readable, and hashed regardless of case, spaces and dash", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
    expect(hashRecovery(codes[0])).toBe(hashRecovery(` ${codes[0].toUpperCase().replace("-", " ")} `));
    expect(isRecoveryCode(codes[0])).toBe(true);
    expect(isRecoveryCode("123456")).toBe(false);
  });
});

describe("who must use two-factor sign-in", () => {
  const perms = (role: Parameters<typeof effectivePermissions>[0], overrides?: unknown) => effectivePermissions(role, overrides);

  it("admins and anyone who can see access codes, when the company requires it", () => {
    expect(needsTwoFactor(true, "OWNER", perms("OWNER"))).toBe(true);
    expect(needsTwoFactor(true, "ADMIN", perms("ADMIN"))).toBe(true);
    expect(needsTwoFactor(true, "TECHNICIAN", perms("TECHNICIAN"))).toBe(true); // secrets.view by default
    expect(needsTwoFactor(true, "ACCOUNTANT", perms("ACCOUNTANT"))).toBe(false);
    expect(needsTwoFactor(true, "REQUESTER", perms("REQUESTER"))).toBe(false);
    expect(needsTwoFactor(false, "OWNER", perms("OWNER"))).toBe(false);
  });

  it("follows the company's permission settings", () => {
    expect(needsTwoFactor(true, "TECHNICIAN", perms("TECHNICIAN", { TECHNICIAN: ["workOrders.execute"] }))).toBe(false);
    expect(needsTwoFactor(true, "VIEWER", perms("VIEWER", { VIEWER: ["secrets.view"] }))).toBe(true);
  });
});
