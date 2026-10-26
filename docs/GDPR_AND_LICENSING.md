# GDPR review and licensing options

Review of the source as of v0.3.0 (2026-09-29). This is a technical review, not legal advice: have a
lawyer or DPO confirm the conclusions before relying on them, especially before selling the software.

---

## Part 1 — GDPR

### 1.1 Roles

- **Your company, using the app for its own clients:** your company is the **controller** for everything
  in it (staff, clients, villa contacts, requesters). The app is a tool you run; no one else processes the
  data unless you add providers (e-mail, hosting).
- **If you later sell it as a hosted service (phase 10):** your company becomes a **processor** for each
  customer company. You would then need a Data Processing Agreement (Art. 28), a sub-processor list and
  per-tenant export/erasure. The tenant isolation already in place is the right foundation for that.
- **Self-hosted copies run by others** (e.g. under a licence, see Part 2): they are the controller; you are
  neither controller nor processor, as long as you don't host or access their data.

### 1.2 Personal data the app stores

| Data | Where | Notes |
|---|---|---|
| Staff and portal users: name, e-mail, phone, password hash, language, theme | `User` | bcrypt hashes; sessions are signed JWT cookies (30 days, Auth.js default) |
| Staff cost per hour, time logged | `JobRole`, `Organization.roleRates`, `TimeEntry` | employee data; visible to owners/admins/managers |
| Client companies/owners and contacts: names, e-mails, phones, addresses, tax ids | `Client`, `ClientContact` | |
| Villas: addresses, access notes | `Villa` | access notes are free text and may contain personal details |
| Villa codes and device credentials | `Villa.secretsEnc`, `Asset.credentialsEnc` | AES-256-GCM, every view audit-logged ✅ |
| Anonymous QR requesters: name, e-mail, phone | `Request` | collected from the **public** form |
| Client signatures (image + name) | `Attachment`, `WorkOrder.signedByName` | personal data, not "biometric" (not used to identify people) |
| Photos | `Attachment` / `UPLOAD_DIR` | may show people or homes |
| Chat, comments, @mentions, notifications | `Message`, `WorkOrderComment`, `Notification` | |
| IP address of sensitive actions | `AuditLog.ip` | |
| Push subscriptions + browser user agent | `PushSubscription` | |
| Backups: **all of the above plus the encryption keys** | `/backups/*.tar.gz` | files are `0600`; not encrypted |

### 1.3 What is already in good shape

- **Security (Art. 32):** passwords hashed (bcrypt); secrets encrypted (AES-GCM) with audited access;
  strict tenant isolation (`tenantDb` + `assertOwned`, tested); role-based permissions; server admin behind a
  second password with attempt limits; HTTPS via the proxy; backups owner-only on disk.
- **Data minimisation:** no tracking or analytics; no third-party scripts. Fonts are bundled at build time,
  so pages make **no requests to Google**. Map links only reach Google when someone clicks them.
- **Cookies:** only strictly necessary/functional ones (session, active company, language, theme,
  server-admin unlock). **No cookie banner is needed** under the ePrivacy rules.
- **Push notifications:** payloads are end-to-end encrypted (Web Push), so browser push services can't read them.
- **Short-lived tokens:** password reset tokens are hashed and expire after 1 hour.
- **Hosting:** self-hosted in the EU (ZimaOS). The dev database (Neon, London) holds demo data only;
  the UK has an EU adequacy decision.
- **Rectification (Art. 16):** users edit their profile; staff edit client data.

### 1.4 Gaps, by priority

