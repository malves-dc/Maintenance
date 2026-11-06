import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [{ name: "field-app-list", path: "/m", selector: "body", width: 412, maxHeight: 640 }];

const text: HelpText = {
  en: `# Field app

A simple phone app for technicians that shows the work orders assigned to you and lets you carry them out with or without signal: checklist, time, photos, comments, status and the client's signature.

## What the field app is for

Villas often have poor or no mobile signal in technical rooms and basements. The **Field app (offline)** keeps a copy of your open work orders on the phone, so you can open them, fill in the checklist, take photos and get the client to sign even with no connection. Everything you do is saved on the device first and sent to the server as soon as there is a connection.

Open it from **Field app (offline)** in the menu. It's built for phones, but it works in any browser.

> Add it to your phone's home screen (in the browser menu, "Add to Home Screen" or "Install app"). It then opens like a normal app, straight on your work list. On iPhone this is also needed for push notifications.

## Before you go offline

The app can only show what it has already downloaded:

1. Open the field app once while you have a connection. It downloads your open work orders and keeps a copy of itself on the phone.
2. Check the line under the company name at the top: **Updated** followed by how long ago tells you when your list was last refreshed.
3. If a job was assigned to you after that, tap the **Sync now** button (the circular arrows) before you lose signal.

> If you see **Connect once to download your work orders; after that they're available offline.**, the phone has never synced. Find a connection before you go to site.

## Your work list

![The field app: your open work orders, with the scan, sync and full-app buttons at the top](field-app-list)

**My work** lists the work orders assigned to you that are **Open**, **In progress** or **On hold** (up to 50), in three sections: **To do** (in progress, overdue, today or without a date; jobs in progress first), **Next 30 days** and **Later**, by the job's start date (or its due date). Each card shows:

- the work order number, its status and its priority;
- a pulsing red dot if your timer is running on that job;
- the title, and the villa, area and asset it's about;
- the start date and the due date (in red when it has passed), and how many checklist steps are done (for example **3/8 steps**).

The buttons at the top right are: **Scan** (the camera, see below), **Sync now**, and **Open the full app**, which takes you to the normal app.

## Doing a job

Tap a card to open the work order. You'll see the villa address (tap it to open a map), the villa's **Access** notes, the asset and the description. Villa access codes are never stored on the phone; look them up in the full app if you need them.

When the villa has a [knowledge base](/help/villas), tap **Knowledge base** under the job details to read its articles, even offline. Articles about the job's asset come first; with more than five, a search box appears. Attached files open in the full app and need a connection.

1. Tap **Start work**. The job becomes **In progress**.
2. Choose **On site** or **Remote**, then tap **Start timer** to time your work. The button turns into **Stop** with a running clock. Only one timer runs at a time: starting one on another job stops the first. Anything under a minute isn't recorded.
3. Work through the **Checklist**: tick steps, choose pass/fail or an option, type text or numbers, take photos and collect signatures where a step asks for them.
4. Under **Photos & videos**, tap **Take photo** to add pictures of the job, or **Record video** for a clip of up to 1 minute. The video is reduced to 720p on the phone (this takes a moment; the button shows the progress) and kept there until it is uploaded.
5. Under **Activity**, write a note and tap the send button. Type @ to mention a colleague; they'll be notified once the comment syncs.
6. Under **Report**, describe the work you did. It is saved on the phone when you leave the box and synced like everything else; the job can't be marked done without it.
7. Under **Client sign-off**, ask the client or house manager to sign, type their name and tap **Confirm sign-off**. If nobody is there, tick **Client absent** instead.
8. Tap **Mark done**.

If you have to stop, tap **On hold**, type the reason (for example waiting for parts) and confirm. Stopping or finishing the job also stops your timer. To pick the job up again, tap **Resume**.

> **Mark done** is refused while required checklist steps are empty, the report is blank or there is no sign-off. The app lists what's missing, so fill it in and try again.

## Scanning an asset label

Tap the scan button at the top and point the camera at the QR label on a piece of equipment. The list then shows only your jobs for that asset (**Showing** followed by the asset name). Tap the cross to **Show all** again, or **Open** to see the asset's page (that needs a connection). This works offline for assets at the villas of your assigned jobs. See [Scan](/help/scan).

## Searching past jobs

Tap the magnifying glass at the top to search every work order in the company, not just yours: type a word such as *processor* and you see the jobs where it was written, with the comment or note highlighted. Results that are in your list open in the field app; the others open the full work order page. Search needs a connection. See [Search](/help/search).

## Syncing and what the banners mean

The app syncs on its own: when it opens, when the connection comes back, when you return to it, every minute while it's open, and a moment after each change. Changes are sent in the order you made them; photos, videos and signatures are uploaded first. A coloured banner under the header tells you where things stand:

- **Offline.** You have no connection. Keep working: everything is saved on the device and the banner tells you how many changes are waiting.
- **changes waiting to sync…**: you're online and the app is sending your changes.
- **Couldn't sync just now.** Something went wrong on the way; your changes are kept and will be retried.
- **Your session expired.** Tap **Sign in**, sign in again and the app carries on syncing. Nothing on the device is lost.

If a change can't be applied (for example the job was closed in the office while you were offline, or a required step was still missing), a red box lists it as **changes couldn't be applied**, with the job number and what it was. Fix it in the full app if needed, then tap the cross to **Dismiss** the list.

> If two people answer the same checklist step, the later answer wins. The field app only syncs while it is open, so open it once you're back in signal to send everything.

## Limits

- Only your assigned open work orders are available, up to 50. Jobs assigned to your team but not to you don't appear.
- The field app can't create work orders or requests, record parts used or open chat. Use the full app for those.
- Photos already uploaded from another device aren't shown offline.

## Who can use it

The field app is for everyone who can carry out work orders: by default the Super Admin, Administrators, Managers and Technicians. Viewers and Accountants don't see it in the menu, and clients use the client portal instead. See [Work orders](/help/work-orders) for the full work order screen.
`,
  pt: `# App de campo

Uma aplicação simples para o telemóvel dos técnicos, que mostra as ordens de trabalho atribuídas a si e permite executá-las com ou sem rede: checklist, tempo, fotografias, comentários, estado e a assinatura do cliente.

## Para que serve a app de campo

Muitas moradias têm pouca ou nenhuma rede nas salas técnicas e nas caves. A **App de campo (offline)** guarda uma cópia das suas ordens de trabalho em aberto no telemóvel, para que as possa abrir, preencher a checklist, tirar fotografias e recolher a assinatura do cliente mesmo sem ligação. Tudo o que faz fica primeiro guardado no dispositivo e é enviado para o servidor assim que houver ligação.

Abra-a em **App de campo (offline)** no menu. Foi pensada para o telemóvel, mas funciona em qualquer navegador.

> Adicione-a ao ecrã principal do telemóvel (no menu do navegador, "Adicionar ao ecrã principal" ou "Instalar aplicação"). Passa a abrir como uma aplicação normal, diretamente na sua lista de trabalho. No iPhone isto também é necessário para as notificações push.

## Antes de ficar sem rede

A aplicação só consegue mostrar o que já descarregou:

1. Abra a app de campo uma vez com ligação. Ela descarrega as suas ordens de trabalho em aberto e guarda uma cópia de si própria no telemóvel.
2. Veja a linha por baixo do nome da empresa no topo: **Atualizado** seguido de há quanto tempo indica quando a lista foi atualizada pela última vez.
3. Se lhe atribuíram um trabalho depois disso, toque no botão **Sincronizar agora** (as setas em círculo) antes de perder a rede.

> Se vir **Ligue-se uma vez para descarregar as suas ordens de trabalho; depois ficam disponíveis sem rede.**, o telemóvel nunca sincronizou. Procure uma ligação antes de ir para a obra.

## A sua lista de trabalho

![A app de campo: as suas ordens de trabalho em aberto, com os botões de leitura, sincronização e aplicação completa no topo](field-app-list)

**O meu trabalho** lista as ordens de trabalho atribuídas a si que estão **Aberta**, **Em curso** ou **Em espera** (até 50), em três secções: **Para fazer** (em curso, em atraso, hoje ou sem data; as em curso primeiro), **Próximos 30 dias** e **Mais tarde**, pela data de início do trabalho (ou pelo prazo). Cada cartão mostra:

- o número da ordem de trabalho, o estado e a prioridade;
- um ponto vermelho a piscar se o seu cronómetro estiver a contar nesse trabalho;
- o título, e a moradia, divisão e equipamento a que diz respeito;
- a data de início e o prazo (a vermelho quando já passou), e quantos passos da checklist estão feitos (por exemplo **3/8 passos**).

Os botões no canto superior direito são: **Ler código** (a câmara, ver abaixo), **Sincronizar agora** e **Abrir a aplicação completa**, que o leva à aplicação normal.

## Executar um trabalho

Toque num cartão para abrir a ordem de trabalho. Vê a morada da moradia (toque nela para abrir um mapa), as notas de **Acesso** da moradia, o equipamento e a descrição. Os códigos de acesso das moradias nunca ficam guardados no telemóvel; consulte-os na aplicação completa se precisar.

Quando a moradia tem [base de conhecimento](/help/villas), toque em **Base de conhecimento** por baixo dos dados do trabalho para ler os artigos, mesmo offline. Os artigos sobre o equipamento do trabalho aparecem primeiro; com mais de cinco, aparece uma caixa de pesquisa. Os ficheiros anexos abrem na aplicação completa e precisam de ligação.

1. Toque em **Iniciar trabalho**. O trabalho passa a **Em curso**.
2. Escolha **No local** ou **Remoto** e toque em **Iniciar cronómetro** para medir o seu tempo. O botão passa a **Parar**, com um relógio a contar. Só pode haver um cronómetro de cada vez: iniciar outro noutro trabalho para o primeiro. Menos de um minuto não é registado.
3. Percorra a **Checklist**: marque passos, escolha passa/falha ou uma opção, escreva texto ou números, tire fotografias e recolha assinaturas quando um passo o pedir.
4. Em **Fotografias e vídeos**, toque em **Tirar fotografia** para juntar imagens do trabalho, ou em **Gravar vídeo** para um vídeo até 1 minuto. O vídeo é reduzido para 720p no telemóvel (demora um pouco; o botão mostra o progresso) e fica lá guardado até ser enviado.
5. Em **Atividade**, escreva uma nota e toque no botão de enviar. Escreva @ para mencionar um colega; essa pessoa é notificada quando o comentário for sincronizado.
6. Em **Relatório**, descreva o trabalho realizado. Fica guardado no telemóvel quando sai da caixa e é sincronizado como o resto; o trabalho não pode ser concluído sem ele.
7. Em **Aprovação do cliente**, peça ao cliente ou ao governante para assinar, escreva o nome dele e toque em **Confirmar aprovação**. Se não estiver ninguém, marque **Cliente ausente**.
8. Toque em **Marcar como concluída**.

Se tiver de parar, toque em **Em espera**, escreva o motivo (por exemplo a aguardar material) e confirme. Pôr o trabalho em espera ou concluí-lo também para o cronómetro. Para retomar o trabalho, toque em **Retomar**.

> **Marcar como concluída** é recusado enquanto houver passos obrigatórios da checklist por preencher, faltar o relatório ou faltar a aprovação do cliente. A aplicação mostra o que falta; preencha e tente novamente.

## Ler a etiqueta de um equipamento

Toque no botão de leitura no topo e aponte a câmara para a etiqueta QR de um equipamento. A lista passa a mostrar só os seus trabalhos desse equipamento (**A mostrar** seguido do nome do equipamento). Toque na cruz para **Mostrar tudo** de novo, ou em **Abrir** para ver a página do equipamento (isso precisa de ligação). Funciona sem rede para os equipamentos das moradias dos seus trabalhos atribuídos. Veja [Ler código](/help/scan).

## Pesquisar trabalhos anteriores

Toque na lupa no topo para pesquisar todas as ordens de trabalho da empresa, não só as suas: escreva uma palavra como *processador* e vê os trabalhos onde foi escrita, com o comentário ou a nota destacados. Os resultados que estão na sua lista abrem na app de campo; os outros abrem a página completa da ordem de trabalho. A pesquisa precisa de ligação. Veja [Pesquisa](/help/search).

## A sincronização e o que significam os avisos

A aplicação sincroniza sozinha: quando abre, quando a ligação volta, quando regressa a ela, a cada minuto enquanto está aberta e pouco depois de cada alteração. As alterações são enviadas pela ordem em que as fez; as fotografias, os vídeos e as assinaturas são enviados primeiro. Uma faixa colorida por baixo do cabeçalho mostra o ponto da situação:

- **Sem ligação.** Não tem rede. Continue a trabalhar: está tudo guardado no dispositivo e a faixa diz quantas alterações estão à espera.
- **alterações a aguardar sincronização…**: tem rede e a aplicação está a enviar as suas alterações.
- **Não foi possível sincronizar agora.** Algo falhou pelo caminho; as alterações ficam guardadas e serão reenviadas.
- **A sessão expirou.** Toque em **Iniciar sessão**, entre novamente e a aplicação continua a sincronizar. Nada do que está no dispositivo se perde.

Se uma alteração não puder ser aplicada (por exemplo, o trabalho foi fechado no escritório enquanto estava sem rede, ou ainda faltava um passo obrigatório), uma caixa vermelha mostra-a em **alterações não puderam ser aplicadas**, com o número do trabalho e o que era. Corrija na aplicação completa se for preciso e toque na cruz para **Dispensar** a lista.

> Se duas pessoas responderem ao mesmo passo da checklist, fica a resposta mais recente. A app de campo só sincroniza enquanto está aberta, por isso abra-a quando voltar a ter rede para enviar tudo.

## Limites

- Só estão disponíveis as suas ordens de trabalho em aberto atribuídas, até 50. Os trabalhos atribuídos à sua equipa mas não a si não aparecem.
- A app de campo não cria ordens de trabalho nem pedidos, não regista peças usadas e não abre as mensagens. Use a aplicação completa para isso.
- As fotografias já enviadas a partir de outro dispositivo não aparecem sem rede.

## Quem a pode usar

A app de campo é para quem pode executar ordens de trabalho: por defeito o Super Admin, Administradores, Gestores e Técnicos. Observadores e Contabilistas não a veem no menu, e os clientes usam o portal do cliente. Veja [Ordens de trabalho](/help/work-orders) para o ecrã completo da ordem de trabalho.
`,
};

export default text;
