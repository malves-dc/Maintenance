# Handoff — VillaOps CMMS

State as of **2026-09-29**, phase 9 of 10 done (see `git log` for the commit). Read this, then
`CLAUDE.md` (conventions) and `docs/ROADMAP.md` (phase list), before touching code. Phase 10 (billing/SaaS) is
**on hold**: the app runs for one company for now. Next candidate work: the Odoo integration in
`docs/ODOO_INTEGRATION.md` (waiting on the decisions in its §10).

**Repository:** `malves-dc/Maintenance` since 2026-10-14 (a fork of the original `Xeon3D/Maintenance`, which has the
v0.1.0–v0.3.0 releases, recreated here). Docker Hub image `malvesdc/maintenance` (up to v0.3.0 it was `xeon3d/maintenance`), published by `.github/workflows/release.yml`
on every `vX.Y.Z` tag (it was built by hand with Docker Desktop up to v0.3.0). Servers on v0.3.0 or older run
`xeon3d/maintenance` and check `Xeon3D/Maintenance`: change their compose `image:` to `malvesdc/maintenance:latest` once.
The user runs it on a ZimaOS server behind Nginx Proxy Manager as an **open public demo** (nothing
locked down, by choice) with a password-protected **factory reset**. 0.2.0 added **Settings → Server**
(software name, one-click updates, scheduled backups with restore); see "Docker & releases" and
"Server administration" in §3. "VillaOps" is now only the *default* software name (server setting).

---

## 1. What this is

A multi-tenant SaaS CMMS with **full MaintainX feature parity** for a company that maintains
high-end residential villas: electrical, automation (KNX etc.), network, security, CCTV, A/V
and lighting. The user chose, and does not want re-litigated:

- **Stack:** Next.js 16 + Postgres (Neon) + Prisma 7 + Auth.js v5. **Not** Supabase.
- **Languages:** English + **European** Portuguese (pt-PT wording: "palavra-passe", "equipa", "utilizador").
- **Scope:** everything, delivered in the 10 roadmap phases; each phase ends tested and committed.
- **"VillaOps" is only the default software name**; the owner sets the real one in Settings → Server.

### Working rhythm the user has accepted
1. Build a whole phase, including translations, tests and browser verification.
2. Run `typecheck`, `lint` and `test`, then verify in the preview browser (details in §6).
3. Commit at the end of the phase (the message style is in `git log`), ending with the
   `Co-Authored-By: Claude …` trailer. The repo-local git identity is `Marcos Alves <malves@diniscoelho.pt>`
   (since 2026-10-14; older commits are `xeon4`).
4. Send a short summary covering: what's new, what was tested, what was fixed along the way,
   and things to know. Then ask whether to continue with the next phase.

---

## 2. Status

| # | Phase | State |
|---|---|---|
| 1 | Foundation: auth, orgs, invitations, RBAC, i18n, shell, tenant guard | ✅ `dad89a9` |
| 2 | Clients, villas, areas, assets, secrets, QR labels, CSV import | ✅ `d237866` |
| 3 | Work orders: checklists, photos, time, costs, sign-off, PDF, board/calendar | ✅ `85b3383` |
| 4 | Preventive maintenance, procedures library, meters, scheduler | ✅ `944bb4c` |
| 5 | Requests (portal + anonymous QR) and client portal | ✅ `82554bc` |
| 6 | Inventory & purchasing: parts, stock locations, WO parts, vendors, POs | ✅ |
| 7 | Messaging & notifications: in-app, email, web push, chat, password reset | ✅ |
| 8 | Reporting & dashboards + service contracts (SLA) | ✅ |
| 9 | Offline field app (PWA), sync, camera, QR/barcode scanning | ✅ |
| 10 | **SaaS layer: Stripe billing, limits, super-admin** | ⏭ next |

The **full data
model for all 10 phases already exists** in `prisma/schema.prisma` (see §5), so later phases
are mostly UI and logic plus small additive migrations.

---

## 3. Environment (Windows 11)

**Docker-only machines (2026-10-14):** a PC without Node can develop entirely in containers: a compose stack
with `postgres:17-alpine` and `node:24-bookworm-slim` (repo bind-mounted at `/app`, named volumes for
`node_modules` and `.next`, `WATCHPACK_POLLING=true`, port 3000), `.env` pointing at `db:5432`, and every
`npm`/`npx` command run with `docker compose exec`. Turbopack misses **new** files over the Windows bind mount:
restart `next dev` after adding a file. `npx playwright install --with-deps chromium` works in that container.


- **Node 24** was installed after the Claude app started, so the app's inherited PATH lacks it.
  - PowerShell: prefix commands with
    `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User");`
  - Bash tool: `export PATH="/c/Program Files/nodejs:$PATH"`.
- **Dev server:** preview config `web` in `.claude/launch.json`, which runs
  `node.exe node_modules/next/dist/bin/next dev` on port 3000. The dev Prisma client is cached on `globalThis` keyed by the generated
  `PrismaClient` class, so `prisma generate` no longer needs a dev-server restart.
- **Database:** Neon Postgres (eu-west-2). The connection string lives **only** in the gitignored
  `.env`. Never print or commit it. The user was advised to rotate the password, because it was
  pasted in chat. If it changes, only `DATABASE_URL` in `.env` needs updating.
