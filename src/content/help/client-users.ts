import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [];

const text: HelpText = {
  en: `# Clients

Give villa owners and property managers access to the client portal, and remove it when they no longer need it.

## What this page is for

**Clients** (under **Settings** in the menu) lists the client portal users: the people who sign in to send requests and follow the work on their villas. Your own staff are on [Staff](/help/users). The client companies themselves, with their villas and contacts, are under [Clients](/help/clients) in the main menu.

The page has three parts:

- **Invite user**: the form for new invitations.
- **The list of client users**, with their **Name** and e-mail, the **Client** they belong to (marked **Owner** and/or **Property manager**, with how many villas it owns or manages), **Status** and **Actions**.
- **Pending invitations**: invitations not accepted yet, shown only when there are any.

## Inviting a client user

1. In **Invite user**, type the person's **Email**.
2. Choose the **Client** they belong to.
3. Click **Create invitation**.

The person receives an e-mail with a link to join, also shown on the page with a **Copy** button. It expires in 7 days. Once accepted, they only see the client portal.

## What client users see

A client user sees the villas their client **owns**, and the villas their client **manages** as property manager, with the requests and client-visible work orders there. They never see the staff app. See [Requests](/help/requests).

## Changing a name

Click the pencil next to a client user's name to correct it, then click the tick. The change is kept in the [Audit log](/help/audit).

## Deactivating and erasing

**Deactivate** removes their access; **Reactivate** gives it back. Once deactivated, **Erase data** deletes their personal data for good, as for staff.

## Who can access it

Roles with the **Users and roles** permission, by default the Super Admin and Administrators.
`,
  pt: `# Clientes

Dê aos proprietários de vilas e aos property managers acesso ao portal do cliente, e retire-o quando já não precisarem.

## Para que serve esta página

**Clientes** (em **Definições** no menu) mostra os utilizadores do portal do cliente: as pessoas que entram para enviar pedidos e acompanhar os trabalhos nas suas vilas. Os colaboradores da empresa estão em [Colaboradores](/help/users). As próprias empresas clientes, com as vilas e os contactos, estão em [Clientes](/help/clients) no menu principal.

A página tem três partes:

- **Convidar utilizador**: o formulário para novos convites.
- **A lista de utilizadores clientes**, com o **Nome** e e-mail, o **Cliente** a que pertencem (marcado como **Proprietário** e/ou **Property manager**, com quantas vilas possui ou gere), o **Estado** e as **Ações**.
- **Convites pendentes**: convites ainda não aceites, só aparece quando existem.

## Convidar um utilizador cliente

1. Em **Convidar utilizador**, escreva o **Email** da pessoa.
2. Escolha o **Cliente** a que pertence.
3. Clique em **Criar convite**.

A pessoa recebe um e-mail com uma ligação para entrar, que também aparece na página com um botão **Copiar**. Expira dentro de 7 dias. Depois de aceite, só vê o portal do cliente.

## O que os utilizadores clientes veem

Um utilizador cliente vê as vilas que o seu cliente **possui** e as vilas que o seu cliente **gere** como property manager, com os pedidos e as ordens de trabalho visíveis ao cliente. Nunca vê a aplicação da equipa. Veja [Pedidos](/help/requests).

## Mudar o nome

Clique no lápis junto ao nome de um utilizador cliente para o corrigir e depois no visto. A alteração fica no [Registo de auditoria](/help/audit).

## Desativar e apagar dados

**Desativar** retira o acesso; **Reativar** devolve-o. Depois de desativado, **Apagar dados** elimina definitivamente os dados pessoais, tal como para os colaboradores.

## Quem pode aceder

As funções com a permissão **Utilizadores e funções**, por defeito o Super Admin e os Administradores.
`,
};

export default text;
