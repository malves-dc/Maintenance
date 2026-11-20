"use client";

import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

// Text fields with a "used / total" counter underneath. There is deliberately no maxLength: the person can
// keep typing, the text and the counter turn red past the limit, and the server action rejects it (too_big).

function Counter({ used, max }: { used: number; max: number }) {
  const t = useTranslations("common");
  return (
    <span aria-live="polite" className={cn("block text-right text-xs tabular-nums", used > max ? "font-medium text-danger" : "text-muted")}>
      {t("charCount", { used, max })}
    </span>
  );
}

export function CountedInput({ max, className, onChange, ...props }: Omit<ComponentProps<"input">, "maxLength"> & { max: number }) {
  const [used, setUsed] = useState(String(props.defaultValue ?? "").length);
  const over = used > max;
  return (
    <>
      <Input
        {...props}
        aria-invalid={over || undefined}
        className={cn(className, over && "text-danger")}
        onChange={(e) => {
          setUsed(e.target.value.length);
          onChange?.(e);
        }}
      />
      <Counter used={used} max={max} />
    </>
  );
}

export function CountedTextarea({ max, className, onChange, ...props }: Omit<ComponentProps<"textarea">, "maxLength"> & { max: number }) {
  const [used, setUsed] = useState(String(props.defaultValue ?? "").length);
  const over = used > max;
  return (
    <>
      <Textarea
        {...props}
        aria-invalid={over || undefined}
        className={cn(className, over && "text-danger")}
        onChange={(e) => {
          setUsed(e.target.value.length);
          onChange?.(e);
        }}
      />
      <Counter used={used} max={max} />
    </>
  );
}
