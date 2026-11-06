import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [
  { name: "reports-overview", path: "/reports", maxHeight: 900 },
  { name: "reports-work-orders", path: "/reports/work-orders", maxHeight: 900 },
];

const text: HelpText = {
  en: `# Reports

How the company is doing: workload, repair times, SLA compliance, billing, technicians' time and how reliable the equipment is, for any period, client, villa or system, with CSV exports.

## What reports are for

Reports add up what is recorded in work orders, time entries, parts, contracts and asset status. They are for the weekly review, the monthly conversation with a client, or checking whether a contract pays for itself. Nothing needs to be entered here: the better the work orders are kept, the better the reports.

## The filter row

One row of filters at the top applies to every tab, chart, table and export:

- **Period**: **Last 30 days**, **Last 90 days** (the default), **Last 12 months**, **Year to date** or **Custom range** with a start and end date (at most three years).
- **Client** and **Villa**: limit everything to one client or one villa. Picking a client narrows the villa list to theirs.
- **System**: only work on one system (network, CCTV, electrical…).

The filters are part of the page address, and the tabs keep them when you switch, so you can bookmark or share a report exactly as you see it.

## The tabs

![The overview tab with the filter row, the key figures and the opened vs completed chart](reports-overview)

### Overview

The key figures for the period: **Opened** and **Completed** work orders, **Open now** (everything still open, whenever it started), **Mean time to repair**, **Median first response**, **Response SLA met**, **Resolution SLA met**, **PM compliance** and **Value of the work**. A figure turns red when SLA compliance falls under 90% or PM compliance under 80%. The **Opened vs completed** chart shows the trend per day, week or month depending on the length of the period; **Show as table** lists the same numbers.

### Work orders

![The work orders tab: breakdowns, time to repair and preventive maintenance compliance](reports-work-orders)

Work orders opened in the period **By type**, **By system**, **By priority** and **By villa** (top 10); **Time to repair** per system and per priority, with the average and the median; and **Preventive maintenance compliance**: how many preventive jobs were **Due**, done **On time**, done **Late** or **Not done**, in total and per villa.

### SLA

For work under a service contract: how many jobs were **Under contract**, the share that met the response and resolution targets, a breakdown **By contract** with the number of breaches, and the latest 50 **Breached work orders**. See [Service contracts](/help/contracts) for how the targets are set.

### Billing

The **Value of the work** split into **Labour**, **Parts**, **Other charges** and **Urgent fee**; **Value by villa** (stacked bars); **Value by client** with the **Contract fees** for the period and **Fees − work** (the contract fees minus the value of the work done, in red when negative; it is not a profit margin); and **Value by system**.

### Technicians

**Hours logged** per person, and a table with hours, **Hours billed**, **Utilisation**, **Jobs worked**, jobs **Completed** and, for those who can see amounts, labour.

### Assets

**Average availability**, **Assets with downtime** and **Repairs opened**; the assets with **Most downtime**; and a table of every asset with downtime or repairs, showing time **Down**, time **Degraded**, **Availability** and number of **Repairs**.

## How the figures are counted

- Counts, amounts and SLA follow the work orders **opened** in the period. Mean time to repair follows the work orders **completed** in the period. Preventive compliance follows the preventive work **due** in the period, up to today.
- **Mean time to repair** and **Median first response** only count repairs: reactive, corrective and emergency work orders. They run from the moment the work order was opened to its completion (or to the first response).
- **SLA** percentages only count targets that are decided. A job whose deadline hasn't passed and isn't finished yet isn't counted until it is met or missed.
- **On time** (preventive) means completed by its due date.
- **Labour** is the billed time (each technician's time per work order and day rounded up to the company's blocks, 30 minutes by default) at each technician's price per hour; **Parts** are charged at their sale price when they were used.
- **Contract fees** are the monthly fees of the client's contracts, pro rata for the days in the period. With a villa filter, only contracts for that villa count; with a system filter, fees and **Fees − work** are hidden because a fee can't be split by system.
- **Utilisation** compares the hours a person logged with the hours available: 8 hours per working day (Monday to Friday) in the period.
- **Downtime** is the time an asset was marked **Down** in its status history; availability is the share of the period it wasn't down. Time before the asset was added doesn't count against it. **Repairs** are reactive, corrective and emergency work orders opened on the asset.
- Dates in reports are whole calendar days in UTC.

> If a figure looks wrong, check the data behind it: a job completed without being marked done, time not logged, or an asset never set back to operational all show up here.

## Exporting

Each tab has an export button (**Export work orders** on the overview and work orders tabs, **Export CSV** on the others). The CSV file has the same filters as the page and opens directly in Excel or any spreadsheet. The work orders export lists every work order opened in the period, one per row, with its dates, SLA and amounts.

## Who can see reports

- **Super Admin**, **Administrator**, **Manager**, **Viewer** and **Accountant** can open reports by default; technicians and clients can't.
- The **Billing** tab, the value of the work and the labour column need the **See amounts** permission. The Super Admin can change both in [Settings → Roles](/help/roles).
`,
  pt: `# Relatórios

Como está a correr a empresa: volume de trabalho, tempos de reparação, cumprimento de SLA, faturação, tempo dos técnicos e fiabilidade dos equipamentos, para qualquer período, cliente, moradia ou sistema, com exportação para CSV.

## Para que servem os relatórios

Os relatórios somam o que está registado nas ordens de trabalho, registos de tempo, peças, contratos e estado dos equipamentos. Servem para a revisão semanal, para a reunião mensal com um cliente, ou para ver se um contrato compensa. Não é preciso introduzir nada aqui: quanto melhor forem mantidas as ordens de trabalho, melhores são os relatórios.

## A linha de filtros

Uma linha de filtros no topo aplica-se a todos os separadores, gráficos, tabelas e exportações:

- **Período**: **Últimos 30 dias**, **Últimos 90 dias** (por defeito), **Últimos 12 meses**, **Desde o início do ano** ou **Intervalo personalizado** com data de início e de fim (no máximo três anos).
- **Cliente** e **Moradia**: limitam tudo a um cliente ou a uma moradia. Ao escolher um cliente, a lista de moradias passa a mostrar só as dele.
- **Sistema**: só o trabalho num sistema (rede, CCTV, elétrico…).

Os filtros fazem parte do endereço da página e os separadores mantêm-nos quando muda, por isso pode guardar ou partilhar um relatório tal como o vê.

## Os separadores

![O separador Resumo com a linha de filtros, os números principais e o gráfico de abertas vs concluídas](reports-overview)

### Resumo

Os números principais do período: ordens de trabalho **Abertas** e **Concluídas**, **Em aberto** (tudo o que ainda está aberto, independentemente da data), **Tempo médio de reparação**, **Primeira resposta (mediana)**, **SLA de resposta cumprido**, **SLA de resolução cumprido**, **Cumprimento da manutenção preventiva** e **Valor do trabalho**. Um número fica a vermelho quando o cumprimento de SLA desce abaixo de 90% ou o da manutenção preventiva abaixo de 80%. O gráfico **Abertas vs concluídas** mostra a evolução por dia, semana ou mês, conforme a duração do período; **Ver em tabela** mostra os mesmos números.

### Ordens de trabalho

![O separador Ordens de trabalho: distribuições, tempo de reparação e cumprimento da manutenção preventiva](reports-work-orders)

As ordens de trabalho abertas no período **Por tipo**, **Por sistema**, **Por prioridade** e **Por moradia** (top 10); o **Tempo de reparação** por sistema e por prioridade, com a média e a mediana; e o **Cumprimento da manutenção preventiva**: quantas ordens preventivas estavam **Previstas**, quantas foram feitas **A tempo**, quantas **Atrasadas** e quantas estão **Por fazer**, no total e por moradia.

### SLA

Para o trabalho abrangido por um contrato de manutenção: o número de ordens de trabalho **Abrangidas por contrato**, a percentagem que cumpriu os prazos de resposta e de resolução, a divisão **Por contrato** com o número de falhas, e as últimas 50 **Ordens de trabalho com SLA falhado**. Veja [Contratos de manutenção](/help/contracts) para saber como se definem os prazos.

### Faturação

O **Valor do trabalho** dividido em **Mão de obra**, **Peças**, **Outros valores** e **Taxa de urgência**; o **Valor por moradia** (barras empilhadas); o **Valor por cliente** com as **Mensalidades** do período e **Mensalidades − trabalho** (as mensalidades dos contratos menos o valor do trabalho feito, a vermelho quando é negativo; não é uma margem de lucro); e o **Valor por sistema**.

### Técnicos

As **Horas registadas** por pessoa, e uma tabela com as horas, as **Horas faturadas**, a **Utilização**, os **Trabalhos** em que participou, os **Concluídos** e, para quem pode ver valores, a mão de obra.

### Equipamentos

A **Disponibilidade média**, os **Equipamentos com inatividade** e as **Reparações abertas**; os equipamentos com **Maior inatividade**; e uma tabela com todos os equipamentos com inatividade ou reparações, com o tempo **Avariado**, o tempo **Degradado**, a **Disponibilidade** e o número de **Reparações**.

## Como são contados os números

- As contagens, os valores e o SLA seguem as ordens de trabalho **abertas** no período. O tempo médio de reparação segue as ordens de trabalho **concluídas** no período. O cumprimento da manutenção preventiva segue o trabalho preventivo **previsto** no período, até hoje.
- O **Tempo médio de reparação** e a **Primeira resposta (mediana)** só contam reparações: ordens de trabalho reativas, corretivas e de emergência. Vão desde a abertura da ordem de trabalho até à conclusão (ou até à primeira resposta).
- As percentagens de **SLA** só contam prazos decididos. Um trabalho cujo prazo ainda não passou e que ainda não terminou só conta quando for cumprido ou falhado.
- **A tempo** (preventiva) significa concluída até à data prevista.
- A **Mão de obra** é o tempo faturado (o tempo de cada técnico por ordem de trabalho e por dia arredondado para cima aos blocos da empresa, 30 minutos por defeito) ao preço por hora de cada técnico; as **Peças** contam ao preço de venda que tinham quando foram usadas.
- As **Mensalidades** são o valor mensal dos contratos do cliente, proporcional aos dias do período. Com o filtro de moradia, só contam os contratos dessa moradia; com o filtro de sistema, as mensalidades e **Mensalidades − trabalho** ficam escondidas, porque uma mensalidade não se pode dividir por sistema.
- A **Utilização** compara as horas que a pessoa registou com as horas disponíveis: 8 horas por dia útil (segunda a sexta) no período.
- A **inatividade** é o tempo em que um equipamento esteve marcado como **Avariado** no seu histórico de estado; a disponibilidade é a parte do período em que não esteve avariado. O tempo antes de o equipamento ser criado não conta contra ele. As **Reparações** são ordens de trabalho reativas, corretivas e de emergência abertas no equipamento.
- As datas nos relatórios são dias de calendário completos em UTC.

> Se um número parecer errado, verifique os dados por trás: um trabalho terminado mas não marcado como concluído, tempo não registado ou um equipamento que nunca voltou a operacional aparecem todos aqui.

## Exportar

Cada separador tem um botão de exportação (**Exportar ordens de trabalho** no Resumo e em Ordens de trabalho, **Exportar CSV** nos outros). O ficheiro CSV tem os mesmos filtros que a página e abre diretamente no Excel ou noutra folha de cálculo. A exportação de ordens de trabalho lista todas as ordens abertas no período, uma por linha, com as datas, o SLA e os valores.

## Quem pode ver os relatórios

- **Super Admin**, **Administrador**, **Gestor**, **Observador** e **Contabilista** podem abrir os relatórios por defeito; os técnicos e os clientes não.
- O separador **Faturação**, o valor do trabalho e a coluna da mão de obra exigem a permissão **Ver valores**. O Super Admin pode alterar ambos em [Definições → Funções](/help/roles).
`,
};

export default text;
