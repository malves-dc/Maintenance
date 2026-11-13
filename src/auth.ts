import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { addressFrom, loginBlocked, recordLoginFailure, recordLoginSuccess } from "@/lib/login-limit";
import { auditUser } from "@/lib/audit";
import { recordSignIn } from "@/lib/online-users";
import { checkSecondFactor } from "@/lib/two-factor";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1),
  code: z.string().max(40).optional(),
});

/** Too many failed attempts for this account or address; surfaced as `auth.tooManyAttempts`. */
class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}
/** Right password, account with two-factor on, no code yet: the form asks for it. */
class TwoFactorRequired extends CredentialsSignin {
  code = "two_factor_required";
}
class TwoFactorInvalid extends CredentialsSignin {
  code = "two_factor_invalid";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, code: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password, code } = parsed.data;
        const address = addressFrom(request.headers);
        // Attempts on existing accounts go to the audit log of each of the account's companies.
        const ip = address === "unknown" ? null : address;
        if (loginBlocked(email, address)) {
          const blocked = await prisma.user.findUnique({ where: { email }, select: { id: true } });
          if (blocked) await auditUser(blocked.id, "auth.signInBlocked", undefined, ip);
          throw new TooManyAttempts();
        }
        const user = await prisma.user.findUnique({ where: { email } });
        const ok = !!user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
        if (!ok || !user) {
          recordLoginFailure(email, address);
          if (user) await auditUser(user.id, "auth.signInFailed", undefined, ip);
          return null;
        }
        if (user.totpEnabledAt) {
          if (!code?.trim()) throw new TwoFactorRequired();
          const passed = await checkSecondFactor(user, code);
          if (!passed) {
            // Counts towards the same lockout as a wrong password, so codes can't be guessed.
            recordLoginFailure(email, address);
            await auditUser(user.id, "auth.twoFactorFailed", undefined, ip);
            throw new TwoFactorInvalid();
          }
          if (passed === "recovery") await auditUser(user.id, "auth.twoFactorRecoveryUsed", undefined, ip);
        }
        recordLoginSuccess(email);
        await auditUser(user.id, "auth.signIn", undefined, ip);
        await recordSignIn(user.id);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
