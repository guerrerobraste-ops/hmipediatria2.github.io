import React from 'react';
import { Sparkles, RotateCcw, Check } from 'lucide-react';
import {
  ExamQuickFillSection,
  QuickFillGroup,
  QuickFillSelectionMap,
  SemiologicalPhase,
} from '../data/clinicalExamQuickFill';

interface ClinicalExamQuickFillPanelProps {
  section: ExamQuickFillSection;
  selections: QuickFillSelectionMap;
  onToggleOption: (group: QuickFillGroup, optionId: string) => void;
  onClearSelections: () => void;
}

const PHASE_BADGE_STYLES: Record<SemiologicalPhase, string> = {
  Inspección: 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/40',
  Palpación: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
  Percusión: 'bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-300 border-violet-300 dark:border-violet-500/40',
  Auscultación: 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40',
  Valoración: 'bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-500/40',
  Síntomas: 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40',
};

export const ClinicalExamQuickFillPanel: React.FC<ClinicalExamQuickFillPanelProps> = ({
  section,
  selections,
  onToggleOption,
  onClearSelections,
}) => {
  const totalSelected = Object.values(selections).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="mb-2.5 rounded-xl border border-indigo-300/80 dark:border-indigo-500/40 bg-indigo-50/70 dark:bg-slate-900/90 p-2.5 space-y-2.5 shadow-inner">
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-indigo-200/80 dark:border-indigo-500/25 pb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-black text-indigo-800 dark:text-indigo-300">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Llenado Rápido — Toque los hallazgos para redactar automáticamente</span>
        </div>
        {totalSelected > 0 && (
          <button
            type="button"
            onClick={onClearSelections}
            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Limpiar ({totalSelected})
          </button>
        )}
      </div>

      <div className="space-y-2">
        {section.groups.map((group) => {
          const activeIds = selections[group.id] || [];
          return (
            <div key={group.id} className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${PHASE_BADGE_STYLES[group.phase]}`}
                >
                  {group.phase}
                </span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {group.label}
                </span>
                <span className="text-[9.5px] text-slate-500 dark:text-slate-400">
                  ({group.mode === 'single' ? '1 opción' : 'múltiple'})
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {group.options.map((opt) => {
                  const isSelected = activeIds.includes(opt.id);
                  const activeClasses = opt.isNormal
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                    : 'bg-rose-600 text-white border-rose-500 shadow-xs';
                  const idleClasses = opt.isNormal
                    ? 'bg-white dark:bg-slate-800/90 text-emerald-800 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                    : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40';

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onToggleOption(group, opt.id)}
                      className={`text-[10.5px] font-bold px-2 py-1 rounded-lg border transition-all active:scale-95 cursor-pointer flex items-center gap-1 leading-tight ${
                        isSelected ? activeClasses : idleClasses
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 shrink-0 stroke-[3]" />}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
