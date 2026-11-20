import type { HelpShot, HelpText } from "@/lib/help";

export const shots: HelpShot[] = [];

const text: HelpText = {
  en: `# Offices

For a company with bases in several places: say which office each technician works from and which office looks after each villa, so that trips are charged by the real distance from where the technician left.

## How offices change the trip charge

Trips are set up in [Settings → Organization](/help/organization): a fixed fee within the radius, and beyond it the rate per km × the whole one-way distance. With offices, that distance is measured from the office the trip left from:

1. The office set for that technician on the work order, if any.
2. Otherwise the technician's **primary** office.
3. Otherwise (a technician without an office) the villa's **default office**.

For example, with 30 within 25 km and 0.40 per km: a villa looked after by the Faro office is 12 km from Faro and 62 km from Lagos. A Faro technician pays the fixed 30; a Lagos technician sent there pays 62 × 0.40 = 24.80.

When the company charges **one trip per work order per day**, technicians who came from the same office share one trip, and technicians from two offices are two trips, each at its own distance. The work order's amounts to bill show the trips per office.

## Creating offices

1. Open **Settings → Offices**.
2. Under **New office**, type the **Name**, and optionally the **Address**.
3. Add the **Latitude** and **Longitude** (copy them from a map). Without them, distances to this office can't be worked out and must be typed on each villa.
4. Click **Create**.

> The first office takes over what the company had before: each villa's distance becomes its distance from this office, and it becomes every villa's default office.

Use **Edit** on an office's card to change it. The bin deletes an office: its villas lose their default office and its technicians their membership.

## Who works from each office

On an office's card, **Add person** adds a member of staff. Someone can work from several offices; the star marks their **primary** office, the one their trips leave from by default. Click the empty star next to another office to make it the primary one. A line above the cards lists the staff who aren't in any office yet.

On a work order, managers (and each technician for themselves while the job is open) can change the office a person left from, next to their role under **Assigned to**. Managers can still change it after the job is closed, until it is invoiced.

## Villas and distances

Each villa's form has a **Default office** and one distance per office. Leave a distance empty to have it worked out from the coordinates of the villa and the office; type a number to fix it (it is then never replaced). The villa's page lists its distance from every office and how it was worked out.

**Distances to villas** at the top of the Offices page chooses how they are worked out:

- Off (the default): an **estimate**, the straight line between the coordinates × 1.3 for the road. Nothing leaves the server.
- **Road distances**: the shortest road distance from the routing server (OSRM). Only coordinates are sent, never names or addresses. If the server can't be reached, the estimate is used.

**Recalculate** works out again every distance that wasn't typed by hand, for example after adding coordinates to villas.

## Who can do what

- **Super Admin** and **Administrator** manage offices, their people and the distance settings.
- Anyone who can edit villas sets a villa's default office and distances.
`,
  pt: `# Escritórios

Para uma empresa com bases em vários locais: indique de que escritório trabalha cada técnico e que escritório acompanha cada moradia, para que as deslocações sejam cobradas pela distância real a partir de onde o técnico saiu.

## Como os escritórios mudam a deslocação cobrada

As deslocações configuram-se em [Definições → Empresa](/help/organization): um valor fixo dentro do raio e, para além dele, o valor por km × toda a distância só de ida. Com escritórios, essa distância é medida a partir do escritório de onde a deslocação saiu:

1. O escritório indicado para esse técnico na ordem de trabalho, se houver.
2. Senão, o escritório **principal** do técnico.
3. Senão (um técnico sem escritório), o **escritório por defeito** da moradia.

Por exemplo, com 30 até 25 km e 0,40 por km: uma moradia acompanhada pelo escritório de Faro fica a 12 km de Faro e a 62 km de Lagos. Um técnico de Faro paga os 30 fixos; um técnico de Lagos enviado para lá paga 62 × 0,40 = 24,80.

Quando a empresa cobra **uma deslocação por ordem de trabalho e por dia**, os técnicos que vieram do mesmo escritório partilham uma deslocação, e técnicos de dois escritórios são duas deslocações, cada uma à sua distância. Os valores a faturar da ordem de trabalho mostram as deslocações por escritório.

## Criar escritórios

1. Abra **Definições → Escritórios**.
2. Em **Novo escritório**, escreva o **Nome** e, se quiser, a **Morada**.
3. Acrescente a **Latitude** e a **Longitude** (copie-as de um mapa). Sem elas, as distâncias a este escritório não podem ser calculadas e têm de ser escritas em cada moradia.
4. Clique em **Criar**.

> O primeiro escritório herda o que a empresa tinha antes: a distância de cada moradia passa a ser a distância a este escritório, e ele passa a ser o escritório por defeito de todas as moradias.

Use **Editar** no cartão de um escritório para o alterar. O caixote do lixo apaga um escritório: as suas moradias ficam sem escritório por defeito e os seus técnicos deixam de pertencer a ele.

## Quem trabalha em cada escritório

No cartão de um escritório, **Adicionar pessoa** acrescenta um membro da equipa. Uma pessoa pode trabalhar em vários escritórios; a estrela marca o seu escritório **principal**, de onde saem as suas deslocações por defeito. Clique na estrela vazia junto a outro escritório para o tornar o principal. Uma linha acima dos cartões indica as pessoas que ainda não estão em nenhum escritório.

Numa ordem de trabalho, os gestores (e cada técnico para si próprio, enquanto o trabalho está aberto) podem mudar o escritório de onde a pessoa saiu, junto à sua função em **Atribuída a**. Os gestores podem mudá-lo mesmo depois de o trabalho fechar, até ser faturado.

## Moradias e distâncias

O formulário de cada moradia tem um **Escritório por defeito** e uma distância por escritório. Deixe uma distância vazia para que seja calculada a partir das coordenadas da moradia e do escritório; escreva um número para a fixar (nunca é substituída). A página da moradia mostra a distância a cada escritório e como foi obtida.

**Distâncias às moradias**, no topo da página Escritórios, escolhe como são calculadas:

- Desligado (por defeito): uma **estimativa**, a linha reta entre as coordenadas × 1,3 para a estrada. Nada sai do servidor.
- **Distâncias por estrada**: a distância por estrada mais curta, dada pelo servidor de rotas (OSRM). Só são enviadas coordenadas, nunca nomes nem moradas. Se o servidor não responder, usa-se a estimativa.

**Recalcular** volta a calcular todas as distâncias que não foram escritas à mão, por exemplo depois de acrescentar coordenadas às moradias.

## Quem pode fazer o quê

- O **Super Admin** e o **Administrador** gerem os escritórios, as suas pessoas e as definições de distância.
- Quem pode editar moradias define o escritório por defeito e as distâncias de cada moradia.
`,
};

export default text;
