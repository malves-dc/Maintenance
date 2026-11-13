import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [{ name: "users-page", path: "/settings/users", maxHeight: 720 }];

const text: HelpText = {
  en: `# Staff

Invite the people of your company, and viewers, choose their role, and deactivate or erase them when they leave. The on-call team is managed from here too.

## What this page is for

**Staff** (under **Settings** in the menu) lists your company's people and viewers who can sign in. Client portal users (villa owners and property managers) have their own page, [Clients](/help/client-users). From here you invite new people, decide what each one can do by giving them a role, and remove access when someone leaves.

![The Staff page: the invitation form at the top and the list of people below](users-page)

The page has three parts:

- **Invite user**: the form for new invitations.
- **The list of people**, with their **Name** and e-mail, **Role** (and **On-call team** when they are in it), **Price per hour**, **Status** and **Actions**.
- **Pending invitations**: invitations not accepted yet, shown only when there are any.

## Inviting someone

1. In **Invite user**, type the person's **Email**.
2. Choose a **Role**. The list has every role, by name, including the ones your company created.
3. Click **Create invitation**.

The person receives an e-mail with a link to join (in the language you are using). The link is also shown on the page, with a **Copy** button, so you can send it another way, for example by WhatsApp. It expires in 7 days.

When they open the link, they either sign in, if they already have an account with that e-mail address, or create their account, and then click **Accept invitation**. They appear in the list straight away.

> The invitation only works for the e-mail address it was sent to. If the person is signed in with a different account, they are asked to sign out and sign in with the right one. An invitation can also be accepted by someone who already works for another company on this server: they then switch between companies from the top of the menu.

## On call

The **On call** button at the top of the page opens the on-call settings: who is in the on-call team and who is on call each week. See [On call](/help/on-call). It is shown to roles with the **Manage on call** permission.

## Pending invitations

The **Pending invitations** table shows each open invitation with its e-mail, role and when it expires. Click **Revoke** to cancel one, for example if it was sent to the wrong address. To send a fresh link, simply create a new invitation.

## Changing someone's role

Pick a new role in the drop-down in the person's row. Staff can't be turned into client users, or the other way round: invite them on the right page instead. The change is saved straight away and applies the next time they open a page. The role decides what they can see and do (see [Roles](/help/roles)) and, for staff, the **Price per hour** charged for their time on jobs.

> Only people whose role can carry out work orders can be assigned work orders. If someone is missing from the assignee list, check their role.

## Deactivating and erasing

When someone leaves, click **Deactivate** in their row. They can no longer open this company, but everything they did stays: work orders, time entries, comments and signatures keep their name. **Reactivate** gives the access back.

Once a person is deactivated, an **Erase data** button appears. It removes their name, e-mail, phone, password and notifications for good, so they can no longer sign in. Their jobs and time stay, under "Former user". Use it when someone asks for their personal data to be deleted.

> Erasing can't be undone. If the person also belongs to another company on this server, their account can't be erased from here: deactivating them removes their access to your company.

## Changing someone's name

Click the pencil next to a person's name, type the new name and click the tick (or press Enter; Esc cancels). The account is the person's own, so the new name also shows in any other company they belong to. Erased people can't be renamed, and only the Super Admin can rename the Super Admin. Each change is kept in the [Audit log](/help/audit). People change their own name in [My profile](/help/profile).

## What you can't change

- The Super Admin's row has no controls: the Super Admin's role can't be changed and they can't be deactivated.
- You can't change your own role or deactivate yourself, so a company can never be left without someone to manage it.
- Erased people stay in the list, marked **Erased**, with no controls.

## Who can access it

Roles with the **Users and roles** permission, by default the Super Admin and Administrators. To group technicians by specialty, use [Teams](/help/teams).
`,
  pt: `# Colaboradores

Convide as pessoas da sua empresa, e observadores, escolha a função de cada uma e desative-as ou apague os seus dados quando saírem. A equipa de prevenção também se gere a partir daqui.

## Para que serve esta página

**Colaboradores** (em **Definições** no menu) mostra as pessoas da sua empresa e os observadores que podem entrar. Os utilizadores do portal do cliente (proprietários de vilas e property managers) têm a sua própria página, [Clientes](/help/client-users). Aqui convida novas pessoas, decide o que cada uma pode fazer atribuindo-lhe uma função e retira o acesso quando alguém sai.

![A página Colaboradores: o formulário de convite no topo e a lista de pessoas por baixo](users-page)

A página tem três partes:

- **Convidar utilizador**: o formulário para novos convites.
- **A lista de pessoas**, com o **Nome** e e-mail, a **Função** (e **Equipa de prevenção** quando fazem parte dela), o **Preço por hora**, o **Estado** e as **Ações**.
- **Convites pendentes**: convites ainda não aceites, só aparece quando existem.

## Convidar uma pessoa

1. Em **Convidar utilizador**, escreva o **Email** da pessoa.
2. Escolha uma **Função**. A lista tem todas as funções, por nome, incluindo as criadas pela sua empresa.
3. Clique em **Criar convite**.

A pessoa recebe um e-mail com uma ligação para entrar (no idioma que está a usar). A ligação também aparece na página, com um botão **Copiar**, para a poder enviar de outra forma, por exemplo por WhatsApp. Expira dentro de 7 dias.

Ao abrir a ligação, a pessoa inicia sessão, se já tiver uma conta com esse endereço de e-mail, ou cria a sua conta, e depois clica em **Aceitar convite**. Passa logo a aparecer na lista.

> O convite só funciona para o endereço de e-mail para onde foi enviado. Se a pessoa tiver sessão iniciada com outra conta, é-lhe pedido que termine a sessão e entre com a conta certa. Um convite também pode ser aceite por alguém que já trabalha para outra empresa neste servidor: passa a mudar de empresa no topo do menu.

## Prevenção

O botão **Prevenção** no topo da página abre a escala de prevenção: quem faz parte da equipa de prevenção e quem está de prevenção em cada semana. Veja [Prevenção](/help/on-call). Aparece às funções com a permissão **Gerir prevenção**.

## Convites pendentes

A tabela **Convites pendentes** mostra cada convite em aberto, com o e-mail, a função e quando expira. Clique em **Revogar** para cancelar um convite, por exemplo se foi enviado para o endereço errado. Para enviar uma nova ligação, basta criar um novo convite.

## Mudar a função de uma pessoa

Escolha a nova função na lista na linha da pessoa. Um colaborador não pode passar a utilizador cliente, nem o contrário: convide-o na página certa. A alteração fica guardada de imediato e aplica-se na próxima página que a pessoa abrir. A função decide o que a pessoa pode ver e fazer (veja [Funções](/help/roles)) e, para os colaboradores, o **Preço por hora** cobrado pelo tempo registado nos trabalhos.

> Só as pessoas cuja função pode executar ordens de trabalho podem ter ordens de trabalho atribuídas. Se alguém não aparece na lista de responsáveis, verifique a sua função.

## Desativar e apagar dados

Quando alguém sai, clique em **Desativar** na sua linha. A pessoa deixa de poder abrir esta empresa, mas tudo o que fez fica: ordens de trabalho, registos de tempo, comentários e assinaturas mantêm o seu nome. **Reativar** devolve-lhe o acesso.

Depois de a pessoa estar desativada, aparece o botão **Apagar dados**. Remove definitivamente o nome, e-mail, telefone, palavra-passe e notificações, e a pessoa deixa de poder iniciar sessão. Os trabalhos e o tempo ficam, como "Antigo utilizador". Use-o quando alguém pede que os seus dados pessoais sejam apagados.

> Apagar os dados não pode ser desfeito. Se a pessoa pertencer também a outra empresa neste servidor, a conta não pode ser apagada aqui: desativá-la remove o acesso à sua empresa.

## Mudar o nome de uma pessoa

Clique no lápis junto ao nome da pessoa, escreva o novo nome e clique no visto (ou prima Enter; Esc cancela). A conta é da própria pessoa, por isso o novo nome aparece também noutras empresas a que ela pertença. Não é possível mudar o nome de pessoas cujos dados foram apagados, e só o Super Admin pode mudar o nome do Super Admin. Cada alteração fica no [Registo de auditoria](/help/audit). Cada pessoa muda o seu próprio nome em [O meu perfil](/help/profile).

## O que não pode alterar

- A linha do Super Admin não tem controlos: a função do Super Admin não pode ser alterada e não pode ser desativado.
- Não pode mudar a sua própria função nem desativar-se a si mesmo, para que a empresa nunca fique sem ninguém para a gerir.
- As pessoas com dados apagados ficam na lista, marcadas como **Apagado**, sem controlos.

## Quem pode aceder

As funções com a permissão **Utilizadores e funções**, por defeito o Super Admin e os Administradores. Para agrupar técnicos por especialidade, use as [Equipas](/help/teams).
`,
};

export default text;
