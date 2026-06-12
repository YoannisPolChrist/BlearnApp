const NON_BLOCKABLE_APP_IDS = new Set([
  'android',
  'blearn',
  'app.blearn.mobile',
  'com.android.vpndialogs',
  'com.google.android.captiveportallogin',
  'com.google.android.gms',
  'com.google.android.packageinstaller',
  'com.google.android.permissioncontroller',
  'com.android.permissioncontroller',
  'miui.systemui.plugin',
]);

const NON_BLOCKABLE_APP_PREFIXES = [
  'app.blearn.',
  'com.android.launcher',
  'com.android.launcher3',
  'com.android.systemui',
  'com.google.android.apps.nexuslauncher',
  'com.google.android.launcher',
  'com.huawei.android.launcher',
  'com.mi.android.globallauncher',
  'com.miui.home',
  'com.sec.android.app.launcher',
  'com.transsion.',
] as const;

function normalizeAppTargetId(targetId: string) {
  return targetId.trim().toLowerCase();
}

function isBlearnSelfTargetId(targetId: string) {
  return targetId === 'blearn' || /^blearn(?:[\s._-]|$)/.test(targetId);
}

function matchesPackagePrefix(targetId: string, prefix: string) {
  if (prefix.endsWith('.')) {
    return targetId.startsWith(prefix);
  }

  return targetId === prefix || targetId.startsWith(`${prefix}.`);
}

export function isBlockableAppTargetId(targetId: string) {
  const normalizedTargetId = normalizeAppTargetId(targetId);
  if (!normalizedTargetId) {
    return false;
  }

  if (NON_BLOCKABLE_APP_IDS.has(normalizedTargetId) || isBlearnSelfTargetId(normalizedTargetId)) {
    return false;
  }

  return !NON_BLOCKABLE_APP_PREFIXES.some((prefix) => matchesPackagePrefix(normalizedTargetId, prefix));
}

export function sanitizeBlockedAppTargetIds(targetIds: string[]) {
  const uniqueTargetIds = new Set<string>();

  for (const targetId of targetIds) {
    const normalizedTargetId = normalizeAppTargetId(targetId);
    if (isBlockableAppTargetId(normalizedTargetId)) {
      uniqueTargetIds.add(normalizedTargetId);
    }
  }

  return [...uniqueTargetIds];
}
