import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Lock } from 'lucide-react';

interface StrictConfirmDialogsProps {
  showConfirmStep1: boolean;
  showConfirmStep2: boolean;
  startTime: string;
  endTime: string;
  confirmText: string;
  confirmCode: string;
  setShowConfirmStep1: (value: boolean) => void;
  setShowConfirmStep2: (value: boolean) => void;
  setConfirmText: (value: string) => void;
  onConfirmStep2: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function StrictConfirmDialogs({
  showConfirmStep1,
  showConfirmStep2,
  startTime,
  endTime,
  confirmText,
  confirmCode,
  setShowConfirmStep1,
  setShowConfirmStep2,
  setConfirmText,
  onConfirmStep2,
  t,
}: StrictConfirmDialogsProps) {
  return (
    <>
      <AnimatePresence>
        {showConfirmStep1 ? (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-background/80 lg:backdrop-blur-xl" onClick={() => setShowConfirmStep1(false)} />
            <motion.div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
              <div className="mb-4 flex justify-center"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"><AlertTriangle size={32} className="text-destructive" /></div></div>
              <h2 className="mb-2 text-center font-serif text-xl font-bold text-foreground">{t('modes.confirm.title')}</h2>
              <p className="mb-6 text-center text-sm text-muted-foreground">{t('modes.confirm.description', { start: startTime, end: endTime })}</p>
              <div className="flex gap-3"><button onClick={() => setShowConfirmStep1(false)} className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-muted-foreground">{t('modes.confirm.cancel')}</button><motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowConfirmStep1(false); setShowConfirmStep2(true); setConfirmText(''); }} className="flex-1 rounded-xl bg-destructive py-3 text-sm font-bold text-destructive-foreground">{t('modes.confirm.continue')}</motion.button></div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirmStep2 ? (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-background/80 lg:backdrop-blur-xl" />
            <motion.div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
              <div className="mb-4 flex justify-center"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"><Lock size={32} className="text-destructive" /></div></div>
              <h2 className="mb-2 text-center font-serif text-xl font-bold text-foreground">{t('modes.confirm.finalTitle')}</h2>
              <p className="mb-6 text-center text-sm text-muted-foreground">{t('modes.confirm.finalDescription', { code: confirmCode })}</p>
              <input type="text" value={confirmText} onChange={(event) => setConfirmText(event.target.value.toUpperCase())} placeholder={confirmCode} className="mb-4 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-center font-mono text-lg font-bold text-foreground placeholder:text-muted-foreground/30 focus:border-destructive focus:outline-none" autoFocus />
              <div className="flex gap-3"><button onClick={() => { setShowConfirmStep2(false); setConfirmText(''); }} className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-muted-foreground">{t('modes.confirm.cancel')}</button><motion.button whileTap={{ scale: 0.95 }} onClick={onConfirmStep2} disabled={confirmText !== confirmCode} className="flex-1 rounded-xl bg-destructive py-3 text-sm font-bold text-destructive-foreground disabled:opacity-30">{t('modes.confirm.activate')}</motion.button></div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
