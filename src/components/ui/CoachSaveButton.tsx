import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { tonePalettes } from "@/lib/semanticTones";
import { cn } from "@/lib/utils";

interface CoachSaveButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function CoachSaveButton({
  children,
  className,
  disabled,
  loading = false,
  ...props
}: CoachSaveButtonProps) {
  const isDisabled = disabled || loading;
  const primaryPalette = tonePalettes.primary;
  const mutedPalette = tonePalettes.normal;

  return (
    <button
      type="button"
      {...props}
      disabled={isDisabled}
      className={cn(
        "group relative isolate flex w-full items-center justify-center rounded-[1.7rem] px-6 py-4 text-lg font-black tracking-tight transition-all duration-200 sm:w-auto",
        isDisabled
          ? `cursor-not-allowed opacity-80 ${mutedPalette.badge}`
          : `${primaryPalette.button} hover:-translate-y-0.5 hover:shadow-[0_28px_55px_hsl(var(--primary)/0.32)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--primary)/0.16)]`,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[2px] rounded-[1.5rem] bg-white/10 opacity-0 transition group-hover:opacity-100"
      />
      <span className="relative flex items-center gap-2">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        <span>{children}</span>
      </span>
    </button>
  );
}
