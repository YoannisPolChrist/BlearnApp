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
    description: 'Hier siehst du sofort deinen aktuellen Schutzstatus und gelangst mit einem Tap direkt in deine Modi.',
  },
  {
    id: 'dashboard-learn',
    route: '/',
    targetId: 'tour-dashboard-learn',
    eyebrow: 'Learn',
    highlightTone: 'learn',
    emphasisStyle: 'feature',
    title: 'Freischalten statt nur blockieren',
    description: 'Mit Learn verdienst du dir Zeitfenster durch Karten und Reviews, statt nur stumpf zu sperren.',
  },
  {
    id: 'dashboard-focus',
    route: '/',
    targetId: 'tour-dashboard-focus',
    eyebrow: 'Feedback',
    highlightTone: 'focus',
    emphasisStyle: 'grid',
    title: 'Blearn zeigt dir Wirkung direkt im Alltag',
      description: 'Diese Karten zeigen dir auf einen Blick, was heute schon besser läuft und wo dein Fokus wirkt.',
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
    description: 'Hier entscheidest du, ob du locker, lernbasiert oder deutlich strenger geschützt werden willst.',
  },
  {
    id: 'modes-blocking',
    route: '/modes',
    targetId: 'tour-modes-blocking',
    eyebrow: 'Zuweisung',
    highlightTone: 'modes',
    emphasisStyle: 'feature',
    title: 'Danach ordnest du echte Auslöser zu',
    description: 'Hier legst du fest, welche Apps oder Seiten von welchem Modus übernommen werden.',
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
    description: 'Hier startest du Lernfenster, siehst fällige Karten und hältst deine Pakete in Bewegung.',
  },
  {
    id: 'learn-actions',
    route: '/learn',
    targetId: 'tour-learn-actions',
    eyebrow: 'Pakete',
    highlightTone: 'learn',
    emphasisStyle: 'grid',
    title: 'Bibliothek und Templates decken alles ab',
    description: 'Bestehende Decks öffnen, Starter importieren oder neue Pakete bauen: alles hängt an diesen Kacheln.',
  },
];
