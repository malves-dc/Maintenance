// Fills the demo company with a few weeks of realistic activity, so the help screenshots
// (scripts/help-screenshots.ts) show real-looking screens. Meant for a throwaway database seeded with
// `npm run db:seed`, never for production. Skips if it has already run.
//
// Usage: npx tsx scripts/help-sample-data.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEMO_OWNER } from "../src/lib/demo-seed";
import { localizeTemplate, PROCEDURE_TEMPLATES } from "../src/lib/procedure-templates";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const DAY = 86_400_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000);
const ahead = (days: number) => new Date(Date.now() + days * DAY);

async function main() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_OWNER } });
  const org = await prisma.organization.findFirstOrThrow({ where: { memberships: { some: { userId: owner.id } } } });
  const o = { organizationId: org.id };
  if (await prisma.procedure.count({ where: o })) return console.log("Sample data already present, skipping.");

  const user = async (email: string) => prisma.user.findUniqueOrThrow({ where: { email } });
  const [manager, rui, daniel, client] = await Promise.all([
    user("manager@demo.test"),
    user("tech.network@demo.test"),
    user("tech.electrical@demo.test"),
    user("client@demo.test"),
  ]);
  const villa = await prisma.villa.findFirstOrThrow({ where: { ...o, code: "VQL-07" } });
  const villa2 = await prisma.villa.findFirstOrThrow({ where: { ...o, code: "VDL-12" } });
  const asset = (name: string) => prisma.asset.findFirstOrThrow({ where: { ...o, name } });
  const [rack, sw, nvr, knx, board] = await Promise.all(["Main rack", "Core switch", "NVR", "KNX IP router", "Main distribution board"].map(asset));
  const cinema = await prisma.area.findFirstOrThrow({ where: { ...o, name: "Cinema room" } });
  const teamNet = await prisma.team.findFirstOrThrow({ where: { ...o, name: "Network & A/V" } });
  const contract = await prisma.serviceContract.findFirst({ where: o });
  const vanRui = await prisma.stockLocation.findFirstOrThrow({ where: { ...o, userId: rui.id } });
  const poe = await prisma.part.findFirstOrThrow({ where: { ...o, sku: "POE-30" } });

  // Procedures: three starter templates.
  const procs: Record<string, string> = {};
  // Two of them: with fewer than 3 the Procedures page still shows its starter templates.
  for (const key of ["cctv-quarterly", "network-rack"]) {
    const tpl = PROCEDURE_TEMPLATES.find((t) => t.key === key) ?? PROCEDURE_TEMPLATES[0];
    if (Object.values(procs).length && procs[tpl.key]) continue;
    const l = localizeTemplate(tpl, "en");
    const p = await prisma.procedure.create({
      data: { ...o, name: l.name, description: l.description, system: l.system, items: { create: l.items } },
    });
    procs[tpl.key] = p.id;
  }
  const cctvProc = await prisma.procedure.findUniqueOrThrow({ where: { id: procs["cctv-quarterly"] }, include: { items: { orderBy: { sortOrder: "asc" } } } });

  // A meter on the UPS / board with readings.
  const meter = await prisma.meter.create({
    data: { ...o, assetId: board.id, name: "UPS battery voltage", unit: "V", lowerLimit: 12, upperLimit: 14.4, alertWorkOrder: true },
  });
  const readings = [13.6, 13.5, 13.5, 13.3, 13.2, 13.1, 12.9, 12.8];
  for (const [i, value] of readings.entries()) {
    await prisma.meterReading.create({ data: { meterId: meter.id, value, userId: daniel.id, createdAt: ago((readings.length - i) * 7) } });
  }
  await prisma.meter.update({ where: { id: meter.id }, data: { lastValue: 12.8, lastReadAt: ago(7) } });
  const hours = await prisma.meter.create({ data: { ...o, assetId: nvr.id, name: "NVR running hours", unit: "h" } });
  await prisma.meterReading.create({ data: { meterId: hours.id, value: 8420, userId: rui.id, createdAt: ago(20) } });
  await prisma.meter.update({ where: { id: hours.id }, data: { lastValue: 8420, lastReadAt: ago(20) } });

  // Preventive maintenance.
  const pmCctv = await prisma.pMSchedule.create({
    data: {
      ...o,
      title: "CCTV quarterly health check",
      frequency: "MONTHLY",
      interval: 3,
      startDate: ago(80),
      nextDueAt: ahead(10),
      leadDays: 7,
      priority: "MEDIUM",
      system: "CCTV",
      villaId: villa.id,
      assetId: nvr.id,
      procedureId: procs["cctv-quarterly"],
      teamId: teamNet.id,
      estimatedMinutes: 90,
      createdById: manager.id,
      assignees: { create: [{ userId: rui.id }] },
    },
  });
  await prisma.pMSchedule.create({
    data: {
      ...o,
      title: "Network rack inspection",
      frequency: "MONTHLY",
      interval: 6,
      startDate: ago(30),
      nextDueAt: ahead(150),
      priority: "LOW",
      system: "NETWORK",
      villaId: villa.id,
      assetId: rack.id,
      procedureId: procs["network-rack"],
      createdById: manager.id,
      assignees: { create: [{ userId: rui.id }] },
    },
  });
  await prisma.pMSchedule.create({
    data: {
      ...o,
      title: "UPS battery replacement",
      trigger: "METER",
      meterId: hours.id,
      meterInterval: 10000,
      lastMeterValue: 0,
      priority: "HIGH",
      system: "ELECTRICAL",
      villaId: villa.id,
      assetId: board.id,
      createdById: manager.id,
      assignees: { create: [{ userId: daniel.id }] },
    },
  });

  // Work orders.
  const counter = await prisma.counter.findUnique({ where: { organizationId_key: { organizationId: org.id, key: "workOrder" } } });
  let n = counter?.value ?? 0;
  type WO = Parameters<typeof prisma.workOrder.create>[0]["data"];
  const wo = async (data: Omit<WO, "organizationId" | "number" | "createdById"> & { createdById?: string }, assignees: string[] = []) => {
    const w = await prisma.workOrder.create({
      data: { ...o, number: ++n, createdById: manager.id, contractId: contract?.id ?? null, ...data, assignees: { create: assignees.map((userId) => ({ userId })) } } as WO,
    });
    await prisma.workOrderStatusLog.create({ data: { workOrderId: w.id, toStatus: "OPEN", userId: manager.id, createdAt: w.createdAt } });
    return w;
  };

  const done = await wo(
    {
      title: "Wi-Fi drops in the cinema room",
      description: "Client reports the projector and the Apple TV lose Wi-Fi in the evenings.",
      status: "DONE",
      workReport: "The cinema access point was on a crowded 5 GHz channel. Moved it to channel 100, lowered the 2.4 GHz power and updated its firmware. Streamed for 30 minutes on the projector and the Apple TV with no drops.",
      priority: "HIGH",
      type: "REACTIVE",
      system: "NETWORK",
      villaId: villa.id,
      areaId: cinema.id,
      assetId: sw.id,
      teamId: teamNet.id,
      createdAt: ago(12),
      firstResponseAt: ago(12, -2),
      startDate: ago(11),
      completedAt: ago(11, -3),
      completedById: rui.id,
      signedByName: "Maria Santos",
      signedAt: ago(11, -3),
    },
    [rui.id],
  );
  await prisma.workOrderStatusLog.createMany({
    data: [
      { workOrderId: done.id, fromStatus: "OPEN", toStatus: "IN_PROGRESS", userId: rui.id, createdAt: ago(11) },
      { workOrderId: done.id, fromStatus: "IN_PROGRESS", toStatus: "DONE", userId: rui.id, createdAt: ago(11, -3) },
    ],
  });
  await prisma.timeEntry.create({ data: { workOrderId: done.id, userId: rui.id, startedAt: ago(11), endedAt: ago(11, -2), minutes: 120, hourlyRate: 45 } });
  await prisma.workOrderPart.create({ data: { workOrderId: done.id, partId: poe.id, stockLocationId: vanRui.id, quantity: 1, unitCost: 24.9 } });
  await prisma.workOrderComment.create({
    data: { workOrderId: done.id, userId: rui.id, body: "Replaced the PoE injector of the cinema access point and moved it to channel 44. Stable for 2 hours.", createdAt: ago(11, -2) },
  });

  const inProgress = await wo(
    {
      title: "CCTV quarterly health check",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      type: "PREVENTIVE",
      system: "CCTV",
      villaId: villa.id,
      assetId: nvr.id,
      teamId: teamNet.id,
      procedureId: cctvProc.id,
      pmScheduleId: pmCctv.id,
      dueDate: ahead(2),
      startDate: ago(0, 2),
      firstResponseAt: ago(0, 2),
      estimatedMinutes: 90,
      createdAt: ago(3),
    },
    [rui.id, owner.id], // the screenshot user: gives the field app something to show
  );
  await prisma.workOrderItem.createMany({
    data: cctvProc.items.map((it, i) => ({
      workOrderId: inProgress.id,
      sortOrder: it.sortOrder,
      type: it.type,
      label: it.label,
      required: it.required,
      options: it.options,
      unit: it.unit,
      ...(i > 0 && i < 4 ? { value: it.type === "NUMBER" ? "30" : "pass", completedById: rui.id, completedAt: ago(0, 1) } : {}),
    })),
  });
  await prisma.timeEntry.create({ data: { workOrderId: inProgress.id, userId: rui.id, startedAt: ago(0, 2), endedAt: ago(0, 1), minutes: 55, hourlyRate: 45 } });
  await prisma.workOrderComment.create({
    data: { workOrderId: inProgress.id, userId: manager.id, body: "@Rui Ferreira the client asked us to also check the gate camera.", createdAt: ago(0, 3) },
  });

  await wo(
    {
      title: "KNX scene not triggering at sunset",
      description: "The 'Evening' scene no longer runs automatically.",
      status: "OPEN",
      priority: "MEDIUM",
      type: "CORRECTIVE",
      system: "AUTOMATION",
      villaId: villa.id,
      assetId: knx.id,
      dueDate: ahead(4),
      createdAt: ago(1),
    },
    [daniel.id, owner.id],
  );
  await wo(
    {
      title: "Pool house lighting circuit tripping",
      status: "ON_HOLD",
      priority: "URGENT",
      type: "EMERGENCY",
      system: "ELECTRICAL",
      villaId: villa.id,
      assetId: board.id,
      dueDate: ago(1),
      firstResponseAt: ago(2, -1),
      createdAt: ago(2),
    },
    [daniel.id],
  );
  await wo({ title: "Install outdoor access point by the pool", status: "OPEN", priority: "LOW", type: "INSTALLATION", system: "NETWORK", villaId: villa2.id, dueDate: ahead(14), createdAt: ago(0, 5) }, [rui.id]);
  await wo({ title: "Annual electrical inspection", status: "OPEN", priority: "MEDIUM", type: "INSPECTION", system: "ELECTRICAL", villaId: villa2.id, dueDate: ahead(21), createdAt: ago(0, 1) }, [daniel.id]);
  await prisma.counter.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "workOrder" } },
    create: { organizationId: org.id, key: "workOrder", value: n },
    update: { value: n },
  });

  // Requests: one pending from the portal, one from a QR label, one approved, one declined.
  let r = 0;
  const req = (data: Omit<Parameters<typeof prisma.request.create>[0]["data"], "organizationId" | "number">) =>
    prisma.request.create({ data: { ...o, number: ++r, ...data } as Parameters<typeof prisma.request.create>[0]["data"] });
  await req({ title: "TV in the master bedroom has no signal", description: "Since this morning the TV shows 'no signal' on every input.", priority: "MEDIUM", system: "AV", villaId: villa.id, requesterId: client.id, createdAt: ago(0, 3) });
  await req({ title: "Camera at the gate is offline", priority: "HIGH", system: "CCTV", villaId: villa.id, assetId: nvr.id, requesterName: "Maria Santos", requesterEmail: "maria@whitmore.test", createdAt: ago(0, 6) });
  await req({ title: "Wi-Fi drops in the cinema room", status: "APPROVED", priority: "HIGH", system: "NETWORK", villaId: villa.id, requesterId: client.id, workOrderId: done.id, createdAt: ago(12, 1) });
  await req({ title: "Please add a socket in the garage", status: "DECLINED", declineReason: "This is new installation work, not maintenance. We'll send you a quote.", villaId: villa.id, requesterId: client.id, createdAt: ago(5) });
  await prisma.counter.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "request" } },
    create: { organizationId: org.id, key: "request", value: r },
    update: { value: r },
  });

  // Chat: a group conversation and a direct message.
  const group = await prisma.conversation.create({
    data: { ...o, type: "GROUP", name: "Villa Quinta do Lago 7", lastMessageAt: ago(0, 1), members: { create: [manager, rui, daniel, owner].map((u) => ({ userId: u.id })) } },
  });
  const lines: [string, string, number][] = [
    [manager.id, "Morning! The CCTV check at VQL-07 is today, keys are with the house manager.", 4],
    [rui.id, "On my way, should be there by 10:00.", 3.5],
    [daniel.id, "I'm nearby for the pool house circuit, I can help if needed.", 3],
    [rui.id, "Thanks. Disks look fine, retention is 30 days.", 1],
  ];
  for (const [userId, body, h] of lines) await prisma.message.create({ data: { conversationId: group.id, userId, body, createdAt: ago(0, h) } });
  const dm = await prisma.conversation.create({
    data: { ...o, type: "DIRECT", lastMessageAt: ago(1), members: { create: [{ userId: owner.id }, { userId: manager.id }] } },
  });
  await prisma.message.create({ data: { conversationId: dm.id, userId: manager.id, body: "Can you approve PO-1 when you have a minute?", createdAt: ago(1) } });

  console.log(`Added sample activity to ${org.name}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
