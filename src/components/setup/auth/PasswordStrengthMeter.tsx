import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { getPasswordStrength } from '@/lib/password';



export function PasswordStrengthMeter({ password }: { password?: string }) {
  const passwordStrength = useMemo(() => getPasswordStrength(password || ''), [password]);

  return (
    <div className="rounded-[1.45rem] border border-border/70 bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
          Passwort-Stärke
        </p>
        {passwordStrength ? (
          <p className={cn('text-xs font-bold', passwordStrength.tone)}>
            {passwordStrength.label}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Noch leer</p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn(
              'h-2 flex-1 rounded-full bg-border transition-colors',
              passwordStrength && index < passwordStrength.activeBars ? passwordStrength.barTone : null,
            )}
          />
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {passwordStrength
          ? passwordStrength.hint
          : 'Mindestens 8 Zeichen.'}
      </p>
    </div>
  );
}
