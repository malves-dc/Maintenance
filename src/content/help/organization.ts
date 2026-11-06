import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [{ name: "organization-page", path: "/settings/organization", maxHeight: 820 }];

const text: HelpText = {
  en: `# Organization

Your company's profile: name, logo, brand colour and the details printed on documents, plus the regional settings, business hours, privacy notice and data retention that apply to the whole company.

## What this page is for

**Organization** (under **Settings** in the menu) describes your company to everyone who deals with it. What you enter here appears in the app, in the client portal, in e-mails and on the PDF documents the app produces, such as service reports and purchase orders. It also holds a few company-wide rules: the time zone and currency, the business hours used by service contracts, who gets copies of service reports, and how long old records are kept.

![The Organization page: the main form on the left and the logo on the right](organization-page)

The page has one long form on the left, saved with the **Save** button at the bottom, and a **Logo** card on the right, which saves as soon as you pick a file.

## Company details

- **Company name**: the name shown in the app, the client portal and e-mails. It is the only required field.
- **Legal name**: the registered name, if different (for example "Demo Integrations, Lda."). It is printed on documents.
- **Tax number (NIF)**, **Phone**, **Email**, **Website** and **Address**: printed in the header of PDF documents and used in the default privacy notice. The website must start with http:// or https://.

## Logo and brand colour

To add or change the logo:

1. In the **Logo** card, click **Upload logo** (or **Replace logo** if there is one already).
2. Pick a PNG or JPEG file of up to 2 MB.

It is saved straight away, and the card shows a preview on white and on the brand colour. A wide logo on a white or transparent background works best. **Remove** takes it away.

Under **Branding**, the **Brand colour** is used for buttons, links, the client portal and PDF headers. Pick it with the colour picker or type a hex code such as #1f4f8f; the preview shows a button and link text in that colour. **Use default** goes back to the standard blue.

> The brand colour must be dark enough for white text on top of it. If it is too light, a warning appears and the colour is not saved.

## Documents

The **Document footer** is printed at the bottom of service reports and purchase orders. Use it for things like a licence number, insurance details or your IBAN.

## Privacy notice and data retention

The company has a public privacy notice, linked from request forms, the client portal and e-mails. By default the app uses a built-in notice filled in with the company details above. To use your own text, write it in **Custom privacy notice** (plain text, a blank line between paragraphs). **View the public notice** opens it as others see it.

**Data retention** sets how long old records are kept. Once a day, older ones are deleted (or, for QR request forms, the requester's contact details are removed). 0 keeps them forever.

- **Notifications (days)**: entries under the bell. Default 90 days.
- **Security log (months)**: the record of sign-ins and sensitive actions. Default 24 months.
- **QR requester contact details (months after the decision)**: names, e-mails and phones left by people who reported a fault through a QR code. Default 24 months.
- **Chat messages (months)**: default 0, kept forever.

## Regional settings

- **Time zone**: all dates and times in the app, reports and schedules use it.
- **Currency**: used for amounts to bill, prices, contract fees and purchase orders.
- **Default language**: the company's language. Each person can still choose their own language in [Profile](/help/profile).

## Time billing

**Bill time in blocks of** sets how work-order time is charged: each technician's time on a work order is rounded up to whole blocks of 15, 30 (the default) or 60 minutes, or not rounded, day by day. With 30-minute blocks, 34 minutes in a day bill as 1 hour, and 15 minutes on each of two days bill as 30 minutes each. It applies to the labour amount, billed hours in the reports and the time on the service report. The time each person logged is kept as it is and still counts for utilisation.

**Urgent work orders** sets the urgent fee charged to the client on work orders with Urgent priority: a **Fixed amount** plus a **Percentage of labour**. For example, 50 + 20% on a job with 80 of labour adds 66. Leave both at 0 for no fee. A [service contract](/help/contracts) can set its own. The fee shows in the work order's amounts to bill and the billing report, and the client's service report says **Service: Urgent**, without amounts.

**Trips for on-site work** sets what is charged when technicians work on site; remote time charges no trip. **Charge trips** chooses how they are counted: **One per technician per day** (two technicians on site the same day are two trips) or **One per work order per day** (however many go). Villas within the **Radius for the fixed fee** (25 km by default) pay the **Fixed fee per trip**; farther ones pay the **per km** rate × the villa's whole **Distance from the company** (one way; set it on each villa; a villa without one pays the fixed fee). For example, 30 within 25 km and 0.40 per km: a villa 40 km away costs 16 per trip. Leave the fee and the rate at 0 to charge no trips. A [service contract](/help/contracts) can include trips or set its own amounts. Trips show in the work order's amounts to bill and the billing report; the client's service report shows how many, without amounts.

## Service report copies

When someone e-mails a service report from a work order, the client is offered as a recipient. The **Service report copies** section adds company recipients that are offered every time, besides the client:

- **Everyone in these roles**: tick roles, including the ones your company created.
- **These people**: tick individual staff members.
- **These addresses**: other e-mail addresses, one per line (for example your accounts department).

They are only suggestions: the person sending the report can untick any of them.

## Business hours and holidays

Service contracts can count response and resolution times in business hours only (the **Count business hours only** option on a contract, see [Service contracts](/help/contracts)). Those contracts use the hours set here.

1. Tick each day the company is open and set the time it opens and closes. Days left unticked are closed all day.
2. In **Holidays**, list the days the SLA clock doesn't run, one per line, in the form YYYY-MM-DD (for example 2026-12-25).
3. Click **Save**.

> Times are in the company's time zone. Contracts that don't use **Count business hours only** count around the clock and ignore this section.

## On-call hours

Choose when whoever is on call receives new client requests (see [On call](/help/on-call)):

- **At any time**: every request goes to them, day and night.
- **Only in these hours**: tick the days and set a start and an end for each. An end at or before the start runs into the next day: **18:00–02:00** ends at 2 a.m. the next day, and **02:00–02:00** lasts 24 hours. When you first choose it, the hours are set to weekday evenings 18:00–02:00 and the whole weekend.
- **Company holidays: all day** also covers the holidays listed under business hours.

A request made at night after midnight belongs to the evening it started from, so on Monday at 1 a.m. it still goes to the person on call the week before. Outside these hours, requests only go to those who approve requests, as usual.

## Who can access it

Only roles with the **Company settings** permission, by default the Super Admin and Administrators. Changes are recorded in the security log. Server-wide settings, such as backups and e-mail delivery, are in [Server](/help/server), not here.
`,
  pt: `# Organização

O perfil da sua empresa: nome, logótipo, cor da marca e os dados que aparecem nos documentos, além das definições regionais, horário de funcionamento, aviso de privacidade e conservação de dados que se aplicam a toda a empresa.

## Para que serve esta página

**Organização** (em **Definições** no menu) apresenta a sua empresa a todos os que lidam com ela. O que escrever aqui aparece na aplicação, no portal do cliente, nos e-mails e nos documentos PDF que a aplicação produz, como os relatórios de serviço e as notas de encomenda. Também reúne algumas regras de toda a empresa: o fuso horário e a moeda, o horário de funcionamento usado pelos contratos de serviço, quem recebe cópias dos relatórios de serviço e durante quanto tempo se guardam os registos antigos.

![A página Organização: o formulário principal à esquerda e o logótipo à direita](organization-page)

A página tem um formulário longo à esquerda, guardado com o botão **Guardar** no fundo, e um cartão **Logótipo** à direita, que é guardado assim que escolhe um ficheiro.

## Dados da empresa

- **Nome da empresa**: o nome que aparece na aplicação, no portal do cliente e nos e-mails. É o único campo obrigatório.
- **Denominação social**: o nome registado, se for diferente (por exemplo "Demo Integrations, Lda."). Aparece nos documentos.
- **NIF**, **Telefone**, **Email**, **Website** e **Morada**: aparecem no cabeçalho dos documentos PDF e são usados no aviso de privacidade predefinido. O website tem de começar por http:// ou https://.

## Logótipo e cor da marca

Para acrescentar ou mudar o logótipo:

1. No cartão **Logótipo**, clique em **Carregar logótipo** (ou **Substituir logótipo**, se já existir um).
2. Escolha um ficheiro PNG ou JPEG até 2 MB.

Fica guardado de imediato e o cartão mostra uma pré-visualização sobre branco e sobre a cor da marca. Funciona melhor um logótipo horizontal com fundo branco ou transparente. **Remover** retira-o.

Em **Imagem da marca**, a **Cor da marca** é usada em botões, links, no portal do cliente e no cabeçalho dos PDF. Escolha-a no seletor de cores ou escreva um código hexadecimal como #1f4f8f; a pré-visualização mostra um botão e texto de link nessa cor. **Usar predefinição** volta ao azul habitual.

> A cor da marca tem de ser escura o suficiente para ter texto branco por cima. Se for demasiado clara, aparece um aviso e a cor não é guardada.

## Documentos

O **Rodapé dos documentos** aparece no fundo dos relatórios de serviço e das notas de encomenda. Use-o para, por exemplo, o número de alvará, os dados do seguro ou o IBAN.

## Aviso de privacidade e conservação de dados

A empresa tem um aviso de privacidade público, com ligação nos formulários de pedido, no portal do cliente e nos e-mails. Por defeito, a aplicação usa um aviso incluído, preenchido com os dados da empresa acima. Para usar o seu próprio texto, escreva-o em **Aviso de privacidade personalizado** (texto simples, com uma linha em branco entre parágrafos). **Ver o aviso público** abre-o tal como os outros o veem.

A **Conservação de dados** define durante quanto tempo se guardam os registos antigos. Uma vez por dia, os mais antigos são apagados (ou, nos formulários de pedido por QR, são removidos os contactos de quem fez o pedido). 0 guarda-os para sempre.

- **Notificações (dias)**: as entradas do sino. Por defeito, 90 dias.
- **Registo de segurança (meses)**: o registo de inícios de sessão e ações sensíveis. Por defeito, 24 meses.
- **Contactos de quem fez pedidos por QR (meses após a decisão)**: nomes, e-mails e telefones deixados por quem comunicou uma avaria através de um código QR. Por defeito, 24 meses.
- **Mensagens de chat (meses)**: por defeito 0, guardadas para sempre.

## Definições regionais

- **Fuso horário**: todas as datas e horas da aplicação, dos relatórios e dos agendamentos usam-no.
- **Moeda**: usada nos valores a faturar, preços, mensalidades dos contratos e notas de encomenda.
- **Idioma predefinido**: o idioma da empresa. Cada pessoa pode na mesma escolher o seu idioma no [Perfil](/help/profile).

## Faturação do tempo

**Faturar o tempo em blocos de** define como é cobrado o tempo das ordens de trabalho: o tempo de cada técnico numa ordem de trabalho é arredondado para cima a blocos inteiros de 15, 30 (por defeito) ou 60 minutos, ou não é arredondado, dia a dia. Com blocos de 30 minutos, 34 minutos num dia são faturados como 1 hora, e 15 minutos em cada um de dois dias são faturados como 30 minutos cada. Aplica-se ao valor da mão de obra, às horas faturadas nos relatórios e ao tempo no relatório de serviço. O tempo que cada pessoa registou mantém-se e continua a contar para a utilização.

**Ordens de trabalho urgentes** define a taxa de urgência cobrada ao cliente nas ordens de trabalho com prioridade Urgente: um **Valor fixo** mais uma **Percentagem da mão de obra**. Por exemplo, 50 + 20% num trabalho com 80 de mão de obra acrescenta 66. Deixe ambos a 0 para não haver taxa. Cada [contrato de manutenção](/help/contracts) pode ter a sua. A taxa aparece nos valores a faturar da ordem de trabalho e no relatório de faturação, e o relatório de serviço do cliente indica **Serviço: Urgente**, sem valores.

**Deslocações (trabalho no local)** define o que é cobrado quando os técnicos trabalham no local; o tempo remoto não cobra deslocação. **Cobrar deslocações** escolhe como são contadas: **Uma por técnico e por dia** (dois técnicos no local no mesmo dia são duas deslocações) ou **Uma por ordem de trabalho e por dia** (quantos forem). As moradias dentro do **Raio do valor fixo** (25 km por defeito) pagam o **Valor fixo por deslocação**; as mais distantes pagam o valor **por km** × toda a **Distância à empresa** da moradia (só ida; defina-a em cada moradia; uma moradia sem distância paga o valor fixo). Por exemplo, 30 até 25 km e 0,40 por km: uma moradia a 40 km custa 16 por deslocação. Deixe o valor fixo e o valor por km a 0 para não cobrar deslocações. Cada [contrato de manutenção](/help/contracts) pode incluir as deslocações ou ter os seus próprios valores. As deslocações aparecem nos valores a faturar da ordem de trabalho e no relatório de faturação; o relatório de serviço do cliente mostra quantas foram, sem valores.

## Cópias dos relatórios de serviço

Quando alguém envia por e-mail um relatório de serviço a partir de uma ordem de trabalho, o cliente é sugerido como destinatário. A secção **Cópias dos relatórios de serviço** acrescenta destinatários da empresa que são sugeridos sempre, além do cliente:

- **Todas as pessoas destas funções**: marque funções, incluindo as criadas pela sua empresa.
- **Estas pessoas**: marque colaboradores individuais.
- **Estes endereços**: outros endereços de e-mail, um por linha (por exemplo a contabilidade).

São apenas sugestões: quem envia o relatório pode desmarcar qualquer um deles.

## Horário de funcionamento e feriados

Os contratos de serviço podem contar os tempos de resposta e de resolução apenas em horário laboral (a opção **Contar apenas horário laboral** num contrato, veja [Contratos de manutenção](/help/contracts)). Esses contratos usam o horário definido aqui.

1. Marque cada dia em que a empresa está aberta e indique a hora a que abre e fecha. Os dias não marcados ficam fechados o dia todo.
2. Em **Feriados**, indique os dias em que o relógio do SLA não conta, um por linha, no formato AAAA-MM-DD (por exemplo 2026-12-25).
3. Clique em **Guardar**.

> As horas estão no fuso horário da empresa. Os contratos que não usam **Contar apenas horário laboral** contam a toda a hora e ignoram esta secção.

## Horário de prevenção

Escolha quando quem está de prevenção recebe os novos pedidos dos clientes (veja [Prevenção](/help/on-call)):

- **A qualquer hora**: todos os pedidos vão para essa pessoa, de dia e de noite.
- **Só neste horário**: marque os dias e defina, para cada um, uma hora de início e de fim. Uma hora de fim igual ou anterior à de início termina no dia seguinte: **18:00–02:00** acaba às 2h do dia seguinte e **02:00–02:00** dura 24 horas. Quando o escolhe pela primeira vez, o horário fica com as noites dos dias úteis das 18:00 às 02:00 e o fim de semana completo.
- **Feriados da empresa: todo o dia** cobre também os feriados indicados no horário de funcionamento.

Um pedido feito depois da meia-noite pertence à noite em que o período começou: na segunda-feira à 1h ainda vai para quem estava de prevenção na semana anterior. Fora deste horário, os pedidos vão apenas para quem aprova pedidos, como habitualmente.

## Quem pode aceder

Só as funções com a permissão **Definições da empresa**, por defeito o Super Admin e os Administradores. As alterações ficam no registo de segurança. As definições de todo o servidor, como as cópias de segurança e o envio de e-mail, estão em [Servidor](/help/server), não aqui.
`,
};

export default text;
