import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [];

const text: HelpText = {
  en: `# Server

Settings for the whole installation rather than one company: the software name, e-mail delivery, updates, backups and copies of backups kept off the server. They are protected by a separate server password.

## What this page is for

One installation of the app can hold several companies. **Server** (under **Settings** in the menu) looks after the installation itself:

- **General**: the name of the software and whether anyone can create an account.
- **E-mail**: how the app sends invitations, password resets, notifications and service reports.
- **Updates**: the installed version and one-click updates.
- **Backups**: the backup schedule, manual backups, downloads and restores.
- **Backup copies**: copies of each backup sent by e-mail or to a cloud folder.

> Everything on this page affects every company on the server, not just yours. A restore, in particular, replaces the data of all companies.

## Unlocking the page

Because these settings reach beyond your company, your role alone isn't enough. The page first shows **Enter the server password**.

1. Type the **Server password**. It is set by whoever installed the server (the SERVER_ADMIN_PASSWORD setting, or FACTORY_RESET_PASSWORD if that one isn't set).
2. Click **Unlock**.

The page stays unlocked for you, in this browser, for 30 minutes. Click **Lock** at the top to close it earlier. After several wrong passwords, unlocking is blocked for 15 minutes.

If the page says that server administration is off, no server password has been set: ask whoever runs the server to add one.

## Software name

Under **General**, the **Software name** is shown on the sign-in page, in the browser tab, in the installed app and in e-mails. Leave it empty to use the standard name. Click **Save**.

## Closing sign-up

While **Anyone can create an account** is ticked, the sign-in page offers **Create account**, and anyone who reaches the server can create a new company on it. Once your company exists, untick it and click **Save**: the link disappears and the sign-up page refuses new companies. People invited to a company can still create their accounts through the invitation link.

If the box is greyed out, whoever runs the server has closed sign-up with the ALLOW_SIGNUP setting.

## E-mail delivery

Until e-mail is set up, the app can't send invitations, password resets, e-mail notifications or service reports. The card shows how e-mail goes out now.

1. Under **Send through**, choose **SMTP account** (any mailbox: Microsoft 365, Google Workspace, your domain's mail server), **Resend** (the Resend sending service, with an API key) or **Environment variables** (the settings in the server's docker-compose file).
2. Fill in the **Sender**: the address e-mails come from, optionally with a name in front. With SMTP it is usually the mailbox itself.
3. For SMTP, fill in the **SMTP server**, **Port**, **Security**, **Username** and **Password**. For Resend, paste the **API key**.
4. Type an address in **Send a test to** and click **Send test e-mail**. The test uses what is in the form, even before you save.
5. When the test arrives, click **Save**.

Passwords and API keys are stored encrypted; leave the field empty to keep the saved one.

> Microsoft 365: smtp.office365.com, port 587, STARTTLS, and SMTP AUTH must be enabled for the mailbox. Google: smtp.gmail.com, port 587, STARTTLS, with an app password. If the test doesn't arrive, check the spam folder.

## Updates

The **Updates** card shows the **Installed version** and the **Latest release**, with **Update available** or **Up to date**. **Check now** checks again, and **What's new** lists the release notes.

To update, click **Update to** followed by the version number, and confirm. A backup is made first, then the app restarts on the new version, which takes about a minute; the page reloads by itself.

One-click updates need the updater service from the server's docker-compose file. Without it, the card says so, and the server has to be updated by whoever runs it. You can also tick **Install updates automatically** in the backup schedule: every day at the backup time, if a new version is out, the app backs up and then updates.

## Backups

Each backup holds the database, all uploaded files and the encryption keys, so it can be restored on this server or on a new one. A note under the title says whether new backups are encrypted (with the server's BACKUP_PASSWORD setting).

### Schedule

1. Tick **Hourly**, **Daily** and/or **Monthly**, and for each one set **Keep the last** (how many to keep; older ones are deleted).
2. Choose the hour in **Daily and monthly backups at** and the **Time zone**. Monthly backups run on the 1st; hourly ones run on the hour.
3. Click **Save**.

### Manual backups and the list

**Back up now** makes a backup straight away. **Upload a backup…** adds a backup file made elsewhere, for example to move to a new server. The list shows each backup's **Date**, **Type**, **Version** and **Size**, with a lock icon when it is encrypted. Types include **Manual**, **Before update**, **Before restore** and **Uploaded**; manual and uploaded backups are never deleted automatically.

Use the buttons at the end of each row to **Download**, **Restore** or **Delete** a backup.

> Keep copies off the server too. If the server's disk fails, the backups on it are lost with it. Download them regularly or set up backup copies below.

## Restoring a backup

1. Click **Restore** in the row of the backup you want.
2. Read the warning and type RESTORE to confirm.
3. Wait: the page shows that the restore is running, then that the server is restarting, and reloads by itself.

Before restoring, the app makes a **Before restore** backup of the current state, so you can go back if you chose the wrong one.

> A restore replaces everything on this server (all companies, users, work orders and files) with the contents of the backup. Anything done since that backup is lost. A backup from a newer version can't be restored until this server is updated, and an encrypted backup needs the same BACKUP_PASSWORD it was made with.

## Backup copies

**Backup copies** sends each new backup off the server as it is made.

By e-mail:

1. Tick **E-mail backups** and list up to 5 addresses in **Send to**, one per line.
2. Under **Which backups**, choose which types to send.
3. Keep **Only send encrypted backups** ticked unless you have a reason not to: a backup holds all the data and the encryption keys.
4. Set the **Largest attachment (MB)**. Bigger backups are not attached; a notice is sent instead.
5. Click **Send test e-mail**, then **Save**.

To a cloud folder:

1. Choose **OneDrive / SharePoint**, **Google Drive** or **WebDAV** (for example Nextcloud).
2. Set the **Folder** and **Which backups**. **Remove from the cloud the backups removed here** keeps the folder from filling up.
   Keep **Only copy encrypted backups** ticked: it is on by default, and a backup that isn't encrypted (no BACKUP_PASSWORD on the server) is then not uploaded and the last copy shows as failed. A backup holds all the data and the encryption keys, so it should not sit unencrypted with a cloud provider.
3. For OneDrive or Google Drive, follow the one-time setup shown on the card: register an app with Microsoft or Google using the redirect address shown (copy it with **Copy**), paste the **Client ID** and **Client secret**, click **Save**, then **Connect** and sign in. For WebDAV, fill in the **WebDAV address**, **Username** and **Password**.
4. Click **Test upload** to check it works, then **Save**.

The card shows the result of the last copy, so you can see whether copies are still arriving.

## Factory reset

On demo and test servers, a **Factory reset** card may appear at the bottom. It erases every company, user, work order and uploaded file on the server and restores the demo data. It asks for its own password and can't be undone. On a production server it is normally not shown.

## Who can access it

People whose role has **Company settings** (by default the Super Admin and Administrators) and who know the server password. Unlocking, failed attempts and every server operation are recorded in the security log. Company settings are in [Organization](/help/organization).
`,
  pt: `# Servidor

Definições de toda a instalação e não de uma só empresa: o nome do software, o envio de e-mail, as atualizações, as cópias de segurança e as cópias guardadas fora do servidor. Estão protegidas por uma palavra-passe própria do servidor.

## Para que serve esta página

Uma instalação da aplicação pode ter várias empresas. **Servidor** (em **Definições** no menu) trata da instalação em si:

- **Geral**: o nome do software e se qualquer pessoa pode criar uma conta.
- **E-mail**: como a aplicação envia convites, recuperação de palavra-passe, notificações e relatórios de serviço.
- **Atualizações**: a versão instalada e as atualizações num clique.
- **Cópias de segurança**: o agendamento, as cópias manuais, as transferências e as reposições.
- **Cópias dos backups**: cópias de cada backup enviadas por e-mail ou para uma pasta na cloud.

> Tudo nesta página afeta todas as empresas do servidor, não só a sua. Em particular, uma reposição substitui os dados de todas as empresas.

## Desbloquear a página

Como estas definições vão além da sua empresa, a sua função não basta. A página mostra primeiro **Introduza a palavra-passe do servidor**.

1. Escreva a **Palavra-passe do servidor**. É definida por quem instalou o servidor (a definição SERVER_ADMIN_PASSWORD ou, se não existir, FACTORY_RESET_PASSWORD).
2. Clique em **Desbloquear**.

A página fica desbloqueada para si, neste navegador, durante 30 minutos. Clique em **Bloquear** no topo para a fechar antes disso. Depois de várias palavras-passe erradas, o desbloqueio fica bloqueado durante 15 minutos.

Se a página disser que a administração do servidor está desligada, não foi definida nenhuma palavra-passe do servidor: peça a quem gere o servidor que a defina.

## Nome do software

Em **Geral**, o **Nome do software** aparece na página de início de sessão, no separador do navegador, na aplicação instalada e nos e-mails. Deixe-o vazio para usar o nome habitual. Clique em **Guardar**.

## Fechar o registo

Enquanto **Qualquer pessoa pode criar uma conta** estiver assinalado, a página de início de sessão mostra **Criar conta**, e qualquer pessoa que chegue ao servidor pode criar nele uma nova empresa. Depois de criar a sua empresa, desmarque-o e clique em **Guardar**: a ligação desaparece e a página de registo recusa novas empresas. As pessoas convidadas para uma empresa continuam a poder criar a sua conta através do link do convite.

Se a caixa estiver a cinzento, quem gere o servidor fechou o registo com a definição ALLOW_SIGNUP.

## Envio de e-mail

Enquanto o e-mail não estiver configurado, a aplicação não consegue enviar convites, recuperação de palavra-passe, notificações por e-mail nem relatórios de serviço. O cartão mostra como o e-mail sai neste momento.

1. Em **Enviar através de**, escolha **Conta SMTP** (qualquer caixa de correio: Microsoft 365, Google Workspace, o servidor de correio do seu domínio), **Resend** (o serviço de envio Resend, com uma chave de API) ou **Variáveis de ambiente** (as definições no ficheiro docker-compose do servidor).
2. Preencha o **Remetente**: o endereço de onde saem os e-mails, opcionalmente com um nome à frente. Com SMTP costuma ser a própria caixa de correio.
3. Para SMTP, preencha o **Servidor SMTP**, **Porta**, **Segurança**, **Utilizador** e **Palavra-passe**. Para Resend, cole a **Chave de API**.
4. Escreva um endereço em **Enviar um teste para** e clique em **Enviar e-mail de teste**. O teste usa o que está no formulário, mesmo antes de gravar.
5. Quando o teste chegar, clique em **Guardar**.

As palavras-passe e chaves de API são guardadas encriptadas; deixe o campo vazio para manter a que está gravada.

> Microsoft 365: smtp.office365.com, porta 587, STARTTLS, e o SMTP AUTH tem de estar ativo na caixa de correio. Google: smtp.gmail.com, porta 587, STARTTLS, com uma palavra-passe de aplicação. Se o teste não chegar, veja a pasta de spam.

## Atualizações

O cartão **Atualizações** mostra a **Versão instalada** e a **Última versão**, com **Atualização disponível** ou **Atualizado**. **Verificar agora** volta a verificar e **Novidades** mostra as notas de cada versão.

Para atualizar, clique em **Atualizar para** seguido do número da versão e confirme. Primeiro é feita uma cópia de segurança; depois a aplicação reinicia na nova versão, o que demora cerca de um minuto, e a página recarrega sozinha.

As atualizações num clique precisam do serviço de atualização do ficheiro docker-compose do servidor. Sem ele, o cartão avisa, e o servidor tem de ser atualizado por quem o gere. Também pode marcar **Instalar atualizações automaticamente** no agendamento das cópias: todos os dias, à hora das cópias, se houver uma nova versão, a aplicação faz uma cópia e depois atualiza.

## Cópias de segurança

Cada cópia inclui a base de dados, todos os ficheiros carregados e as chaves de encriptação, por isso pode ser reposta neste servidor ou num novo. Uma nota por baixo do título indica se as novas cópias são encriptadas (com a definição BACKUP_PASSWORD do servidor).

### Agendamento

1. Marque **Horária**, **Diária** e/ou **Mensal** e, para cada uma, indique **Manter as últimas** (quantas guardar; as mais antigas são apagadas).
2. Escolha a hora em **Cópias diárias e mensais às** e o **Fuso horário**. As cópias mensais são feitas no dia 1; as horárias, à hora certa.
3. Clique em **Guardar**.

### Cópias manuais e a lista

**Fazer cópia agora** faz uma cópia de imediato. **Carregar uma cópia…** acrescenta um ficheiro de cópia feito noutro lado, por exemplo para mudar para um novo servidor. A lista mostra a **Data**, o **Tipo**, a **Versão** e o **Tamanho** de cada cópia, com um cadeado quando está encriptada. Os tipos incluem **Manual**, **Antes de atualizar**, **Antes de repor** e **Carregada**; as cópias manuais e carregadas nunca são apagadas automaticamente.

Use os botões no fim de cada linha para **Transferir**, **Repor** ou **Eliminar** uma cópia.

> Guarde também cópias fora do servidor. Se o disco do servidor avariar, as cópias que estão nele perdem-se com ele. Transfira-as com regularidade ou configure as cópias dos backups mais abaixo.

## Repor uma cópia

1. Clique em **Repor** na linha da cópia que pretende.
2. Leia o aviso e escreva REPOR para confirmar.
3. Aguarde: a página mostra que a reposição está a decorrer, depois que o servidor está a reiniciar, e recarrega sozinha.

Antes de repor, a aplicação faz uma cópia **Antes de repor** do estado atual, para poder voltar atrás se escolheu a cópia errada.

> Uma reposição substitui tudo o que está neste servidor (todas as empresas, utilizadores, ordens de trabalho e ficheiros) pelo conteúdo da cópia. Perde-se tudo o que foi feito depois dessa cópia. Uma cópia de uma versão mais recente só pode ser reposta depois de atualizar este servidor, e uma cópia encriptada precisa da mesma BACKUP_PASSWORD com que foi feita.

## Cópias dos backups

**Cópias dos backups** envia cada novo backup para fora do servidor à medida que é feito.

Por e-mail:

1. Marque **Enviar backups por e-mail** e indique até 5 endereços em **Enviar para**, um por linha.
2. Em **Que backups**, escolha os tipos a enviar.
3. Mantenha **Enviar só backups encriptados** marcado, salvo se tiver uma razão para não o fazer: um backup tem todos os dados e as chaves de encriptação.
4. Indique o **Anexo máximo (MB)**. Os backups maiores não são anexados; é enviado um aviso.
5. Clique em **Enviar e-mail de teste** e depois em **Guardar**.

Para uma pasta na cloud:

1. Escolha **OneDrive / SharePoint**, **Google Drive** ou **WebDAV** (por exemplo Nextcloud).
2. Indique a **Pasta** e **Que backups**. **Remover da cloud os backups removidos aqui** evita que a pasta encha.
   Mantenha **Copiar só backups encriptados** marcado: vem ativo por defeito, e um backup não encriptado (sem BACKUP_PASSWORD no servidor) não é então enviado e a última cópia aparece como falhada. Um backup tem todos os dados e as chaves de encriptação, por isso não deve ficar sem encriptação num fornecedor de cloud.
3. No OneDrive ou Google Drive, siga a configuração única indicada no cartão: registe uma aplicação na Microsoft ou na Google com o endereço de redirecionamento mostrado (copie-o com **Copiar**), cole o **ID do cliente** e o **Segredo do cliente**, clique em **Guardar**, depois em **Ligar** e inicie sessão. No WebDAV, preencha o **Endereço WebDAV**, **Utilizador** e **Palavra-passe**.
4. Clique em **Testar envio** para confirmar que funciona e depois em **Guardar**.

O cartão mostra o resultado da última cópia, para poder ver se as cópias continuam a chegar.

## Repor definições de fábrica

Em servidores de demonstração e de teste, pode aparecer no fundo o cartão **Repor definições de fábrica**. Apaga todas as empresas, utilizadores, ordens de trabalho e ficheiros do servidor e repõe os dados de demonstração. Pede uma palavra-passe própria e não pode ser anulado. Num servidor de produção normalmente não aparece.

## Quem pode aceder

As pessoas cuja função tem **Definições da empresa** (por defeito o Super Admin e os Administradores) e que conhecem a palavra-passe do servidor. O desbloqueio, as tentativas falhadas e todas as operações no servidor ficam no registo de segurança. As definições da empresa estão em [Organização](/help/organization).
`,
};

export default text;
