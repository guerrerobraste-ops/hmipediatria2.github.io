import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { clearServiceWorkerCachesAndReload, isChunkLoadError } from '../utils/lazyWithRetry';

interface AppErrorBoundaryProps {
  children: ReactNode;
  sectionLabel?: string;
  onReset?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Error inesperado de renderizado',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('HMI ErrorBoundary caught error:', error, info);
    if (isChunkLoadError(error)) {
      void clearServiceWorkerCachesAndReload();
    }
  }

  handleHardReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map(k => window.caches.delete(k)));
      }
    } catch {
      // ignore cleanup failures
    }
    window.location.reload();
  };

  handleRetryView = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[320px] w-full flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          <div className="max-w-md w-full rounded-2xl border border-rose-300 dark:border-rose-500/40 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {this.props.sectionLabel
                  ? `Se produjo un error en ${this.props.sectionLabel}`
                  : 'Se produjo un error al cargar la pantalla'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Esto suele ocurrir tras una actualización reciente o caché desactualizada del navegador.
              </p>
              {this.state.errorMessage && (
                <p className="mt-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[11px] font-mono text-rose-700 dark:text-rose-300 break-words">
                  {this.state.errorMessage}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {this.props.onReset && (
                <button
                  type="button"
                  onClick={this.handleRetryView}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer"
                >
                  Reintentar sección
                </button>
              )}
              <button
                type="button"
                onClick={this.handleHardReload}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Recargar aplicación</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
