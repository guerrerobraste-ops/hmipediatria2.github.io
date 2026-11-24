import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  X,
} from 'lucide-react';
import {
  TutorialStep,
  RectLike,
  computeCoachmarkPosition,
} from '../utils/tutorialSteps';

interface InteractiveTutorialOverlayProps {
  active: boolean;
  steps: TutorialStep[];
  currentStepIndex: number;
  onGoToStep: (index: number) => void;
  onGoToStepId: (stepId: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  /** Called when a step requires an automatic UI transition (e.g. clicking Next on "Desarrollar historia clinica" or "Ingresar Px") */
  onTriggerStepAction?: (step: TutorialStep) => void;
}

export const InteractiveTutorialOverlay: React.FC<InteractiveTutorialOverlayProps> = ({
  active,
  steps,
  currentStepIndex,
  onGoToStepId,
  onNext,
  onPrev,
  onClose,
  onTriggerStepAction,
}) => {
  const step = active ? steps[currentStepIndex] : undefined;
  const [targetRect, setTargetRect] = useState<RectLike | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardSize, setCardSize] = useState<{ width: number; height: number }>({
    width: 360,
    height: 210,
  });
  const scrolledStepIdRef = useRef<string | null>(null);

  const findVisibleTarget = useCallback((selector: string): HTMLElement | null => {
    const matches = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
    for (const el of matches) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return el;
      }
    }
    return null;
  }, []);

  const measureTarget = useCallback(() => {
    if (!active || !step) {
      setTargetRect(null);
      return;
    }
    const el = findVisibleTarget(step.targetSelector);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTargetRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      right: r.right,
      bottom: r.bottom,
    });
  }, [active, step, findVisibleTarget]);

  // Smoothly pan camera to the active element whenever step changes (or element mounts)
  useEffect(() => {
    if (!active || !step) {
      scrolledStepIdRef.current = null;
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const findAndScroll = () => {
      if (cancelled) return;
      const el = findVisibleTarget(step.targetSelector);
      if (el) {
        if (scrolledStepIdRef.current !== step.id) {
          scrolledStepIdRef.current = step.id;
          try {
            el.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest',
            });
          } catch {
            el.scrollIntoView();
          }
        }
        measureTarget();
        // Re-measure after smooth scroll settles
        setTimeout(() => {
          if (!cancelled) measureTarget();
        }, 280);
        setTimeout(() => {
          if (!cancelled) measureTarget();
        }, 600);
        return;
      }
      attempts += 1;
      if (attempts < 24) {
        setTimeout(findAndScroll, 120);
      } else {
        setTargetRect(null);
      }
    };

    const initialTimer = setTimeout(findAndScroll, 60);
    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
    };
  }, [active, step, measureTarget]);

  // Keep highlight ring & coachmark locked to the target while scrolling or resizing
  useEffect(() => {
    if (!active || !step) return;
    let rafId = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measureTarget);
    };

    window.addEventListener('scroll', scheduleMeasure, true);
    window.addEventListener('resize', scheduleMeasure);
    const interval = window.setInterval(measureTarget, 350);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleMeasure, true);
      window.removeEventListener('resize', scheduleMeasure);
      window.clearInterval(interval);
    };
  }, [active, step, measureTarget]);

  // Auto-advance when user directly clicks the real highlighted target button on interactive steps
  useEffect(() => {
    if (!active || !step || !step.advanceOnTargetClick) return;
    const onDocClick = (e: MouseEvent) => {
      const targetNode = e.target as HTMLElement | null;
      if (!targetNode) return;
      if (cardRef.current && cardRef.current.contains(targetNode)) return;
      const matched = targetNode.closest(step.targetSelector);
      if (matched) {
        // Let the real button's click handler run first, then advance to the next tutorial step
        setTimeout(() => {
          if (step.nextStepId) {
            onGoToStepId(step.nextStepId);
          } else if (currentStepIndex < steps.length - 1) {
            onNext();
          }
        }, 120);
      }
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [active, step, currentStepIndex, steps.length, onGoToStepId, onNext]);

  // Allow Escape key to exit tutorial cleanly
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, onClose]);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setCardSize(prev =>
        Math.abs(prev.width - rect.width) > 2 || Math.abs(prev.height - rect.height) > 2
          ? { width: rect.width, height: rect.height }
          : prev
      );
    }
  }, [step, targetRect]);

  if (!active || !step) return null;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const isFirst = currentStepIndex <= 0;
  const isLast = currentStepIndex >= steps.length - 1;
  const progressPct = Math.round(((currentStepIndex + 1) / Math.max(1, steps.length)) * 100);

  const coords = computeCoachmarkPosition({
    targetRect,
    cardWidth: Math.min(370, viewportWidth - 24),
    cardHeight: cardSize.height || 210,
    viewportWidth,
    viewportHeight,
    preferredPlacement: step.preferredPlacement,
  });

  const pad = 6;
  const highlightBoxStyle: React.CSSProperties | undefined = targetRect
    ? {
        position: 'fixed',
        top: Math.max(2, targetRect.top - pad),
        left: Math.max(2, targetRect.left - pad),
        width: Math.min(viewportWidth - 4, targetRect.width + pad * 2),
        height: Math.min(viewportHeight - 4, targetRect.height + pad * 2),
        borderRadius: '14px',
        boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.56), 0 0 0 3px #14b8a6, 0 0 24px rgba(20, 184, 166, 0.55)',
        pointerEvents: 'none',
        zIndex: 10040,
        transition: 'top 220ms cubic-bezier(0.16, 1, 0.3, 1), left 220ms cubic-bezier(0.16, 1, 0.3, 1), width 220ms cubic-bezier(0.16, 1, 0.3, 1), height 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }
    : undefined;

  const handlePrimaryNext = () => {
    if (step.advanceOnTargetClick && onTriggerStepAction) {
      onTriggerStepAction(step);
      return;
    }
    if (step.nextStepId) {
      onGoToStepId(step.nextStepId);
      return;
    }
    if (isLast) {
      onClose();
      return;
    }
    onNext();
  };

  return (
    <div
      id="hmi-interactive-tutorial-layer"
      className="no-print"
      aria-live="polite"
    >
      {/* Dimmed spotlight cutout that NEVER blocks clicks or typing on the highlighted element */}
      {highlightBoxStyle ? (
        <div style={highlightBoxStyle} aria-hidden="true" />
      ) : (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            pointerEvents: 'none',
            zIndex: 10040,
          }}
        />
      )}

      {/* Floating Coachmark Message Card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-label={`Tutorial: ${step.title}`}
        data-tutorial-step-id={step.id}
        style={{
          position: 'fixed',
          top: coords.top,
          left: coords.left,
          width: Math.min(370, viewportWidth - 24),
          zIndex: 10050,
          pointerEvents: 'auto',
          transition: 'top 200ms cubic-bezier(0.16, 1, 0.3, 1), left 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-teal-500/70 dark:border-teal-400/60 shadow-2xl overflow-visible"
      >
        {/* Directional Pointer Arrow */}
        {targetRect && coords.placement === 'bottom' && (
          <div
            aria-hidden="true"
            style={{ left: coords.arrowLeftPx - 7 }}
            className="absolute -top-2 w-3.5 h-3.5 rotate-45 bg-white dark:bg-slate-900 border-l border-t border-teal-500/70 dark:border-teal-400/60"
          />
        )}
        {targetRect && coords.placement === 'top' && (
          <div
            aria-hidden="true"
            style={{ left: coords.arrowLeftPx - 7 }}
            className="absolute -bottom-2 w-3.5 h-3.5 rotate-45 bg-white dark:bg-slate-900 border-r border-b border-teal-500/70 dark:border-teal-400/60"
          />
        )}

        {/* Thin Progress Bar */}
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-t-2xl overflow-hidden">
          <div
            className="h-full bg-teal-600 dark:bg-teal-400 transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="p-4 space-y-3">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{step.sectionLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums shrink-0">
                  {currentStepIndex + 1}/{steps.length}
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                {step.title}
              </h4>
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-700/50 rounded-md px-2 py-0.5 inline-block">
                🧪 Práctica con paciente ficticio · No se guarda en BD
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              title="Salir del tutorial"
              aria-label="Salir del tutorial"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Message Body */}
          <p className="text-xs sm:text-[13px] leading-relaxed text-slate-700 dark:text-slate-200 font-medium">
            {step.message}
          </p>

          {/* Optional Decision Buttons (e.g. ¿Tiene laboratorios?) */}
          {step.decisionActions && step.decisionActions.length > 0 ? (
            <div className="flex flex-col gap-2 pt-1">
              {step.decisionActions.map(action => (
                <button
                  key={action.targetStepId}
                  type="button"
                  onClick={() => onGoToStepId(action.targetStepId)}
                  className={`w-full min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99] ${
                    action.variant === 'primary'
                      ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <span>{action.label}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ))}
              {!isFirst && (
                <button
                  type="button"
                  onClick={onPrev}
                  className="self-start px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                {!isFirst && (
                  <button
                    type="button"
                    onClick={onPrev}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                data-testid="tutorial-next-btn"
                onClick={handlePrimaryNext}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                {isLast ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{step.nextLabel || 'Finalizar'}</span>
                  </>
                ) : (
                  <>
                    <span>{step.nextLabel || 'Siguiente'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
