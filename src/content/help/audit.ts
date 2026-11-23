import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [{ name: "audit-log", path: "/settings/audit", maxHeight: 760 }];

const text: HelpText = {
  en: `# Audit log

A record of who did what in the company, when and from which address: sign-ins, changes to records with their old and new values, permission changes and server operations.

## What it's for

The **Audit log** (Settings → Audit log) answers questions such as "who changed this work order's priority?", "who looked at this villa's access codes?" or "who deleted that asset?". Entries are written automatically; nobody can edit or delete them from the app.

It records two kinds of events:

- **Automatic changes**: every time someone creates, changes or deletes a client, villa, area, asset, contract, procedure, category, work order, request, preventive maintenance schedule, meter, part, stock location, vendor, purchase order, team, job role, membership or invitation. For photos and files, only deletions are recorded.
- **Specific events**: sign-ins and sign-outs (including failed and blocked attempts), password changes and reset links, two-factor sign-in (turned on or off, new recovery codes, wrong codes, sign-ins with a recovery code, resets by an admin), changes to the company settings and logo, role prices and role permissions, views and changes of villa access codes and device credentials, data erasures and personal-data exports (people downloading their own data, client and requester exports, and exports of this log), stock moves and van restocks, service reports sent by e-mail, and the operations in Settings → Server (unlocking it, backups, restores, updates, e-mail settings, cloud folders and factory reset).

Stock movements, time entries, comments and notifications are not repeated here: they already keep their own history.

## What the list shows

![The audit log, newest entries first, with the filters at the top](audit-log)

The newest entries come first. Each row has:

- **When**: the date and time, to the second.
- **User**: who did it. **System** means it was done automatically, without a person; **Removed user** means the person's account no longer exists.
- **What**: a coloured badge with the category (**Security**, **Users & permissions**, **Records** or **Server**), the action (for example **Changed work order** or **Signed in**) and the name of the item. While a work order, request, client, villa, asset, part, vendor, purchase order, contract, preventive schedule or procedure still exists, its name is a link that opens it. Deleted items keep their name in the entry.
- **Address**: the IP address the action came from (on wide screens only).

When an entry has more to say, a line such as **3 details** appears under it. Click it to open the details:

- For a change, each field that changed is listed with its old value crossed out, an arrow and the new value, for example the status going from Open to In progress. Lists such as assignees or categories show the names before and after.
- When linked items were changed without the app knowing their previous value, they're listed under **Linked items**.
- For a permission change, each role is listed with the permissions added (+) and removed (−).

## Filtering and searching

1. Type in the search box to look for a person's name, an item's name or an address.
2. Narrow the list with the filters: **All categories**, **Everyone** (pick a person, or **System**), **All types** (work order, villa, asset…), and the **From** and **To** dates.
3. The dates are whole days in the company's time zone, and both are included.

The filters are part of the page address, so you can bookmark or share a filtered view with someone who also has access to the log.

## Exporting CSV

The **CSV** button at the top (**Export CSV**) downloads the entries that match the current search and filters, newest first, up to 50,000 rows. The file has the columns **When**, **User** (name and e-mail), **Category**, **What**, **Type**, **Item**, **Details** and **Address**, so it opens directly in a spreadsheet. The button only appears when there is something to export. The file holds names, e-mails and addresses, so each export is itself recorded in the log.

## How long entries are kept

Entries are kept for the period set in [Settings → Organization](/help/organization), under **Data retention** → **Security log (months)**. The default is 24 months; once a day, older entries are deleted. 0 keeps them forever.

> Choose a period that matches your obligations: a longer one helps with investigations, a shorter one keeps less personal data (names and addresses) about your staff.

## Privacy and security

> Passwords, access codes, device credentials and tokens are never written to the log. A change to one of them shows **(hidden)** instead of the value, so the log can be shared without revealing secrets.

> Every reveal of a villa's access codes or an asset's device credentials is logged with the person and time. See [Villas](/help/villas) and [Assets](/help/assets).

> The log contains names and IP addresses of your staff. Give access to it only to the people who need it.

## Who can see it

The **Audit log** permission is given to the **Super Admin** and the **Administrator** by default. The Super Admin can give it to other roles, or take it away from the Administrator, in [Settings → Roles](/help/roles). Without it, the menu entry doesn't appear. Each company only sees its own log. See also [Users](/help/users) and [Server](/help/server).
`,
  pt: `# Registo de auditoria

Um registo de quem fez o quê na empresa, quando e a partir de que endereço: inícios de sessão, alterações aos registos com os valores antigos e novos, alterações de permissões e operações do servidor.

## Para que serve

O **Registo de auditoria** (Definições → Registo de auditoria) responde a perguntas como "quem alterou a prioridade desta ordem de trabalho?", "quem viu os códigos de acesso desta moradia?" ou "quem eliminou aquele equipamento?". As entradas são escritas automaticamente; ninguém as pode editar ou apagar na aplicação.

Regista dois tipos de eventos:

- **Alterações automáticas**: sempre que alguém cria, altera ou elimina um cliente, moradia, zona, equipamento, contrato, procedimento, categoria, ordem de trabalho, pedido, plano de manutenção preventiva, contador, peça, local de stock, fornecedor, encomenda, equipa, função, membro ou convite. Nas fotografias e ficheiros, só ficam registadas as eliminações.
- **Eventos específicos**: inícios e fins de sessão (incluindo tentativas falhadas e bloqueadas), alterações de palavra-passe e links de reposição, autenticação de dois fatores (ativada ou desativada, novos códigos de recuperação, códigos errados, entradas com código de recuperação, reposições por um administrador), alterações às definições e ao logótipo da empresa, aos preços e às permissões das funções, visualizações e alterações dos códigos de acesso das moradias e das credenciais dos equipamentos, apagamento de dados e exportações de dados pessoais (pessoas que descarregam os seus dados, exportações de clientes e de quem fez pedidos, e exportações deste registo), movimentos de stock e reposições de carrinhas, relatórios de serviço enviados por email, e as operações em Definições → Servidor (desbloqueio, backups, restauros, atualizações, definições de email, pastas na cloud e reposição de fábrica).

Os movimentos de stock, registos de tempo, comentários e notificações não se repetem aqui: já guardam o seu próprio histórico.

## O que a lista mostra

![O registo de auditoria, com as entradas mais recentes primeiro e os filtros no topo](audit-log)

As entradas mais recentes aparecem primeiro. Cada linha tem:

- **Quando**: a data e a hora, ao segundo.
- **Utilizador**: quem o fez. **Sistema** significa que foi feito automaticamente, sem uma pessoa; **Utilizador removido** significa que a conta da pessoa já não existe.
- **O quê**: uma etiqueta colorida com a categoria (**Segurança**, **Utilizadores e permissões**, **Registos** ou **Servidor**), a ação (por exemplo **Alterou: ordem de trabalho** ou **Iniciou sessão**) e o nome do item. Enquanto uma ordem de trabalho, pedido, cliente, moradia, equipamento, peça, fornecedor, encomenda, contrato, plano preventivo ou procedimento existir, o nome é um link que o abre. Os itens eliminados mantêm o nome na entrada.
- **Endereço**: o endereço IP de onde veio a ação (só em ecrãs largos).

Quando uma entrada tem mais informação, aparece por baixo uma linha como **3 detalhes**. Clique nela para abrir os detalhes:

- Numa alteração, cada campo alterado aparece com o valor antigo riscado, uma seta e o valor novo, por exemplo o estado a passar de Aberta para Em curso. Listas como os responsáveis ou as categorias mostram os nomes antes e depois.
- Quando foram alterados itens ligados sem que a aplicação saiba o valor anterior, aparecem em **Itens ligados**.
- Numa alteração de permissões, cada função aparece com as permissões acrescentadas (+) e retiradas (−).

## Filtrar e pesquisar

1. Escreva na caixa de pesquisa para procurar o nome de uma pessoa, o nome de um item ou um endereço.
2. Restrinja a lista com os filtros: **Todas as categorias**, **Todos** (escolha uma pessoa, ou **Sistema**), **Todos os tipos** (ordem de trabalho, moradia, ativo…) e as datas **De** e **Até**.
3. As datas são dias completos no fuso horário da empresa, e ambas estão incluídas.

Os filtros fazem parte do endereço da página, por isso pode guardar ou partilhar uma vista filtrada com alguém que também tenha acesso ao registo.

## Exportar CSV

O botão **CSV** no topo (**Exportar CSV**) descarrega as entradas que correspondem à pesquisa e aos filtros atuais, das mais recentes para as mais antigas, até 50 000 linhas. O ficheiro tem as colunas **Quando**, **Utilizador** (nome e email), **Categoria**, **O quê**, **Tipo**, **Item**, **Detalhes** e **Endereço**, por isso abre diretamente numa folha de cálculo. O botão só aparece quando há algo para exportar. O ficheiro tem nomes, e-mails e endereços, por isso cada exportação fica também registada.

## Durante quanto tempo se guardam as entradas

As entradas são guardadas durante o período definido em [Definições → Organização](/help/organization), em **Conservação de dados** → **Registo de segurança (meses)**. Por defeito são 24 meses; uma vez por dia, as entradas mais antigas são apagadas. 0 guarda-as para sempre.

> Escolha um período que corresponda às suas obrigações: um mais longo ajuda nas investigações, um mais curto guarda menos dados pessoais (nomes e endereços) da sua equipa.

## Privacidade e segurança

> As palavras-passe, códigos de acesso, credenciais de equipamentos e tokens nunca são escritos no registo. Uma alteração a um deles mostra **(oculto)** em vez do valor, por isso o registo pode ser partilhado sem revelar segredos.

> Cada visualização dos códigos de acesso de uma moradia ou das credenciais de um equipamento fica registada com a pessoa e a hora. Veja [Moradias](/help/villas) e [Equipamentos](/help/assets).

> O registo contém nomes e endereços IP da sua equipa. Dê-lhe acesso apenas a quem precisa.

## Quem o pode ver

A permissão **Registo de auditoria** é dada por defeito ao **Super Admin** e ao **Administrador**. O Super Admin pode dá-la a outras funções, ou retirá-la ao Administrador, em [Definições → Funções](/help/roles). Sem ela, a entrada do menu não aparece. Cada empresa só vê o seu próprio registo. Veja também [Utilizadores](/help/users) e [Servidor](/help/server).
`,
};

export default text;