**Progress (2026-10-14):** ✅ 1 privacy notice (`/privacy/<slug>`, custom text in Settings → Organization, linked from the QR form, sign-in, portal, profile and e-mails); ✅ 2 sign-in limit (10 failures per account / 30 per address in 15 min); ✅ 3 "Download my data" (JSON, profile page; staff export of a client is still open); ✅ 4 erasure (Settings → Users "Erase data" for deactivated members; "Erase personal data" on archived clients; work history kept under a placeholder name); ✅ 5 retention (per-company periods in Settings → Organization, applied daily; sync log 30 days, expired tokens/invitations fixed); ✅ 6 encrypted backups (`BACKUP_PASSWORD`); ✅ 7 security headers (`next.config.ts`); ✅ 8 demo banner (`DEMO_MODE=true`). Still open: the admin items 9–11, and erasing a person who belongs to several companies.

| # | Gap | GDPR article | Fix | Effort |
|---|---|---|---|---|
| 1 | **No privacy notice**, including on the **public QR request form** that collects name/e-mail/phone from anyone | 12–14 | Privacy page (company-editable text in Settings), linked from the QR form, sign-in, portal and e-mails; short notice under the form | S |
| 2 | **No login attempt limit**: passwords can be brute-forced | 32 | Reuse `AttemptLimiter` on sign-in (per e-mail + per IP) | S |
| 3 | **No right of access / portability**: a person can't get their data | 15, 20 | "Download my data" (JSON/ZIP) on the profile; staff export of a client/contact/requester's data | M |
| 4 | **No erasure**: users can't be deleted; clients and villas are only archived; QR requesters' contact details stay forever | 17 | Delete/anonymise user (keep work history as "Former user"); anonymise client/contact/requester; delete their photos and signatures | M |
| 5 | **No retention limits**: audit logs, notifications, sync log, chat, old requests and ex-staff data are kept forever | 5(1)(e) | Retention settings (e.g. notifications 90 days, sync log 30 days, audit log 2 years, requester contact data N years after the job closes) applied by the existing minute scheduler | M |
| 6 | **Backups are unencrypted** and contain every record plus the keys | 32 | Optional backup password (AES-256) and a note that downloaded copies need secure storage; backup retention follows the schedule already there | S–M |
| 7 | **No security headers** (CSP, HSTS, X-Frame-Options, Referrer-Policy) | 32 | Add in `next.config.ts` (HSTS can also be set in Nginx Proxy Manager) | S |
| 8 | **Public demo:** anyone can sign up and type real personal data; sign-up e-mails would go out if Resend is configured | 5, 32 | Demo banner ("don't enter real personal data; erased at every reset"), scheduled factory reset, keep e-mail off on the demo | S |
| 9 | **E-mail provider** (Resend, US) processes recipients' addresses and message content | 28, 44–46 | Sign Resend's DPA (it relies on the EU–US Data Privacy Framework/SCCs), or use an EU provider | admin |
| 10 | **Staff transparency:** time logs, costs and activity are employee data | 13, 88; Lei 58/2019 art. 28 | Tell staff what is recorded and why (internal notice); keep cost rates restricted to managers (already the case) | admin |
| 11 | **Records of processing / breach procedure** | 30, 33 | Paper work: record of processing activities, breach response steps (the audit log helps) | admin |

S = under a day, M = one to three days.

**If you sell it as a hosted service**, add: a DPA template, a sub-processor list, per-company export and
deletion (whole tenant), and data-residency notes (e.g. EU hosting).

### 1.5 Portugal

The supervisory authority is the **CNPD**; national rules are in **Lei n.º 58/2019**. Its art. 28 (processing
of employee data) is relevant to time tracking. Nothing in the app is covered by the special-category rules
(Art. 9).

---

## Part 2 — Licensing under the Business Source License (BSL 1.1)

### 2.1 Current state

