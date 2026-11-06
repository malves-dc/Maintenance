import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [
  { name: "roles-list", path: "/settings/roles", selector: "main .max-w-5xl > :first-child", maxHeight: 900 },
  { name: "roles-permissions", path: "/settings/roles/TECHNICIAN/permissions", selector: "main .max-w-3xl", maxHeight: 1100 },
];

const text: HelpText = {
  en: `# Roles

What each role can do and what an hour of its time is charged at. There is one list of roles: the ones the program comes with and the ones you create work the same way.

## What this page is for

Everyone in the company has a role. The role decides two things:

- **What the person can see and do**: which menus they get, which buttons appear, what they may change.
- **What their time is charged at**: the price per hour billed to the client for the time they log on work orders.

**Roles** (under **Settings** in the menu) lists every role, by name. Roles are given to people in [Users](/help/users).

## The roles

![Every role with its people, permissions and price per hour](roles-list)

Each row shows how many people have the role, a **Permissions** button with how many permissions it has, and its **Price per hour**. The program comes with:

- **Super Admin**: everything, always. The only role that can change what the others may do. It can't be given to anyone from Users: it is usually the person who created the company.
- **Administrator**: by default everything except billing: settings, users, approvals.
- **Manager**: by default plans and assigns work, manages clients, stock and purchasing.
- **Technician**: by default does the work: work orders, checklists, time, parts.
- **Viewer**: by default an observer: sees everything, changes nothing.
- **Accountant**: by default reports, amounts and billing, including marking work orders as invoiced; no field work.
- **Client (requester)**: the client portal only: their villas and requests.

A new company also starts with **Designer**, **Electrician**, **Engineer**, **Helper** and **Integrator**. Rename them, delete them or add your own: they work like any other role.

## Prices per hour

1. Type the **Price per hour** of each role, in the company's currency.
2. Click **Save**.

Leave a price empty if you don't charge for that role's time. A role you created without a price is charged at the Technician's price. Viewer, Accountant and Client (requester) show **Not charged (doesn't log time)**: they don't record time on jobs.

## Creating, renaming and deleting roles

To create one:

1. Under **New role**, type a **Name** (for example Programmer).
2. Type its **Price per hour**, or leave it empty.
3. Click **Create**.

A new role starts with the Technician's permissions; change them from its **Permissions** button. To rename a role you created, edit its name in the list and click **Save**. **Delete** removes it; the people in it become Technicians again.

To give someone a role, pick it in their row in [Users](/help/users).

## The role on a work order

Each person on a work order can take a different role on that job: for example, a technician who only helps on a security job takes **Helper**. They pick it next to their name under **Assigned to** on the work order; managers can set it for anyone. The choices are Technician and every role the company created; Super Admin, Administrator, Manager, Accountant, Viewer and Client can't be taken on a job. See [Work orders](/help/work-orders).

## How role prices become labour

When someone logs time on a work order, the app stores the time together with a price per hour:

- the price of the role they took on that work order, if they picked one;
- otherwise the price of their own role.

Changing your role on an open work order also recharges the time you already logged on it at the new role's price.

Labour is the billed time multiplied by that stored price. Billed time is each technician's time on the work order, day by day, rounded up to the company's blocks (30 minutes by default, see [Organization](/help/organization)), so 34 minutes in a day at 40 per hour bill 40. It appears in a work order's amounts to bill, in requests and in the billing report (see [Reports](/help/reports)), for people allowed to **See amounts**.

> Price changes on this page only apply to time logged from now on. Time already recorded keeps the price it was logged with, so changing a price never rewrites past amounts. The same is true when you move a person to another role in Users.

## Permissions

**Permissions** opens the role's own page: one checkbox per permission, grouped into **Administration**, **Work**, **Clients, villas and assets**, **Stock and purchasing**, **Reports** and **Finance**, each with a short explanation.

![The permissions of one role](roles-permissions)

Super Admin (everything) and Client (requester) are fixed. To change what any other role may do (Super Admin only), tick or untick the boxes and click **Save**. Changes apply straight away to everyone in the role. A role whose permissions differ from its defaults shows a badge, and a button to put them back.

> Be careful with the Administration permissions. **Company settings** gives access to the company profile and, with the server password, to the server. **Users and roles** lets a person invite people and change roles. **See access codes** shows villa codes and device passwords, and every view is logged.

## Who can access it

Roles with the **Users and roles** permission (by default the Super Admin and Administrators) can open this page, set prices per hour and create, rename and delete roles. Only the Super Admin can change permissions; everyone else sees them read-only, with the note **Only the Super Admin can change permissions.** Permission changes are recorded in the security log.
`,
  pt: `# Funções

O que cada função pode fazer e a que preço é cobrada uma hora do seu tempo. Há uma só lista de funções: as que vêm com o programa e as que criar funcionam da mesma forma.

## Para que serve esta página

Cada pessoa na empresa tem uma função. A função decide duas coisas:

- **O que a pessoa pode ver e fazer**: que menus tem, que botões aparecem, o que pode alterar.
- **A que preço é cobrado o seu tempo**: o preço por hora faturado ao cliente pelo tempo que regista nas ordens de trabalho.

**Funções** (em **Definições** no menu) mostra todas as funções, por nome. As funções são atribuídas às pessoas em [Utilizadores](/help/users).

## As funções

![Todas as funções com as pessoas, as permissões e o preço por hora](roles-list)

Cada linha mostra quantas pessoas têm a função, um botão **Permissões** com quantas permissões tem, e o seu **Preço por hora**. O programa vem com:

- **Super Admin**: tudo, sempre. A única função que pode alterar o que as outras podem fazer. Não pode ser atribuída a ninguém em Utilizadores: normalmente é a pessoa que criou a empresa.
- **Administrador**: por defeito, tudo exceto a faturação: definições, utilizadores, aprovações.
- **Gestor**: por defeito, planeia e atribui trabalho, gere clientes, stock e compras.
- **Técnico**: por defeito, executa o trabalho: ordens de trabalho, listas de verificação, tempo, peças.
- **Observador**: por defeito, observação: vê tudo, não altera nada.
- **Contabilista**: por defeito, relatórios, valores e faturação, incluindo marcar ordens de trabalho como faturadas; sem trabalho de campo.
- **Cliente (requerente)**: apenas o portal do cliente: as suas moradias e pedidos.

Uma empresa nova começa também com **Designer**, **Electrician**, **Engineer**, **Helper** e **Integrator**. Mude-lhes o nome, elimine-as ou acrescente as suas: funcionam como qualquer outra função.

## Preços por hora

1. Escreva o **Preço por hora** de cada função, na moeda da empresa.
2. Clique em **Guardar**.

Deixe o preço vazio se não cobra o tempo dessa função. Uma função criada sem preço é cobrada ao preço de Técnico. Observador, Contabilista e Cliente (requerente) mostram **Não cobrado (não regista tempo)**: não registam tempo nos trabalhos.

## Criar, mudar o nome e eliminar funções

Para criar uma:

1. Em **Nova função**, escreva um **Nome** (por exemplo Programador).
2. Escreva o **Preço por hora**, ou deixe-o vazio.
3. Clique em **Criar**.

Uma função nova começa com as permissões de Técnico; altere-as no botão **Permissões**. Para mudar o nome de uma função criada, edite-o na lista e clique em **Guardar**. **Eliminar** remove-a; as pessoas que a tinham voltam a ser Técnicos.

Para dar uma função a alguém, escolha-a na linha da pessoa em [Utilizadores](/help/users).

## A função numa ordem de trabalho

Cada pessoa numa ordem de trabalho pode ter uma função diferente nesse trabalho: por exemplo, um técnico que só ajuda num trabalho de segurança escolhe **Helper**. Escolhe-a junto ao seu nome em **Atribuída a**, na ordem de trabalho; os gestores podem defini-la para qualquer pessoa. As opções são Técnico e todas as funções criadas pela empresa; Super Admin, Administrador, Gestor, Contabilista, Observador e Cliente não podem ser escolhidas num trabalho. Veja [Ordens de trabalho](/help/work-orders).

## Como os preços das funções se tornam mão de obra

Quando alguém regista tempo numa ordem de trabalho, a aplicação guarda o tempo juntamente com um preço por hora:

- o preço da função que a pessoa escolheu nessa ordem de trabalho, se escolheu uma;
- caso contrário, o preço da sua própria função.

Mudar de função numa ordem de trabalho em aberto também volta a cobrar o tempo já registado nela ao preço da nova função.

A mão de obra é o tempo faturado multiplicado por esse preço guardado. O tempo faturado é o tempo de cada técnico na ordem de trabalho, dia a dia, arredondado para cima aos blocos da empresa (30 minutos por defeito, veja [Empresa](/help/organization)), por isso 34 minutos num dia a 40 por hora faturam 40. Aparece nos valores a faturar da ordem de trabalho, nos pedidos e no relatório de faturação (veja [Relatórios](/help/reports)), para quem tem permissão para **Ver valores**.

> As alterações de preço nesta página só se aplicam ao tempo registado a partir de agora. O tempo já registado mantém o preço com que foi registado, por isso mudar um preço nunca altera valores passados. O mesmo acontece quando muda uma pessoa de função em Utilizadores.

## Permissões

**Permissões** abre a página da função: uma caixa por permissão, agrupadas em **Administração**, **Trabalho**, **Clientes, moradias e ativos**, **Stock e compras**, **Relatórios** e **Finanças**, cada uma com uma breve explicação.

![As permissões de uma função](roles-permissions)

Super Admin (tudo) e Cliente (requerente) são fixas. Para alterar o que qualquer outra função pode fazer (só o Super Admin), marque ou desmarque as caixas e clique em **Guardar**. As alterações aplicam-se de imediato a todas as pessoas da função. Uma função cujas permissões diferem das predefinidas mostra uma etiqueta, e um botão para as repor.

> Tenha cuidado com as permissões de Administração. **Definições da empresa** dá acesso ao perfil da empresa e, com a palavra-passe do servidor, ao servidor. **Utilizadores e funções** permite convidar pessoas e mudar funções. **Ver códigos de acesso** mostra os códigos das moradias e as palavras-passe dos equipamentos, e cada consulta fica registada.

## Quem pode aceder

As funções com a permissão **Utilizadores e funções** (por defeito o Super Admin e os Administradores) podem abrir esta página, definir os preços por hora e criar, mudar o nome e eliminar funções. Só o Super Admin pode alterar as permissões; os restantes veem-nas apenas para consulta, com a nota **Só o Super Admin pode alterar as permissões.** As alterações de permissões ficam no registo de segurança.
`,
};

export default text;
