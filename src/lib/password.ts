export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordStrength {
  activeBars: number;
  label: string;
  hint: string;
  tone: string;
  barTone: string;
}

export function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) {
    return null;
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const varietyScore = [hasUppercase, hasLowercase, hasNumber, hasSymbol].filter(Boolean).length;

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      activeBars: 1,
      label: 'Noch zu kurz',
      hint: `Nutze mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`,
      tone: 'text-destructive',
      barTone: 'bg-destructive',
    };
  }

  if (password.length >= 12 && varietyScore >= 3) {
    return {
      activeBars: 3,
      label: 'Stark',
      hint: 'Gut so.',
      tone: 'text-success',
      barTone: 'bg-success',
    };
  }

  if (varietyScore >= 2) {
    return {
      activeBars: 2,
      label: 'Solide',
      hint: 'Mit Zahl oder Zeichen noch besser.',
      tone: 'text-warning',
      barTone: 'bg-warning',
    };
  }

  return {
    activeBars: 2,
    label: 'Okay',
    hint: 'Mixe Buchstaben und Zahlen.',
    tone: 'text-warning',
    barTone: 'bg-warning',
  };
}
