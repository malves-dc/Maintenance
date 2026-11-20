import { NOT_IN_STAFF_LISTS } from "@/lib/rbac";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { AddMemberSelect, DeleteTeamButton, NewTeamForm, RemoveMemberButton } from "./client";

export default async function TeamsPage() {
  const ctx = await getContext();
  if (!ctx.can("teams.manage")) notFound();
  const t = await getTranslations();

  const [teams, members] = await Promise.all([
    ctx.db.team.findMany({
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { name: "asc" },
    }),
    ctx.db.membership.findMany({
      where: { active: true, role: { notIn: NOT_IN_STAFF_LISTS } },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);
  const people = members.map((m) => m.user).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader title={t("settings.teamsTitle")} description={t("settings.teamsDescription")} />

      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-medium">{t("settings.newTeam")}</h2>
        <NewTeamForm />
      </Card>

      {teams.length === 0 ? (
        <p className="text-sm text-muted">{t("settings.noTeams")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => {
            const memberIds = new Set(team.members.map((m) => m.userId));
            return (
              <Card key={team.id} className="p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ backgroundColor: team.color }} />
                    <h3 className="font-medium">{team.name}</h3>
                    {team.system && <Badge>{t(`systems.${team.system}`)}</Badge>}
                  </div>
                  <DeleteTeamButton id={team.id} />
                </div>
                <ul className="mb-3 space-y-1">
                  {team.members.map((m) => (
                    <li key={m.userId} className="flex items-center justify-between text-sm">
                      {m.user.name}
                      <RemoveMemberButton teamId={team.id} userId={m.userId} />
                    </li>
                  ))}
                </ul>
                <AddMemberSelect teamId={team.id} options={people.filter((p) => !memberIds.has(p.id))} />
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
