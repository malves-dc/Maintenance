import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [{ name: "notifications-preferences", path: "/settings/profile", maxHeight: 900 }];

const text: HelpText = {
  en: `# Notifications

The bell tells you when something needs your attention: a job assigned to you, a status change, a mention, a new request, an approval or a stock alert. You choose which ones also reach you by email or as a push alert on your phone.

## The bell

The bell sits at the bottom of the menu, next to your name (on a phone, in the top bar). A red number on it counts your unread notifications (**99+** above 99). It updates by itself every 30 seconds and whenever you move to another page, so you don't need to reload.

Click the bell to open **Notifications**.

## The notifications list

The page shows your latest 100 notifications, newest first. Unread ones are highlighted, in bold and with a dot on the right. Each one has a title, a short detail line (for example the work order title and who did it) and how long ago it happened.

1. Click a notification. It's marked as read and you go straight to what it's about: the work order, request, purchase order, part or conversation.
2. To clear the lot without opening them, click **Mark all as read** at the top.

When there's nothing left, the page says **You're all caught up.**

> Notifications are shown in the language you're using now, even if they were created while you used the other one.

## What you're notified about

You're never notified about something you did yourself. Otherwise:

- **A work order is assigned to me**: when you're added as an assignee, whether the job was created by hand, edited, or created from an approved request.
- **Status changes on my work orders**: a job you created or are assigned to is started, put on hold, done, cancelled or reopened.
- **Comments on my work orders**: someone comments on a job you created or are assigned to.
- **Someone @mentions me**: someone mentions you in a work order comment, a group chat or a team channel.
- **New chat messages**: a message in one of your conversations. These don't appear in the list; the number next to **Messages** in the menu shows them instead. See [Messages](/help/messages).
- **New maintenance requests**: a client sends a request. Goes to everyone who can approve requests. See [Requests](/help/requests).
- **A client adds photos to a request**: a client adds photos to a request already sent, at any stage. Goes to everyone who can approve requests and to the people assigned to its work order.
- **Meter readings out of range**: a reading falls outside its limits and a work order is opened. Goes to everyone who can manage work orders. See [Meters](/help/meters).
- **Parts running low**: a part drops to its minimum. Goes to everyone who manages stock, once, at the moment it becomes low. See [Parts & inventory](/help/parts).
- **Purchase orders waiting for approval**: a purchase order is submitted. Goes to everyone who can approve purchase orders.
- **Updates on my purchase orders**: a purchase order you created is approved, sent back to draft or cancelled. See [Purchase orders](/help/purchase-orders).

## Email and push

Every notification goes into the list. Whether it also reaches you by email or push is up to you, in [My profile](/help/profile):

![My profile: push notifications for this device and the email / push choices per event](notifications-preferences)

1. Click your name at the bottom of the menu to open **My profile**.
2. Under **What to notify me about**, each event has an **Email** and a **Push** tick box. Tick or untick them; **Changes save automatically.**
3. Under **Push notifications on this device**, click **Turn on** and allow notifications when the browser asks. Click **Send a test** to check it works.

Out of the box, push is on for everything, and email is on for assignments, mentions, new requests, meter alerts and purchase orders waiting for approval.

Each email has an **Open** button that takes you to the item, and a link to change these settings.

> Push has to be turned on separately on each phone and computer. On iPhone, first add the app to the home screen, then turn push on from there. If you see **Notifications are blocked for this site**, allow them in the browser's site settings and reload.

## Who gets what

Everyone has a bell and a notifications list, including clients in the client portal. Which events reach you depends on what you do:

- Technicians mostly get assignments, status changes, comments and mentions on their jobs.
- Managers and Administrators also get new requests, meter alerts and stock alerts (by default).
- The Super Admin and Administrators also get purchase orders waiting for approval (by default).
- Clients only get notified when their requests are accepted, declined or given a visit date and time, and when their jobs change status.

If the Super Admin changes what a role can do in [Roles](/help/roles), the alerts follow: for example, giving a role the right to approve requests also sends it new requests.
`,
  pt: `# Notificações

O sino avisa-o quando algo precisa da sua atenção: um trabalho atribuído a si, uma mudança de estado, uma menção, um novo pedido, uma aprovação ou um alerta de stock. Escolhe quais lhe chegam também por email ou como alerta push no telemóvel.

## O sino

O sino está no fundo do menu, junto ao seu nome (no telemóvel, na barra de topo). Um número vermelho conta as notificações por ler (**99+** acima de 99). Atualiza-se sozinho a cada 30 segundos e sempre que muda de página, por isso não precisa de recarregar.

Clique no sino para abrir **Notificações**.

## A lista de notificações

A página mostra as suas 100 notificações mais recentes, primeiro as mais novas. As que estão por ler aparecem destacadas, a negrito e com um ponto à direita. Cada uma tem um título, uma linha de detalhe (por exemplo o título da ordem de trabalho e quem fez a alteração) e há quanto tempo aconteceu.

1. Clique numa notificação. Fica marcada como lida e vai diretamente ao assunto: a ordem de trabalho, o pedido, a encomenda, a peça ou a conversa.
2. Para limpar tudo sem as abrir, clique em **Marcar todas como lidas** no topo.

Quando não houver mais nada, a página diz **Está tudo em dia.**

> As notificações aparecem no idioma que está a usar agora, mesmo que tenham sido criadas quando usava o outro.

## Sobre o que é notificado

Nunca é notificado sobre algo que fez a si próprio. De resto:

- **Uma ordem de trabalho é-me atribuída**: quando é indicado como responsável, quer o trabalho tenha sido criado à mão, editado ou criado a partir de um pedido aprovado.
- **Mudanças de estado nas minhas ordens de trabalho**: um trabalho que criou ou que lhe está atribuído é iniciado, posto em espera, concluído, cancelado ou reaberto.
- **Comentários nas minhas ordens de trabalho**: alguém comenta um trabalho que criou ou que lhe está atribuído.
- **Alguém me menciona com @**: alguém o menciona num comentário de uma ordem de trabalho, numa conversa de grupo ou num canal de equipa.
- **Novas mensagens de conversa**: uma mensagem numa das suas conversas. Estas não aparecem na lista; o número junto a **Mensagens** no menu mostra-as. Veja [Mensagens](/help/messages).
- **Novos pedidos de manutenção**: um cliente envia um pedido. Vai para todos os que podem aprovar pedidos. Veja [Pedidos](/help/requests).
- **Um cliente adiciona fotografias a um pedido**: um cliente junta fotografias a um pedido já enviado, em qualquer fase. Vai para todos os que podem aprovar pedidos e para as pessoas atribuídas à ordem de trabalho.
- **Leituras de contadores fora dos limites**: uma leitura sai dos limites e é aberta uma ordem de trabalho. Vai para todos os que podem gerir ordens de trabalho. Veja [Contadores](/help/meters).
- **Peças a esgotar**: uma peça desce até ao mínimo. Vai para todos os que gerem o stock, uma vez, no momento em que fica baixa. Veja [Peças e stock](/help/parts).
- **Notas de encomenda a aguardar aprovação**: uma encomenda é submetida. Vai para todos os que podem aprovar encomendas.
- **Atualizações das minhas notas de encomenda**: uma encomenda que criou é aprovada, devolvida a rascunho ou cancelada. Veja [Encomendas](/help/purchase-orders).

## Email e push

Todas as notificações entram na lista. Pode escolher se também lhe chegam por email ou push, em [O meu perfil](/help/profile):

![O meu perfil: notificações push neste dispositivo e as escolhas de email / push por evento](notifications-preferences)

1. Clique no seu nome no fundo do menu para abrir **O meu perfil**.
2. Em **Notificações que quero receber**, cada evento tem uma caixa **Email** e uma caixa **Push**. Marque ou desmarque; **As alterações são guardadas automaticamente.**
3. Em **Notificações push neste dispositivo**, clique em **Ativar** e permita as notificações quando o navegador perguntar. Clique em **Enviar um teste** para confirmar que funciona.

Por defeito, o push está ligado para tudo, e o email para atribuições, menções, novos pedidos, alertas de contadores e encomendas a aguardar aprovação.

Cada email tem um botão **Abrir** que o leva ao assunto, e um link para alterar estas definições.

> O push tem de ser ativado em cada telemóvel e computador. No iPhone, adicione primeiro a aplicação ao ecrã principal e ative o push a partir daí. Se vir **As notificações estão bloqueadas para este site**, permita-as nas definições do site no navegador e recarregue a página.

## Quem recebe o quê

Todos têm um sino e uma lista de notificações, incluindo os clientes no portal do cliente. Os eventos que lhe chegam dependem do que faz:

- Os técnicos recebem sobretudo atribuições, mudanças de estado, comentários e menções nos seus trabalhos.
- Gestores e Administradores recebem também novos pedidos, alertas de contadores e alertas de stock (por defeito).
- O Super Admin e os Administradores recebem também as encomendas a aguardar aprovação (por defeito).
- Os clientes só são notificados quando os seus pedidos são aceites, recusados ou recebem a data e a hora da visita, e quando os seus trabalhos mudam de estado.

Se o Super Admin alterar o que uma função pode fazer em [Funções](/help/roles), os alertas acompanham: por exemplo, dar a uma função o direito de aprovar pedidos faz com que passe também a receber os novos pedidos.
`,
};

export default text;