- **`.env` keys:**
  - `DATABASE_URL`: uses `sslmode=verify-full`.
  - `AUTH_SECRET`, `AUTH_TRUST_HOST`.
  - `FIELD_ENCRYPTION_KEY`: 32 bytes, base64. **Never rotate** without re-encrypting
    `Villa.secretsEnc` and `Asset.credentialsEnc`.
  - `UPLOAD_DIR` (`./uploads`).
  - `CRON_SECRET`.
  - `SCHEDULER_INTERVAL_MINUTES` (`15`).
  - Optional `APP_URL`, used for QR label links and email/push links (else the request host).
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: web push (generated 2026-09-28; rotating
    them invalidates every browser subscription). Without them push is simply off.
  - E-mail delivery is chosen in **Settings → Server → E-mail** (`lib/email-settings.ts`, stored in server-settings.json,
    secrets via `encryptField`): SMTP (nodemailer **8.x**: next-auth's peer range) or Resend; "env" falls back to:
  - `RESEND_API_KEY` + `EMAIL_FROM` (commented out): real email via Resend's HTTP API. Without them,
    dev writes each email to `.mail/*.html` (gitignored) and production logs a warning.
- **Prisma:** `prisma@latest` resolves to an 8.0 RC. **Keep `prisma` and `@prisma/client` pinned to 7.x.**
- `prisma init` added agent-skill folders (`.agents/`, `.claude/skills/prisma-*`, `.windsurf/`,
  `skills-lock.json`). These are harmless reference docs and are committed.
- `FACTORY_RESET_PASSWORD` is set in the local `.env` (value given by the user in chat). **It must never
  be committed or printed**: the repo is public. The ZimaOS server has its own copy in the compose env.

### Docker & releases
- `next.config.ts` has `output: "standalone"`. `Dockerfile` (node:24-trixie-slim, multi-stage; `apt-get upgrade` in the
  base stage, which the release workflow rebuilds without cache; npm/npx/corepack/yarn removed from the runtime image;
  `ffmpeg`/`ffprobe` built from the ffmpeg.org source in an `ffmpeg` stage with only libx264 + libdav1d, pinned by
  `FFMPEG_VERSION`/`FFMPEG_SHA256`, which Docker Scout does not track; the weekly `ffmpeg-check.yml` workflow fails
  (GitHub e-mails it) when ffmpeg.org has a newer release of the branch, with the new values in its summary):
  standalone server + a separate `/migrator` folder with the pinned Prisma CLI, `prisma/` and `prisma.config.ts`.
- `docker/entrypoint.sh`: generates missing `AUTH_SECRET`, `FIELD_ENCRYPTION_KEY`, `CRON_SECRET` and VAPID
  keys (plain node crypto: `web-push` is bundled, not in `node_modules`) into `/data/secrets.env`, runs
  `prisma migrate deploy`, then `node server.js`. Env vars win over the generated values.
- `src/instrumentation.ts`: `SEED_DEMO=true` seeds the demo org when there are no organizations.
  The seed lives in `src/lib/demo-seed.ts` (relative imports; shared by `prisma/seed.ts`).
- Factory reset (`src/lib/factory-reset.ts`, page `/factory-reset`, public in `proxy.ts`): TRUNCATEs every
  table except `_prisma_migrations`, empties `UPLOAD_DIR`, re-seeds, signs the caller out. Password compared
  with `timingSafeEqual` on SHA-256 digests; 5 failures per client IP / 30 overall per 15 min (in memory).
  **Never test it against the Neon dev DB**; test it in a throwaway compose stack (below).
- Docker CLI isn't on the Bash tool's PATH: `export PATH="$PATH:/c/Program Files/Docker/Docker/resources/bin"`,
  and `export MSYS_NO_PATHCONV=1` before `docker exec -w /app …` (Git Bash mangles absolute paths).
- Test a build: copy `docker-compose.yml` to the scratchpad, map port 3200, use named volumes, set
  `FACTORY_RESET_PASSWORD` via a `.env` next to it, `docker compose up -d`, then `down -v` afterwards.
- Release: bump `version` in `package.json` (+ lock file; it is the app's version and what the update check
  compares), merge, then push a `vX.Y.Z` tag. `release.yml` checks the tag matches, runs the checks, pushes
  `:<v>` and `:latest` (amd64 only: ZimaOS is x86-64) with the release notes as an index annotation, then creates
  the GitHub release. The `:<v>` tag on Docker Hub is what installed servers see as "update available" (the GitHub
  repository is private), and the updater pulls `:latest`. Secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`.

### Server administration (Settings → Server, v0.2.0)
- Gate: `src/lib/server-admin.ts`. Needs `org.manage` **and** the server password (`SERVER_ADMIN_PASSWORD`,
  else `FACTORY_RESET_PASSWORD`); unlock = HMAC-signed `server_admin` cookie (user id + expiry, 30 min).
  Company roles alone aren't enough: on the open demo anyone can create a company and be its owner.
- Server-wide settings (`src/lib/server-settings.ts`): JSON in `DATA_DIR/server-settings.json` (dev `./.data`),
  so they survive factory reset and restore. `getAppName()` replaces the old `common.appName` message.
- Backups (`src/lib/backups.ts`, rules in `backup-schedule.ts`): tar.gz of `manifest.json` + `database.dump`
  (pg_dump custom) + `secrets.env` + `uploads/`, files `0600` in `BACKUP_DIR` (`/backups`). Restore: extract,
  refuse if the backup has migrations this build doesn't know, take a `pre-restore` backup, `DROP SCHEMA public
  CASCADE` + `pg_restore` (rolls back to the safety copy on failure), replace uploads, merge keys into
  `DATA_DIR/secrets.env`, then `process.exit(0)` so Docker restarts it and the entrypoint re-runs migrations.
  Scheduler: `runServerJobs()` every minute from `src/instrumentation-node.ts`; period keys in `BACKUP_DIR/.state.json`.
- Updates (`src/lib/updates.ts`, since 0.4.13): the `X.Y.Z` tags of `APP_IMAGE` (default `malvesdc/maintenance`)
  from the Docker Hub API (6 h cache) vs `APP_VERSION`. Notes of up to 5 newer versions come from the image index
  annotation `io.villaops.release-notes` (base64 JSON array, written by `scripts/release-notes.mjs` in
  `release.yml`; anonymous registry token, one manifest GET per version, cached per process). Up to 0.4.12 the
  check read GitHub releases, which stopped working when the repository went private. "Update now" =
  `pre-update` backup + `POST $UPDATER_URL/v1/update?image=malvesdc/maintenance&async=true` with the token the
  entrypoint writes to `DATA_DIR/updater-token` (Watchtower reads it from its read-only mount). Watchtower
  fork `nickfedor/watchtower` (the original containrrr one is archived); HTTP API mode disables its polling.
- Tested 2026-09-29 in a local compose stack: scheduled + manual backups, download, upload (valid/invalid),
  restore (data + files back, restart, migrations), lock/unlock, and a real Watchtower recreate. To force
  "update available" in a test, set `APP_IMAGE` to an image whose newest version tag is higher.
- `/api/server/backups/upload` is excluded from the proxy matcher (no 16 MB buffer) and checks access itself.
- **Backup copies** (`lib/backup-copies.ts`, settings in `lib/backup-copies-settings.ts` → `ServerSettings.backupCopies`):
  `doBackup()` calls `copyBackup(file, kind, removed)` after pruning — in the background, but awaited (≤10 min) for
  `pre-update` since the container is replaced next. E-mail via `sendEmail` with the file attached (`emailPlan`:
  attach / tooBig / notEncrypted / skip). Cloud targets in `lib/cloud/` (`CloudTarget`: upload in parts, list,
  remove): Graph upload sessions (10 MiB), Drive resumable uploads (8 MiB, `drive.file` scope → the app creates the
  folder), WebDAV PUT/MKCOL/PROPFIND. OAuth: `/api/server/cloud/connect` → provider → `/api/server/cloud/callback`
  (signed `state` stands in for the SameSite=Strict server-admin cookie). Client secrets / refresh tokens / passwords
  stored with `encryptField`; Microsoft rotates refresh tokens (`onRefresh` saves them). Last results in
  `DATA_DIR/backup-copies-status.json`. Only names matching the backup pattern are ever deleted remotely.

### Tooling gotchas that already cost time
- **Don't patch TS/TSX through PowerShell double-quoted strings.** The backtick is PowerShell's
  escape character and silently eats JS template literals. Use the Edit/Write tools, or a
  single-quoted here-string (`@' … '@`).
- `Select-String -Path` treats `[id]` in route folders as a wildcard, so verify edits with
  `-LiteralPath` or Grep. False "0 matches" results have happened.
- Run `npx next typegen` after adding routes, so `PageProps<"/route">` / `RouteContext<…>` types exist.
- Next 16 differences:
  - `proxy.ts` replaces `middleware`.
  - `params`, `searchParams` and `cookies()` are async.
  - Page files may only export the component and metadata; put helpers elsewhere (e.g. `assets/filter.ts`).
  - Read `node_modules/next/dist/docs/` before using an unfamiliar API.

---

## 4. Architecture and conventions (must follow)

### Tenancy and permissions
- **Always use `ctx.db`**, from `getContext()` / `requirePermission()` (`src/lib/context.ts`) or
  `getPortalContext()` (`src/lib/portal.ts`).
  - It is `tenantDb(orgId)` (`src/lib/db/tenant.ts`): a Prisma extension that injects
    `organizationId` into every where/create on tenant models.
  - The raw `prisma` client is only for auth, sign-up, invitations, public QR pages and the scheduler.
- **Foreign keys from user input must be checked** with `assertOwned(ctx.db, model, ids)`, or with a
  scoped `findFirst` (e.g. an area must belong to the same villa). The guard only filters the
  row being written, not the rows it points to.
- **Use unchecked FKs on tenant models** (`villaId: x`, not `villa: { connect }`), and always set
  `organizationId` explicitly in `create` data. The extension also sets it, but TypeScript needs it.
- **Child models without `organizationId`** (checklist items, time entries, PO lines…) are only
  reached through a parent loaded via `ctx.db`.
- **A model that gains `organizationId` must be added to `TENANT_MODELS`.** `tests/tenant-models.test.ts`
  enforces this.
- **RBAC:** default matrix in `src/lib/rbac.ts`. Use `ctx.can("x")` in pages (`notFound()` when denied) and
  `requirePermission("x")` in server actions; never `can(role, …)` (it ignores the company's settings).
  Roles: OWNER (shown as **"Super Admin"**), ADMIN, MANAGER, TECHNICIAN, ACCOUNTANT ("Contabilista": reports, costs,
  billing; not billable, not a van owner), REQUESTER (the client portal) and VIEWER.
  - **Configurable permissions** (Settings → Roles, editable only by OWNER via `requireOwner()`): overrides for
    ADMIN/MANAGER/TECHNICIAN/VIEWER/ACCOUNTANT in `Organization.rolePermissions`, and per custom role in
    `JobRole.permissions` (null = follow its access level). `effectivePermissions()` resolves them; `ctx.can` and
    `membersWith()` use it. OWNER always has everything; REQUESTER is fixed (portal users must never get internal
    permissions); `internal.view` is always on for staff roles. A new permission goes in `PERMISSIONS` **and**
    `PERMISSION_GROUPS` (a test checks), with `perm.<key>.label/hint` messages.
  - `costs.view` gates labour/parts/totals (WO costs card, request cost summary, cost report + money columns in CSV
    exports, overview cost KPI, technician labour column) and contract fees (a form without it keeps the stored fee).
    Purchase prices (parts, POs, vendors) stay with the inventory/purchasing permissions. `billing.manage` is
    grantable but has no screens yet.
  - **E-mailed service reports** (manual, `workOrders.sendReport`): WO page panel → `sendReportAction` →
    `lib/report-email.ts` (`reportRecipients`: client e-mail, contacts with `receivesReports`, `Client.reportEmails`,
    company list `Organization.reportRecipients` {userIds, roles incl. "job:<id>", emails}; `sendServiceReport`:
    PDF from `lib/service-report.ts` in the company language, one e-mail per address, `WorkOrder.reportSentAt/To`,
    audit log). Pure rules in `lib/report-recipients.ts`. In production it refuses when e-mail isn't configured.
  - Structural checks stay on the role itself: REQUESTER = portal user, OWNER can't be changed or erased.
  - Not to be confused with `User.isSuperAdmin` (unused; meant for a future platform console in phase 10).
- **Custom roles** (`JobRole`, Settings → Roles): a name, a cost per hour and an access level (ADMIN,
  MANAGER or TECHNICIAN). A member in a custom role has `jobRoleId` set and `role` = its access level,
  so RBAC is unchanged; changing a role's access updates its members. Built-in role rates live in
  `Organization.roleRates`. `hourlyRateFor()` (`src/lib/roles.ts`): custom role rate → built-in role
  rate → legacy `Membership.hourlyRate`; never for VIEWER/REQUESTER. `ctx.hourlyRate` is snapshotted
  onto each `TimeEntry`, so rate changes only affect new time. Show role names with
  `jobRole?.name ?? t("roles.X")`. Request pages show the linked job's cost (`workOrderCosts`).
- **Theme** (light / dark / system): `User.theme`, saved by `setThemeAction` on every toggle click (plus a
  cookie for signed-out pages); `getTheme()` (`src/lib/theme-server.ts`) feeds `<html data-theme>` and a
  server-set `dark` class; `THEME_BOOT_SCRIPT` resolves "system" before paint and follows device changes.
  Dark mode = `html.dark` overrides of the app tokens **and** the Tailwind palette shades in use
  (globals.css), so plain classes like `bg-red-50 text-red-800` work in both. `bg-white` is deliberately
  not remapped (logos, signatures, labels). New colour shades used in the UI need a dark value there.
- **Client sign-off**: signature (`signOff()`) or `WorkOrder.clientAbsent` (`setClientAbsent()`, refused once
  signed), both in `src/lib/wo-ops.ts` and shared by the web panel and offline sync (ops `signoff` /
  `clientAbsent`; an offline signature is a queued photo with `signOffName`). Completing a job **requires** a signature or client absent (`isSignedOff()`, enforced in `changeStatus`); a done job's sign-off can't be removed without reopening it. The PDF prints "Client absent" when set.
- **REQUESTER users are redirected to `/portal`** by `(app)/layout.tsx`. Portal scope
  (`src/lib/portal-scope.ts`, tested):
  - Villas the member's client owns (`clientId`) **or manages** (`Villa.managerId`, a property
    manager / managing company). Owners only reach their own villas; a manager reaches every villa
    it manages across owners.
  - Requests on those villas, and client-visible work orders there.
  - Contracts of either the owner or the manager can cover a villa (`covers()` takes `clientIds`).
  - `/api/files/[id]` and the WO report route contain explicit portal checks.

### Forms and server actions
- **Server actions** live in `actions.ts` next to their pages, with the signature
  `(boundArgs…, prev: FormResult, form: FormData) => Promise<FormResult>`.
  - Validate with `parseForm(schema, form)` (`src/lib/forms.ts`), then check
    `if (parsed.error) return parsed.error` and read `parsed.data`. Destructuring `{data, error}`
    breaks type narrowing.
  - Zod helpers: `str`, `optStr`, `optId`, `optDate`, `optNumber`, `enumOf`, `optEnumOf`.
- **Field errors are Zod issue codes**, translated via `validation.<code>` in the messages. Custom
  refinements put the message *key* in `message`, e.g. `invalid_ip`, `contactRequired`.
- **Forms:**
  - Use `<ActionForm action={x.bind(null, id)}>` (`src/components/action-form.tsx`) with `<FieldError name>`.
  - Custom forms use `useActionForm()` (`src/lib/use-action-form.ts`) plus `<FieldErrorsProvider>`.
  - **Never use `<form action={…}>` with `useActionState` directly.** React 19 resets
    uncontrolled inputs after the action, so users lose their input on validation errors.
- **Error codes returned from actions are message keys**, e.g. `"wo.requiredItems"` or
  `"requests.notPending"`. `ActionForm` resolves `common.<code>`, then `<code>`.
- **Dates:**
  - European formats in both languages: next-intl's `locale` is `en-GB` / `pt-PT` (`INTL_LOCALE` in
    `src/i18n/config.ts`), so read the app language with `appLocale(await getLocale())`, never `=== "pt"`.
  - Never use native `type="date|time|datetime-local"` inputs (they follow the browser's language, e.g.
    MM/DD/YYYY and AM/PM). Use `<DateInput>` / `<TimeInput>` (`src/components/date-input.tsx`; they submit
    `yyyy-mm-dd` / `HH:MM`) or `<DateTimeField name>`, which submits ISO in the browser's time zone.
  - Rendering uses next-intl with the org time zone (`src/i18n/request.ts` looks it up per request).
  - Recurrence maths is time-zone aware (`src/lib/pm-schedule.ts`).

### Internationalisation
- Every UI string goes in **both** `messages/en.json` and `messages/pt.json`.
  `tests/messages.test.ts` enforces key parity.
- Workflow: write a fragment JSON in the scratchpad, then run
  `node scripts/merge-messages.mjs en <file>` (and the same for `pt`).
- ICU plurals are used, e.g. `pm.every.MONTHLY` has `=3 {Quarterly}`. Don't create a key that is
  also a namespace: `pm.every` vs `pm.every.DAILY` broke once.
- Browser titles: `export const generateMetadata = titled("nav.x")` (`src/lib/metadata.ts`), never a static English `metadata.title`.

### Files and secrets
- **Storage:** `src/lib/storage.ts` (`putObject/getObject/deleteObject`). Refs look like
  `local:<org>/<yyyy-mm>/<hex>.<ext>` and are served by `/api/files/[id]`: auth-checked, `ETag`,
  `Cache-Control: private, no-cache`.
  - Upload endpoint `/api/uploads`: targets `workOrderId | workOrderItemId | assetId | villaId | partId | purchaseOrderId | articleId`.
    `<AttachmentsPanel target>` (`src/components/attachments-panel.tsx`) is the generic upload/thumbnail/delete UI.
  - The client downsizes photos first (`src/lib/upload-client.ts` → `shrinkImage`).
  - Portal and QR forms send photos inside the server-action FormData instead
    (`createRequest` in `src/lib/requests.ts`).
- **Secrets:** `encryptField/decryptField` (AES-256-GCM, `src/lib/crypto.ts`). Reveal and save only
  through `src/app/(app)/secret-actions.ts`, which audit-log via `src/lib/audit.ts`.

### Domain logic (reuse rather than duplicate)
- **`src/lib/work-orders.ts`:**
  - `createWorkOrder` (validates refs, numbers via `nextNumber`, copies procedure items, links
    meter steps).
  - `changeStatus` (Done blocked by required items, stops timers, stamps `firstResponseAt`).
  - `workOrderCosts`: labour + parts + other costs (pass `parts` = the WO's `WorkOrderPart` rows).
  - `WoCtx` is the minimal context, so the scheduler can act without a request.
- **`src/lib/pm.ts` + `src/lib/pm-schedule.ts`:** the scheduler.
  - `runDueSchedules` claims each occurrence atomically; missed occurrences collapse into one WO.
  - `onMeterReading` handles meter-based schedules.
  - Triggers: `/api/cron/pm` (Bearer `CRON_SECRET`, public in `proxy.ts`), the
    `src/instrumentation.ts` interval, and the "Run scheduler" button.
- **`src/lib/meters.ts`:** `recordReading` stores the reading, runs meter PMs, and opens an alert
  WO (one open at a time, via `WorkOrder.alertMeterId`).
- **`src/lib/requests.ts`:** `createRequest`, `approveRequest` (creates the WO and moves photos
  onto it) and `declineRequest`.
- **`src/lib/inventory.ts`** (DB) + **`src/lib/inventory-math.ts`** (pure, unit-tested):
  - Every stock change goes through the private `move()`: one `PartStock` update plus one signed
    `StockMovement` row, inside a transaction. Decrements are a guarded `updateMany … quantity >= q`,
    so stock can never go negative and concurrent takes can't oversell (`InventoryError("insufficientStock")`).
  - `setStockLevel` (count → ADJUSTMENT), `transferStock` (TRANSFER_OUT/IN pair), `setLocationMin`,
    `consumePart` / `returnPart` (WO parts; a return is a *positive* CONSUMPTION with note `return`),
    `receivePurchaseOrder` (RECEIPT movements, updates the part's unit cost to the price paid, derives
    PARTIALLY_RECEIVED/RECEIVED), `lowStockParts`, `onOrderByPart`, `createLowStockPurchaseOrders`
    (one draft per preferred vendor), `addLowStockLines`.
  - Low stock = total ≤ `Part.minQuantity` (0 = untracked) **or** any location ≤ its own `PartStock.minQuantity`.
    Reorder suggestion tops up to 2 × reorder point, net of open PO quantities.
  - PO workflow is `poActions(status, {canApprove, hasReceipts})`: approvers approve straight from DRAFT;
    others submit → PENDING_APPROVAL. Only drafts are editable; cancel is blocked once anything is received.
  - Domain errors surface as `stock.<code>` message keys.
- **On site / remote time and trips** (`src/lib/travel-charge.ts`, pure, tested): `TimeEntry.mode` (ONSITE default,
  REMOTE); chosen before the timer / manual entry (web and field app, `time` op `mode`), switchable per entry
  (`setTimeModeAction`). One trip per day (org time zone) with finished on-site time, per technician or per work order
  (`Organization.travelPerTechnician`); cost = `travelFee` within `travelRadiusKm` of the company (or when
  `Villa.distanceKm` is unset), else `travelKmRate` × the whole one-way distance. A contract can include trips
  (`travelIncluded`) or set its own `travelFee` / `travelKmRate` (null = company). Pass `travelOf(org, contract)` to `workOrderCosts` (select `villa.distanceKm` and the
  entries' `startedAt`/`mode`). The service report shows the count and each person's mode, no amounts.
- **Per-org counters** via `nextNumber(orgId, key)`. Keys in use: `workOrder`, `request`, `purchaseOrder`.

### UI kit
- `<ConfirmIconButton action={boundAction}>` (`src/components/confirm-button.tsx`): confirm-then-run icon button for row removals.
- `src/components/ui.tsx` (Button, Input, Select, Textarea, Field, Card, PageHeader, Badge, Table, FormError).
- `badges.tsx` (system, asset status, WO status, priority), `list-controls.tsx` (FilterBar +
  Pagination, URL-driven), `empty-state`, `back-link`, `archive-button`, `recent-work-orders`,
  `sparkline`, `signature-pad`, `photo-picker`, `secret-field`.
- **Navigation:** `src/components/shell/nav.ts`. Items have `ready: false` until built. **Flip
  Messages and Reports to `ready: true` when their phase ships.** Badges are computed in
  `(app)/layout.tsx` (`badges` map: pending requests, POs awaiting approval).
- **Forms that must reset after success** (e.g. PO receiving) get a React `key` derived from the
  data, because `useActionForm` deliberately keeps uncontrolled inputs.
- Tailwind v4 tokens (`brand`, `muted`, `border`, `surface`, `danger`) in `src/app/globals.css`.
  Light theme only for now.

---

## 5. Data model notes

All models are in `prisma/schema.prisma`, with 5 migrations (`init`, `pm_meters`, `notifications`, `offline_sync`, `company_profile`). Add changes
with `npx prisma migrate dev --name <x>`, then `npx prisma generate` (Prisma 7 doesn't auto-generate).

**Built out:** Organization, User, Membership, Invitation, Counter, Team, Client, ClientContact,
Villa, Area, Asset, AssetStatusLog, Procedure(+Item), WorkOrder(+Assignee/Item/Comment/StatusLog/
Cost), TimeEntry, Attachment, AuditLog, PMSchedule(+Assignee), Meter, MeterReading, Request.

**Built in phase 6 (no migration was needed):** Part, StockLocation, PartStock, StockMovement,
WorkOrderPart, Vendor(+Contact), PurchaseOrder(+Line), `Asset.parts` (compatible parts, M2M). Each org
gets a "Main warehouse" at sign-up; the seed adds two vans, two vendors and four stocked spares.

**Built in phase 7:** Notification (+`data` JSON for re-rendering in the reader's language),
`User.notificationPrefs` (JSON), `PushSubscription` (new; per user, not org-scoped), Conversation
(DIRECT/GROUP/TEAM; WORK_ORDER is unused, WO comments are the WO thread), ConversationMember (read
markers), Message, VerificationToken (password reset).

**Exist but have no UI yet (the remaining phases):**
- **Phase 10:** `Subscription` (a trial is created at sign-up).
- **Work-order categories** (`Category`, M2M): Settings → Categories (`workOrders.manage`), chips on the WO form/list/detail, `?category=` list filter.
- **Not on any phase yet** (mention to the user): email verification
  at sign-up isn't done either.

**Built in phase 8 (no migration):** `ServiceContract` UI; `WorkOrder.contractId` is now set automatically.

---

## 6. How to verify (proven techniques)

- **Checks:** `npm run typecheck`, `npm run lint` (`npx eslint src tests`), `npm test` (vitest, 107 tests).
- **Testing offline needs a production build.** In `next dev`, Turbopack only hydrates after its HMR
  websocket connects, so a page served from the SW cache stays inert with the server down. Use
  `npx next build`, then preview config `prod` (`next start -p 3100`); stop it to simulate no signal
  (navigator.onLine stays true, so the app detects offline from failed fetches). Port 3100 is its own
  origin (separate SW/caches/IndexedDB) but shares localhost cookies.
- **Only one `next dev` per folder:** if another session's server already runs on :3000, attach with
  `preview_start({url: "http://localhost:3000"})` instead of starting a second one (it serves the same code).
- **Library-level checks against the real DB:** a temporary `tests/_x.test.ts` with
  `vi.mock("server-only")` + `import "dotenv/config"` can call `src/lib` functions directly (tsx can't:
  `server-only` throws, and `--conditions=react-server` breaks React). Delete it afterwards.
- **Emails in dev:** open the newest file in `.mail/`. Push can't be tested in the preview pane
  (notifications are blocked there); use a normal browser on localhost.
- **PDF text check:** inflate `FlateDecode` streams with `DecompressionStream("deflate")` in the page and
  hex-decode the `<…>` text operands (react-pdf's built-in fonts write text as hex).
- **Browser pane:**
  - Screenshots often time out because the app window may be behind another. Prefer
    `get_page_text`, `find` and `javascript_tool`.
  - Fill React inputs through the native value setter, then dispatch `input`/`change`, then
    `form.requestSubmit()`.
  - Fire `blur` handlers with `dispatchEvent(new FocusEvent('focusout', {bubbles:true}))`.
  - Test file inputs with `DataTransfer` + a canvas-generated JPEG.
  - **Don't `navigate` to a PDF URL.** It pops a save dialog on the user's screen; fetch it instead.
- **Acting as any user without the UI:** write a throwaway `scripts/_x.mts` (`.mts` because
  top-level await is needed) that runs `encode({ token: { sub: userId, email }, secret: AUTH_SECRET, salt: "authjs.session-token" })`
  from `next-auth/jwt`, then `fetch` pages with `cookie: authjs.session-token=<token>`. Run it
  with `npx tsx`, then delete the script.
  - Note: `NextIntlClientProvider` embeds *all* message strings in the HTML, so assert on
    markup or URLs, not on translated text.
- **Demo logins** (password `demo1234`, all `@demo.test`):
  - `owner` Sofia (OWNER), `manager` Miguel (MANAGER), `tech.network` Rui (TECHNICIAN, €45/h),
    `tech.electrical` Daniel (TECHNICIAN), `viewer` Ana (VIEWER).
  - `client` James Whitmore (REQUESTER → client "Whitmore Family Office").
  - The preview pane is currently signed in as the **owner** (Sofia).
- **Demo data now includes test records** from phases 2–5. The user knows; keep or clean up on request:
  - Villa "Villa Quinta do Lago 7" (code `VQL-07`), which has a test access code.
  - 9 assets, including "Cinema access point", "Pool house rack", "Pool house AP" and "Cinema projector".
  - WOs #1–#6. #2 is a meter alert, now internal. #5 is a deliberate overdue catch-up.
  - 2 PM schedules, a UPS battery meter with readings, and 7 starter procedures.
  - Requests R1 (approved → WO #6) and R2 (declined).
  - Phase 9: WO #7 got four checklist steps (checkbox, photo, dBm reading, signature) and was
    completed offline by Daniel in the test: answers, photo, signature, a comment, 7 min of time, Done.
  - Phase 8: contract "Premium maintenance 2026" (Whitmore, all villas, 4 h / 48 h, 4 visits,
    €450/month) linked to WOs #1–#7.
  - Phase 7: a DM Miguel↔Rui, a group "Pool house job" (Miguel, Rui, Daniel), a comment on WO #7
    mentioning Daniel (who is now assigned to #7, which is In progress), PO-2 awaiting approval,
    and assorted notifications. Test emails are in `.mail/`.
  - Phase 6: vendor "Redes Lusas Distribuição", part "Ubiquiti U6-Pro access point" (8 on hand,
    linked to "Pool house AP", van-Rui minimum 3 so it shows as low), WO #7 with one AP used, and PO-1
    (received in two receipts). The live DB predates the seed's new inventory block.

---

## 7. Open items and known gaps (tell the user where relevant)

**Blocking before any real deployment**
1. **Uploads are on local disk.** Swap `src/lib/storage.ts` to S3/R2 (the interface is ready).
   Serverless hosts don't persist files.
2. **Scheduler on the host:** configure a 15-minute cron calling `/api/cron/pm`.
   `SCHEDULER_INTERVAL_MINUTES` is only for self-hosting.
3. **Email provider not configured.** Settings → Server → E-mail: SMTP or Resend (or `RESEND_API_KEY` + `EMAIL_FROM`).
   Until then nothing is emailed in production (invites still show a copyable link).
4. **Web push needs HTTPS** in production (localhost is exempt) and `VAPID_SUBJECT` set to a real
   contact address.
5. **The user should rotate the Neon password.** `.env` then needs the new URL.

**Smaller**
- `NextIntlClientProvider` ships every message to the client (fine now; scope it later for performance).
- Staff can't create a request manually (they create WOs directly). Probably fine.
- The public QR form has no CAPTCHA; it relies on a honeypot plus DB-count rate limits.
- `nodemailer` is on 10.x for its security fixes, but `next-auth`/`@auth/core` still declare an optional peer of
  `^7 || ^8`. `overrides` in `package.json` points them at ours (we don't use their email provider). Drop it once
  `@auth/core` accepts 10.
- Docker Scout also lists Debian CVEs with no fixed version (zlib, tar, many "low" glibc/systemd/krb5…). Nothing to
  change: the release build runs `apt-get upgrade` without cache, so a Debian fix lands on the next release. `tar` is
  needed by backups (`lib/backups.ts`).
- Audit log (Settings → Audit log, permission `audit.view`): see "Audit log, van restock, scanning" in §8.
- Playwright e2e smoke tests in `e2e/` (`npm run test:e2e`; against a running server with `E2E_BASE_URL=http://localhost:3000`); CI job `e2e` builds and runs them on a seeded Postgres.
- `next-auth` is a v5 beta.

---

## 8. Plan for the next phases

### Phase 6 — Inventory & purchasing (✅ done; notes for later)
- Not done, possible follow-ups: barcode scanning (phase 9 PWA), PO emailing to the vendor (phase 7 email), technicians restocking their own van
  (transfers need `inventory.manage`), a stock-valuation report (phase 8).
- Deleting a WO keeps its stock movements (parts were physically used); only "return" puts stock back.

<details><summary>Original phase 6 plan</summary>

- **Parts** (`/parts`): list, detail and form; SKU/barcode, system, unit cost, min qty,
  preferred vendor; photo via `/api/uploads` (add a `partId` target); compatible assets (M2M).
- **Stock locations** (settings, or a tab on parts): warehouse, vans (linked to a technician), site stock.
  - Per-location `PartStock` with `minQuantity` overrides.
  - Adjustments, and transfers written as two `StockMovement` rows (TRANSFER_OUT/IN) in one transaction.
- **Parts on work orders:** a "Parts" panel on `/work-orders/[id]`.
  - Pick a part plus the location (default: the technician's van).
  - Write `WorkOrderPart` and a CONSUMPTION movement, and decrement `PartStock`. Returning a part
    reverses this.
  - Add parts cost into `workOrderCosts`, and parts into the PDF report (client-facing: no costs).
- **Low-stock:** `quantity <= min` badges, a filter, and a dashboard card. Notifications come in phase 7.
- **Vendors** (`/vendors`): CRUD, contacts, systems; link from assets (`Asset.vendorId`
  already exists) and parts.
- **Purchase orders** (`/purchase-orders`): numbering via `nextNumber(org, "purchaseOrder")`.
  - Status flow: DRAFT → PENDING_APPROVAL → APPROVED (`purchasing.approve`) → ORDERED →
    PARTIALLY_RECEIVED/RECEIVED.
  - Lines can be parts or free text.
  - Receiving updates `receivedQuantity` and writes RECEIPT movements into `shipToLocation`.
  - "Create PO from low stock" should pre-fill lines. A PDF PO for vendors can reuse react-pdf.
- **Barcode scanning:** optional; can be a PWA feature in phase 9.
- Add translations, `TENANT_MODELS` is already correct, flip the nav items, test the stock
  arithmetic with unit tests.

</details>

### Phase 7 — Messaging & notifications (✅ done; notes for later)
- **`src/lib/notify.ts`**: `notify(actor, userIds, {type, data, link})`. Never notifies the actor; only
  active org members. Writes an in-app row (title/body rendered in the recipient's `User.locale`,
  plus `data` so the list re-renders in the viewer's current language), then email/push per
  `prefsOf()` (`src/lib/notification-types.ts`: types, defaults, portal subset). Delivery runs in
  `after()` when there's a request, inline otherwise (scheduler). `notifyExternal()` emails people
  without accounts (QR requesters). `membersWith(db, permission)` picks recipients by role.
- Text lives in `messages/*.json` under `notify.<TYPE>.title/body` (ICU `select` for statuses) and
  `email.*`. Precompute optional fragments in code (`place`, `detail`) rather than branching in ICU.
  `tests/notifications.test.ts` renders every type in both languages.
- Hooks: `createWorkOrder`/`notifyAssigned` (also WO edit), `changeStatus` (+ requester when a
  client-visible WO from a request is done), WO comments (MENTION / WO_COMMENT), `createRequest`,
  `notifyRequester` (approve/decline), `recordReading` (METER_ALERT), `watchLowStock` in inventory
  (fires on the transition into low stock only), PO submit/approve/reject/cancel, chat messages.
- **Chat** (`src/lib/conversations.ts`, `/messages`): DMs (one per pair), named groups, a channel per
  team (created lazily; access = current team membership). Live updates = `router.refresh()` every
  4 s while visible; read markers via `markReadAction`. Plain messages are push-only (no in-app row;
  the Messages nav badge counts unread conversations); @mentions in groups/channels notify in-app.
- `<MentionTextarea>` powers @mentions in chat and WO comments; `findMentions()` matches full names,
  or first names when unambiguous.
- Bell (`components/notifications/bell.tsx`) polls `/api/badges` every 30 s; `/api/notifications/[id]`
  marks read and redirects (in-app paths only). Profile at `/settings/profile` and `/portal/profile`:
  details, password change, per-type email/push toggles, push opt-in per device (`public/sw.js`).
- Password reset: `/forgot-password` → emailed link (SHA-256-hashed token, 1 h, max 3 live) →
  `/reset-password/[token]`. Existing JWT sessions aren't revoked on reset (Auth.js JWT strategy).
- Not done: email digests, quiet hours, SSE/websockets, chat attachments, editing/deleting messages.

<details><summary>Original phase 7 plan</summary>

- `src/lib/notify.ts`: `notify(ctx, userIds, type, {title, body, link})` → a `Notification`
  row, plus email/web push according to user preferences (a new model or JSON field is needed).
- **Hook points:**
  - WO assigned: `createWorkOrder`, the assignee change in `saveWorkOrderAction`, `approveRequest`.
  - WO status: tell the creator and assignees; tell the portal client when Done.
  - Requests: new request (`createRequest` → managers); approved/declined → the requester, by
    portal user or by email for QR requests.
  - Scheduler and meters: PM generated, meter alert (`recordReading`).
  - Low stock; PO awaiting approval.
  - @mentions in WO comments.
- **UI:** a notification bell with an unread count in the sidebar header, `/notifications`, and
  mark-read.
- **Messages:** per-WO thread (`Conversation.workOrderId`, can replace or augment WO comments),
  team channels (`Conversation.teamId`) and DMs; poll or use SSE for live updates.
- **Email:** also use for invitations and password reset (§7.3–4).

</details>

### Phase 8 — Reporting & service contracts (✅ done; notes for later)
- **Contracts** (`/contracts`, permission `contracts.manage` = owner/admin/manager; view = internal.view):
  client, optional villa (else client-wide), status, dates (end day inclusive), response/resolution
  hours, included visits/year, monthly fee, systems (none = all). Shown on the client page.
- **Auto-linking** (`src/lib/contracts.ts`, rules in `src/lib/sla.ts` → `covers`/`pickContract`):
  `createWorkOrder` and WO edits pick the covering contract (villa-specific beats client-wide, then
  latest start; only ACTIVE/EXPIRED apply). Saving/deleting a contract runs
  `relinkClientWorkOrders`, so earlier jobs are (re)attributed.
- **SLA** (`slaStates`): calendar hours from WO creation. Response = `firstResponseAt` (or completion);
  resolution = completion. States met/breached/pending/na; compliance counts only decided ones.
  Per contract, `businessHoursOnly` counts only the company's business hours (Settings → Organization: hours per
  weekday + holidays, in the org time zone) and `pauseOnHold` stops the clock while ON_HOLD (periods from
  `WorkOrderStatusLog`; load them with `SLA_STATUS_LOGS` and pass `slaCalendar(org)` to `slaStates`). Maths in
  `src/lib/sla-clock.ts` (tested); a job on hold before its target shows "Paused" with no due date.
  The WO page shows respond-by / resolve-by with `<SlaBadge>` (icon + word).
- **Reports** (`/reports/*`, `reports.view` = owner/admin/manager/viewer): one URL-driven filter row
  (`src/lib/report-filters.ts`: 30d/90d/12m/ytd/custom ≤3y, client, villa, system) scopes every tab
  and CSV. Loaders in `src/lib/reports.ts`; pure maths in `src/lib/report-math.ts` (tested).
  Conventions shown on the pages: counts/costs/SLA by WO *opened* in the period, MTTR by WO
  *completed* (reactive/corrective/emergency only), PM by *due* date. Utilisation = logged hours vs
  8 h × working days. Downtime = time in DOWN from `AssetStatusLog`. Fees = contract fee pro rata;
  with a villa filter only villa-specific contracts count; hidden with a system filter.
- **Charts** (`src/components/charts/`): followed the `dataviz` skill. Palette = its categorical slots
  1–3 (`SERIES` in `bars.tsx`), validated on #ffffff (aqua is <3:1 → every chart has a legend and a
  table). `TrendChart` (client SVG, crosshair + keyboard), `BarList`, `StackedBars` (2px gaps,
  per-segment tooltip), `StatTile`. Light theme only, like the app.
- **CSV**: `src/lib/csv.ts` (BOM, formula-injection guard). Report exports at
  `/reports/export/[kind]` (work-orders, sla, costs, technicians, assets); list exports at
  `/api/export/assets` (no credentials) and `/api/export/parts`. Download routes live under `/api` or
  use `<a>`: the Next lint rule treats `/assets/export` as a page link.
- Timezone: report windows are UTC days (dates display in UTC to match); fine for Europe, revisit for
  orgs far from UTC.

### Company profile & branding (added after phase 9)
- `/settings/organization` (owner/admin): name, legal name, NIF, address, phone, email, website,
  brand colour, document footer, logo, plus the regional settings.
- `src/lib/branding.ts` (pure, tested): `brandColor()` falls back to the default blue unless the saved
  colour gives ≥ 4.5:1 with white (buttons use white text on it, links use it on white).
  `brandStyle()` sets `--brand` and `--color-brand` inline on the app/portal/field/QR wrappers.
  `companyLines()` builds the letterhead; `logoSrc()` gives a versioned logo URL.
- Logo: PNG/JPEG only, ≤ 2 MB, type sniffed from the bytes (no SVG: it can carry script and react-pdf
  can't embed it). Stored via `putObject` under `<org>/branding/`, served publicly by
  `/api/org-logo/[id]?v=<updatedAt>` (immutable cache; public for QR pages and emails). The SW
  caches it for the offline field app (cache `v3`).
- PDFs share `src/components/pdf/letterhead.tsx` (`PdfHeader`/`PdfFooter`, data from
  `src/lib/letterhead.ts`); emails get the logo and colour through `emailLayout({logo, color})`.
- Demo org now has example details and a generated logo (set during testing).
- The *product* name ("VillaOps", `common.appName`) is still a placeholder, separate from the
  company name.

### Phase 9 — Offline field app (✅ done; notes for later)
- **`/m`** (outside the `(app)` layout; technicians and anyone with `workOrders.execute`): one client
  page, hash-routed (`#wo=<id>`) so it never needs the server once loaded. It's the manifest
  `start_url`; sidebar has "Field app". Shows the user's assigned open WOs (max 50) from
  `/api/offline/snapshot`: checklist, last 20 comments, villa address + access notes (never the
  encrypted codes), asset details, and the assets at those villas (for offline QR lookups).
- **Data on the device** (`src/lib/offline/idb.ts`, DB `villaops-field`): `kv` (snapshot, sync issues,
  running timer — keys prefixed by user id), `queue` (ops by user, ordered by `seq`), `blobs`
  (photos/signatures until uploaded). What's shown = `applyOps(snapshot, queue)` (pure, tested).
- **Sync** (`src/lib/offline/sync.ts`): on load, `online`, tab visible, every 60 s, after each change,
  and the Sync button. Photos upload via `/api/uploads` first, then become `answer` ops; the rest
  goes to `POST /api/offline/sync` in order. The server claims each op id in `SyncOperation`
  (tenant model) before applying, so replays are answered from the log. Outcomes: applied / stale
  (someone else answered later — later answer wins) / rejected (rule broken, e.g. `wo.locked`,
  `wo.requiredItems`: dropped and listed as a sync issue) / retry (server error: batch stops, stays
  queued). An expired session keeps the queue and shows a sign-in link.
- Server logic shared with the web app lives in `src/lib/wo-ops.ts` (`answerItem`, `addComment`,
  `addTimeEntry`, `clampAt` — device times clamped to the last 30 days, never future).
- Timer runs on the device and is queued as a finished interval on stop (<1 min dropped); one timer
  at a time. "Done" is checked locally against required steps first.
- **Service worker** (`public/sw.js`, registered on every page by `ServiceWorkerRegistrar`): caches
  `/m` + the scripts it loaded (the page posts them via `cache-field` because the first load happens
  before the SW controls it), `/offline.html` for other pages, static assets (cache-first in prod,
  network-first on localhost), manifest/icons. Bump `VERSION` when the caching logic changes.
  `sw.js` is served `no-cache` (next.config headers).
- **Install**: `src/app/manifest.ts`, icons drawn by `src/app/icons/[file]/route.tsx` (next/og) —
  replace with real brand artwork when the product name is decided.
- **Scanning** (`src/components/scanner.tsx`): `BarcodeDetector` (Chrome/Android: QR + EAN/UPC/Code128…)
  else jsQR (QR only; iPhone Safari) + manual entry. Used in `/scan` (label QR → `/r/<token>`,
  codes → `/api/scan`: part barcode/SKU, asset tag/serial), the field app (filters to the asset's
  WOs, offline) and the WO parts panel (picks the part). Camera needs HTTPS or localhost.
- **Not done / limits**: true background sync with the app closed (Background Sync API is
  Chromium-only; we sync whenever the app is open); parts usage, new WOs and requests offline (stock
  must not oversell); offline viewing of already-uploaded photos; chat offline. iOS needs the app
  added to the home screen for push and keeps storage less reliably.

### In-app help (added 2026-10-14)
- `/help` (index with grouped topics + server-side search `?q=`) and `/help/[slug]` (article, "On this page" TOC,
  "Open this area"). The **?** link in the sidebar footer / mobile top bar opens the article for the current page
  (`helpHref()` in `src/lib/help.ts`, longest path prefix). Topics are filtered with the same permission as their nav item.
- Registry + a small Markdown subset parser in `src/lib/help.ts` (pure, tested in `tests/help.test.ts`); one file per
  article in `src/content/help/<slug>.ts` with `{ en, pt }` text and its `shots`, listed in `src/content/help/index.ts`.
  Articles are content, not UI strings, so they are **not** in `messages/*.json` (that would ship them to every page);
  only the help chrome is (`help.*`). A new area needs a topic in `HELP_TOPICS` + an article (the test enforces both).
- **Keep articles in step with the UI**: when a screen changes, update its article (both languages).
- Screenshots: `public/help-shots/<locale>/<name>.png`, taken by `npm run help:shots [slug|shot …]` (Playwright,
  signs in as the demo owner, light theme, Lisbon time zone). Take them on a throwaway DB, not the dev one:
  a compose stack with its own Postgres + `next dev -p 3300` on this repo (reuse the dev `node_modules` volume),
  then `prisma migrate deploy`, `tsx prisma/seed.ts`, `tsx scripts/help-sample-data.ts` (realistic WOs, requests,
  PM, meters, procedures, chat). Run the capture from the dev container (it has Chromium) with
  `HELP_BASE_URL=http://localhost:3300 HELP_HOST_RULES="MAP localhost:3300 host.docker.internal:3300"` (next dev only
  hydrates for its own origin). The test fails if an article uses a screenshot that doesn't exist.

### Audit log, van restock, scanning (added 2026-10-14)
- **Audit trail:** `tenantDb(orgId, actor)` (`lib/db/tenant.ts`) passes every write on the models in
  `AUDITED` (`lib/db/audit-trail.ts`) through `withAuditTrail`: it loads the row(s) first, runs the write, then
  logs `<entity>.create|update|delete` with a `label` (name / #number, kept after deletion) and, for updates,
  `changes` `{field: [old, new]}` from `changesOf()` (`lib/audit.ts`). Relations a form rewrites wholesale
  (assignees `{deleteMany, create:[{userId}]}`, categories `{set}`) are compared and shown as names, or dropped
  when unchanged. Secret-looking fields (`*Enc`, password, token, hash) are masked. `getContext()` passes the
  user + IP; the PM scheduler passes `{userId: null}` ("System"); public QR pages pass no actor (not logged).
  Logging never throws (`writeAudit`). A write inside a transaction that later rolls back is still logged.
- **Explicit events:** `audit(ctx, action, …)` / `auditUser(userId, action)` (every company of the user) for
  sign-in ok / failed / blocked, sign-out, password change / reset, server unlock, organization settings and
  role permissions (diff per role), and all Settings → Server operations (`server.*`, incl. backup download /
  upload, restore — re-written into the restored database as `server.restored` — and factory reset).
- **Viewer:** `/settings/audit` (+ CSV `/api/export/audit`), filters in `lib/audit-filter.ts` (days in the
  company time zone), text in `lib/audit-text.ts` (`audit.actions.*` are nested by the action's dots: next-intl
  reads dots as nesting). Retention: Settings → Organization → Data retention (`auditMonths`).
- **Van restock:** `/parts/van` + `restockVan()` (`lib/inventory.ts`): a technician (`inventory.use`) moves parts
  between a warehouse and their own van in one transaction (all lines or none; `notYourVan` otherwise; managers:
  any van). Logged as TRANSFER movements and `stock.vanRestock`.
- **Scanner:** `components/scanner.tsx` uses BarcodeDetector when it reads 1D codes, else ZXing
  (`@zxing/library`, iPhone/Firefox/Windows). `purpose="serial" | "mac"` adds "Read text": OCR with
  tesseract.js, served from `public/ocr` (copied from node_modules by `scripts/copy-ocr.mjs` in predev/prebuild;
  not committed; CSP has `'wasm-unsafe-eval'`). `lib/scan-codes.ts` normalises MACs and picks serial candidates.
  `ScanField` (asset serial / MAC, part barcode), `SerialList` (serial numbers of units used on a WO,
  `WorkOrderPart.serialNumbers`, shown in the service report). The scanner renders in a portal (it is opened
  inside forms). `/api/scan` also finds assets by MAC in any notation.

### Villa knowledge base (added 2026-10-19)
- `KnowledgeArticle` (tenant model, audited): per villa, title, Markdown `body`, optional `system`, `pinned`,
  created/updated by, M2M `assets` (`_ArticleAssets`), files via `Attachment.articleId` (upload target `articleId`).
  Staff only: never in the portal. Read = `internal.view`; write = new permission `knowledge.manage` (group "sites";
  default owner/admin/manager/technician).
- Pages: `/villas/[id]/knowledge` (list, URL filters `q`, `system`, `assetId`), `/new` (`?assetId=` prefills),
  `/[articleId]` (rendered text, linked assets, files), `/[articleId]/edit` (+ delete, which removes the stored files).
  `<KnowledgeCard>` shows pinned/latest articles on the villa page and on asset pages (linked ones).
- `lib/markdown.ts` (pure, tested): a small Markdown subset parsed into blocks; `<Markdown>` renders React elements,
  never HTML; links only http(s)/mailto/tel/in-app; images `![alt](/api/files/<id> | https://…)`; `\*` etc. escape a
  marker (not `\\`, so UNC paths stay). No regex lookbehind (old iPhone Safari runs it in the field app).
- **Editor** (`components/knowledge/markdown-editor.tsx`, 2026-10-22): Tiptap 3 visual editor with a toolbar + a
  **Markdown** tab (the old textarea). `lib/markdown-doc.ts` (pure, tested) converts Markdown ⇄ editor JSON; the editor's
  schema is limited to what the subset holds (headings 2–4, flat lists, notes of paragraphs, one mark per run, inline
  images), and Markdown input rules still fire (`# `/`## `/`### ` = the three heading sizes). Keep the Tiptap packages on
  one version. Images (button, paste, drop) upload with target `draftForVillaId`: an attachment with **no owner**
  (`NO_OWNER` in `lib/uploads.ts`) until `saveArticleAction` adopts the ids in the text (`imageFileIds`) for the
  article; `runRetention` deletes owner-less attachments older than 2 days. Images in the text are left out of the
  article's Files card.
- `lib/knowledge.ts` (pure, tested): `filterArticles()` — same matching as the work-order search (`lib/search-text.ts`:
  accents, partial words, typos, every word must appear) over title + text + linked asset names, in memory (a villa has
  tens of articles). Shared by the web list and the field app.
- Field app: the snapshot carries `knowledge` (text of the articles of the villas of the user's jobs, max 500) and
  `villa.id`; both optional for older cached snapshots. `app/m/knowledge-view.tsx` shows them inside each job.
- Global search: `lib/knowledge-search.ts` (`searchArticles`, max 3000 newest rows matched in memory) adds the top 5
  articles above the work orders on `/search` (villa/system filters apply) and in `/api/search` (field app).

### On call (added 2026-10-19)
- `Membership.onCall` = in the on-call team (staff only: `ON_CALL_ROLES` excludes REQUESTER and VIEWER). `OnCallWeek` (tenant
  model, audited): one row per member per week (a week can have several), `weekStart` = the Monday as a DATE. Weeks are Monday–Sunday in the
  company time zone (`lib/on-call.ts`, pure, tested: `weekOf`, `monthWeeks`, `isoWeek`…).
- Two pages share `components/on-call-calendar.tsx` (`OnCallNow`, `OnCallCalendar editable?`): `/on-call` (nav "On call",
  `internal.view`) is **read-only** for all staff, and `OnCallNow href="/on-call"` is the dashboard card; `/settings/users/on-call` (no nav item: reached only from the **On call** button
  on Settings → Staff; page and writes need the new permission `onCall.manage`, group "admin", default owner/admin) has a select
  per week and the team checkboxes. Removing someone from the team frees their weeks from the current one on; past weeks stay.
- **Settings → Staff / Clients** (split 2026-10-19): `/settings/users` ("Staff" / "Colaboradores") lists non-REQUESTER members and
  invites; `/settings/client-users` ("Clients" / "Clientes") lists portal users (REQUESTER) with their client marked owner and/or
  property manager (villa counts), and invites them with a client (no role picker). `updateMemberAction` refuses role changes
  across the staff/client boundary; `revalidateUsers()` refreshes both pages. Note the sidebar now has two "Clients" entries
  (client companies under Sites, client users under Settings).
- `createRequest` links `Request.onCallUsers` (M2M `_RequestOnCall`; was `onCallUserId` until migration `on_call_several`) from `requestOnCallUsers()` (`lib/on-call-db.ts`: the week's member, if still active
  and in the team) and adds them to the REQUEST_NEW recipients (approvers still get it). That member may approve/decline that
  request whatever their role (`handlerOf` in `requests/actions.ts`), is pre-selected as assignee, and sees it in the Requests
  nav badge. Shown on the request page and list ("On call when it arrived").
- **On-call hours** (Settings → Organization, `Organization.onCallHours`, null = at any time): per weekday one period, an end at or
  before the start runs into the next day (equal = 24 h), plus "company holidays all day" (holidays from business hours). Defaults
  offered: weekdays 18:00–02:00, weekend 02:00–02:00. `onCallShiftDay()` (`lib/on-call.ts`, tested) returns the day the period
  holding a request started (yesterday first), and `requestOnCallUser()` gives the request to that day's week member, so Monday
  01:00 still goes to the previous week's person. Outside the hours only approvers are notified. The calendar and the dashboard
  card (`onCallUsersAt`) show the week's members regardless of the hours.
- **Several on call**: `pickOnCall()` (tested) gives a request to those of the week's members in a team whose specialty
  (`Team.system`) is the request's system; to all of them when none is, or the request has no system. Requests have no team of
  their own, so the system is the link. Management UI: chips per week with × and a "+ Add" picker (`WeekPeople`).

### Phase 10 — SaaS layer
Stripe checkout and portal (`Subscription`), plan limits (seats, villas, storage), trial expiry
handling, a super-admin console (`User.isSuperAdmin`), org deletion/export.
