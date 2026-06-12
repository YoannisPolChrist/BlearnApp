export interface AppTourStep {
  id: string;
  route: string;
  targetId: string;
  title: string;
  description: string;
  eyebrow: string;
  highlightTone: 'primary' | 'learn' | 'focus' | 'modes';
  emphasisStyle?: 'hero' | 'feature' | 'grid';
  spotlightPadding?: number;
}

export const APP_TOUR_STEPS: AppTourStep[] = [
  {
    id: 'dashboard-modes',
    route: '/',
    targetId: 'tour-dashboard-modes',
    eyebrow: 'Dashboard',
    highlightTone: 'primary',
    emphasisStyle: 'hero',
    spotlightPadding: 18,
    title: 'Hier steuerst du deinen Fokus',
    description: 'Dein Schutzstatus auf einen Blick – ein Tap führt zu den Modi.',
  },
  {
    id: 'dashboard-learn',
    route: '/',
    targetId: 'tour-dashboard-learn',
    eyebrow: 'Learn',
    highlightTone: 'learn',
    emphasisStyle: 'feature',
    title: 'Freischalten statt nur blockieren',
    description: 'Learn: Zeitfenster durch Reviews verdienen statt nur sperren.',
  },
  {
    id: 'dashboard-focus',
    route: '/',
    targetId: 'tour-dashboard-focus',
    eyebrow: 'Feedback',
    highlightTone: 'focus',
    emphasisStyle: 'grid',
    title: 'Blearn zeigt dir Wirkung direkt im Alltag',
      description: 'Zeigt, was heute besser läuft und wo dein Fokus wirkt.',
  },
  {
    id: 'modes-selector',
    route: '/modes',
    targetId: 'tour-modes-selector',
    eyebrow: 'Modi',
    highlightTone: 'modes',
    emphasisStyle: 'hero',
    spotlightPadding: 18,
    title: 'Hier wählst du die passende Schutzstufe',
    description: 'Wähle, wie streng dein Schutz sein soll.',
  },
  {
    id: 'modes-blocking',
    route: '/modes',
    targetId: 'tour-modes-blocking',
    eyebrow: 'Zuweisung',
    highlightTone: 'modes',
    emphasisStyle: 'feature',
    title: 'Danach ordnest du echte Auslöser zu',
    description: 'Lege fest, welcher Modus welche Apps und Seiten übernimmt.',
  },
  {
    id: 'learn-hero',
    route: '/learn',
    targetId: 'tour-learn-hero',
    eyebrow: 'Learn Hub',
    highlightTone: 'learn',
    emphasisStyle: 'hero',
    spotlightPadding: 18,
    title: 'Die Lernzentrale ist dein Freischalt-Motor',
    description: 'Starte Lernfenster und behalte fällige Karten im Blick.',
  },
  {
    id: 'learn-actions',
    route: '/learn',
    targetId: 'tour-learn-actions',
    eyebrow: 'Pakete',
    highlightTone: 'learn',
    emphasisStyle: 'grid',
    title: 'Bibliothek und Templates decken alles ab',
    description: 'Decks öffnen, Starter importieren oder neue Pakete bauen.',
  },
];
