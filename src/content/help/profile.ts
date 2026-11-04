import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [{ name: "profile-page", path: "/settings/profile", maxHeight: 760 }];

const text: HelpText = {
  en: `# My profile

Your own details, your password and the notifications you want to receive by e-mail and push. Everyone can open their profile, whatever their role.

## What this page is for

**My profile** (under **Settings** in the menu) holds the settings that belong to you as a person rather than to the company: your name and phone, your password, which alerts reach you outside the app, and push notifications on the devices you use. Changes here only affect your own account.

![My profile: details and password on the left, push and notification choices on the right](profile-page)

The page has five cards:

- **Details**: your name, e-mail and phone.
- **Password**: change your password.
- **Push notifications on this device**: turn alerts on for the phone or computer you are using.
- **What to notify me about**: an e-mail and a push switch for each kind of event.
- **Your data**: download a copy of your personal data and read the company's privacy notice.

## Your details

1. Change your **Name** or **Phone**.
2. Click **Save**.

Your name is what colleagues see on work orders, comments, messages and time entries. The **Email** field is read-only: it is the address you sign in with. If it needs to change, ask an administrator.

## Changing your password

1. In the **Password** card, type your **Current password**.
2. Type the **New password** (at least 8 characters) and type it again in **Repeat the new password**.
3. Click **Change password**. You will see **Password changed.** when it is done.

> If you forgot your password, you can't change it here: sign out and use the password reset link on the sign-in page instead. If you have no password yet, the current password field is not shown.

## Language and theme

The **Language and appearance** card at the top of this page switches between English and Português, and between a light, dark or automatic theme (**Same as device**). The change applies at once and is remembered for your account.

## Your calendar

The **Calendar** card puts the work orders assigned to you into Google Calendar, Outlook or your phone's calendar:

1. Click **Create calendar link**.
2. Click **Open in calendar app** on the device whose calendar you use, or **Copy** the link and add it as a subscribed calendar ("From URL" in Google Calendar, "Subscribe to calendar" in Outlook).

Each job appears from its start to its due time, with the villa as the location and a link back to the work order; finished jobs get a ✓. Calendar apps refresh subscriptions every few hours, so a change can take a while to show. Anyone with the link sees your jobs: if it leaked, click **New link** and the old one stops working.

## Choosing your notifications

Everything that concerns you always appears under the bell in the app (see [Notifications](/help/notifications)). The **What to notify me about** card decides which of those events also reach you outside the app:

- **Email**: a message to the address you sign in with (only if e-mail is set up on the server).
- **Push**: an alert on each device where you turned push notifications on.

Tick or untick the boxes next to each event. There is no save button: changes save automatically, and the note under the list shows **Saved.** The events you can choose from include:

- **A work order is assigned to me**
- **Status changes on my work orders**
- **Comments on my work orders**
- **Someone @mentions me**
- **New chat messages**
- **New maintenance requests**
- **Meter readings out of range**
- **Parts running low**
- **Purchase orders waiting for approval**
- **Updates on my purchase orders**

Some events start switched on for e-mail (for example new assignments, mentions and new requests) and others only for push; adjust them to taste. You only receive an event when it actually concerns you and your role can see it.

## Push notifications on a device

Push notifications reach your phone or computer even when the app is closed. They are switched on separately on each device and browser you use.

1. Open **My profile** on the device you want alerts on.
2. In **Push notifications on this device**, click **Turn on**.
3. Allow notifications when the browser asks.
4. The card now shows **On for this device**. Click **Send a test** to check that an alert arrives.

To stop alerts on that device, click **Turn off**.

> On an iPhone, push only works once the app has been added to the home screen: open it in Safari, use Share and then Add to Home Screen, open it from the new icon and turn push on there. If the card says notifications are blocked, allow them in the browser's site settings and reload the page.

## Your data

**Download my data** saves a file (JSON) with everything the app stores about you: your account, memberships, time entries and so on. The **Privacy notice** link opens the company's privacy notice, which the administrators set up in [Organization](/help/organization).

## Who can use it

Every signed-in person has a profile. Client users have their own profile in the client portal, with a shorter list of notifications (their requests being accepted, declined or scheduled, and status changes on their jobs).
`,
  pt: `# O meu perfil

Os seus dados, a sua palavra-passe e as notificações que quer receber por e-mail e push. Todas as pessoas podem abrir o seu perfil, seja qual for a função.

## Para que serve esta página

**O meu perfil** (em **Definições** no menu) reúne as definições que pertencem a si como pessoa e não à empresa: o nome e o telefone, a palavra-passe, os alertas que lhe chegam fora da aplicação e as notificações push nos dispositivos que usa. As alterações feitas aqui só afetam a sua conta.

![O meu perfil: dados e palavra-passe à esquerda, push e escolha de notificações à direita](profile-page)

A página tem cinco cartões:

- **Dados**: o seu nome, e-mail e telefone.
- **Palavra-passe**: alterar a palavra-passe.
- **Notificações push neste dispositivo**: ativar os alertas no telemóvel ou computador que está a usar.
- **Notificações que quero receber**: um interruptor de e-mail e outro de push para cada tipo de evento.
- **Os seus dados**: descarregar uma cópia dos seus dados pessoais e ler o aviso de privacidade da empresa.

## Os seus dados pessoais

1. Altere o **Nome** ou o **Telefone**.
2. Clique em **Guardar**.

O seu nome é o que os colegas veem nas ordens de trabalho, comentários, mensagens e registos de tempo. O campo **Email** não pode ser editado: é o endereço com que inicia sessão. Se precisar de o mudar, peça a um administrador.

## Alterar a palavra-passe

1. No cartão **Palavra-passe**, escreva a **Palavra-passe atual**.
2. Escreva a **Nova palavra-passe** (pelo menos 8 caracteres) e repita-a em **Repita a nova palavra-passe**.
3. Clique em **Alterar palavra-passe**. Quando terminar, aparece **Palavra-passe alterada.**

> Se se esqueceu da palavra-passe, não a pode alterar aqui: termine a sessão e use a ligação de recuperação da palavra-passe na página de início de sessão. Se ainda não tem palavra-passe, o campo da palavra-passe atual não aparece.

## Idioma e tema

O cartão **Idioma e aspeto**, no topo desta página, muda entre English e Português, e entre um tema claro, escuro ou automático (**Igual ao dispositivo**). A alteração aplica-se de imediato e fica guardada na sua conta.

## O seu calendário

O cartão **Calendário** põe as ordens de trabalho atribuídas a si no Google Calendar, no Outlook ou no calendário do telemóvel:

1. Clique em **Criar link do calendário**.
2. Clique em **Abrir na app de calendário** no dispositivo cujo calendário usa, ou **Copie** o link e acrescente-o como calendário subscrito ("A partir do URL" no Google Calendar, "Subscrever calendário" no Outlook).

Cada trabalho aparece do início ao prazo, com a moradia como local e uma ligação para a ordem de trabalho; os concluídos têm um ✓. As aplicações de calendário atualizam as subscrições de poucas em poucas horas, por isso uma alteração pode demorar a aparecer. Quem tiver o link vê os seus trabalhos: se o divulgou sem querer, clique em **Novo link** e o antigo deixa de funcionar.

## Escolher as notificações

Tudo o que lhe diz respeito aparece sempre no sino dentro da aplicação (veja [Notificações](/help/notifications)). O cartão **Notificações que quero receber** decide quais desses eventos também lhe chegam fora da aplicação:

- **Email**: uma mensagem para o endereço com que inicia sessão (só se o e-mail estiver configurado no servidor).
- **Push**: um alerta em cada dispositivo onde ativou as notificações push.

Marque ou desmarque as caixas junto a cada evento. Não há botão de guardar: as alterações são guardadas automaticamente e a nota por baixo da lista mostra **Guardado.** Os eventos que pode escolher incluem:

- **Uma ordem de trabalho é-me atribuída**
- **Mudanças de estado nas minhas ordens de trabalho**
- **Comentários nas minhas ordens de trabalho**
- **Alguém me menciona com @**
- **Novas mensagens de conversa**
- **Novos pedidos de manutenção**
- **Leituras de contadores fora dos limites**
- **Peças a esgotar**
- **Notas de encomenda a aguardar aprovação**
- **Atualizações das minhas notas de encomenda**

Alguns eventos começam ativos por e-mail (por exemplo novas atribuições, menções e novos pedidos) e outros só por push; ajuste-os a seu gosto. Só recebe um evento quando ele lhe diz respeito e a sua função o pode ver.

## Notificações push num dispositivo

As notificações push chegam ao telemóvel ou computador mesmo com a aplicação fechada. Ativam-se separadamente em cada dispositivo e navegador que usa.

1. Abra **O meu perfil** no dispositivo onde quer receber alertas.
2. Em **Notificações push neste dispositivo**, clique em **Ativar**.
3. Permita as notificações quando o navegador perguntar.
4. O cartão passa a mostrar **Ativas neste dispositivo**. Clique em **Enviar um teste** para confirmar que o alerta chega.

Para deixar de receber alertas nesse dispositivo, clique em **Desativar**.

> No iPhone, as notificações push só funcionam depois de adicionar a aplicação ao ecrã principal: abra-a no Safari, use Partilhar e depois Adicionar ao ecrã principal, abra-a a partir do novo ícone e ative as notificações aí. Se o cartão disser que as notificações estão bloqueadas, permita-as nas definições do site no navegador e recarregue a página.

## Os seus dados

**Descarregar os meus dados** guarda um ficheiro (JSON) com tudo o que a aplicação tem sobre si: a sua conta, as empresas a que pertence, os registos de tempo, etc. A ligação **Aviso de privacidade** abre o aviso de privacidade da empresa, que os administradores configuram em [Organização](/help/organization).

## Quem pode usar

Todas as pessoas com sessão iniciada têm um perfil. Os utilizadores de cliente têm o seu próprio perfil no portal do cliente, com uma lista de notificações mais curta (os seus pedidos aceites, recusados ou agendados e as mudanças de estado nos seus trabalhos).
`,
};

export default text;
