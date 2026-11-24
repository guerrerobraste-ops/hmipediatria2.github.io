import React from 'react';
import { WifiOff, HardDrive } from 'lucide-react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  offlineQueueCount?: number;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ isOnline, offlineQueueCount = 0 }) => {
  if (isOnline) return null;

  return (
    <div className="bg-amber-500/15 border-y sm:border sm:rounded-2xl border-amber-500/30 px-3 sm:px-4 py-2 sm:py-2.5 text-amber-800 dark:text-amber-200 text-xs shadow-sm flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
          <WifiOff className="w-4 h-4" />
        </div>
        <div>
          <span className="font-extrabold block sm:inline">Modo Sin Conexión (Offline Activo)</span>
          <span className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-300 sm:ml-2">
            Puedes evolucionar pacientes, redactar indicaciones y generar PDF normalmente. Todo se guarda en la memoria interna (IndexedDB).
          </span>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2 font-mono text-[11px] bg-amber-500/20 px-2 py-1 rounded-lg">
        <HardDrive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>{offlineQueueCount > 0 ? `${offlineQueueCount} cambios locales` : 'Memoria Protegida'}</span>
      </div>
    </div>
  );
};
