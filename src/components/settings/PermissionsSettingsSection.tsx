import { motion } from 'framer-motion';
import type { PermissionStatus } from '@/services/screenTimeNormalization';
import type { SettingsPermissionCard } from '@/modules/settings/useSettingsPermissions';
import GlassCard from '@/components/GlassCard';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { sectionItem } from '@/lib/motion';
import { SETTINGS_PERMISSIONS_PANEL_VALUE } from '@/modules/settings/settingsRuntime';

type Translate = (key: string, vars?: Record<string, unknown>) => string;

interface PermissionsSettingsSectionProps {
  expandedSettingsPanel: string;
  onOpenModes: () => void;
  onOpenPermissionGuide: () => void;
  onRefreshPermissions: () => void;
  onValueChange: (value: string) => void;
  permissionCards: readonly SettingsPermissionCard[];
  permissionErrorMessage: string | null;
  permissionStatus: PermissionStatus;
  permissionSummaryLabel: string;
  permissionsNeedAttention: boolean;
  permissionsTitle: string;
  showPermissionGuideCta: boolean;
  t: Translate;
}

export function PermissionsSettingsSection({
  expandedSettingsPanel,
  onOpenModes,
  onOpenPermissionGuide,
  onRefreshPermissions,
  onValueChange,
  permissionCards,
  permissionErrorMessage,
  permissionStatus,
  permissionSummaryLabel,
  permissionsNeedAttention,
  permissionsTitle,
  showPermissionGuideCta,
  t,
}: PermissionsSettingsSectionProps) {
  return (
    <motion.section id="permissions" variants={sectionItem} className="section-anchor">
      <GlassCard accentGlow className="overflow-hidden p-0">
        <Accordion
          type="single"
          collapsible
          className="w-full"
          value={expandedSettingsPanel}
          onValueChange={onValueChange}
        >
          <AccordionItem value={SETTINGS_PERMISSIONS_PANEL_VALUE} className="border-b-0">
            <AccordionTrigger className="px-5 py-5 text-left hover:no-underline sm:px-6">
              <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    {t('settings.permissions.eyebrow')}
                  </p>
                  <p className="mt-2 text-lg font-black text-foreground">{permissionsTitle}</p>
                  {permissionErrorMessage && (
                    <p className="mt-1 text-sm leading-relaxed text-destructive/90 font-medium">
                      {permissionErrorMessage}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                    permissionsNeedAttention ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                  }`}>
                    {permissionSummaryLabel}
                  </span>
                  {permissionStatus.websiteBlockingAvailable ? (
                    <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-foreground/78">
                      Website-Schutz
                    </span>
                  ) : null}
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-5 pb-5 pt-0 sm:px-6">
              <div className="space-y-4">
                {permissionErrorMessage ? (
                  <div className="rounded-2xl border border-warning/30 bg-warning/8 px-4 py-4 text-sm text-foreground shadow-[0_14px_34px_hsl(var(--warning)/0.08)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-warning">
                      Android-Setup pruefen
                    </p>
                    <p className="mt-1 leading-relaxed text-foreground/82">
                      {permissionErrorMessage}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={onRefreshPermissions}
                        className="rounded-xl bg-warning px-3 py-2 text-xs font-bold text-warning-foreground"
                      >
                        Erneut pruefen
                      </button>
                      <button
                        type="button"
                        onClick={onOpenModes}
                        className="rounded-xl border border-warning/30 bg-background/80 px-3 py-2 text-xs font-bold text-foreground"
                      >
                        Fokusregeln oeffnen
                      </button>
                    </div>
                  </div>
                ) : null}

                {showPermissionGuideCta ? (
                  <div className="flex justify-end">
                    <button
                      onClick={onOpenPermissionGuide}
                      className="btn-press w-full rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary sm:w-auto"
                    >
                      {t('common.actions.guidedSetup')}
                    </button>
                  </div>
                ) : null}

                <div className="responsive-card-grid">
                  {permissionCards.map((card) => (
                    <div key={card.key} className="flex h-full flex-col gap-4 rounded-[1.4rem] border border-border/70 bg-background/65 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground">{card.label}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                            card.statusTone === 'primary'
                              ? 'bg-primary/10 text-primary'
                              : card.statusTone === 'muted'
                                ? 'bg-muted text-muted-foreground'
                                : card.statusTone === 'warning'
                                  ? 'bg-warning/10 text-warning'
                                  : card.granted || card.statusTone === 'success'
                                    ? 'bg-success/10 text-success'
                                    : 'bg-warning/10 text-warning'
                          }`}
                        >
                          {card.statusLabel || (card.granted ? t('common.status.active') : t('common.status.open'))}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          void card.action();
                        }}
                        className={`btn-press mt-auto w-full rounded-xl px-4 py-3 text-sm font-bold ${
                          card.granted
                            ? 'border border-border bg-card/70 text-foreground'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        {card.buttonLabel || (card.granted ? t('common.actions.recheck') : t('common.actions.grant'))}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </GlassCard>
    </motion.section>
  );
}
