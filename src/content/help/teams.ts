import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [{ name: "teams-list", path: "/settings/teams", maxHeight: 560 }];

const text: HelpText = {
  en: `# Teams

Group technicians by specialty, such as network and A/V or electrical, so that work can be handed to the right people in one go.

## What teams are for

A team is a named group of people with an optional specialty and a colour. Teams are used in three places:

- **Work orders**: the **Team** field says which team is responsible. When you pick a team and nobody is assigned yet, its members are pre-selected in **Assigned to**; picking another team swaps them for its members, as long as you haven't changed the people by hand. You can always change them. See [Work orders](/help/work-orders).
- **Preventive schedules**: the same **Team** field, with the same shortcut, so every generated work order goes to that team. See [Preventive maintenance](/help/preventive).
- **Messages**: each team has its own chat channel, which appears automatically for its current members. See [Messages](/help/messages).

## The Teams screen

Open **Settings → Teams**. At the top is the form to create a team; below it, one card per team with its colour, name, specialty and members.

![Two teams, each with its specialty and members, under the form to create a new one](teams-list)

## Creating a team and choosing members

1. Under **New team**, type the **Name**.
2. Optionally choose a **Specialty** (the system the team works on) and a colour.
3. Click **Create**.
4. On the team's card, use **Add member** to add people one at a time. Only active staff can be added, not client users.
5. The cross next to a member removes them from the team.

A person can belong to several teams.

> Teams can't be renamed. To change a name, create the new team, move the members and delete the old one.

## Deleting a team

The bin on a team's card deletes it after a confirmation. Work orders and schedules that used the team keep existing, just without a team, and the team's chat channel is removed.

## Who can do what

- **Super Admin**, **Administrator** and **Manager** can create and delete teams and change their members.
- Other roles don't see this page, but they see the team on work orders and use their team's channel in Messages.
`,
  pt: `# Equipas

Agrupe os técnicos por especialidade, como rede e áudio/vídeo ou eletricidade, para entregar o trabalho às pessoas certas de uma só vez.

## Para que servem as equipas

Uma equipa é um grupo de pessoas com um nome, uma especialidade opcional e uma cor. As equipas usam-se em três sítios:

- **Ordens de trabalho**: o campo **Equipa** diz qual a equipa responsável. Quando escolhe uma equipa e ainda ninguém está atribuído, os seus membros ficam pré-selecionados em **Atribuída a**; se escolher outra equipa, passam a ser os membros dessa, desde que não tenha alterado as pessoas à mão. Pode sempre alterá-las. Veja [Ordens de trabalho](/help/work-orders).
- **Planos preventivos**: o mesmo campo **Equipa**, com o mesmo atalho, para que todas as ordens geradas vão para essa equipa. Veja [Manutenção preventiva](/help/preventive).
- **Mensagens**: cada equipa tem o seu canal de conversa, que aparece automaticamente aos membros atuais. Veja [Mensagens](/help/messages).

## O ecrã Equipas

Abra **Definições → Equipas**. No topo está o formulário para criar uma equipa; por baixo, um cartão por equipa com a cor, o nome, a especialidade e os membros.

![Duas equipas, cada uma com a sua especialidade e membros, por baixo do formulário para criar uma nova](teams-list)

## Criar uma equipa e escolher os membros

1. Em **Nova equipa**, escreva o **Nome**.
2. Opcionalmente, escolha uma **Especialidade** (o sistema em que a equipa trabalha) e uma cor.
3. Clique em **Criar**.
4. No cartão da equipa, use **Adicionar membro** para acrescentar pessoas, uma de cada vez. Só se podem adicionar colaboradores ativos, não utilizadores de clientes.
5. A cruz ao lado de um membro retira-o da equipa.

Uma pessoa pode pertencer a várias equipas.

> Não é possível mudar o nome de uma equipa. Para o alterar, crie a nova equipa, passe os membros para ela e elimine a antiga.

## Eliminar uma equipa

O caixote do lixo no cartão de uma equipa elimina-a, depois de uma confirmação. As ordens de trabalho e os planos que usavam a equipa continuam a existir, apenas sem equipa, e o canal de conversa da equipa é removido.

## Quem pode fazer o quê

- **Super Admin**, **Administrador** e **Gestor** podem criar e eliminar equipas e alterar os seus membros.
- As outras funções não veem esta página, mas veem a equipa nas ordens de trabalho e usam o canal da sua equipa em Mensagens.
`,
};

export default text;
