import type { HelpShot, HelpText } from "@/lib/help";
import * as assets from "./assets";
import * as audit from "./audit";
import * as categories from "./categories";
import * as clients from "./clients";
import * as clientUsers from "./client-users";
import * as contracts from "./contracts";
import * as dashboard from "./dashboard";
import * as fieldApp from "./field-app";
import * as gettingStarted from "./getting-started";
import * as messages from "./messages";
import * as meters from "./meters";
import * as notifications from "./notifications";
import * as offices from "./offices";
import * as onCall from "./on-call";
import * as organization from "./organization";
import * as parts from "./parts";
import * as preventive from "./preventive";
import * as procedures from "./procedures";
import * as profile from "./profile";
import * as purchaseOrders from "./purchase-orders";
import * as reports from "./reports";
import * as requests from "./requests";
import * as roles from "./roles";
import * as scan from "./scan";
import * as search from "./search";
import * as server from "./server";
import * as teams from "./teams";
import * as users from "./users";
import * as vendors from "./vendors";
import * as villas from "./villas";
import * as workOrders from "./work-orders";

export type HelpModule = { default: HelpText; shots: HelpShot[] };

/** Article text and screenshots by topic slug (see HELP_TOPICS in lib/help.ts). */
export const HELP_CONTENT: Record<string, HelpModule> = {
  "getting-started": gettingStarted,
  dashboard,
  search,
  "field-app": fieldApp,
  scan,
  notifications,
  "work-orders": workOrders,
  requests,
  "on-call": onCall,
  preventive,
  procedures,
  messages,
  clients,
  contracts,
  villas,
  assets,
  meters,
  parts,
  "purchase-orders": purchaseOrders,
  vendors,
  reports,
  profile,
  organization,
  users,
  "client-users": clientUsers,
  roles,
  teams,
  offices,
  categories,
  audit,
  server,
};
