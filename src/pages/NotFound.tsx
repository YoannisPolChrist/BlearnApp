import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { BrandLockup } from "@/components/brand/BrandMark";
import GlassCard from "@/components/GlassCard";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="app-page flex min-h-screen items-center justify-center">
      <GlassCard className="brand-shell max-w-xl text-center">
        <div className="relative z-10">
          <BrandLockup className="justify-center" subtitle="Diese Route gehört nicht zu deinem aktiven Setup" />
          <h1 className="mt-6 text-5xl font-black tracking-[-0.08em] text-foreground">404</h1>
          <p className="mt-3 text-lg text-muted-foreground">Diese Seite gibt es in Blearn gerade nicht.</p>
          <a
            href="/"
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[0_16px_36px_hsl(var(--primary)/0.22)] transition hover:opacity-95"
          >
            Zurück zum Dashboard
          </a>
        </div>
      </GlassCard>
    </div>
  );
};

export default NotFound;
