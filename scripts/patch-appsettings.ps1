$file = Join-Path $PSScriptRoot '..\src\pages\AppSettings.tsx'
$lines = [System.IO.File]::ReadAllLines($file, [System.Text.Encoding]::UTF8)

# Find the line with the GlassCard for /modes (unique pattern)
$startIdx = $null
for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match "interactive=\{!locked\}" -and $lines[$i] -match "navigate\('/modes'\)") {
    $startIdx = $i
    break
  }
}

if ($null -eq $startIdx) {
  Write-Error "Could not find the Modes GlassCard line. Aborting."
  exit 1
}

# Find the closing </motion.div> that follows this GlassCard block
$closeIdx = $null
for ($i = $startIdx; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match '^\s*</motion\.div>') {
    $closeIdx = $i
    break
  }
}

if ($null -eq $closeIdx) {
  Write-Error "Could not find closing </motion.div> after Modes GlassCard. Aborting."
  exit 1
}

Write-Host "Patching lines $($startIdx+1) to $($closeIdx+1)..."

# Build the escape-hatch block (keep leading indentation consistent with surroundings)
$indent = "                " # 16 spaces (matches GlassCard indent)
$patch = @(
  "${indent}<GlassCard interactive={!locked} accentGlow onClick={() => !locked && navigate('/modes')} className={locked ? 'opacity-60' : ''}>"
  "${indent}<div className=""flex items-center gap-4"">"
  "${indent}  <div className=""flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"">"
  "${indent}    <Shield size={20} className=""text-primary"" />"
  "${indent}  </div>"
  "${indent}  <div className=""min-w-0 flex-1"">"
  "${indent}    <p className=""font-semibold text-foreground"">{t('settings.areas.modesTitle')}</p>"
  "${indent}    <p className=""text-xs leading-relaxed text-muted-foreground"">"
  "${indent}      {locked ? t('settings.areas.modesLocked') : t('settings.areas.modesDescription')}"
  "${indent}    </p>"
  "${indent}  </div>"
  "${indent}</div>"
  "${indent}</GlassCard>"
  ""
  "                {showForceReleaseEscape ? ("
  "                  <div className=""mt-2 rounded-2xl border border-warning/30 bg-warning/8 px-4 py-3"">"
  "                    <p className=""text-xs font-bold text-warning"">"
  "                      {isGerman"
  "                        ? 'Strikmodus-Sperre aktiv \u2014 Zeitraum gerade nicht aktiv'"
  "                        : 'Strict lock active \u2014 schedule window not currently active'}"
  "                    </p>"
  "                    <p className=""mt-0.5 text-xs leading-relaxed text-foreground/72"">"
  "                      {isGerman"
  "                        ? 'Die Sperre ist aus einer fr\u00fcheren Aktivierung erhalten geblieben. Du kannst sie jetzt manuell aufheben.'"
  "                        : 'The lock persisted from a previous activation. You can manually release it now.'}"
  "                    </p>"
  "                    <button"
  "                      type=""button"""
  "                      onClick={forceReleaseLock}"
  "                      className=""btn-press mt-3 rounded-xl border border-warning/40 bg-warning/16 px-4 py-2 text-xs font-bold text-warning"""
  "                    >"
  "                      {isGerman ? 'Strikmodus aufheben' : 'Release strict lock'}"
  "                    </button>"
  "                  </div>"
  "                ) : null}"
  "              </motion.div>"
)

# Rebuild: lines before startIdx + patch + lines after closeIdx
$before = $lines[0..($startIdx - 1)]
$after  = if ($closeIdx + 1 -lt $lines.Length) { $lines[($closeIdx + 1)..($lines.Length - 1)] } else { @() }

$newContent = ($before + $patch + $after) -join "`r`n"
[System.IO.File]::WriteAllText($file, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Done. Patched AppSettings.tsx successfully."