- The repository is **public with no licence**, which legally means **"all rights reserved"**: people may view
  (and fork on GitHub, per GitHub's terms) but may not use, copy or run it.
- Dependencies and the Docker image were checked (production tree, 247 packages):
  - **Permissive** (MIT, ISC, Apache-2.0, BSD, 0BSD): ~230. ✅
  - **LGPL-3.0**: `sharp`'s libvips (image resizing, a separate native library). ✅ Compatible: it stays a
    separate, replaceable file; include its licence and notice.
  - **MPL-2.0**: `web-push`. ✅ Compatible: only changes to its own files would have to stay MPL.
  - **CC-BY-4.0**: `caniuse-lite` (browser data used at build time). ✅ Attribution only.
  - **png-js** (no licence field in its package): MIT upstream. ✅
  - Committed agent-skill docs (`prisma/skills`): MIT. ✅
  - Docker image: Alpine base (mixed, incl. GPL tools such as BusyBox, distributed as separate programs) and the PostgreSQL
    client (PostgreSQL licence). ✅ Standard practice; mention them in a third-party notice.
  - **Nothing prevents a BSL licence.**

### 2.2 What BSL 1.1 means

- It is **source-available, not open source**. Anyone may copy, modify and redistribute the code and use it
  **for non-production purposes** (testing, evaluation, development).
- **Production use needs a commercial licence from you**, except what you allow in the
  **Additional Use Grant**.
- Each version automatically becomes open source (the **Change License**) on its **Change Date**. That date
  can be at most **four years** after the version is first published. The Change License must be
  **GPL-2.0-or-later or compatible with it** (Apache-2.0 and MPL-2.0 qualify).
- You may not change the licence text itself, only its parameters. The licence must be shown on every copy.
  SPDX id: `BUSL-1.1`.

### 2.3 Suggested parameters

| Parameter | Suggestion |
|---|---|
| Licensor | Your company's legal name |
| Licensed Work | "Maintenance (VillaOps CMMS)", the version, and "© 2026 <company>" |
| Additional Use Grant | *"You may make production use of the Licensed Work to manage your own organisation's maintenance operations, provided you do not offer it to third parties as a hosted, managed or white-labelled service, or sell it."* |
| Change Date | Four years after each release (e.g. 2030-09-29 for 0.3.0), updated on every release |
| Change License | Apache License 2.0 (or GPL-2.0-or-later) |

With that grant, any company can run it for itself for free, but only you can sell or host it for others,
which matches the phase-10 SaaS plan.

### 2.4 Steps to adopt it

1. Add `LICENSE` with the BSL 1.1 text and the parameters above. Set `"license": "BUSL-1.1"` in
   `package.json`, add a README section, and add an `org.opencontainers.image.licenses` label to the image.
2. Add `THIRD_PARTY_NOTICES.md` (LGPL libvips, MPL web-push, CC-BY caniuse-lite, Alpine/PostgreSQL in the image).
3. Bump the Change Date in `LICENSE` at every release (add it to the release checklist in HANDOFF).
4. If others will contribute: require a **Contributor License Agreement**, so you can keep selling commercial
   licences and relicensing.
5. Releases published before the licence (0.1.0–0.3.0) are "all rights reserved" copies. Adding the licence
   now applies it to them going forward only if you say so in the README; simplest is to state that the BSL
   covers all published versions.

### 2.5 Two things to weigh

- **Authorship of AI-assisted code:** most of this code was written by an AI under your direction. In the EU,
  copyright needs human intellectual creation. Your design choices, requirements and review help, but
  protection of purely generated parts is uncertain. That affects **how enforceable any licence is**
  (BSL or other), not whether you may publish one. Worth a short conversation with a lawyer before you rely
  on licence fees.
- **Alternatives**, if BSL's four-year model doesn't fit:
  - **FSL-1.1** (Functional Source License, used by Sentry): the same idea with a simpler built-in rule
    ("no competing use") and conversion to Apache/MIT after **two** years.
  - **Elastic License 2.0**: permanent, forbids offering it as a managed service.
  - **PolyForm Noncommercial**: no commercial use at all without a licence.
  - **AGPL-3.0 plus a commercial licence (dual licensing)**: truly open source; anyone hosting it must
    publish their changes.

**Recommendation:** BSL 1.1 with the Additional Use Grant above works with every dependency. FSL-1.1 does
the same with less wording and a shorter delay, if you prefer that.
