import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Wind } from 'lucide-react';
import { useAppStore, getRandomChallenge, type Challenge } from '@/store/useAppStore';
import GlassCard from '@/components/GlassCard';
import PageTransition from '@/components/PageTransition';
import { SuccessTileAnimation } from '@/components/ui/SuccessTileAnimation';

import imgStretch from '@/assets/challenge-stretch.jpg';
import imgWater from '@/assets/challenge-water.jpg';
import imgWindow from '@/assets/challenge-window.jpg';
import imgBreathing from '@/assets/challenge-breathing.jpg';
import imgWalk from '@/assets/challenge-walk.jpg';
import imgColdWater from '@/assets/challenge-coldwater.jpg';

const challengeImages: Record<string, string> = {
  stretch: imgStretch,
  water: imgWater,
  window: imgWindow,
  breathing_deep: imgBreathing,
  gratitude: imgBreathing,
  body_scan: imgBreathing,
  cold_water: imgColdWater,
  walk: imgWalk,
};

type PauseState = 'intro' | 'challenge' | 'complete';

export default function PausePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const level = parseInt(searchParams.get('level') || '1', 10);
  const { addInteraction, incrementChallenges, incrementPauses } = useAppStore();

  const [state, setState] = useState<PauseState>('intro');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  const completeChallenge = useCallback(
    (challengeId?: string) => {
      setState('complete');
      incrementChallenges();
      incrementPauses();
      addInteraction({
        timestamp: Date.now(),
        type: 'challenge',
        completed: true,
        challenge: challengeId,
      });
    },
    [addInteraction, incrementChallenges, incrementPauses],
  );

  useEffect(() => {
    const c = getRandomChallenge(level);
    setChallenge(c);
  }, [level]);

  useEffect(() => {
    if (state !== 'challenge' || timeLeft <= 0) return;
    const activeChallengeId = challenge?.id;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          completeChallenge(activeChallengeId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [challenge?.id, completeChallenge, state, timeLeft]);

  const startChallenge = () => {
    if (challenge) {
      setTimeLeft(challenge.duration);
      setTotalTime(challenge.duration);
      setState('challenge');
    }
  };

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;
  const bgImage = challenge ? challengeImages[challenge.id] : imgBreathing;

  return (
    <PageTransition>
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col items-center px-4 pt-8">
        {/* Nature background */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={bgImage}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
            >
              <div
                className="absolute inset-0 opacity-80 dark:opacity-50"
                style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              />
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
        </div>

        {/* Header */}
        <div className="relative z-10 mb-8 flex w-full items-center">
          <button onClick={() => navigate('/')} className="rounded-full p-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <h1 className="flex-1 text-center font-serif text-2xl font-bold text-foreground">
            Bewusste Pause
          </h1>
          <div className="w-10" />
        </div>

        <AnimatePresence mode="wait">
          {state === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex flex-1 flex-col items-center justify-center"
            >
              {/* Challenge image card */}
              {challenge && (
                <motion.div
                  className="mb-8 w-full overflow-hidden rounded-2xl"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl">
                    <img
                      src={challengeImages[challenge.id] || imgBreathing}
                      alt={challenge.name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="text-xl font-bold text-foreground">{challenge.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{challenge.description}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {challenge && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <GlassCard className="mb-8 w-full">
                    <p className="text-sm text-foreground leading-relaxed">{challenge.instruction}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{challenge.duration} Sekunden</p>
                  </GlassCard>
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={startChallenge}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-semibold text-primary-foreground"
                style={{ boxShadow: '0 8px 32px hsl(var(--primary) / 0.25)' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Play size={18} />
                Starten
              </motion.button>

              <motion.button
                onClick={() => navigate('/breathing')}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                <Wind size={14} />
                Atemübung starten
              </motion.button>
            </motion.div>
          )}

          {state === 'challenge' && challenge && (
            <motion.div
              key="challenge"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex flex-1 flex-col items-center justify-center"
            >
              {/* Nature image during challenge */}
              <motion.div
                className="mb-8 aspect-[4/3] w-full max-w-[280px] overflow-hidden rounded-2xl"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <img
                  src={challengeImages[challenge.id] || imgBreathing}
                  alt={challenge.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
              </motion.div>

              <p className="mb-2 font-serif text-lg font-semibold text-foreground">{challenge.name}</p>
              <p className="mb-8 text-center text-sm text-muted-foreground">{challenge.instruction}</p>

              {/* Timer */}
              <div className="mb-6 flex flex-col items-center">
                <motion.span
                  key={timeLeft}
                  initial={{ scale: 1.15, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-5xl font-bold text-foreground"
                >
                  {timeLeft}
                </motion.span>
                <span className="mt-1 text-xs font-medium text-muted-foreground">
                  Sekunden
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ boxShadow: '0 0 12px hsl(var(--primary) / 0.4)' }}
                />
              </div>
            </motion.div>
          )}

          {state === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex flex-1 flex-col items-center justify-center"
            >
              <div className="w-full max-w-sm">
                <SuccessTileAnimation
                  eyebrow="Pause abgeschlossen"
                  title="Abgeschlossen"
                  description={challenge?.name}
                  detail="Challenge gespeichert"
                  emoji="🧘"
                >
                  <div className="flex w-full gap-3">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate('/breathing')}
                      className="flex-1 rounded-2xl border border-border bg-card/60 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Atemübung
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate('/')}
                      className="flex-1 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
                      style={{ boxShadow: '0 4px 20px hsl(var(--primary) / 0.25)' }}
                    >
                      Fertig
                    </motion.button>
                  </div>
                </SuccessTileAnimation>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
