import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Compass, ListFilter, Search, X } from 'lucide-react';
import {
  HistoriaQuickJumpItem,
  filterQuickJumpGroups,
  getQuickJumpGroupsForScope,
} from '../utils/historiaQuickJumpCatalog';
import { useSeasonalTheme } from '../utils/seasonalTheme';

interface HistoriaQuickJumpDropdownProps {
  activePageNum: number;
  onSelectJump: (pageNum: number, target?: string) => void;
  /** When provided, limits the dropdown list to acápites of a specific page (e.g. Page 3, 4, or 5) */
  scopedPage?: number;
  placeholder?: string;
  label?: string;
  dataTutorial?: string;
  dataTestId?: string;
  compact?: boolean;
}

export const HistoriaQuickJumpDropdown: React.FC<HistoriaQuickJumpDropdownProps> = ({
  activePageNum,
  onSelectJump,
  scopedPage,
  placeholder = 'Desplegar lista de acápites para ir rápido...',
  label = 'Acceso rápido a acápites',
  dataTutorial,
  dataTestId,
  compact = false,
}) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSelectedLabel, setLastSelectedLabel] = useState<string>('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const baseGroups = useMemo(() => getQuickJumpGroupsForScope(scopedPage), [scopedPage]);
  const filteredGroups = useMemo(
    () => filterQuickJumpGroups(baseGroups, searchQuery),
    [baseGroups, searchQuery]
  );

  const totalItemsCount = useMemo(
    () => baseGroups.reduce((sum, g) => sum + g.items.length, 0),
    [baseGroups]
  );

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  // Reset search when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleChooseItem = (item: HistoriaQuickJumpItem) => {
    setLastSelectedLabel(item.label);
    setIsOpen(false);
    onSelectJump(item.page, item.target);
  };

  const handleChooseGroupStart = (page: number, title: string) => {
    setLastSelectedLabel(title);
    setIsOpen(false);
    onSelectJump(page);
  };

  return (
    <div
      ref={wrapperRef}
      data-tutorial={dataTutorial}
      className={`relative w-full ${compact ? '' : `border rounded-2xl p-2.5 sm:p-3 shadow-xs ${themeTokens.cardSurface}`}`}
    >
      <button
        type="button"
        data-testid={dataTestId || (scopedPage ? `quick-jump-dropdown-p${scopedPage}` : 'toggle-botones-rapidos')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2.5 text-left rounded-xl border transition-all cursor-pointer ${
          compact
            ? 'px-3 py-2 bg-white dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-teal-500/60'
            : 'px-3.5 py-2.5 bg-white/95 dark:bg-slate-900/90 border-slate-300/90 dark:border-slate-700 hover:border-teal-500/70 shadow-2xs'
        } ${isOpen ? 'ring-2 ring-teal-500/40 border-teal-500 dark:border-teal-400' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className={`p-1.5 rounded-lg shrink-0 ${themeTokens.accentBadge}`}>
            {compact ? (
              <ListFilter className={`w-3.5 h-3.5 ${themeTokens.accentIcon}`} />
            ) : (
              <Compass className={`w-4 h-4 ${themeTokens.accentIcon}`} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-black uppercase tracking-wider ${compact ? 'text-[10.5px]' : 'text-[11px] sm:text-xs'} text-slate-900 dark:text-white`}>
                {label}
              </span>
              {!scopedPage && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-500/12 text-teal-800 dark:text-teal-300 border border-teal-500/30 shrink-0">
                  Pág. {activePageNum} activa
                </span>
              )}
              <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                ({totalItemsCount} acápites)
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
              {lastSelectedLabel ? `Último acceso: ${lastSelectedLabel}` : placeholder}
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border flex items-center gap-1 shrink-0 transition-colors ${themeTokens.accentBadge}`}
        >
          <span className="hidden xs:inline">{isOpen ? 'Cerrar' : 'Ver lista'}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${
              isOpen ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 mt-1.5 z-50 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-quick-jump-slide-in"
        >
          {/* Sticky Search Filter inside Dropdown */}
          <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  scopedPage
                    ? 'Filtrar acápite en esta página (ej. tórax, vacunas, piel)...'
                    : 'Buscar acápite o página (ej. tórax, graffar, vacunas, motivo)...'
                }
                className="w-full pl-8 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Organized Acápites List */}
          <div className="max-h-[340px] sm:max-h-[390px] overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-slate-800/80 animate-quick-jump-items-in">
            {filteredGroups.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                No se encontraron acápites para &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              filteredGroups.map(group => {
                const isCurrentPage = activePageNum === group.page;
                return (
                  <div key={group.id} className="py-1.5">
                    {/* Group Header */}
                    {!scopedPage && (
                      <div
                        className={`px-3.5 py-1.5 flex items-center justify-between gap-2 sticky top-0 z-10 backdrop-blur-sm ${
                          isCurrentPage
                            ? 'bg-teal-50/95 dark:bg-teal-950/90 border-y border-teal-200/70 dark:border-teal-800/70'
                            : 'bg-slate-100/95 dark:bg-slate-800/95'
                        }`}
                      >
                        <span className="text-[10.5px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300">
                          {group.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleChooseGroupStart(group.page, group.title)}
                          className="text-[10px] font-extrabold text-teal-700 dark:text-teal-300 hover:underline cursor-pointer shrink-0"
                        >
                          Inicio Pág. {group.page} →
                        </button>
                      </div>
                    )}

                    {/* Acápites Items */}
                    <div className="py-0.5">
                      {group.items.map(item => {
                        const isLast = lastSelectedLabel === item.label;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={isLast}
                            onClick={() => handleChooseItem(item)}
                            className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isLast
                                ? 'bg-teal-50 dark:bg-teal-900/40 text-teal-900 dark:text-teal-200 font-extrabold'
                                : 'text-slate-800 dark:text-slate-200 hover:bg-teal-50/80 dark:hover:bg-teal-950/50 hover:text-teal-900 dark:hover:text-teal-200 font-semibold'
                            }`}
                          >
                            <span className="truncate">{item.label}</span>
                            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 shrink-0">
                              Pág. {item.page}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
