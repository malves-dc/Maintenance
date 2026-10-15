import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [
  { name: "villas-list", path: "/villas", maxHeight: 420 },
  { name: "villas-detail", path: "/villas", open: "Villa Quinta do Lago 7", maxHeight: 1300 },
];

const text: HelpText = {
  en: `# Villas

Every property you maintain: who owns and manages it, how to get there and in, how it is divided into floors and rooms, and what equipment is installed. Work orders, requests and preventive plans all point to a villa.

## The villas list

**Villas** in the menu lists the active villas with their code, **Owner** (and "Managed by…" when a property manager is set), **City**, number of **Assets** and **Open WOs** (work orders that are open, in progress or on hold). Search by name, code, city or address, filter by client (this shows the villas the client owns or manages) and switch between **Active** and **Archived**.

![The villas list with owner, city, assets and open work orders](villas-list)

## Adding a villa

A villa always belongs to a client, so [create the client](/help/clients) first.

1. Click **New villa** (or **New villa** on the client page, which fills in the owner).
2. Choose the **Owner** and/or the **Property manager / company**: a villa can have only an owner, only a managing company, or both, but at least one. The manager can't be the owner itself.
3. When the villa has both, choose in **Bill to** who the work is billed to: the owner or the manager. With only one of them, that one is billed.
4. Fill in the **Name** and a short **Code**, such as VQL-07. The code is printed on the QR labels, so keep it short.
5. Add the **Address**, **City**, **Country** and, for exact navigation, the **Latitude** and **Longitude**.
6. Use **Access notes** for parking, working hours, pets and similar practical details.
7. Click **Create**.

> Never type alarm codes, gate codes or passwords in the access notes. Access notes are plain text, shown to every colleague and copied to the technicians' phones for offline use. Codes go in the encrypted **Access codes** field instead.

## Owner and property manager

The **Owner** is the client the villa belongs to. The **Property manager / company** is a client (usually of the type **Property manager**) that looks after the villa. A villa has one of them or both. This matters in three places:

- **Client portal**: the owner's portal users see only the owner's own villas; the manager's portal users see every villa it manages, and can request work there.
- **Service contracts**: a contract of either the owner or the manager can cover the villa. Changing the owner or the manager re-checks which contract the villa's work orders fall under. See [Service contracts](/help/contracts).
- **Billing**: the client in **Bill to** is the one shown as client on the work orders, the service reports and the cost reports, and the service reports are e-mailed to it.

## The villa page

![A villa page: installed systems, work orders, floors and rooms, and the details, access notes and access codes on the right](villas-detail)

- **Needs attention**: shown only when an asset is **Down** or **Degraded**.
- **Installed systems**: the villa's equipment grouped by system, with a link to each asset. **View all** opens the full asset list for the villa, and **Print QR labels** prints a label for every asset in it.
- **Work orders**: the latest jobs at the villa, with a button to create a new one.
- **Floors & rooms**: the villa's areas (see below).
- On the right: the owner and manager, the address with **Open in Maps**, the client's main contacts, the **Access notes** and the **Access codes**.

## Access codes

**Access codes** holds the sensitive information about the villa: alarm and gate codes, key safe combinations, Wi-Fi passwords and so on. It is stored encrypted and shown masked.

1. To read it, click **Reveal**. Click **Hide** when you're done.
2. To change it, click **Edit**, type the text and click **Save**. Clearing the text removes the codes.

Every reveal is recorded in the audit log with your name and the time, and so is every change. Opening **Edit** on a villa that already has codes also counts as a reveal.

> Only reveal codes when you need them. The audit log shows the company exactly who looked at which villa's codes, and when.

## Floors and rooms

Areas let you say exactly where equipment is. Each area has a name and a kind: **Floor**, **Room**, **Zone**, **Outdoor** or **Technical room**. Areas can be nested, for example a Cinema room inside the Ground floor.

1. In **Floors & rooms**, type the name (for example "Cinema room").
2. Choose the kind and, to nest it, the parent area; leave **Top level** for a floor or an outside zone.
3. Click **Add**.

Hover over an area to rename it (pencil) or delete it (bin). Deleting an area also deletes its sub-areas; the assets in them are kept, without an area.

## QR labels and requests from the villa

The QR labels belong to the assets, not to the villa itself. Print them for the whole villa with **Print QR labels**, and stick each one on its equipment. When someone scans a label:

- A colleague who is signed in goes straight to the asset page.
- A client portal user goes to a new request, already filled in with the asset.
- Anyone else (house staff, guests) sees a short form: what the problem is, details, urgency, up to three photos, their name and a phone or e-mail. It only shows the asset and your company's name, nothing else about the villa.

The form creates a request at that villa and asset for your team to review. To prevent abuse, each label accepts at most 5 anonymous requests per hour. See [Requests](/help/requests) and [Assets](/help/assets).

## Archiving

**Archive** hides a villa from the lists and pick lists, keeping its history; **Restore** brings it back.

## Who can do what

- Everyone in the company can see villas, their areas and access notes.
- **Super Admin**, **Administrator** and **Manager** can create, edit and archive villas and edit the access codes (permission **Clients and villas**).
- **Technicians** can add, rename and delete floors and rooms (permission **Assets**).
- Revealing access codes needs **See access codes**: by default the Super Admin, Administrator, Manager and Technician. The Viewer and Accountant see that codes exist, but not what they are.
`,
  pt: `# Moradias

Todas as propriedades que mantém: quem é o dono e quem a gere, como lá chegar e entrar, como se divide em pisos e divisões, e que equipamentos tem instalados. Ordens de trabalho, pedidos e planos preventivos apontam todos para uma moradia.

## A lista de moradias

**Moradias** no menu mostra as moradias ativas com o código, **Proprietário** (e "Gerida por…" quando há um gestor de propriedades), **Localidade**, número de **Equipamentos** e **OTs abertas** (ordens de trabalho abertas, em curso ou em espera). Pesquise pelo nome, código, localidade ou morada, filtre por cliente (mostra as moradias que o cliente possui ou gere) e alterne entre **Ativo** e **Arquivado**.

![A lista de moradias com proprietário, localidade, equipamentos e ordens de trabalho abertas](villas-list)

## Adicionar uma moradia

Uma moradia pertence sempre a um cliente, por isso [crie primeiro o cliente](/help/clients).

1. Clique em **Nova moradia** (ou em **Nova moradia** na página do cliente, que preenche o proprietário).
2. Escolha o **Proprietário** e/ou a **Gestão da propriedade / empresa**: uma moradia pode ter só proprietário, só uma empresa de gestão, ou ambos, mas pelo menos um. O gestor não pode ser o próprio proprietário.
3. Quando a moradia tem ambos, escolha em **Faturar a** a quem se fatura o trabalho: ao proprietário ou à gestão. Com só um deles, fatura-se a esse.
4. Preencha o **Nome** e um **Código** curto, como VQL-07. O código é impresso nas etiquetas QR, por isso mantenha-o curto.
5. Acrescente a **Morada**, **Localidade**, **País** e, para uma navegação exata, a **Latitude** e a **Longitude**.
6. Use as **Notas de acesso** para estacionamento, horários, animais e outros detalhes práticos.
7. Clique em **Criar**.

> Nunca escreva códigos de alarme, códigos de portão ou palavras-passe nas notas de acesso. As notas de acesso são texto simples, visível para todos os colegas e copiado para os telemóveis dos técnicos para uso offline. Os códigos vão para o campo encriptado **Códigos de acesso**.

## Proprietário e gestor da propriedade

O **Proprietário** é o cliente a quem a moradia pertence. A **Gestão da propriedade / empresa** é um cliente (normalmente do tipo **Gestor de propriedades**) que cuida da moradia. Uma moradia tem um deles ou ambos. Isto conta em três sítios:

- **Portal do cliente**: os utilizadores do portal do proprietário só veem as moradias do próprio proprietário; os utilizadores do portal do gestor veem todas as moradias que ele gere e podem pedir trabalhos nelas.
- **Contratos de manutenção**: um contrato do proprietário ou do gestor pode abranger a moradia. Mudar o proprietário ou o gestor volta a verificar a que contrato pertencem as ordens de trabalho da moradia. Veja [Contratos de manutenção](/help/contracts).
- **Faturação**: o cliente em **Faturar a** é o que aparece como cliente nas ordens de trabalho, nos relatórios de serviço e nos relatórios de custos, e é a ele que se enviam os relatórios de serviço por e-mail.

## A página da moradia

![A página de uma moradia: sistemas instalados, ordens de trabalho, pisos e divisões, e à direita os dados, notas de acesso e códigos de acesso](villas-detail)

- **Requer atenção**: só aparece quando um equipamento está **Avariado** ou **Degradado**.
- **Sistemas instalados**: os equipamentos da moradia agrupados por sistema, com ligação a cada um. **Ver tudo** abre a lista completa de equipamentos da moradia e **Imprimir etiquetas QR** imprime uma etiqueta para cada equipamento.
- **Ordens de trabalho**: os últimos trabalhos na moradia, com um botão para criar um novo.
- **Pisos e divisões**: as áreas da moradia (ver abaixo).
- À direita: o proprietário e o gestor, a morada com **Abrir no Maps**, os contactos principais do cliente, as **Notas de acesso** e os **Códigos de acesso**.

## Códigos de acesso

Os **Códigos de acesso** guardam a informação sensível da moradia: códigos de alarme e de portão, combinações de cofres de chaves, palavras-passe do Wi-Fi, etc. Ficam guardados de forma encriptada e aparecem ocultos.

1. Para os ler, clique em **Mostrar**. Clique em **Ocultar** quando terminar.
2. Para os alterar, clique em **Editar**, escreva o texto e clique em **Guardar**. Apagar o texto remove os códigos.

Cada visualização fica registada no registo de auditoria com o seu nome e a hora, tal como cada alteração. Abrir **Editar** numa moradia que já tem códigos também conta como visualização.

> Só mostre os códigos quando precisar deles. O registo de auditoria indica à empresa exatamente quem viu os códigos de cada moradia, e quando.

## Pisos e divisões

As áreas permitem dizer exatamente onde está cada equipamento. Cada área tem um nome e um tipo: **Piso**, **Divisão**, **Zona**, **Exterior** ou **Sala técnica**. As áreas podem estar umas dentro das outras, por exemplo uma Sala de cinema dentro do Rés-do-chão.

1. Em **Pisos e divisões**, escreva o nome (por exemplo "Sala de cinema").
2. Escolha o tipo e, para a colocar dentro de outra, a área pai; deixe **Nível superior** para um piso ou uma zona exterior.
3. Clique em **Adicionar**.

Passe o rato sobre uma área para lhe mudar o nome (lápis) ou a eliminar (caixote). Eliminar uma área elimina também as suas subáreas; os equipamentos nelas são mantidos, mas ficam sem área.

## Etiquetas QR e pedidos a partir da moradia

As etiquetas QR pertencem aos equipamentos, não à moradia em si. Imprima-as para toda a moradia com **Imprimir etiquetas QR** e cole cada uma no respetivo equipamento. Quando alguém digitaliza uma etiqueta:

- Um colega com sessão iniciada vai diretamente para a página do equipamento.
- Um utilizador do portal do cliente vai para um novo pedido, já preenchido com o equipamento.
- Qualquer outra pessoa (pessoal da casa, hóspedes) vê um formulário curto: qual é o problema, detalhes, urgência, até três fotografias, o nome e um telefone ou email. Só mostra o equipamento e o nome da sua empresa, nada mais sobre a moradia.

O formulário cria um pedido nessa moradia e equipamento para a sua equipa analisar. Para evitar abusos, cada etiqueta aceita no máximo 5 pedidos anónimos por hora. Veja [Pedidos](/help/requests) e [Equipamentos](/help/assets).

## Arquivar

**Arquivar** esconde uma moradia das listas e das escolhas, mantendo o histórico; **Restaurar** volta a mostrá-la.

## Quem pode fazer o quê

- Todas as pessoas da empresa podem ver as moradias, as suas áreas e as notas de acesso.
- **Super Admin**, **Administrador** e **Gestor** podem criar, editar e arquivar moradias e editar os códigos de acesso (permissão **Clientes e moradias**).
- Os **Técnicos** podem acrescentar, mudar o nome e eliminar pisos e divisões (permissão **Ativos**).
- Mostrar os códigos de acesso exige **Ver códigos de acesso**: por defeito, o Super Admin, Administrador, Gestor e Técnico. O Observador e o Contabilista veem que existem códigos, mas não o seu conteúdo.
`,
};

export default text;
