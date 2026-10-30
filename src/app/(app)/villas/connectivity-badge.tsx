import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Online / Offline / Not checked, from the villa's last internet check. */
export async function ConnectivityBadge({ online, className }: { online: boolean | null; className?: string }) {
  const t = await getTranslations("connectivity");
  const [label, colour, dot] =
    online === null
      ? [t("unchecked"), "bg-gray-100 text-gray-600", "bg-gray-400"]
      : online
        ? [t("online"), "bg-green-50 text-green-700", "bg-green-500"]
        : [t("offline"), "bg-red-50 text-red-700", "bg-red-500"];
  return (
    <Badge className={cn("gap-1.5", colour, className)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </Badge>
  );
}
