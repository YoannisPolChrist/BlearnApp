#!/usr/bin/env node
// Guards against the .gitignore regression that silently excluded
// android/app/src/main/AndroidManifest.xml and res/ from the repository.
// Run in CI and before release builds: node scripts/check-android-sources.mjs
import { execSync } from 'node:child_process';

const REQUIRED_TRACKED = [
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/res',
];

const tracked = execSync('git ls-files android/app/src/main', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const missing = REQUIRED_TRACKED.filter(
  (required) => !tracked.some((file) => file === required || file.startsWith(`${required}/`)),
);

if (missing.length > 0) {
  console.error('FEHLER: Android-Quellen fehlen im Git-Index:');
  for (const entry of missing) {
    console.error(`  - ${entry}`);
  }
  console.error('');
  console.error('Ein frischer Clone kann so nicht gebaut werden. Prüfe .gitignore');
  console.error('(keine globalen Muster wie "AndroidManifest.xml" oder "res/")');
  console.error('und committe die Dateien vom Rechner mit dem lokalen Stand.');
  process.exit(1);
}

console.log('OK: AndroidManifest.xml und res/ sind im Repository getrackt.');
