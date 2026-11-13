import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [
  { name: "clients-list", path: "/clients", maxHeight: 460 },
  { name: "clients-detail", path: "/clients", open: "Whitmore Family Office", maxHeight: 820 },
];

const text: HelpText = {
  en: `# Clients

The people and companies you work for: villa owners, family offices and property managers. A client holds its villas, its contacts, its service contracts and the client users who can sign in to the portal.

## What clients are for

Every villa belongs to a client, so a client is the first thing to create. The client record keeps who to call, who receives the service reports and which maintenance contracts apply. There are three types:

- **Private owner**: a person or family who owns one or more villas.
- **Company**: a business that owns villas (or anything that isn't a private person).
- **Property manager**: a company that looks after villas on behalf of other owners. It can own villas too, but it is usually set as the manager of other clients' villas.

## The clients list

**Clients** in the menu lists every active client with its type, its primary contact and the number of villas it owns. Use the search box to find a client by name, e-mail or phone, and switch the filter from **Active** to **Archived** to see archived clients.

![The clients list with type, primary contact and number of villas](clients-list)

## Adding a client

1. Click **New client**.
2. Fill in the **Name** and choose the **Type**.
3. Add the **Email**, **Phone**, **Tax ID** and **Billing address** if you have them. Only the name is required.
4. In **Service report copies**, add any extra addresses that should be offered when a service report is e-mailed for this client (for example a family office), one per line.
5. Use **Notes** for anything the team should know about the client.
6. Click **Create**. You land on the client page, ready to add contacts and villas.

## The client page

The client page brings everything about the client together:

- **Villas**: the villas the client owns, with their code, location and number of assets. **New villa** creates a villa already linked to this client. See [Villas](/help/villas).
- **Villas managed**: only for clients that manage villas of other owners. Each villa shows its owner.
- **Service contracts**: the client's maintenance contracts with their status and response / resolution times. **New contract** starts one for this client. See [Service contracts](/help/contracts).
- **Contacts**: the people to talk to, on the right. The first contact you add becomes the **Primary** contact, shown in the clients list and on the villa pages.

![A client page: villas and contracts on the left, details and contacts on the right](clients-detail)

## Contacts and service reports

To add a contact, open **Add contact** under **Contacts**, fill in the **Name**, the **Role** (house manager, owner, estate office…), **Phone** and **Email**, and click **Add**. To change a contact, click the pencil next to it: you can edit the name, role, phone and e-mail, make it the **Primary contact** (the previous primary one stops being so) and choose whether it receives service reports; click **Save**. Remove a contact with the cross next to it.

When a work order is finished, its PDF service report can be e-mailed from the work order page. The addresses offered by default are the client's e-mail, the contacts marked to receive reports, the client's **Service report copies** and the company's own copies. For a contact with an e-mail address:

- Tick **Receives service reports** when you add the contact, or
- Click the small **Receives reports** / **No reports** button under the contact to switch it at any time.

> The person sending a report can still untick any address before sending, or type other addresses. See [Work orders](/help/work-orders).

## Portal access for client users

Clients can sign in to the client portal. It opens on their properties; each property has two buttons: **Report a problem** (a new request) and **Earlier requests** (what they asked for and the jobs shared with them, with the service report of each finished job). Portal users are invited from [Settings → Users](/help/users):

1. Click **Invite user** and type the person's e-mail.
2. Choose the role **Client (requester)**.
3. In **Client**, pick the client they belong to, and click **Create invitation**.

A portal user of an owner only ever sees that owner's villas. A portal user of a property manager sees every villa the company manages, across owners, and can request work on all of them. The manager is set on each villa (**Property manager / company**).

## Archiving and erasing a client

**Archive** hides the client from the lists and the pick lists; its villas, jobs and contracts stay. **Restore** brings it back.

If a former client asks to have their personal data removed, archive the client first. **Erase personal data** then removes the name, e-mail, phone, tax number, billing address, notes and all contacts for good; villas, jobs and contracts stay, under "Former client". This can't be undone, and it is refused while the client still has active portal users: deactivate and erase those users first.

## Who can do what

- Everyone in the company (all staff roles) can see clients, their contacts and their villas.
- **Super Admin**, **Administrator** and **Manager** can create, edit, archive and erase clients and manage their contacts and report settings (permission **Clients and villas**).
- Client portal users never see this area.
`,
  pt: `# Clientes

As pessoas e empresas para quem trabalha: proprietários de moradias, family offices e gestores de propriedades. Um cliente reúne as suas moradias, contactos, contratos de manutenção e os utilizadores que podem entrar no portal.

## Para que servem os clientes

Cada moradia pertence a um cliente, por isso o cliente é a primeira coisa a criar. A ficha do cliente guarda a quem ligar, quem recebe os relatórios de serviço e que contratos de manutenção se aplicam. Há três tipos:

- **Proprietário particular**: uma pessoa ou família dona de uma ou mais moradias.
- **Empresa**: uma empresa dona de moradias (ou qualquer entidade que não seja um particular).
- **Gestor de propriedades**: uma empresa que cuida de moradias em nome de outros proprietários. Também pode ter moradias próprias, mas normalmente é indicada como gestora das moradias de outros clientes.

## A lista de clientes

**Clientes** no menu mostra todos os clientes ativos com o tipo, o contacto principal e o número de moradias que possuem. Use a caixa de pesquisa para encontrar um cliente pelo nome, email ou telefone, e mude o filtro de **Ativo** para **Arquivado** para ver os clientes arquivados.

![A lista de clientes com tipo, contacto principal e número de moradias](clients-list)

## Adicionar um cliente

1. Clique em **Novo cliente**.
2. Preencha o **Nome** e escolha o **Tipo**.
3. Acrescente o **Email**, **Telefone**, **NIF** e **Morada de faturação** se os tiver. Só o nome é obrigatório.
4. Em **Cópias dos relatórios de serviço**, acrescente os endereços extra a sugerir quando se envia por email um relatório de serviço deste cliente (por exemplo, um family office), um por linha.
5. Use as **Notas** para o que a equipa deve saber sobre o cliente.
6. Clique em **Criar**. Fica na página do cliente, pronta para acrescentar contactos e moradias.

## A página do cliente

A página do cliente junta tudo o que lhe diz respeito:

- **Moradias**: as moradias do cliente, com código, localização e número de equipamentos. **Nova moradia** cria uma moradia já ligada a este cliente. Veja [Moradias](/help/villas).
- **Moradias geridas**: só para clientes que gerem moradias de outros proprietários. Cada moradia mostra o seu proprietário.
- **Contratos de manutenção**: os contratos do cliente com o estado e os tempos de resposta / resolução. **Novo contrato** cria um para este cliente. Veja [Contratos de manutenção](/help/contracts).
- **Contactos**: as pessoas com quem falar, à direita. O primeiro contacto que acrescentar passa a ser o contacto **Principal**, mostrado na lista de clientes e nas páginas das moradias.

![A página de um cliente: moradias e contratos à esquerda, dados e contactos à direita](clients-detail)

## Contactos e relatórios de serviço

Para acrescentar um contacto, abra **Adicionar contacto** em **Contactos**, preencha o **Nome**, a **Função** (governante, proprietário, gabinete…), **Telefone** e **Email**, e clique em **Adicionar**. Para alterar um contacto, clique no lápis ao lado: pode mudar o nome, a função, o telefone e o email, torná-lo o **Contacto principal** (o anterior deixa de o ser) e escolher se recebe relatórios de serviço; clique em **Guardar**. Remova um contacto com a cruz ao lado.

Quando uma ordem de trabalho termina, o relatório de serviço em PDF pode ser enviado por email a partir da página da ordem. Os endereços sugeridos por defeito são o email do cliente, os contactos marcados para receber relatórios, as **Cópias dos relatórios de serviço** do cliente e as cópias da própria empresa. Para um contacto com email:

- Marque **Recebe relatórios de serviço** ao acrescentar o contacto, ou
- Clique no pequeno botão **Recebe relatórios** / **Sem relatórios** por baixo do contacto para mudar a qualquer momento.

> Quem envia o relatório pode sempre desmarcar qualquer endereço antes de enviar, ou escrever outros. Veja [Ordens de trabalho](/help/work-orders).

## Acesso ao portal para utilizadores do cliente

Os clientes podem entrar no portal do cliente. O portal abre nas suas propriedades; cada propriedade tem dois botões: **Reportar um problema** (um pedido novo) e **Pedidos anteriores** (o que pediram e os trabalhos partilhados com eles, com o relatório de serviço de cada trabalho concluído). Os utilizadores do portal são convidados em [Definições → Utilizadores](/help/users):

1. Clique em **Convidar utilizador** e escreva o email da pessoa.
2. Escolha a função **Cliente (requerente)**.
3. Em **Cliente**, escolha o cliente a que a pessoa pertence e clique em **Criar convite**.

Um utilizador do portal de um proprietário só vê as moradias desse proprietário. Um utilizador do portal de um gestor de propriedades vê todas as moradias que a empresa gere, de vários proprietários, e pode pedir trabalhos em todas. O gestor é indicado em cada moradia (**Gestão da propriedade / empresa**).

## Arquivar e apagar um cliente

**Arquivar** esconde o cliente das listas e das escolhas; as suas moradias, trabalhos e contratos mantêm-se. **Restaurar** volta a mostrá-lo.

Se um antigo cliente pedir a remoção dos seus dados pessoais, arquive primeiro o cliente. **Apagar dados pessoais** remove então definitivamente o nome, email, telefone, NIF, morada de faturação, notas e todas as pessoas de contacto; as moradias, trabalhos e contratos ficam, como "Antigo cliente". Não é possível desfazer, e é recusado enquanto o cliente tiver utilizadores do portal ativos: desative e apague primeiro esses utilizadores.

## Quem pode fazer o quê

- Todas as pessoas da empresa (todas as funções internas) podem ver os clientes, os contactos e as moradias.
- **Super Admin**, **Administrador** e **Gestor** podem criar, editar, arquivar e apagar clientes e gerir os contactos e os envios de relatórios (permissão **Clientes e moradias**).
- Os utilizadores do portal do cliente nunca veem esta área.
`,
};

export default text;
