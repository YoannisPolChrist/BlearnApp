import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import { LearnTemplatesContent } from '@/components/learn/LearnTemplatesContent';

export default function LearnTemplatesPage() {
  const navigate = useNavigate();

  return (
    <PageTransition variant="hero">
      <div className="app-page">
        <div className="page-header page-header-wrap">
          <button
            onClick={() => navigate('/learn')}
            className="btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card/70 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">
              Templates
            </p>
            <h1 className="break-words text-2xl font-black tracking-[-0.05em] text-foreground sm:text-3xl">
              Standard-Decks für Learn
            </h1>
          </div>
        </div>

        <div className="page-shell-clip">
          <div className="mt-6">
            <LearnTemplatesContent
              onOpenLearn={() => navigate('/learn')}
            />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
