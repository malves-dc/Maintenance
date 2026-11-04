import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [{ name: "requests-list", path: "/requests?status=all" }];

const text: HelpText = {
  en: `# Requests

Problems reported by clients, from the client portal or by scanning a QR label on a piece of equipment. Here you review each request and either approve it into a work order or decline it.

## Where requests come from

Clients don't create work orders themselves: they send a request, and your team decides what to do with it.

- **Client portal**: a client with a portal account opens one of their properties, clicks **Report a problem**, picks the area and the equipment if they know it, describes the problem, says how urgent it is, can say **when the work can be done** (a period, optional) and can add up to 4 photos.
- **QR label**: every asset has a QR label (see [Assets](/help/assets)). Anyone who scans it with a phone gets a short form for that equipment, without needing an account; they leave their name and contact details. Clients who are signed in go to the portal form instead, already filled in with the equipment, and staff go to the asset's page.

When a request arrives, everyone who can approve requests gets a notification, and the number of pending requests appears next to **Requests** in the menu.

> Staff don't create requests: when you already know what needs doing, create a [work order](/help/work-orders) directly.

## The requests list

![The requests list with its tabs](requests-list)

The tabs at the top split requests by status, with a count on each:

- **Pending**: waiting for a decision. This is the tab that opens by default.
- **Approved**: turned into a work order.
- **Declined**: rejected, with the reason if one was given.
- **All**: every request, with its status shown under the title.

Each row shows the **Title** with the request number (**R12**), the system, the urgency and a camera icon with the number of photos; the client's availability (amber calendar) or, once confirmed, the visit date (green calendar); the **Location** (villa and asset); who it's **From** (with "via QR label" for requests sent from a label); and when it was **Received**.

Use the search box to find a word in the title or description, the requester's name or an R-number, and the villa filter to see one villa.

## Reviewing a request

Click a request to open it. You see:

- the description and the photos the client sent (click a photo to enlarge it);
- on the right, who sent it, with their phone and e-mail as links you can call or write to, and the villa, client, area and asset; and the **Client's availability**, when they gave one.

## Approving a request

1. Open a pending request.
2. In **Approve as work order**, check the **Title** and set the **Priority**, **Type**, **System** and **Due** date. The priority starts from what the client chose (or Medium).
   If the client gave a period, set the **Confirmed visit** date and time: the request can't be approved without it. Without a period it is optional.
3. Choose a **Team** and the people under **Assigned to**. Picking a team selects its members when nobody is assigned yet.
4. Click **Create work order**.

The app creates the work order and opens it. It takes the villa, area and asset from the request; the description gets the requester's name and contact details at the end; and the client's photos are attached to the work order. The people assigned are notified, and so is the client: in the portal, or by e-mail for requests sent from a QR label.

From then on the request shows **Approved as work order** with a link to the job and its current status, plus, for people who can see amounts, what the job has to bill so far.

> When the work order is marked done, the client is told, as long as the work order is visible to the client.

## The client's availability and the confirmed visit

When sending a request, the client can say **when the work can be done**: a period with a start and an end date and time (for example, "from Monday 9:00 until Wednesday 18:00"). It's optional; requests without one work as before.

When a request has a period:

- it shows in the list and on the request as the **Client's availability**;
- to approve it you must set the **Confirmed visit**, the date and time your team will go. It usually falls inside the period; if you agree another time with the client, the request warns that it's **outside the client's availability**;
- the confirmed visit becomes the work order's **start date**, and the work order shows both the availability and the confirmed visit.

The client is told (in the portal, or by e-mail for QR-label requests) and sees the confirmed date and time on the request and in the list of requests for the property.

To set a visit later, or move one, open the approved request and use **Confirm the visit** (or **Visit**). The client is told again. This works until the work order is done or cancelled. Moving the work order's start date in the work order itself doesn't change what the client sees.

## Declining a request

1. Open a pending request.
2. In **Decline**, write a reason if you want to. The reason is shown to the client.
3. Click **Decline request**.

The client is notified the same way as for an approval. A declined request can't be reopened; the client can always send a new one.

> If two people handle the same request at once, only the first decision counts; the second gets the message that the request has already been handled.

## Who can do what

- **Super Admin**, **Administrator** and **Manager**: see, approve and decline requests, and get notified of new ones.
- **Technician**, **Accountant** and **Viewer**: can see requests but not approve or decline them.
- **Whoever is on call** that week is also notified of every new request and can approve or decline the ones that arrived during their week, whatever their role. The request shows who was on call. See [On call](/help/on-call).
- **Clients** send requests and follow them in the client portal.
`,
  pt: `# Pedidos

Problemas reportados pelos clientes, a partir do portal do cliente ou ao digitalizar a etiqueta QR de um equipamento. Aqui analisa cada pedido e aprova-o como ordem de trabalho ou recusa-o.

## De onde vêm os pedidos

Os clientes não criam ordens de trabalho: enviam um pedido e a sua equipa decide o que fazer com ele.

- **Portal do cliente**: um cliente com conta no portal abre uma das suas propriedades, clica em **Reportar um problema**, escolhe a divisão e o equipamento, se souber, descreve o problema, indica a urgência, pode dizer **quando o trabalho pode ser feito** (um período, opcional) e pode juntar até 4 fotografias.
- **Etiqueta QR**: cada equipamento tem uma etiqueta QR (veja [Equipamentos](/help/assets)). Quem a digitalizar com o telemóvel recebe um formulário curto para esse equipamento, sem precisar de conta; deixa o nome e os contactos. Os clientes com sessão iniciada vão para o formulário do portal, já preenchido com o equipamento, e os colaboradores vão para a página do equipamento.

Quando chega um pedido, todas as pessoas que podem aprovar pedidos recebem uma notificação, e o número de pedidos pendentes aparece junto a **Pedidos** no menu.

> Os colaboradores não criam pedidos: quando já sabe o que é preciso fazer, crie diretamente uma [ordem de trabalho](/help/work-orders).

## A lista de pedidos

![A lista de pedidos com os separadores](requests-list)

Os separadores no topo dividem os pedidos por estado, com uma contagem em cada um:

- **Pendente**: à espera de decisão. É o separador que abre por defeito.
- **Aprovado**: transformado em ordem de trabalho.
- **Recusado**: rejeitado, com o motivo, se tiver sido indicado.
- **Todos**: todos os pedidos, com o estado por baixo do título.

Cada linha mostra o **Título** com o número do pedido (**R12**), o sistema, a urgência e um ícone de câmara com o número de fotografias; a disponibilidade do cliente (calendário laranja) ou, depois de confirmada, a data da visita (calendário verde); a **Localização** (moradia e equipamento); **De** quem é (com "via etiqueta QR" nos pedidos enviados a partir de uma etiqueta); e quando foi **Recebido**.

Use a caixa de pesquisa para encontrar uma palavra no título ou na descrição, o nome de quem pediu ou um número R, e o filtro de moradia para ver só uma moradia.

## Analisar um pedido

Clique num pedido para o abrir. Vê:

- a descrição e as fotografias enviadas pelo cliente (clique numa fotografia para a ampliar);
- à direita, quem o enviou, com o telefone e o e-mail como ligações para ligar ou escrever, e a moradia, o cliente, a divisão e o equipamento; e a **Disponibilidade do cliente**, se a indicou.

## Aprovar um pedido

1. Abra um pedido pendente.
2. Em **Aprovar como ordem de trabalho**, confirme o **Título** e defina a **Prioridade**, o **Tipo**, o **Sistema** e o **Prazo**. A prioridade parte da que o cliente escolheu (ou Média).
   Se o cliente indicou um período, defina a data e a hora da **Visita confirmada**: sem ela o pedido não pode ser aprovado. Sem período é opcional.
3. Escolha uma **Equipa** e as pessoas em **Atribuída a**. Ao escolher uma equipa, os seus membros ficam selecionados se ainda não houver ninguém atribuído.
4. Clique em **Criar ordem de trabalho**.

A aplicação cria a ordem de trabalho e abre-a. A moradia, a divisão e o equipamento vêm do pedido; a descrição recebe no fim o nome e os contactos de quem pediu; e as fotografias do cliente ficam anexadas à ordem de trabalho. As pessoas atribuídas são notificadas, e o cliente também: no portal, ou por e-mail nos pedidos enviados a partir de uma etiqueta QR.

A partir daí o pedido mostra **Aprovado como ordem de trabalho**, com uma ligação ao trabalho e o seu estado atual e, para quem pode ver valores, quanto há a faturar no trabalho até agora.

> Quando a ordem de trabalho é concluída, o cliente é avisado, desde que a ordem de trabalho esteja visível para o cliente.

## A disponibilidade do cliente e a visita confirmada

Ao enviar um pedido, o cliente pode dizer **quando o trabalho pode ser feito**: um período com data e hora de início e de fim (por exemplo, "de segunda às 9:00 até quarta às 18:00"). É opcional; os pedidos sem período funcionam como antes.

Quando um pedido tem um período:

- aparece na lista e no pedido como **Disponibilidade do cliente**;
- para o aprovar tem de definir a **Visita confirmada**, a data e a hora a que a sua equipa vai. Normalmente fica dentro do período; se combinar outra hora com o cliente, o pedido avisa que está **fora da disponibilidade do cliente**;
- a visita confirmada passa a ser a **data de início** da ordem de trabalho, e a ordem de trabalho mostra a disponibilidade e a visita confirmada.

O cliente é avisado (no portal, ou por e-mail nos pedidos de etiqueta QR) e vê a data e a hora confirmadas no pedido e na lista de pedidos da propriedade.

Para definir a visita mais tarde, ou alterá-la, abra o pedido aprovado e use **Confirmar a visita** (ou **Visita**). O cliente é avisado de novo. Pode fazê-lo até a ordem de trabalho estar concluída ou cancelada. Alterar a data de início na própria ordem de trabalho não muda o que o cliente vê.

## Recusar um pedido

1. Abra um pedido pendente.
2. Em **Recusar**, escreva um motivo, se quiser. O motivo é mostrado ao cliente.
3. Clique em **Recusar pedido**.

O cliente é notificado da mesma forma que numa aprovação. Um pedido recusado não pode ser reaberto; o cliente pode sempre enviar um novo.

> Se duas pessoas tratarem o mesmo pedido ao mesmo tempo, só conta a primeira decisão; a segunda recebe a mensagem de que o pedido já foi tratado.

## Quem pode fazer o quê

- **Super Admin**, **Administrador** e **Gestor**: veem, aprovam e recusam pedidos, e são notificados dos novos.
- **Técnico**, **Contabilista** e **Observador**: veem os pedidos, mas não os aprovam nem recusam.
- **Quem está de prevenção** nessa semana também é notificado de todos os novos pedidos e pode aprovar ou recusar os que chegaram durante a sua semana, seja qual for a sua função. O pedido mostra quem estava de prevenção. Veja [Prevenção](/help/on-call).
- Os **clientes** enviam pedidos e acompanham-nos no portal do cliente.
`,
};

export default text;
