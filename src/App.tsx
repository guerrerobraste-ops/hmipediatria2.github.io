import React, { useState, useEffect, useRef, Suspense } from 'react';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { Patient, Bed, PersonalTask, HistoriaClinicaPediatrica, HospitalArea, MedicalEvolution, Gender, RolGuardiasData, ReadmissionRecord } from './types';
import { 
  fetchPatientsApi, savePatientApi, savePatientsListApi, addPatientEvolutionApi, deletePatientApi,
  fetchBedsApi, saveBedsApi, 
  saveHistoriaApi, fetchHistoriaByIdApi,
  saveTasksApi, deleteTaskApi,
  subscribeToRealtimeEvents, syncOfflineQueue,
  syncAndRebuildLocalMemory,
  getOfflineQueueCountApi,
  fetchGuardiasApi,
  fetchMaintenanceStatusApi,
  getLocalMaintenanceStatus,
  MaintenanceConfig,
  fetchAmbientSoundConfigApi,
  getLocalAmbientSoundConfig,
  getUserAmbientSoundMuted,
  setUserAmbientSoundMuted,
  AmbientSoundConfig,
  fetchPanelControlApi,
  reportUserPresenceHeartbeatApi,
  reportUserPresenceLogoutApi,
  sendUserPresenceBeaconLogout,
} from './services/api';
import { PRESENCE_HEARTBEAT_INTERVAL_MS } from './utils/userPresence';

import {
  getDraftFromIDB,
  getPatientsFromIDB,
  getBedsFromIDB,
  getHistoriasFromIDB,
  getTasksFromIDB,
  getGuardiasFromIDB,
  setTutorialSandboxStorageGuard,
  DEFAULT_ROL_GUARDIAS
} from './services/storage';

import { fetchAllProfiles, submitSuggestionApi } from './lib/supabase';
import {
  syncActivityLogsWithSupabase,
  logDatabaseActivity,
  sanitizeSnapshotForLog
} from './services/activityLogger';

import { WardBedBoard } from './components/WardBedBoard';
import { HistoriaClinicaPDFRenderer } from './components/HistoriaClinicaPDFRenderer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthScreen } from './components/AuthScreen';
import { MaintenanceScreen } from './components/MaintenanceScreen';
import { DancingSanta } from './components/DancingSanta';

// Lazy-loaded heavy tabs and modals with chunk-retry recovery to minimize initial JS payload
const HistoriaClinicaForm = lazyWithRetry(() =>
  import('./components/HistoriaClinicaForm').then(m => ({ default: m.HistoriaClinicaForm }))
);
const DischargedPatientsList = lazyWithRetry(() =>
  import('./components/DischargedPatientsList').then(m => ({ default: m.DischargedPatientsList }))
);
const PersonalTasksManager = lazyWithRetry(() =>
  import('./components/PersonalTasksManager').then(m => ({ default: m.PersonalTasksManager }))
);
const LaboratoriosManager = lazyWithRetry(() =>
  import('./components/LaboratoriosManager').then(m => ({ default: m.LaboratoriosManager }))
);
const RolGuardiasView = lazyWithRetry(() =>
  import('./components/RolGuardiasView').then(m => ({ default: m.RolGuardiasView }))
);
const StatisticsView = lazyWithRetry(() =>
  import('./components/StatisticsView').then(m => ({ default: m.StatisticsView }))
);
const AdminPanel = lazyWithRetry(() =>
  import('./components/AdminPanel').then(m => ({ default: m.AdminPanel }))
);
const TutorialHubView = lazyWithRetry(() =>
  import('./components/TutorialHubView').then(m => ({ default: m.TutorialHubView }))
);
const InteractiveTutorialOverlay = lazyWithRetry(() =>
  import('./components/InteractiveTutorialOverlay').then(m => ({ default: m.InteractiveTutorialOverlay }))
);

import { 
  Stethoscope, CheckSquare, Sun, Moon, Wifi, WifiOff, 
  Plus, Shield, Share2, Sparkles, ArrowLeft, Edit3,
  ShieldCheck, BarChart3, LogOut, Eye, CalendarDays, Volume2, VolumeX,
  MessageSquarePlus, Send, CheckCircle2, X, User, BookOpen
} from 'lucide-react';
import {
  getTutorialStepsByTour,
  TutorialStep,
  TutorialTourId,
} from './utils/tutorialSteps';
import {
  createTutorialSandboxData,
  TutorialSandboxData,
} from './utils/tutorialDemoData';

import { SeasonalOverlay, SeasonalStyle } from './components/SeasonalOverlay';
import { getSeasonalThemeTokens, readStoredSeasonalStyle, isSeasonalAutoVenezuelaEnabled } from './utils/seasonalTheme';
import { ambientSoundEngine, STYLE_SOUND_META, AmbientTrack } from './utils/ambientSoundEngine';
import {
  shouldUnmuteOnGlobalAmbientChange,
  resolveEffectiveAmbientPlaying,
  parseConfigTimestampMs,
} from './utils/panelControlSync';
import {
  getHeaderSurfaceNeonClass,
  getHeaderNeonMeta,
  getMobileNavSurfaceNeonClass,
  getMobileNavItemNeonClasses,
  getAudioButtonNeonClasses,
} from './utils/headerNeonStyles';
import { syncDynamicPwaIcons } from './utils/dynamicPwaIconSync';
import {
  isMobileViewportWidth,
  shouldPauseForMobileBackground,
  resolveMobileEffectivePlayback,
} from './utils/mobileActivityGuard';
import { DEFAULT_HISTORIA_CLINICA, getPediatricNormalFunctionalExam, getPediatricNormalPhysicalExam } from './data/initialData';

const LazyTabFallback = (
  <div className="w-full py-16 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
    <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
    <span className="text-xs font-bold">Cargando módulo...</span>
  </div>
);

const DRAFT_KEY = 'hmi_historia_draft_v2';

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [historias, setHistorias] = useState<HistoriaClinicaPediatrica[]>([]);
  const [guardias, setGuardias] = useState<RolGuardiasData>(DEFAULT_ROL_GUARDIAS);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceConfig>(() =>
    getLocalMaintenanceStatus()
  );
  const [ambientSoundConfig, setAmbientSoundConfig] = useState<AmbientSoundConfig>(() =>
    getLocalAmbientSoundConfig()
  );
  // Always start with ambient audio enabled on fresh launch; if user taps Mute, stays muted until tapped again
  const [userSoundMuted, setUserSoundMuted] = useState<boolean>(false);
  const [userLocalSoundOverride, setUserLocalSoundOverride] = useState<boolean>(true);
  const userExplicitlyMutedRef = useRef<boolean>(false);
  const appBootTimestampRef = useRef<number>(Date.now());
  const [activeAmbientTrack, setActiveAmbientTrack] = useState<AmbientTrack | null>(() =>
    ambientSoundEngine.getCurrentTrack()
  );
  const [isMobileBackgroundPaused, setIsMobileBackgroundPaused] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'inicio' | 'ward' | 'guardias' | 'laboratorios' | 'historias' | 'altas' | 'tareas' | 'estadisticas' | 'tutorial' | 'admin'>('inicio');
  const [adminInitialTab, setAdminInitialTab] = useState<'doctores' | 'logs' | 'password' | 'estilos' | 'guardias' | 'sugerencias'>('doctores');
  const [selectedLabPatientId, setSelectedLabPatientId] = useState<string | undefined>(undefined);
  const resolveAutoDarkMode = (): boolean => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    }
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6;
  };

  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>(() => {
    if (typeof window !== 'undefined') {
      const storedThemeMode = localStorage.getItem('hmi_theme_mode');
      if (storedThemeMode === 'light' || storedThemeMode === 'dark' || storedThemeMode === 'auto') {
        return storedThemeMode;
      }
      const storedMode = localStorage.getItem('hmi_dark_mode');
      if (storedMode === 'dark') return 'dark';
      if (storedMode === 'light') return 'light';
    }
    return 'auto';
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const storedThemeMode = localStorage.getItem('hmi_theme_mode');
      const storedMode = localStorage.getItem('hmi_dark_mode');
      if (storedThemeMode === 'dark' || (!storedThemeMode && storedMode === 'dark')) return true;
      if (storedThemeMode === 'light' || (!storedThemeMode && storedMode === 'light')) return false;
      return resolveAutoDarkMode();
    }
    return true;
  });

  const [showThemeModeMenu, setShowThemeModeMenu] = useState<boolean>(false);
  const [showMobileIconMenu, setShowMobileIconMenu] = useState<boolean>(false);
  const mobileIconMenuRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showMobileIconMenu) return;
    const handleOutside = (event: MouseEvent) => {
      if (mobileIconMenuRef.current && !mobileIconMenuRef.current.contains(event.target as Node)) {
        setShowMobileIconMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showMobileIconMenu]);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

  const [seasonalTheme, setSeasonalTheme] = useState<SeasonalStyle>(() => readStoredSeasonalStyle());

  const handleSelectThemeMode = (mode: 'light' | 'dark' | 'auto') => {
    setThemeMode(mode);
    setShowThemeModeMenu(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hmi_theme_mode', mode);
      if (mode === 'dark') {
        localStorage.setItem('hmi_dark_mode', 'dark');
        setDarkMode(true);
      } else if (mode === 'light') {
        localStorage.setItem('hmi_dark_mode', 'light');
        setDarkMode(false);
      } else {
        localStorage.setItem('hmi_dark_mode', 'auto');
        setDarkMode(resolveAutoDarkMode());
      }
    }
  };

  const handleToggleDarkMode = () => {
    const nextMode: 'light' | 'dark' = darkMode ? 'light' : 'dark';
    handleSelectThemeMode(nextMode);
  };

  const isSoundPlaying = resolveEffectiveAmbientPlaying(
    Boolean(ambientSoundConfig.enabled),
    userLocalSoundOverride,
    userSoundMuted
  );

  const handleToggleUserMuteSound = () => {
    if (isSoundPlaying) {
      userExplicitlyMutedRef.current = true;
      setUserLocalSoundOverride(false);
      setUserSoundMuted(true);
      setUserAmbientSoundMuted(true);
    } else {
      userExplicitlyMutedRef.current = false;
      setUserLocalSoundOverride(true);
      setUserSoundMuted(false);
      setUserAmbientSoundMuted(false);
      ambientSoundEngine.unlockFromUserGesture(
        seasonalTheme,
        ambientSoundConfig.intensity ?? 0.45
      );
    }
  };

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const refreshQueueCount = async () => {
    try {
      const count = await getOfflineQueueCountApi();
      setOfflineQueueCount(count);
    } catch {
      setOfflineQueueCount(0);
    }
  };

  // Modals & Active Form State
  const [showHistoriaForm, setShowHistoriaForm] = useState<boolean>(false);
  const [editingHistoria, setEditingHistoria] = useState<HistoriaClinicaPediatrica | undefined>(undefined);
  const [initialHistoriaTab, setInitialHistoriaTab] = useState<'editor' | 'preview'>('editor');
  const [autoOpenPrint, setAutoOpenPrint] = useState<boolean>(false);
  const [publicViewHistoria, setPublicViewHistoria] = useState<HistoriaClinicaPediatrica | null>(null);
  const [isResumeDraft, setIsResumeDraft] = useState<boolean>(false);
  const [editingPatientForHistoriaId, setEditingPatientForHistoriaId] = useState<string | null>(null);

  // Floating Suggestions Modal State (Ventana flotante de Sugerencias al Desarrollador)
  const [showSuggestionsModal, setShowSuggestionsModal] = useState<boolean>(false);
  const [suggestionUserName, setSuggestionUserName] = useState<string>('');
  const [suggestionDateStr, setSuggestionDateStr] = useState<string>('');
  const [suggestionMessage, setSuggestionMessage] = useState<string>('');
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState<boolean>(false);
  const [suggestionSuccessMsg, setSuggestionSuccessMsg] = useState<string | null>(null);

  const [hasDraft, setHasDraft] = useState<boolean>(false);

  // Interactive Floating Tutorial State (TUTORIAL Walkthrough — isolated fictional sandbox)
  const [activeTourId, setActiveTourId] = useState<TutorialTourId | null>(null);
  const [tutorialStepIndex, setTutorialStepIndex] = useState<number>(0);
  const [tutorialSandbox, setTutorialSandbox] = useState<TutorialSandboxData | null>(null);
  const isTutorialMode = Boolean(activeTourId && tutorialSandbox);

  const activeTutorialSteps: TutorialStep[] = activeTourId
    ? getTutorialStepsByTour(activeTourId)
    : [];
  const activeTutorialStep: TutorialStep | null =
    activeTourId && tutorialStepIndex >= 0 && tutorialStepIndex < activeTutorialSteps.length
      ? activeTutorialSteps[tutorialStepIndex]
      : null;

  const openTutorialHistoriaDraft = (sandbox: TutorialSandboxData | null) => {
    setEditingHistoria(sandbox ? { ...sandbox.historiaDraft } : undefined);
    setEditingPatientForHistoriaId(null);
    setIsResumeDraft(false);
    setInitialHistoriaTab('editor');
    setAutoOpenPrint(false);
    setShowHistoriaForm(true);
  };

  const startTutorial = (tourId: TutorialTourId) => {
    const steps = getTutorialStepsByTour(tourId);
    if (steps.length === 0) return;
    setTutorialSandboxStorageGuard(true);
    const freshSandbox = createTutorialSandboxData();
    setTutorialSandbox(freshSandbox);
    window.dispatchEvent(new CustomEvent('hmi_tutorial_cleanup'));
    setActiveTourId(tourId);
    setTutorialStepIndex(0);
    const first = steps[0];
    if (first.requiredAppTab) {
      setActiveTab(first.requiredAppTab);
    }
    if (!first.requiresHistoriaOpen && showHistoriaForm) {
      setShowHistoriaForm(false);
    }
  };

  const stopTutorial = () => {
    window.dispatchEvent(new CustomEvent('hmi_tutorial_cleanup'));
    setShowHistoriaForm(false);
    setEditingHistoria(undefined);
    setEditingPatientForHistoriaId(null);
    setActiveTourId(null);
    setTutorialStepIndex(0);
    setTutorialSandbox(null);
    setTutorialSandboxStorageGuard(false);
  };

  const handleTutorialGoToStepId = (stepId: string) => {
    if (!activeTourId) return;
    const steps = getTutorialStepsByTour(activeTourId);
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx >= 0) {
      setTutorialStepIndex(idx);
    }
  };

  const handleTutorialNext = () => {
    if (!activeTourId || !activeTutorialStep) return;
    if (activeTutorialStep.id === 'hc-01-inicio-btn' && !showHistoriaForm) {
      openTutorialHistoriaDraft(tutorialSandbox);
    }
    if (activeTutorialStep.id === 'hc-39-btn-ingresar-px') {
      window.dispatchEvent(new CustomEvent('hmi_tutorial_open_hospitalize_modal'));
    }
    if (tutorialStepIndex + 1 < activeTutorialSteps.length) {
      setTutorialStepIndex(tutorialStepIndex + 1);
    } else {
      stopTutorial();
    }
  };

  const handleTutorialPrev = () => {
    if (tutorialStepIndex > 0) {
      const prevStep = activeTutorialSteps[tutorialStepIndex - 1];
      if (prevStep && !prevStep.requiresHistoriaOpen && showHistoriaForm) {
        setShowHistoriaForm(false);
      }
      setTutorialStepIndex(tutorialStepIndex - 1);
    }
  };

  const handleTriggerTutorialStepAction = (step: TutorialStep) => {
    if (step.id === 'hc-01-inicio-btn') {
      openTutorialHistoriaDraft(tutorialSandbox);
      handleTutorialGoToStepId('hc-02-p1-intro');
    } else if (step.id === 'hc-39-btn-ingresar-px') {
      window.dispatchEvent(new CustomEvent('hmi_tutorial_open_hospitalize_modal'));
      handleTutorialGoToStepId('hc-40-modal-area');
    } else {
      handleTutorialNext();
    }
  };

  // Keep view, Historia page, modals, patient cards, bulk download, mobile brand menu, and Hospitalize modal synchronized with the active tutorial step
  useEffect(() => {
    if (!activeTutorialStep) return;

    if (activeTutorialStep.requiredAppTab && activeTab !== activeTutorialStep.requiredAppTab) {
      setActiveTab(activeTutorialStep.requiredAppTab);
    }

    if (activeTutorialStep.requiresHistoriaOpen && !showHistoriaForm) {
      window.dispatchEvent(new CustomEvent('hmi_tutorial_modal_state', { detail: { modal: 'none' } }));
      openTutorialHistoriaDraft(tutorialSandbox);
    } else if (!activeTutorialStep.requiresHistoriaOpen && showHistoriaForm) {
      setShowHistoriaForm(false);
    }

    if (activeTutorialStep.openMobileBrandMenu && typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowMobileIconMenu(true);
    } else if (!activeTutorialStep.openMobileBrandMenu && showMobileIconMenu) {
      setShowMobileIconMenu(false);
    }

    const timers: number[] = [];

    if (activeTutorialStep.expandFirstPatient) {
      timers.push(
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('hmi_tutorial_expand_first_patient'));
        }, 100)
      );
    }

    if (activeTutorialStep.openBulkDownloadMenu) {
      timers.push(
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('hmi_tutorial_toggle_bulk_download', { detail: { open: true } })
          );
        }, 100)
      );
    } else if (activeTutorialStep.requiredModal === 'none') {
      timers.push(
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('hmi_tutorial_toggle_bulk_download', { detail: { open: false } })
          );
        }, 60)
      );
    }

    if (activeTutorialStep.requiredModal) {
      const targetModal = activeTutorialStep.requiredModal;
      timers.push(
        window.setTimeout(() => {
          if (targetModal === 'altas_profile' || targetModal === 'altas_reingreso') {
            window.dispatchEvent(
              new CustomEvent('hmi_tutorial_altas_modal', { detail: { modal: targetModal } })
            );
          } else {
            window.dispatchEvent(
              new CustomEvent('hmi_tutorial_altas_modal', { detail: { modal: 'none' } })
            );
            window.dispatchEvent(
              new CustomEvent('hmi_tutorial_modal_state', { detail: { modal: targetModal } })
            );
          }
        }, 110)
      );
    }

    if (activeTutorialStep.evolutionUiState) {
      const evoState = activeTutorialStep.evolutionUiState;
      timers.push(
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('hmi_tutorial_evolution_ui', { detail: evoState })
          );
        }, 170)
      );
    }

    if (
      activeTutorialStep.historiaPage ||
      activeTutorialStep.historiaTab ||
      activeTutorialStep.openQuickFillField !== undefined
    ) {
      const targetPage = activeTutorialStep.historiaPage;
      const targetTab = activeTutorialStep.historiaTab;
      const targetQuickFill = activeTutorialStep.openQuickFillField ?? '';
      const closeModal = !activeTutorialStep.requiresHospitalizeModal;
      timers.push(
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('hmi_tutorial_set_historia_page', {
              detail: {
                page: targetPage,
                tab: targetTab,
                openQuickFillField: targetQuickFill,
                closeHospitalizeModal: closeModal,
              },
            })
          );
        }, 120)
      );
    }

    return () => {
      timers.forEach(t => window.clearTimeout(t));
    };
  }, [activeTutorialStep?.id]);

  useEffect(() => {
    if (!activeTutorialStep?.requiresHospitalizeModal) return;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('hmi_tutorial_open_hospitalize_modal'));
    }, 100);
    return () => window.clearTimeout(timer);
  }, [activeTutorialStep?.id]);

  // Safety cleanup: release IndexedDB guard on unmount
  useEffect(() => {
    return () => {
      setTutorialSandboxStorageGuard(false);
    };
  }, []);

  // Asynchronous draft check in IndexedDB localForage
  const checkDraftInIDB = async () => {
    try {
      const parsed = await getDraftFromIDB<HistoriaClinicaPediatrica>(DRAFT_KEY);
      if (!parsed) {
        setHasDraft(false);
        return;
      }
      const active = Boolean(
        parsed.apellidos?.trim() ||
        parsed.nombres?.trim() ||
        parsed.numHistoria?.trim() ||
        parsed.motivosAdmision?.trim() ||
        parsed.enfermedadActual?.trim() ||
        parsed.diagnosticoAdmision?.trim() ||
        parsed.patientId ||
        (parsed.resumenHistoriaEnfermedad?.trim() && parsed.resumenHistoriaEnfermedad !== 'Se trata de...')
      );
      setHasDraft(active);
    } catch {
      setHasDraft(false);
    }
  };

  useEffect(() => {
    // Intercept back navigation
    const handlePopState = (event: PopStateEvent) => {
      // Logic: If historia form is open, close it, else navigate home
      // Since HistoriaClinicaForm is a top level state:
      if (showHistoriaForm) {
        setShowHistoriaForm(false);
      } else if (activeTab !== 'inicio') {
        setActiveTab('inicio');
      }
      history.pushState(null, '', window.location.href);
    };

    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showHistoriaForm, activeTab]);

  useEffect(() => {
    checkDraftInIDB();
    window.addEventListener('storage', checkDraftInIDB);
    window.addEventListener('hmi_draft_changed', checkDraftInIDB);
    return () => {
      window.removeEventListener('storage', checkDraftInIDB);
      window.removeEventListener('hmi_draft_changed', checkDraftInIDB);
    };
  }, []);

  const handleOpenLaboratorios = (patientId: string) => {
    setSelectedLabPatientId(patientId);
    setActiveTab('laboratorios');
  };

  // Sync with System Dark/Light Mode & Automatic Schedule when themeMode is 'auto'
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const evaluateAutoTheme = () => {
      const currentPref = localStorage.getItem('hmi_theme_mode') || themeMode;
      if (currentPref === 'auto' || !localStorage.getItem('hmi_dark_mode') || localStorage.getItem('hmi_dark_mode') === 'auto') {
        setDarkMode(resolveAutoDarkMode());
      }
    };
    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const handleSystemThemeChange = () => evaluateAutoTheme();
    mediaQuery?.addEventListener?.('change', handleSystemThemeChange);
    const autoTimer = window.setInterval(evaluateAutoTheme, 60000);
    return () => {
      mediaQuery?.removeEventListener?.('change', handleSystemThemeChange);
      window.clearInterval(autoTimer);
    };
  }, [themeMode]);

  // Close theme mode dropdown when clicking outside
  useEffect(() => {
    if (!showThemeModeMenu) return;
    const handleClickOutside = (ev: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(ev.target as Node)) {
        setShowThemeModeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showThemeModeMenu]);

  // Initialize Dark Mode Class & Seasonal Theme Attribute
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-seasonal', seasonalTheme);
    syncDynamicPwaIcons(seasonalTheme);
  }, [seasonalTheme]);

  // Load Initial Cloud/Local Data with Immediate Offline Hydration & IndexedDB Rebuild
  const loadAllData = async () => {
    try {
      const [cachedPatients, cachedBeds, cachedTasks, cachedHistorias, cachedGuardias] = await Promise.all([
        getPatientsFromIDB(),
        getBedsFromIDB(),
        getTasksFromIDB(),
        getHistoriasFromIDB(),
        getGuardiasFromIDB()
      ]);
      if (cachedPatients.length > 0) setPatients(cachedPatients);
      if (cachedBeds.length > 0) setBeds(cachedBeds);
      if (cachedTasks.length > 0) setTasks(cachedTasks);
      if (cachedHistorias.length > 0) setHistorias(cachedHistorias);
      if (cachedGuardias) setGuardias(cachedGuardias);
    } catch {}

    // Sync offline queue first, then fetch Supabase (including v3.2.0 full backup & app_panel_control) & merge cleanly
    const data = await syncAndRebuildLocalMemory();
    setPatients(data.patients);
    setBeds(data.beds);
    setTasks(data.tasks);
    setHistorias(data.historias);
    if (data.guardias) setGuardias(data.guardias);
    setSeasonalTheme(readStoredSeasonalStyle());
    const syncedDark = localStorage.getItem('hmi_dark_mode');
    if (syncedDark === 'dark') setDarkMode(true);
    else if (syncedDark === 'light') setDarkMode(false);
    setMaintenanceStatus(getLocalMaintenanceStatus());
    setAmbientSoundConfig(getLocalAmbientSoundConfig());
    syncActivityLogsWithSupabase().catch(() => {});

    // Check URL parameters for public shared historia link
    const urlParams = new URLSearchParams(window.location.search);
    const publicId = urlParams.get('historiaId');
    if (publicId) {
      const h = await fetchHistoriaByIdApi(publicId);
      if (h) {
        setPublicViewHistoria(h);
      }
    }
  };

  // Pause ambient audio automatically when user switches app or goes home ONLY in mobile view (<= 767px)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let isBlurred = typeof document !== 'undefined' && typeof document.hasFocus === 'function'
      ? !document.hasFocus()
      : false;
    const mq = window.matchMedia ? window.matchMedia('(max-width: 767px)') : null;

    const evaluateMobilePause = () => {
      const mobileNow = mq ? mq.matches : isMobileViewportWidth(window.innerWidth);
      const hiddenNow =
        typeof document !== 'undefined' &&
        (document.hidden || document.visibilityState === 'hidden');
      setIsMobileBackgroundPaused(
        shouldPauseForMobileBackground({
          isMobileView: mobileNow,
          isDocumentHidden: hiddenNow,
          isWindowBlurred: isBlurred,
        })
      );
    };

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden && document.visibilityState === 'visible') {
        isBlurred = false;
      }
      evaluateMobilePause();
    };
    const handlePause = () => {
      isBlurred = true;
      evaluateMobilePause();
    };
    const handleResume = () => {
      isBlurred = false;
      evaluateMobilePause();
    };

    evaluateMobilePause();
    mq?.addEventListener?.('change', evaluateMobilePause);
    window.addEventListener('resize', evaluateMobilePause);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePause);
    window.addEventListener('pageshow', handleResume);
    window.addEventListener('blur', handlePause);
    window.addEventListener('focus', handleResume);

    return () => {
      mq?.removeEventListener?.('change', evaluateMobilePause);
      window.removeEventListener('resize', evaluateMobilePause);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePause);
      window.removeEventListener('pageshow', handleResume);
      window.removeEventListener('blur', handlePause);
      window.removeEventListener('focus', handleResume);
    };
  }, []);

  useEffect(() => {
    const baseEnabled = Boolean(ambientSoundConfig.enabled) || userLocalSoundOverride;
    const effectiveEnabled = resolveMobileEffectivePlayback({
      userWantsAudio: baseEnabled,
      isMobilePaused: isMobileBackgroundPaused,
    });
    ambientSoundEngine.sync(
      seasonalTheme,
      effectiveEnabled,
      ambientSoundConfig.intensity ?? 0.4,
      userSoundMuted || isMobileBackgroundPaused
    );
  }, [
    seasonalTheme,
    ambientSoundConfig.enabled,
    ambientSoundConfig.intensity,
    userLocalSoundOverride,
    userSoundMuted,
    isMobileBackgroundPaused,
  ]);

  useEffect(() => {
    // Reset stale mute flag on fresh app startup so audio always starts active
    setUserAmbientSoundMuted(false);
    setActiveAmbientTrack(ambientSoundEngine.getCurrentTrack());
    return ambientSoundEngine.subscribeTrackChange((track) => {
      setActiveAmbientTrack(track);
      if (track && ambientSoundEngine.isActivelyPlaying() && !userExplicitlyMutedRef.current) {
        setUserSoundMuted(false);
        setUserAmbientSoundMuted(false);
        if (!getLocalAmbientSoundConfig().enabled) {
          setUserLocalSoundOverride(true);
        }
      }
    });
  }, []);

  useEffect(() => {
    const applyMaintenanceStatus = (nextStatus: MaintenanceConfig | null | undefined) => {
      if (!nextStatus) return;
      setMaintenanceStatus(prev => {
        if (
          Boolean(prev.enabled) === Boolean(nextStatus.enabled) &&
          (prev.message || '') === (nextStatus.message || '') &&
          (prev.updatedAt || '') === (nextStatus.updatedAt || '')
        ) {
          return prev;
        }
        return nextStatus;
      });
    };

    const applyAmbientSoundConfig = (nextConfig: AmbientSoundConfig | null | undefined) => {
      if (!nextConfig) return;
      setAmbientSoundConfig(prev => {
        const nextTs = parseConfigTimestampMs(nextConfig.updatedAt);
        const isFreshAdminDisable =
          prev.enabled && !nextConfig.enabled && nextTs > appBootTimestampRef.current;

        if (isFreshAdminDisable) {
          setUserLocalSoundOverride(false);
        } else if (
          shouldUnmuteOnGlobalAmbientChange(prev, nextConfig, userExplicitlyMutedRef.current)
        ) {
          setUserSoundMuted(false);
          setUserAmbientSoundMuted(false);
          setUserLocalSoundOverride(false);
        }
        if (
          Boolean(prev.enabled) === Boolean(nextConfig.enabled) &&
          Math.abs((prev.intensity ?? 0.4) - (nextConfig.intensity ?? 0.4)) < 0.005 &&
          (prev.updatedAt || '') === (nextConfig.updatedAt || '')
        ) {
          return prev;
        }
        return nextConfig;
      });
    };

    const syncSeasonalIfChanged = () => {
      const next = readStoredSeasonalStyle();
      syncDynamicPwaIcons(next);
      setSeasonalTheme(prev => (prev === next ? prev : next));
    };

    const syncGlobalConfigsNow = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      fetchMaintenanceStatusApi()
        .then((status) => applyMaintenanceStatus(status))
        .catch(() => {});
      fetchAmbientSoundConfigApi()
        .then((cfg) => applyAmbientSoundConfig(cfg))
        .catch(() => {});
      fetchPanelControlApi()
        .then((panel) => {
          if (panel) {
            syncSeasonalIfChanged();
            applyAmbientSoundConfig(getLocalAmbientSoundConfig());
            applyMaintenanceStatus(getLocalMaintenanceStatus());
          }
        })
        .catch(() => {});
    };

    const getPatientsSignature = (list: Patient[]) =>
      list
        .map(p => `${p.id}:${p.updatedAt || ''}:${p.status}:${p.area}:${p.bedNumber}:${p.evolutions?.length || 0}`)
        .sort()
        .join('|');

    const getBedsSignature = (list: Bed[]) =>
      list
        .map(b => `${b.id}:${b.status}:${b.patientId || ''}:${b.area}:${b.bedNumber}:${b.updatedAt || ''}`)
        .sort()
        .join('|');

    let isSyncingLiveClinical = false;
    const syncClinicalLiveNow = async () => {
      if (isSyncingLiveClinical || !navigator.onLine) return;
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      isSyncingLiveClinical = true;
      try {
        const [livePatients, liveBeds] = await Promise.all([
          fetchPatientsApi(),
          fetchBedsApi()
        ]);
        if (Array.isArray(livePatients) && livePatients.length > 0) {
          setPatients(prev => (getPatientsSignature(prev) === getPatientsSignature(livePatients) ? prev : livePatients));
        }
        if (Array.isArray(liveBeds) && liveBeds.length > 0) {
          setBeds(prev => (getBedsSignature(prev) === getBedsSignature(liveBeds) ? prev : liveBeds));
        }
      } catch {
      } finally {
        isSyncingLiveClinical = false;
      }
    };

    loadAllData();
    refreshQueueCount();
    syncGlobalConfigsNow();

    // Subscribe to SSE (/api/events), BroadcastChannel & Supabase real-time cloud updates
    const unsubscribe = subscribeToRealtimeEvents((event) => {
      if (event.type === 'PATIENTS_UPDATED') {
        setPatients(prev => (getPatientsSignature(prev) === getPatientsSignature(event.payload) ? prev : event.payload));
      } else if (event.type === 'BEDS_UPDATED') {
        setBeds(prev => (getBedsSignature(prev) === getBedsSignature(event.payload) ? prev : event.payload));
      } else if (event.type === 'TASKS_UPDATED') {
        setTasks(event.payload);
      } else if (event.type === 'HISTORIAS_UPDATED') {
        setHistorias(event.payload);
      } else if (event.type === 'GUARDIAS_UPDATED') {
        setGuardias(event.payload);
      } else if (event.type === 'MAINTENANCE_UPDATED') {
        applyMaintenanceStatus(event.payload);
      } else if (event.type === 'AMBIENT_SOUND_UPDATED') {
        applyAmbientSoundConfig(event.payload);
      } else if (event.type === 'PANEL_CONTROL_UPDATED') {
        syncSeasonalIfChanged();
        handleDarkModeSync();
        applyAmbientSoundConfig(getLocalAmbientSoundConfig());
        applyMaintenanceStatus(getLocalMaintenanceStatus());
      } else if (event.type === 'FULL_BACKUP_UPDATED') {
        const payload = event.payload;
        if (payload?.patients && Array.isArray(payload.patients)) {
          setPatients(prev => (getPatientsSignature(prev) === getPatientsSignature(payload.patients) ? prev : payload.patients));
        }
        if (payload?.beds && Array.isArray(payload.beds)) {
          setBeds(prev => (getBedsSignature(prev) === getBedsSignature(payload.beds) ? prev : payload.beds));
        }
        if (payload?.tasks && Array.isArray(payload.tasks)) {
          setTasks(payload.tasks);
        }
        if (payload?.historias && Array.isArray(payload.historias)) {
          setHistorias(payload.historias);
        }
        if (payload?.guardias) {
          setGuardias(payload.guardias);
        }
        syncSeasonalIfChanged();
        handleDarkModeSync();
        applyAmbientSoundConfig(getLocalAmbientSoundConfig());
        applyMaintenanceStatus(getLocalMaintenanceStatus());
      }
    });

    const handleOnline = () => {
      setIsOnline(true);
      syncGlobalConfigsNow();
      syncOfflineQueue()
        .then(() => refreshQueueCount())
        .then(() => loadAllData())
        .catch(() => {});
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshQueueCount();
    };

    const handleThemeSync = () => {
      syncSeasonalIfChanged();
    };

    const handleDarkModeSync = () => {
      const storedThemeMode = localStorage.getItem('hmi_theme_mode');
      const storedMode = localStorage.getItem('hmi_dark_mode');
      if (storedThemeMode === 'auto' || storedMode === 'auto') {
        setThemeMode('auto');
        setDarkMode(resolveAutoDarkMode());
      } else if (storedThemeMode === 'dark' || storedMode === 'dark') {
        setThemeMode('dark');
        setDarkMode(prev => (prev ? prev : true));
      } else if (storedThemeMode === 'light' || storedMode === 'light') {
        setThemeMode('light');
        setDarkMode(prev => (prev ? false : prev));
      }
    };

    const handleGuardiasSync = () => {
      getGuardiasFromIDB().then(g => setGuardias(g)).catch(() => {});
    };

    const handleMaintenanceSync = () => {
      applyMaintenanceStatus(getLocalMaintenanceStatus());
    };

    const handleAmbientSoundLocalSync = () => {
      applyAmbientSoundConfig(getLocalAmbientSoundConfig());
    };

    const handleUserMuteSync = () => {
      setUserSoundMuted(getUserAmbientSoundMuted());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncGlobalConfigsNow();
        syncClinicalLiveNow();
      }
    };

    const maintenancePollInterval = window.setInterval(syncGlobalConfigsNow, 15000);
    const liveClinicalPollInterval = window.setInterval(syncClinicalLiveNow, 25000);

    const veCalendarInterval = window.setInterval(() => {
      if (isSeasonalAutoVenezuelaEnabled()) {
        syncSeasonalIfChanged();
      }
    }, 60000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', syncGlobalConfigsNow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('hmi_queue_changed', refreshQueueCount);
    window.addEventListener('hmi_seasonal_theme_changed', handleThemeSync);
    window.addEventListener('hmi_dark_mode_changed', handleDarkModeSync);
    window.addEventListener('hmi_guardias_changed', handleGuardiasSync);
    window.addEventListener('hmi_maintenance_changed', handleMaintenanceSync);
    window.addEventListener('hmi_ambient_sound_changed', handleAmbientSoundLocalSync);
    window.addEventListener('hmi_ambient_sound_mute_changed', handleUserMuteSync);
    window.addEventListener('storage', handleThemeSync);
    window.addEventListener('storage', handleDarkModeSync);
    window.addEventListener('storage', handleMaintenanceSync);
    window.addEventListener('storage', handleAmbientSoundLocalSync);
    window.addEventListener('storage', handleUserMuteSync);

    return () => {
      unsubscribe();
      window.clearInterval(maintenancePollInterval);
      window.clearInterval(liveClinicalPollInterval);
      window.clearInterval(veCalendarInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', syncGlobalConfigsNow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('hmi_queue_changed', refreshQueueCount);
      window.removeEventListener('hmi_seasonal_theme_changed', handleThemeSync);
      window.removeEventListener('hmi_dark_mode_changed', handleDarkModeSync);
      window.removeEventListener('hmi_guardias_changed', handleGuardiasSync);
      window.removeEventListener('hmi_maintenance_changed', handleMaintenanceSync);
      window.removeEventListener('hmi_ambient_sound_changed', handleAmbientSoundLocalSync);
      window.removeEventListener('hmi_ambient_sound_mute_changed', handleUserMuteSync);
      window.removeEventListener('storage', handleThemeSync);
      window.removeEventListener('storage', handleDarkModeSync);
      window.removeEventListener('storage', handleMaintenanceSync);
      window.removeEventListener('storage', handleAmbientSoundLocalSync);
      window.removeEventListener('storage', handleUserMuteSync);
    };
  }, []);

  // Save Handlers (strictly isolated in-memory during interactive tutorial sandbox mode — NEVER persist to DB)
  const handleSavePatientList = async (updatedPatients: Patient[]) => {
    if (isTutorialMode) {
      setTutorialSandbox(prev => (prev ? { ...prev, patients: updatedPatients } : prev));
      return;
    }
    const prevMap = new Map(patients.map(p => [p.id, p]));
    const newIds = new Set(updatedPatients.map(p => p.id));
    const deletedPatients = patients.filter(p => !newIds.has(p.id));
    const actorName = doctorEvolutionDisplayName || currentUserFullName || currentUsername || 'Médico de Guardia';

    // Detect clean, high-value clinical transitions (ingresos, altas, traslados, reingresos)
    for (const nextPt of updatedPatients) {
      const prevPt = prevMap.get(nextPt.id);
      if (!prevPt) {
        logDatabaseActivity({
          module: 'pacientes',
          action: 'INSERT',
          changeCategory: 'ingreso',
          user: nextPt.doctorInCharge || actorName,
          description: `Nuevo ingreso hospitalario: ${nextPt.lastName}, ${nextPt.firstName} (${nextPt.area} - ${nextPt.bedNumber})`,
          details: {
            entityType: 'patient_change',
            changeCategory: 'ingreso',
            id: nextPt.id,
            patientId: nextPt.id,
            patientName: `${nextPt.lastName}, ${nextPt.firstName}`.trim(),
            beforeSnapshot: null,
            snapshot: sanitizeSnapshotForLog('patient', nextPt)
          },
          severity: 'success'
        });
      } else if (prevPt.status === 'hospitalized' && nextPt.status === 'discharged') {
        logDatabaseActivity({
          module: 'pacientes',
          action: 'STATUS_CHANGE',
          changeCategory: 'alta',
          user: actorName,
          description: `Alta médica y egreso: ${nextPt.lastName}, ${nextPt.firstName} (${prevPt.area} - ${prevPt.bedNumber})`,
          details: {
            entityType: 'patient_change',
            changeCategory: 'alta',
            id: nextPt.id,
            patientId: nextPt.id,
            patientName: `${nextPt.lastName}, ${nextPt.firstName}`.trim(),
            beforeSnapshot: sanitizeSnapshotForLog('patient_change', prevPt)
          },
          severity: 'info'
        });
      } else if (prevPt.area !== nextPt.area) {
        logDatabaseActivity({
          module: 'pacientes',
          action: 'STATUS_CHANGE',
          changeCategory: 'traslado',
          user: actorName,
          description: `Cambio de área: ${nextPt.lastName}, ${nextPt.firstName} (${prevPt.area} → ${nextPt.area})`,
          details: {
            entityType: 'patient_change',
            changeCategory: 'traslado',
            id: nextPt.id,
            patientId: nextPt.id,
            patientName: `${nextPt.lastName}, ${nextPt.firstName}`.trim(),
            fromArea: prevPt.area,
            toArea: nextPt.area,
            beforeSnapshot: sanitizeSnapshotForLog('patient_change', prevPt)
          },
          severity: 'warning'
        });
      }
    }

    setPatients(updatedPatients);
    
    for (const dp of deletedPatients) {
      try {
        await deletePatientApi(dp.id, { actorName });
      } catch (err) {
        console.error('Error deleting patient:', err);
      }
    }
    await savePatientsListApi(updatedPatients, { skipLog: true });
  };

  const handleSaveBedList = async (updatedBeds: Bed[]) => {
    if (isTutorialMode) {
      setTutorialSandbox(prev => (prev ? { ...prev, beds: updatedBeds } : prev));
      return;
    }
    setBeds(updatedBeds);
    await saveBedsApi(updatedBeds);
  };

  const handleSaveTaskList = async (updatedTasks: PersonalTask[]) => {
    if (isTutorialMode) {
      setTutorialSandbox(prev => (prev ? { ...prev, tasks: updatedTasks } : prev));
      return;
    }
    // Detect deleted tasks and remove from Supabase
    const newIds = new Set(updatedTasks.map(t => t.id));
    const deletedTasks = tasks.filter(t => !newIds.has(t.id));

    setTasks(updatedTasks);

    for (const dt of deletedTasks) {
      try {
        await deleteTaskApi(dt.id);
      } catch (err) {
        console.error('Error deleting task:', err);
      }
    }
    await saveTasksApi(updatedTasks);
  };

  const handleAddEvolution = async (
    patientId: string,
    evolution: MedicalEvolution,
    beforePatientSnapshot?: Patient
  ) => {
    if (isTutorialMode) {
      setTutorialSandbox(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          patients: prev.patients.map(p =>
            p.id === patientId
              ? {
                  ...p,
                  evolutions: [evolution, ...(p.evolutions || []).filter(e => e.id !== evolution.id)],
                  evolucionadoHoy: true,
                  ultimaEvolucionFecha: evolution.date,
                }
              : p
          ),
        };
      });
      return;
    }
    const preSnapshot = beforePatientSnapshot || patients.find(p => p.id === patientId);
    const updated = await addPatientEvolutionApi(patientId, evolution, {
      beforePatientSnapshot: preSnapshot
    });
    if (updated) {
      setPatients(prev => prev.map(p => p.id === patientId ? updated : p));
    }
  };

  const handleUpdateHistoriaDirect = async (updatedHistoria: HistoriaClinicaPediatrica) => {
    if (isTutorialMode) {
      setTutorialSandbox(prev =>
        prev
          ? {
              ...prev,
              historias: [updatedHistoria, ...prev.historias.filter(h => h.id !== updatedHistoria.id)],
            }
          : prev
      );
      return;
    }
    await saveHistoriaApi(updatedHistoria);
    setHistorias(prev => [updatedHistoria, ...prev.filter(h => h.id !== updatedHistoria.id)]);
  };

  const handleSaveHistoria = async (
    historia: HistoriaClinicaPediatrica,
    autoHospitalize?: { area: HospitalArea; bedNumber: string }
  ) => {
    if (isTutorialMode) {
      setTutorialSandbox(prev => {
        if (!prev) return prev;
        const nextHistorias = [historia, ...prev.historias.filter(h => h.id !== historia.id)];
        return { ...prev, historias: nextHistorias, historiaDraft: historia };
      });
      setEditingHistoria(historia);
      return;
    }
    await saveHistoriaApi(historia);
    setHistorias(prev => [historia, ...prev.filter(h => h.id !== historia.id)]);
    setEditingHistoria(historia);

    // Prioritize target patient ID by editingPatientForHistoriaId or historia.patientId so changing name or HC number still matches 100%
    const targetPatientId = editingPatientForHistoriaId || historia.patientId;
    const matchingPatient = patients.find(p => 
      (targetPatientId && p.id === targetPatientId) || 
      (historia.id && p.historiaClinicaId === historia.id) ||
      (historia.numHistoria && p.medicalHistoryNumber && p.medicalHistoryNumber.toLowerCase().trim() === historia.numHistoria.toLowerCase().trim()) ||
      (historia.nombres && historia.apellidos && p.firstName && p.lastName &&
       historia.nombres.toLowerCase().trim() === p.firstName.toLowerCase().trim() &&
       historia.apellidos.toLowerCase().trim() === p.lastName.toLowerCase().trim())
    );

    if (matchingPatient) {
      const parsedWeight = parseFloat(historia.peso);
      const genderMapped: 'M' | 'F' = historia.generoPatient === 'niña' ? 'F' : 'M';
      const isNewReingresoSave = Boolean(historia.isReingreso && matchingPatient.historiaClinicaId !== historia.id);

      const prevHistoriaIds = Array.from(new Set([
        ...(matchingPatient.previousHistoriaIds || []),
        ...(isNewReingresoSave && matchingPatient.historiaClinicaId ? [matchingPatient.historiaClinicaId] : []),
        ...(isNewReingresoSave && historia.previousHistoriaId ? [historia.previousHistoriaId] : [])
      ].filter(id => id && id !== historia.id)));

      const prevDischargeHistory = [...(matchingPatient.dischargeHistory || [])];
      if (isNewReingresoSave && matchingPatient.dischargeDate) {
        const alreadyArchived = prevDischargeHistory.some(
          d => d.date === matchingPatient.dischargeDate && (d.time || '') === (matchingPatient.dischargeTime || '')
        );
        if (!alreadyArchived) {
          prevDischargeHistory.push({
            date: matchingPatient.dischargeDate,
            time: matchingPatient.dischargeTime,
            reason: matchingPatient.dischargeReason
          });
        }
      }

      const reingresoDateStr = historia.reingresoDate || historia.fechaIngreso || new Date().toISOString().split('T')[0];
      const reingresoTimeStr = historia.horaIngreso || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const targetArea = autoHospitalize?.area || matchingPatient.area;
      const targetBedNumber = autoHospitalize?.bedNumber || historia.bedNumber?.trim() || matchingPatient.bedNumber;

      const nextReadmissions = [...(matchingPatient.readmissions || [])];
      if (isNewReingresoSave) {
        const record: ReadmissionRecord = {
          id: 'reing-' + Date.now(),
          date: reingresoDateStr,
          time: reingresoTimeStr,
          mode: 'new_admission',
          area: targetArea,
          bedNumber: targetBedNumber,
          historiaClinicaId: historia.id,
          previousHistoriaId: historia.previousHistoriaId || matchingPatient.historiaClinicaId,
          previousAdmissionDate: matchingPatient.admissionDate,
          previousDischargeDate: matchingPatient.dischargeDate,
          reason: historia.motivosAdmision?.trim() || historia.diagnosticoAdmision?.trim() || undefined,
          createdAt: new Date().toISOString()
        };
        nextReadmissions.unshift(record);
      }

      const parsedReingresoDxLines = isNewReingresoSave && historia.diagnosticoAdmision
        ? historia.diagnosticoAdmision
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !/^\d+\.?$/.test(l))
        : [];
      const nextDiagnoses = parsedReingresoDxLines.length > 0
        ? parsedReingresoDxLines.map((line, idx) => ({ id: `diag-reing-${Date.now()}-${idx}`, title: line }))
        : matchingPatient.diagnoses;

      const updatedPat: Patient = {
        ...matchingPatient,
        historiaClinicaId: historia.id,
        previousHistoriaIds: prevHistoriaIds.length > 0 ? prevHistoriaIds : matchingPatient.previousHistoriaIds,
        dischargeHistory: prevDischargeHistory.length > 0 ? prevDischargeHistory : matchingPatient.dischargeHistory,
        readmissions: nextReadmissions.length > 0 ? nextReadmissions : matchingPatient.readmissions,
        isReingreso: isNewReingresoSave ? true : matchingPatient.isReingreso,
        readmissionMode: isNewReingresoSave ? 'new_admission' : matchingPatient.readmissionMode,
        readmissionCount: isNewReingresoSave ? (matchingPatient.readmissionCount || 0) + 1 : matchingPatient.readmissionCount,
        lastReadmissionDate: isNewReingresoSave ? reingresoDateStr : matchingPatient.lastReadmissionDate,
        status: (isNewReingresoSave || autoHospitalize) ? 'hospitalized' : matchingPatient.status,
        area: targetArea,
        bedNumber: targetBedNumber,
        // Synchronize all Part I: Datos de Filiación y Admisión
        firstName: historia.nombres?.trim() || matchingPatient.firstName,
        lastName: historia.apellidos?.trim() || matchingPatient.lastName,
        medicalHistoryNumber: historia.numHistoria?.trim() || matchingPatient.medicalHistoryNumber,
        age: historia.edad?.trim() || matchingPatient.age,
        gender: genderMapped || matchingPatient.gender,
        weightKg: !isNaN(parsedWeight) && parsedWeight > 0 ? parsedWeight : matchingPatient.weightKg,
        admissionDate: historia.fechaIngreso || matchingPatient.admissionDate,
        admissionTime: historia.horaIngreso || matchingPatient.admissionTime,
        doctorInCharge: historia.medicoAdmisionFirma || matchingPatient.doctorInCharge,
        treatment: isNewReingresoSave && historia.intervencionTratamiento?.trim()
          ? historia.intervencionTratamiento.trim()
          : matchingPatient.treatment,
        diagnoses: nextDiagnoses,
        updatedAt: new Date().toISOString()
      };

      await savePatientApi(updatedPat, { skipLog: true });
      if (isNewReingresoSave) {
        logDatabaseActivity({
          module: 'pacientes',
          action: 'STATUS_CHANGE',
          changeCategory: 'reingreso',
          user: historia.medicoAdmisionFirma || doctorEvolutionDisplayName || 'Médico de Guardia',
          description: `Reingreso (Nuevo Ingreso): ${updatedPat.lastName}, ${updatedPat.firstName} en ${updatedPat.area} (${updatedPat.bedNumber})`,
          details: {
            entityType: 'patient_change',
            changeCategory: 'reingreso',
            mode: 'new_admission',
            id: updatedPat.id,
            patientId: updatedPat.id,
            patientName: `${updatedPat.lastName}, ${updatedPat.firstName}`.trim(),
            beforeSnapshot: sanitizeSnapshotForLog('patient_change', matchingPatient)
          },
          severity: 'warning'
        });
      }
      setPatients(prev => prev.map(p => p.id === updatedPat.id ? updatedPat : p));

      // Update bed occupancy cleanly without duplicating patient
      setBeds(prevBeds => {
        const nextBeds = prevBeds.map(b => {
          if (autoHospitalize) {
            if (b.area === autoHospitalize.area && b.bedNumber === autoHospitalize.bedNumber) {
              return {
                ...b,
                status: 'occupied' as const,
                patientId: updatedPat.id,
                patientName: `${updatedPat.lastName}, ${updatedPat.firstName}`,
                updatedAt: new Date().toISOString()
              };
            }
            if (b.patientId === updatedPat.id && (b.area !== autoHospitalize.area || b.bedNumber !== autoHospitalize.bedNumber)) {
              return {
                ...b,
                status: 'free' as const,
                patientId: undefined,
                patientName: undefined,
                updatedAt: new Date().toISOString()
              };
            }
          } else if (b.patientId === updatedPat.id) {
            return {
              ...b,
              patientName: `${updatedPat.lastName}, ${updatedPat.firstName}`,
              updatedAt: new Date().toISOString()
            };
          }
          return b;
        });
        saveBedsApi(nextBeds).catch(() => {});
        return nextBeds;
      });

      if (isNewReingresoSave && autoHospitalize) {
        setActiveTab('ward');
      }
    } else if (autoHospitalize) {
      const newPatientId = historia.patientId || 'p-' + Date.now();
      const genderMappedNew: 'M' | 'F' = historia.generoPatient === 'niña' ? 'F' : 'M';
      const newPatient: Patient = {
        id: newPatientId,
        medicalHistoryNumber: historia.numHistoria || 'HC-' + Math.floor(Math.random() * 90000 + 10000),
        firstName: historia.nombres || 'Paciente',
        lastName: historia.apellidos || 'Pediatrico',
        age: historia.edad || '1 año',
        gender: genderMappedNew,
        weightKg: parseFloat(historia.peso) || 10,
        admissionDate: historia.fechaIngreso || new Date().toISOString().split('T')[0],
        admissionTime: historia.horaIngreso || '08:00',
        area: autoHospitalize.area,
        bedNumber: autoHospitalize.bedNumber,
        status: 'hospitalized',
        doctorInCharge: historia.medicoServicioFirma || 'Dr. Brayan',
        diagnoses: [
          { id: 'd1', title: historia.diagnosticoAdmision || 'En estudio' }
        ],
        treatment: historia.intervencionTratamiento || 'Esquema según evolución',
        pendingExams: 'Exámenes de ingreso',
        documents: [],
        evolutions: [],
        historiaClinicaId: historia.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await savePatientApi(newPatient);
      setPatients(prev => [newPatient, ...prev.filter(p => p.id !== newPatientId)]);

      const updatedBeds = beds.map(b => {
        if (b.area === autoHospitalize.area && b.bedNumber === autoHospitalize.bedNumber) {
          return {
            ...b,
            status: 'occupied' as const,
            patientId: newPatient.id,
            patientName: `${newPatient.lastName}, ${newPatient.firstName}`,
            updatedAt: new Date().toISOString()
          };
        }
        return b;
      });
      setBeds(updatedBeds);
      saveBedsApi(updatedBeds);
    }
  };

  const handleReadmitPatient = async (
    patientId: string,
    mode: 'correct_errors' | 'new_admission' = 'correct_errors'
  ) => {
    if (isTutorialMode && tutorialSandbox) {
      const demoPt = tutorialSandbox.patients.find(p => p.id === patientId);
      if (!demoPt) return;
      if (mode === 'correct_errors') {
        setTutorialSandbox(prev =>
          prev
            ? {
                ...prev,
                patients: prev.patients.map(p =>
                  p.id === patientId ? { ...p, status: 'hospitalized', readmissionMode: 'correct_errors' } : p
                ),
              }
            : prev
        );
      } else {
        openTutorialHistoriaDraft(tutorialSandbox);
      }
      return;
    }
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    if (mode === 'correct_errors') {
      // Opción 1: Reingresar para corregir errores dejando todo exactamente intacto como estaba antes, marcando indicador visual
      const todayStr = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const errRecord: ReadmissionRecord = {
        id: 'reing-err-' + Date.now(),
        date: todayStr,
        time: nowTime,
        mode: 'correct_errors',
        area: patient.area,
        bedNumber: patient.bedNumber,
        historiaClinicaId: patient.historiaClinicaId,
        previousDischargeDate: patient.dischargeDate,
        reason: 'Corrección de errores en alta / ficha clínica',
        createdAt: new Date().toISOString()
      };

      const updated: Patient = {
        ...patient,
        status: 'hospitalized',
        readmissionMode: 'correct_errors',
        lastReadmissionDate: todayStr,
        readmissions: [errRecord, ...(patient.readmissions || [])],
        updatedAt: new Date().toISOString()
      };

      await savePatientApi(updated, { skipLog: true });
      logDatabaseActivity({
        module: 'pacientes',
        action: 'STATUS_CHANGE',
        changeCategory: 'reingreso',
        user: doctorEvolutionDisplayName || patient.doctorInCharge || 'Médico de Guardia',
        description: `Reingreso por corrección de errores: ${patient.lastName}, ${patient.firstName} (${patient.area} - ${patient.bedNumber})`,
        details: {
          entityType: 'patient_change',
          changeCategory: 'reingreso',
          mode: 'correct_errors',
          id: patient.id,
          patientId: patient.id,
          patientName: `${patient.lastName}, ${patient.firstName}`.trim(),
          beforeSnapshot: sanitizeSnapshotForLog('patient_change', patient)
        },
        severity: 'warning'
      });
      setPatients(prev => prev.map(p => p.id === patientId ? updated : p));

      // Re-occupy previous bed if currently free
      const nextBeds = beds.map(b => {
        if (b.area === patient.area && b.bedNumber === patient.bedNumber && b.status === 'free') {
          return {
            ...b,
            status: 'occupied' as const,
            patientId: patient.id,
            patientName: `${patient.lastName}, ${patient.firstName}`,
            updatedAt: new Date().toISOString()
          };
        }
        return b;
      });
      setBeds(nextBeds);
      saveBedsApi(nextBeds).catch(() => {});

      setActiveTab('ward');
      return;
    }

    // Opción 2: Nuevo Ingreso (Nueva Historia Clínica de Reingreso conservando filiación e historial previo)
    const oldHistoria = historias.find(item =>
      (patient.historiaClinicaId && item.id === patient.historiaClinicaId) ||
      (item.patientId && item.patientId === patient.id) ||
      (item.numHistoria && patient.medicalHistoryNumber && item.numHistoria.toLowerCase().trim() === patient.medicalHistoryNumber.toLowerCase().trim())
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const resolvedAge = oldHistoria?.edad || patient.age;
    const resolvedGender: 'niño' | 'niña' = oldHistoria?.generoPatient || (patient.gender === 'F' ? 'niña' : 'niño');
    const nextEpisodeNumber = (patient.readmissionCount || 0) + 2;

    const freshFunctional = getPediatricNormalFunctionalExam(resolvedAge, resolvedGender);
    const freshPhysical = getPediatricNormalPhysicalExam(resolvedAge, resolvedGender);

    const reingresoHistoria: HistoriaClinicaPediatrica = {
      ...DEFAULT_HISTORIA_CLINICA,
      id: 'hc-reing-' + Date.now(),
      patientId: patient.id,
      isReingreso: true,
      reingresoDate: todayStr,
      previousHistoriaId: oldHistoria?.id || patient.historiaClinicaId,
      episodeNumber: nextEpisodeNumber,
      // Filiación preservada
      generoPatient: resolvedGender,
      apellidos: oldHistoria?.apellidos || patient.lastName,
      nombres: oldHistoria?.nombres || patient.firstName,
      numHistoria: oldHistoria?.numHistoria || patient.medicalHistoryNumber,
      edad: resolvedAge,
      fechaNacimiento: oldHistoria?.fechaNacimiento || '',
      lugarNacimiento: oldHistoria?.lugarNacimiento || '',
      lugarFechaNacimiento: oldHistoria?.lugarFechaNacimiento || '',
      procedenciaEstado: oldHistoria?.procedenciaEstado || '',
      nacionalidad: oldHistoria?.nacionalidad || '',
      ci: oldHistoria?.ci || '',
      direccionCompleta: oldHistoria?.direccionCompleta || '',
      telefono: oldHistoria?.telefono || '',
      enCasoEmergenciaVisarA: oldHistoria?.enCasoEmergenciaVisarA || '',
      parentescoEmergencia: oldHistoria?.parentescoEmergencia || '',
      direccionTelefonoEmergencia: oldHistoria?.direccionTelefonoEmergencia || '',
      peso: oldHistoria?.peso || String(patient.weightKg || ''),
      talla: oldHistoria?.talla || '',
      bedNumber: patient.bedNumber || '',
      // Nuevo episodio clínico
      fechaIngreso: todayStr,
      horaIngreso: nowTime,
      motivosAdmision: '',
      enfermedadActual: 'Se trata de ',
      diagnosticoAdmision: '1. ',
      diagnosticoClinicoFinal: '',
      intervencionTratamiento: '',
      medicoAdmisionFirma: '',
      medicoServicioFirma: 'Jospeth Perez',
      // Página 4: Examen Funcional (14 Sistemas) limpio acorde a edad/sexo
      ...(freshFunctional as any),
      // Página 5: Examen Físico fresco y signos vitales vacíos para tomar en el reingreso
      ...(freshPhysical as any),
      temp: '',
      fr: '',
      fc: '',
      ta: '',
      so2: '',
      so2ConO2: '',
      fechaHoraExamenFisico: `${todayStr} ${nowTime}`,
      // Página 6 GRAFFAR preservado como referencia socioeconómica previa si existe
      graffarProfesionJefe: oldHistoria?.graffarProfesionJefe || '',
      graffarInstruccionMadre: oldHistoria?.graffarInstruccionMadre || '',
      graffarFuenteIngreso: oldHistoria?.graffarFuenteIngreso || '',
      graffarAlojamiento: oldHistoria?.graffarAlojamiento || '',
      graffarScoreA: oldHistoria?.graffarScoreA || 0,
      graffarScoreB: oldHistoria?.graffarScoreB || 0,
      graffarScoreC: oldHistoria?.graffarScoreC || 0,
      graffarScoreD: oldHistoria?.graffarScoreD || 0,
      graffarPuntajeTotal: oldHistoria?.graffarPuntajeTotal || 0,
      graffarEstrato: oldHistoria?.graffarEstrato || '',
      graffarResultado: oldHistoria?.graffarResultado || '',
      // Página 7: Seguimiento de Laboratorios (8 Muestras / Fechas) vacío
      laboratoriosColumnas: [],
      laboratoriosOtros: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEditingPatientForHistoriaId(patient.id);
    setEditingHistoria(reingresoHistoria);
    setIsResumeDraft(false);
    setInitialHistoriaTab('editor');
    setAutoOpenPrint(false);
    setShowHistoriaForm(true);
  };

  const handleOpenHistoriaClinicaForm = (
    patient?: Patient,
    defaultTab: 'editor' | 'preview' = 'editor',
    openPrint: boolean = false,
    specificHistoriaId?: string
  ) => {
    if (patient) {
      const sourceHistorias = isTutorialMode && tutorialSandbox ? tutorialSandbox.historias : historias;
      setEditingPatientForHistoriaId(patient.id);
      const h = (specificHistoriaId ? sourceHistorias.find(item => item.id === specificHistoriaId) : undefined) || sourceHistorias.find(item => 
        (patient.historiaClinicaId && item.id === patient.historiaClinicaId) ||
        (item.patientId && item.patientId === patient.id) ||
        (item.numHistoria && patient.medicalHistoryNumber && item.numHistoria.toLowerCase().trim() === patient.medicalHistoryNumber.toLowerCase().trim()) ||
        (item.nombres && item.apellidos && patient.firstName && patient.lastName &&
         item.nombres.toLowerCase().trim() === patient.firstName.toLowerCase().trim() &&
         item.apellidos.toLowerCase().trim() === patient.lastName.toLowerCase().trim())
      );
      if (h) {
        setEditingHistoria({
          ...h,
          patientId: patient.id,
          numHistoria: h.numHistoria || patient.medicalHistoryNumber,
          nombres: h.nombres || patient.firstName,
          apellidos: h.apellidos || patient.lastName,
          edad: h.edad || patient.age,
          peso: h.peso || String(patient.weightKg || ''),
          bedNumber: h.bedNumber || patient.bedNumber,
          fechaIngreso: h.fechaIngreso || patient.admissionDate,
          horaIngreso: h.horaIngreso || patient.admissionTime
        });
      } else {
        // Try recovering local draft for this patient if available
        let recoveredDraft: HistoriaClinicaPediatrica | null = null;
        if (typeof window !== 'undefined') {
          try {
            const rawDraft = localStorage.getItem(`historia_backup_${patient.id}`);
            if (rawDraft) recoveredDraft = JSON.parse(rawDraft);
          } catch {}
        }

        setEditingHistoria(recoveredDraft || {
          ...DEFAULT_HISTORIA_CLINICA,
          id: 'hc-' + Date.now(),
          patientId: patient.id,
          apellidos: patient.lastName,
          nombres: patient.firstName,
          numHistoria: patient.medicalHistoryNumber,
          edad: patient.age,
          peso: String(patient.weightKg || ''),
          generoPatient: (patient as any).gender === 'F' ? 'niña' : 'niño',
          bedNumber: patient.bedNumber,
          fechaIngreso: patient.admissionDate,
          horaIngreso: patient.admissionTime,
          motivosAdmision: patient.diagnoses?.map(d => d.title).join(', ') || '',
          diagnosticoAdmision: patient.diagnoses?.map(d => d.title).join('\n') || '',
          diagnosticoClinicoFinal: patient.diagnoses?.map(d => d.title).join('\n') || '',
          intervencionTratamiento: patient.treatment || ''
        });
      }
    } else {
      setEditingPatientForHistoriaId(null);
      setEditingHistoria(undefined);
    }
    setInitialHistoriaTab(defaultTab);
    setAutoOpenPrint(openPrint);
    setShowHistoriaForm(true);
  };

  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'doctor'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hmi_user_role');
      if (stored === 'visitor') {
        localStorage.removeItem('hmi_user_role');
        localStorage.removeItem('hmi_first_time_login_done');
        return 'doctor';
      }
      if (stored === 'admin') return 'admin';
    }
    return 'doctor';
  });

  const [currentUsername, setCurrentUsername] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hmi_username') || '';
    }
    return '';
  });

  const [currentUserFullName, setCurrentUserFullName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hmi_user_name') || '';
    }
    return '';
  });

  const [currentUserGender, setCurrentUserGender] = useState<Gender>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hmi_user_gender') === 'F' ? 'F' : 'M';
    }
    return 'M';
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hmi_user_id') || '';
    }
    return '';
  });

  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hmi_user_email') || '';
    }
    return '';
  });

  const [canEditData, setCanEditData] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hmi_can_edit_data');
      if (stored === 'false') return false;
    }
    return true;
  });

  const isAdmin = currentUserRole === 'admin';
  const isReadOnly = !isAdmin && !canEditData;
  const isVisitor = isReadOnly; // Enforces strict read-only mode across all clinical screens if permission disabled

  // Guard admin tab if role lacks permissions
  useEffect(() => {
    if (!isAdmin && activeTab === 'admin') {
      setActiveTab('inicio');
    }
  }, [isAdmin, activeTab]);

  const handleLogout = () => {
    void reportUserPresenceLogoutApi({
      profileId: currentUserId || undefined,
      username: currentUsername || (isAdmin ? 'admin' : undefined),
      email: currentUserEmail || (isAdmin ? 'guerrerobraste@gmail.com' : undefined),
      isAdmin,
    });
    localStorage.removeItem('hmi_first_time_login_done');
    localStorage.removeItem('hmi_user_role');
    localStorage.removeItem('hmi_username');
    localStorage.removeItem('hmi_user_name');
    localStorage.removeItem('hmi_user_gender');
    localStorage.removeItem('hmi_user_id');
    localStorage.removeItem('hmi_user_email');
    setHasLoggedInBefore(false);
    setCurrentUserRole('doctor');
    setCurrentUsername('');
    setCurrentUserFullName('');
    setCurrentUserGender('M');
    setCurrentUserId('');
    setCurrentUserEmail('');
    setActiveTab('inicio');
  };

  // Sync logged-in doctor approval, profile deletion & edit permission from database profiles
  useEffect(() => {
    if (currentUserRole === 'admin') {
      setCanEditData(true);
      if (typeof window !== 'undefined') localStorage.setItem('hmi_can_edit_data', 'true');
    }

    if (!currentUsername) return;

    fetchAllProfiles().then((profs) => {
      if (!Array.isArray(profs) || profs.length === 0) return;
      const matched = profs.find(p => 
        (p.details?.username || '').toLowerCase() === currentUsername.toLowerCase() ||
        (p.email || '').toLowerCase() === currentUsername.toLowerCase()
      );
      if (currentUserRole !== 'admin' && (!matched || matched.is_approved === false)) {
        handleLogout();
        return;
      }
      if (!matched) return;
      if (matched.id) {
        setCurrentUserId(matched.id);
        if (typeof window !== 'undefined') localStorage.setItem('hmi_user_id', matched.id);
      }
      if (matched.email) {
        setCurrentUserEmail(matched.email);
        if (typeof window !== 'undefined') localStorage.setItem('hmi_user_email', matched.email);
      }
      if (currentUserRole !== 'admin') {
        const allowed = matched.can_edit_data !== false && matched.details?.can_edit_data !== false;
        setCanEditData(allowed);
        if (typeof window !== 'undefined') localStorage.setItem('hmi_can_edit_data', allowed ? 'true' : 'false');
      }
      const fullRegisteredName =
        [matched.details?.firstName, matched.details?.lastName].filter(Boolean).join(' ').trim() ||
        matched.full_name ||
        '';
      if (fullRegisteredName) {
        setCurrentUserFullName(fullRegisteredName);
        if (typeof window !== 'undefined') localStorage.setItem('hmi_user_name', fullRegisteredName);
      }
      if (matched.details?.gender === 'F' || matched.details?.gender === 'M') {
        setCurrentUserGender(matched.details.gender);
        if (typeof window !== 'undefined') localStorage.setItem('hmi_user_gender', matched.details.gender);
      }
    }).catch(() => {});
  }, [currentUserRole, currentUsername]);

  const [hasLoggedInBefore, setHasLoggedInBefore] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('hmi_user_role');
      if (role === 'visitor') {
        localStorage.removeItem('hmi_user_role');
        localStorage.removeItem('hmi_first_time_login_done');
        return false;
      }
      return localStorage.getItem('hmi_first_time_login_done') === 'true';
    }
    return false;
  });

  // Real-time online heartbeat while signed in & logout beacon on tab close
  useEffect(() => {
    if (!hasLoggedInBefore) return;
    const identity = {
      profileId: currentUserId || undefined,
      username: currentUsername || (isAdmin ? 'admin' : undefined),
      email: currentUserEmail || (isAdmin ? 'guerrerobraste@gmail.com' : undefined),
      fullName: currentUserFullName || undefined,
      isAdmin,
    };
    if (!identity.profileId && !identity.username && !identity.email) return;

    const sendHeartbeat = () => {
      void reportUserPresenceHeartbeatApi({ ...identity, event: 'heartbeat' });
    };
    sendHeartbeat();

    const intervalId = window.setInterval(sendHeartbeat, PRESENCE_HEARTBEAT_INTERVAL_MS);
    const onFocus = () => sendHeartbeat();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    const onUnload = () => {
      sendUserPresenceBeaconLogout(identity);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [hasLoggedInBefore, currentUserId, currentUsername, currentUserEmail, currentUserFullName, isAdmin]);

  const themeTokens = getSeasonalThemeTokens(seasonalTheme);

  const shouldShowMaintenanceScreen =
    Boolean(maintenanceStatus?.enabled) && !(hasLoggedInBefore && isAdmin);

  if (shouldShowMaintenanceScreen) {
    return (
      <MaintenanceScreen
        message={maintenanceStatus.message}
        isLoggedInUser={hasLoggedInBefore}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        seasonalTheme={seasonalTheme}
        ambientSoundEnabled={true}
        userSoundMuted={!isSoundPlaying}
        onToggleMuteSound={handleToggleUserMuteSound}
        onLogout={handleLogout}
        onAdminLoginSuccess={(role, username, fullName, gender) => {
          localStorage.setItem('hmi_first_time_login_done', 'true');
          localStorage.setItem('hmi_user_role', role);
          localStorage.setItem('hmi_username', username || '');
          localStorage.setItem('hmi_user_email', 'guerrerobraste@gmail.com');
          if (fullName) localStorage.setItem('hmi_user_name', fullName);
          if (gender) localStorage.setItem('hmi_user_gender', gender);
          setCurrentUserRole('admin');
          setCurrentUsername(username || '');
          setCurrentUserFullName(fullName || username || '');
          setCurrentUserGender(gender === 'F' ? 'F' : 'M');
          setCurrentUserEmail('guerrerobraste@gmail.com');
          setHasLoggedInBefore(true);
          void reportUserPresenceHeartbeatApi({
            username: username || 'admin',
            email: 'guerrerobraste@gmail.com',
            fullName: fullName || 'Administrador',
            isAdmin: true,
            event: 'login',
          });
        }}
      />
    );
  }

  if (!hasLoggedInBefore) {
    return (
      <AuthScreen
        darkMode={darkMode}
          onToggleDarkMode={handleToggleDarkMode}
          seasonalTheme={seasonalTheme}
          ambientSoundEnabled={true}
          userSoundMuted={!isSoundPlaying}
          onToggleMuteSound={handleToggleUserMuteSound}
          onLoginSuccess={(role, username, fullName, gender, meta) => {
            localStorage.setItem('hmi_first_time_login_done', 'true');
            localStorage.setItem('hmi_user_role', role);
            localStorage.setItem('hmi_username', username || '');
            if (meta?.profileId) localStorage.setItem('hmi_user_id', meta.profileId);
            else localStorage.removeItem('hmi_user_id');
            if (meta?.email) localStorage.setItem('hmi_user_email', meta.email);
            else localStorage.removeItem('hmi_user_email');
            if (fullName) localStorage.setItem('hmi_user_name', fullName);
            if (gender) localStorage.setItem('hmi_user_gender', gender);
            setCurrentUserRole(role === 'admin' ? 'admin' : 'doctor');
            setCurrentUsername(username || '');
            setCurrentUserFullName(fullName || username || '');
            setCurrentUserGender(gender === 'F' ? 'F' : 'M');
            setCurrentUserId(meta?.profileId || '');
            setCurrentUserEmail(meta?.email || '');
            setHasLoggedInBefore(true);
            void reportUserPresenceHeartbeatApi({
              profileId: meta?.profileId,
              username: username || (role === 'admin' ? 'admin' : undefined),
              email: meta?.email,
              fullName: fullName || username || undefined,
              isAdmin: role === 'admin',
              event: 'login',
            });
          }}
      />
    );
  }

  const cleanUserDisplayName = (currentUserFullName || currentUsername || 'Médico')
    .replace(/^(dr\.?|dra\.?)\s+/i, '')
    .trim();
  const welcomeGreetingText = currentUserGender === 'F'
    ? `Bienvenida Dra. ${cleanUserDisplayName}`
    : `Bienvenido Dr. ${cleanUserDisplayName}`;
  const doctorEvolutionDisplayName =
    cleanUserDisplayName && cleanUserDisplayName !== 'Administrador' && cleanUserDisplayName !== 'Médico'
      ? `${currentUserGender === 'F' ? 'Dra.' : 'Dr.'} ${cleanUserDisplayName}`
      : undefined;

  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden flex flex-col font-sans transition-colors duration-200 ${themeTokens.rootCanvas}`}>
      {/* SEASONAL OVERLAY ANIMATION */}
      <SeasonalOverlay
        style={seasonalTheme}
        showCornerBadges={activeTab === 'inicio' && !showHistoriaForm && !publicViewHistoria}
      />

      {/* PUBLIC HISTORIA VIEW LINK MODAL */}
      {publicViewHistoria && (
        <div className="fixed inset-0 bg-slate-900/75 dark:bg-slate-950/90 backdrop-blur-md z-50 overflow-y-auto p-4 flex flex-col items-center">
          <div className="bg-[#f9fcfc] dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-4 mb-4 text-slate-900 dark:text-white flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPublicViewHistoria(null)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black rounded-xl flex items-center gap-2 border border-slate-300 dark:border-slate-700 cursor-pointer active:scale-95 transition-all"
              >
                <ArrowLeft className={`w-4 h-4 ${themeTokens.accentIcon}`} />
                <span>Volver</span>
              </button>
              <div>
                <span className={`${themeTokens.accentText} font-bold text-xs uppercase tracking-wider flex items-center gap-1.5`}>
                  <Share2 className="w-4 h-4" /> Red Pública · Historia Clínica Redactada
                </span>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">{publicViewHistoria.apellidos} {publicViewHistoria.nombres} ({publicViewHistoria.numHistoria})</p>
              </div>
            </div>
            <button onClick={() => setPublicViewHistoria(null)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold rounded-lg cursor-pointer">
              ✕ Cerrar Vista Pública
            </button>
          </div>
          <HistoriaClinicaPDFRenderer data={publicViewHistoria} />
        </div>
      )}

      {/* TOP BAR HEADER - PERMANENTEMENTE VISIBLE */}
      {(() => {
        const headerNeonMeta = getHeaderNeonMeta(seasonalTheme);
        const audioNeon = getAudioButtonNeonClasses(isSoundPlaying, seasonalTheme);
        return (
          <header className={`sticky top-0 md:backdrop-blur-md border-b z-40 transition-colors shadow-xs ${themeTokens.headerSurface} ${getHeaderSurfaceNeonClass(seasonalTheme)}`}>
            <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-6">
              {/* Zone 1: Wordmark + Official App Icon (Mobile Quick Menu on Icon Tap) */}
              <div className="relative flex items-center gap-2 sm:gap-3 shrink-0" ref={mobileIconMenuRef}>
                <button
                  type="button"
                  data-testid="mobile-brand-icon-btn"
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      setShowMobileIconMenu(prev => !prev);
                    } else {
                      setActiveTab('inicio');
                    }
                  }}
                  title="HMI Pediatría · Opciones rápidas en móvil"
                  className="relative rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500/60 transition-transform active:scale-95 hover:scale-105 cursor-pointer shrink-0"
                >
                  <img
                    src="/assets/aistudio/Icono_86bb4792.png"
                    alt="HMI Pediatría"
                    className="w-9 h-9 sm:w-11 sm:h-11 object-contain rounded-xl shadow-xs"
                  />
                </button>
                <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('inicio'); }} className="flex flex-col group">
                  <span className="header-neon-text-strong text-xs sm:text-sm font-black tracking-tighter text-slate-900 dark:text-white whitespace-nowrap leading-tight">
                    HOSPITAL MATERNO INFANTIL
                  </span>
                  <span className="header-neon-text sm:hidden text-[8px] font-medium text-slate-600 dark:text-slate-300 italic">
                    desarrollado por el Dr. Brayan Guerrero ❤️
                  </span>
                  <span className={`header-neon-text-strong hidden sm:inline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest leading-tight ${themeTokens.brandSubtitle}`}>
                    ÁREA DE PEDIATRÍA
                  </span>
                  <span className="header-neon-text hidden sm:inline text-[8px] font-medium text-slate-600 dark:text-slate-300 italic">
                    desarrollado por el Dr. Brayan Guerrero ❤️
                  </span>
                </a>

                {/* Mobile Quick Options Dropdown (when tapping app icon on mobile) */}
                {showMobileIconMenu && (
                  <div
                    data-testid="mobile-brand-menu"
                    className="md:hidden absolute left-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-2 z-50 space-y-1.5"
                  >
                    <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Menú Rápido HMI
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black ${
                        isOnline ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      }`}>
                        {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <button
                      type="button"
                      data-tutorial="btn-ambient-sound"
                      onClick={() => {
                        handleToggleUserMuteSound();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        {isSoundPlaying ? <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                        <span>{isSoundPlaying ? 'Silenciar Sonido' : 'Activar Sonido'}</span>
                      </span>
                      <span className={`text-[10px] font-black ${isSoundPlaying ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {isSoundPlaying ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <div className="px-2 pt-1" data-tutorial="btn-theme-mode">
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 px-1">
                        Tema de Pantalla
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => handleSelectThemeMode('light')}
                          className={`px-2 py-1.5 rounded-xl text-[10px] font-bold flex flex-col items-center gap-0.5 border cursor-pointer ${
                            themeMode === 'light'
                              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/50'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5 text-amber-500" />
                          <span>Claro</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectThemeMode('dark')}
                          className={`px-2 py-1.5 rounded-xl text-[10px] font-bold flex flex-col items-center gap-0.5 border cursor-pointer ${
                            themeMode === 'dark'
                              ? 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-400/50'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Nocturno</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectThemeMode('auto')}
                          className={`px-2 py-1.5 rounded-xl text-[10px] font-bold flex flex-col items-center gap-0.5 border cursor-pointer ${
                            themeMode === 'auto'
                              ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-400/50'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                          <span>Auto</span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileIconMenu(false);
                        setActiveTab('tutorial');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-2 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Abrir Tutorial Interactivo</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileIconMenu(false);
                          setActiveTab('admin');
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Panel de Control (Admin)</span>
                      </button>
                    )}

                    <div className="px-1">
                      <PWAInstallButton variant="header" />
                    </div>

                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileIconMenu(false);
                          handleLogout();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-black text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Cerrar Sesión / Salir</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Zone 2: Navigation Links */}
              <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <button
                  onClick={() => setActiveTab('inicio')}
                  data-tutorial="nav-inicio"
                  className={`hmi-header-nav-link header-neon-text ${themeTokens.navHover} ${headerNeonMeta.navHoverGlowClass} transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'inicio' ? `${themeTokens.navActive} header-neon-text-strong` : ''
                  }`}
                >
                  Inicio
                </button>
                <button
                  onClick={() => setActiveTab('guardias')}
                  data-tutorial="nav-guardias"
                  className={`hmi-header-nav-link header-neon-text ${themeTokens.navHover} ${headerNeonMeta.navHoverGlowClass} transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'guardias' ? `${themeTokens.navActive} header-neon-text-strong` : ''
                  }`}
                >
                  <CalendarDays className={`w-3.5 h-3.5 ${themeTokens.navIcon}`} />
                  <span>Rol de guardias</span>
                </button>
                <button
                  onClick={() => setActiveTab('altas')}
                  data-tutorial="nav-altas"
                  className={`hmi-header-nav-link header-neon-text ${themeTokens.navHover} ${headerNeonMeta.navHoverGlowClass} transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'altas' ? `${themeTokens.navActive} header-neon-text-strong` : ''
                  }`}
                >
                  Altas Médicas
                </button>
                <button
                  onClick={() => setActiveTab('tareas')}
                  data-tutorial="nav-tareas"
                  className={`hmi-header-nav-link header-neon-text ${themeTokens.navHover} ${headerNeonMeta.navHoverGlowClass} transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'tareas' ? `${themeTokens.navActive} header-neon-text-strong` : ''
                  }`}
                >
                  Tareas de Guardia
                </button>
                <button
                  onClick={() => setActiveTab('estadisticas')}
                  data-tutorial="nav-estadisticas"
                  className={`hmi-header-nav-link header-neon-text ${themeTokens.navHover} ${headerNeonMeta.navHoverGlowClass} transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'estadisticas' ? `${themeTokens.navActive} header-neon-text-strong` : ''
                  }`}
                >
                  <BarChart3 className={`w-3.5 h-3.5 ${themeTokens.navIcon}`} />
                  <span>Estadísticas</span>
                </button>
                <button
                  type="button"
                  data-testid="header-tutorial-btn"
                  onClick={() => setActiveTab('tutorial')}
                  className={`hmi-header-nav-link header-neon-text ${themeTokens.navHover} ${headerNeonMeta.navHoverGlowClass} transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer font-black tracking-wide ${
                    activeTab === 'tutorial' ? `${themeTokens.navActive} header-neon-text-strong` : ''
                  }`}
                  title="Tutorial interactivo guiado paso a paso"
                >
                  <BookOpen className={`w-3.5 h-3.5 ${themeTokens.navIcon}`} />
                  <span>TUTORIAL</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('admin')}
                    className={`hmi-header-nav-link header-neon-text ${themeTokens.navHover} ${headerNeonMeta.navHoverGlowClass} transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'admin' ? `${themeTokens.navActive} header-neon-text-strong` : ''
                    }`}
                    title="Panel de Control para Administrador (Gestión de Doctores y Logs de la BD)"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                    <span>Panel de Control</span>
                    <span className="header-neon-text px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/40">
                      Admin
                    </span>
                  </button>
                )}
              </nav>

              {/* Zone 3: Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('tutorial')}
                  className={`md:hidden px-2 py-1.5 rounded-xl border text-[10px] font-black tracking-wide flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                    activeTab === 'tutorial'
                      ? 'bg-teal-600 text-white border-teal-500'
                      : 'bg-teal-500/12 text-teal-800 dark:text-teal-300 border-teal-500/35'
                  }`}
                  title="Abrir Tutorial Interactivo"
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>TUTORIAL</span>
                </button>
                {isVisitor && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30">
                    <Eye className="w-3 h-3" />
                    <span className="header-neon-text hidden sm:inline">Modo Visita</span>
                  </div>
                )}

                <div className="hidden md:block">
                  <PWAInstallButton variant="header" />
                </div>

                <div
                  className={`hidden md:flex items-center justify-center p-1.5 sm:px-2 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold ${
                    isOnline ? 'bg-emerald-600/12 text-emerald-800 dark:text-emerald-400' : 'bg-amber-500/12 text-amber-800 dark:text-amber-400 border border-amber-500/30'
                  }`}
                  title={isOnline ? 'Online' : 'Offline'}
                  aria-label={isOnline ? 'Online' : 'Offline'}
                >
                  {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                </div>

                <button
                  type="button"
                  data-tutorial="btn-ambient-sound"
                  onClick={handleToggleUserMuteSound}
                  aria-label={isSoundPlaying ? 'Silenciar sonido ambiental' : 'Activar sonido ambiental'}
                  className={`hidden md:flex p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${audioNeon.buttonClasses}`}
                  title={
                    isSoundPlaying
                      ? `Silenciar sonido ambiental (${activeAmbientTrack?.title || STYLE_SOUND_META[seasonalTheme]?.name || 'Estilo actual'})`
                      : `Activar sonido ambiental (${STYLE_SOUND_META[seasonalTheme]?.name || 'Estilo actual'})`
                  }
                >
                  {isSoundPlaying ? (
                    <Volume2 className={`w-4 h-4 ${audioNeon.iconClasses}`} />
                  ) : (
                    <VolumeX className={`w-4 h-4 ${audioNeon.iconClasses}`} />
                  )}
                </button>

                <div className="relative hidden md:block" ref={themeMenuRef}>
                  <button
                    type="button"
                    data-tutorial="btn-theme-mode"
                    onClick={() => setShowThemeModeMenu(prev => !prev)}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-black/5 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-slate-700 border border-slate-300/60 dark:border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Elegir Modo Claro, Modo Nocturno o Modo Automático"
                  >
                    {themeMode === 'auto' ? (
                      <Sparkles className="w-4 h-4 text-teal-500 dark:text-teal-400" />
                    ) : darkMode ? (
                      <Moon className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-500" />
                    )}
                    <span className="hidden lg:inline text-[10px] font-extrabold uppercase tracking-tight">
                      {themeMode === 'auto' ? 'Auto' : darkMode ? 'Nocturno' : 'Claro'}
                    </span>
                  </button>

                  {showThemeModeMenu && (
                    <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-1.5 z-50 space-y-1">
                      <div className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                        Modo de Pantalla
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectThemeMode('light')}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                          themeMode === 'light'
                            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/40'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Sun className="w-4 h-4 text-amber-500" />
                          <span>Modo Claro</span>
                        </span>
                        {themeMode === 'light' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectThemeMode('dark')}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                          themeMode === 'dark'
                            ? 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-400/40'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Moon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                          <span>Modo Nocturno</span>
                        </span>
                        {themeMode === 'dark' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectThemeMode('auto')}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                          themeMode === 'auto'
                            ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-400/40'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <span>Modo Automático</span>
                        </span>
                        {themeMode === 'auto' && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  className="hidden md:flex header-neon-text p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-rose-100/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-200/80 dark:hover:bg-rose-900/50 border border-rose-300/80 dark:border-rose-800 text-xs font-bold items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="Cerrar sesión / Salir"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="header-neon-text hidden md:inline">Salir</span>
                </button>
              </div>
            </div>
          </header>
        );
      })()}

      {/* OFFLINE STATUS BANNER */}
      <OfflineIndicator isOnline={isOnline} offlineQueueCount={offlineQueueCount} />

      {/* MOBILE BOTTOM NAVIGATION */}
      {(() => {
        const inicioNeon = getMobileNavItemNeonClasses(activeTab === 'inicio');
        const guardiasNeon = getMobileNavItemNeonClasses(activeTab === 'guardias');
        const altasNeon = getMobileNavItemNeonClasses(activeTab === 'altas');
        const tareasNeon = getMobileNavItemNeonClasses(activeTab === 'tareas');
        const statsNeon = getMobileNavItemNeonClasses(activeTab === 'estadisticas');
        const adminNeon = getMobileNavItemNeonClasses(activeTab === 'admin', true);
        return (
          <nav
            aria-label="Navegación móvil"
            data-mobile-nav-neon="true"
            className={`md:hidden fixed bottom-0 left-0 right-0 border-t z-30 flex items-center justify-around py-2 px-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 shadow-lg ${themeTokens.mobileNavSurface} ${getMobileNavSurfaceNeonClass(seasonalTheme)}`}
          >
            <button
              onClick={() => setActiveTab('inicio')}
              className={`flex flex-col items-center gap-0.5 cursor-pointer ${inicioNeon.buttonClasses} ${activeTab === 'inicio' ? themeTokens.mobileNavActive : ''}`}
            >
              <Stethoscope className={`w-4 h-4 ${inicioNeon.iconClasses}`} />
              <span className={inicioNeon.labelClasses}>Inicio</span>
            </button>
            <button
              onClick={() => setActiveTab('guardias')}
              className={`flex flex-col items-center gap-0.5 cursor-pointer ${guardiasNeon.buttonClasses} ${activeTab === 'guardias' ? themeTokens.mobileNavActive : ''}`}
            >
              <CalendarDays className={`w-4 h-4 ${guardiasNeon.iconClasses}`} />
              <span className={guardiasNeon.labelClasses}>Guardias</span>
            </button>
            <button
              onClick={() => setActiveTab('altas')}
              className={`flex flex-col items-center gap-0.5 cursor-pointer ${altasNeon.buttonClasses} ${activeTab === 'altas' ? themeTokens.mobileNavActive : ''}`}
            >
              <Shield className={`w-4 h-4 ${altasNeon.iconClasses}`} />
              <span className={altasNeon.labelClasses}>Altas</span>
            </button>
            <button
              onClick={() => setActiveTab('tareas')}
              className={`flex flex-col items-center gap-0.5 cursor-pointer ${tareasNeon.buttonClasses} ${activeTab === 'tareas' ? themeTokens.mobileNavActive : ''}`}
            >
              <CheckSquare className={`w-4 h-4 ${tareasNeon.iconClasses}`} />
              <span className={tareasNeon.labelClasses}>Tareas</span>
            </button>
            <button
              onClick={() => setActiveTab('estadisticas')}
              className={`flex flex-col items-center gap-0.5 cursor-pointer ${statsNeon.buttonClasses} ${activeTab === 'estadisticas' ? themeTokens.mobileNavActive : ''}`}
            >
              <BarChart3 className={`w-4 h-4 ${statsNeon.iconClasses}`} />
              <span className={statsNeon.labelClasses}>Stats</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex flex-col items-center gap-0.5 cursor-pointer ${adminNeon.buttonClasses} ${activeTab === 'admin' ? 'text-amber-700 dark:text-amber-400 font-bold' : ''}`}
              >
                <ShieldCheck className={`w-4 h-4 text-amber-600 dark:text-amber-500 ${adminNeon.iconClasses}`} />
                <span className={adminNeon.labelClasses}>Admin</span>
              </button>
            )}
          </nav>
        );
      })()}

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 py-4 sm:px-6 sm:py-6 mb-16 md:mb-0 space-y-5 sm:space-y-6 overflow-hidden">
        {/* INICIO / HERO LANDING TAB */}
        {activeTab === 'inicio' && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Friendly Hero Card */}
            <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 relative overflow-hidden border transition-colors ${themeTokens.heroCard}`}>
              <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6">
                <div className="max-w-2xl space-y-3 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] sm:text-xs border ${themeTokens.heroBadge}`}>
                      <Sparkles className="w-3.5 h-3.5" /> Servicio de Pediatría & Puericultura
                    </span>
                    {isVisitor && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-[11px] sm:text-xs border border-amber-500/40">
                        <Eye className="w-3.5 h-3.5" /> Modo de Demostración Rápida (Solo Lectura)
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
                    HOSPITAL MATERNO INFANTIL<br/>
                    <span className={themeTokens.heroTitleAccent}>ÁREA DE HOSPITALIZACIÓN DE PEDIATRÍA</span>
                  </h1>
                  <p className={`text-sm sm:text-base font-black tracking-tight ${
                    currentUserGender === 'F' ? themeTokens.heroGreetingF : themeTokens.heroGreetingM
                  }`}>
                    {welcomeGreetingText}
                  </p>
                  <p className={`text-xs md:text-sm leading-relaxed ${themeTokens.heroBodyText}`}>
                    {isVisitor 
                      ? "Bienvenido al modo de demostración rápida. Puedes consultar las camas y los pacientes hospitalizados con acceso estrictamente de solo lectura."
                      : "Plataforma médica para gestión de historias clínicas pediátricas, revista médica de 24 horas y entrega de guardia en tiempo real."
                    }
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {/* Hide Desarrollar historia clinica if in visitor mode */}
                    {!isVisitor && (
                      hasDraft ? (
                        <button
                          data-tutorial="btn-desarrollar-historia"
                          onClick={() => {
                            setEditingHistoria(undefined);
                            setEditingPatientForHistoriaId(null);
                            setIsResumeDraft(true);
                            setInitialHistoriaTab('editor');
                            setAutoOpenPrint(false);
                            setShowHistoriaForm(true);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md dark:shadow-[0_0_16px_rgba(245,158,11,0.55)] ring-2 ring-amber-400/70 transition-all cursor-pointer active:scale-95"
                          title="Seguir desarrollando la Historia Clínica guardada en borrador"
                        >
                          <Edit3 className="w-4 h-4 text-slate-950" />
                          <span>Desarrollar historia clinica</span>
                        </button>
                      ) : (
                        <button
                          data-tutorial="btn-desarrollar-historia"
                          onClick={() => {
                            if (isTutorialMode) {
                              openTutorialHistoriaDraft(tutorialSandbox);
                              return;
                            }
                            setEditingHistoria(undefined);
                            setEditingPatientForHistoriaId(null);
                            setIsResumeDraft(false);
                            setInitialHistoriaTab('editor');
                            setAutoOpenPrint(false);
                            setShowHistoriaForm(true);
                          }}
                          className={`px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${themeTokens.heroPrimaryBtn}`}
                        >
                          <Plus className="w-4 h-4" /> Desarrollar historia clinica
                        </button>
                      )
                    )}

                    {/* Botón Sugerencias al lado de Desarrollar historia clinica */}
                    <button
                      type="button"
                      data-tutorial="btn-sugerencias"
                      onClick={() => {
                        const defaultName = isAdmin
                          ? 'Dr. Brayan Guerrero'
                          : (doctorEvolutionDisplayName || currentUserFullName || currentUsername || 'Médico Usuario');
                        const now = new Date();
                        const formattedDate = now.toLocaleDateString('es-VE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        setSuggestionUserName(defaultName);
                        setSuggestionDateStr(formattedDate);
                        setSuggestionMessage('');
                        setSuggestionSuccessMsg(null);
                        setShowSuggestionsModal(true);
                      }}
                      className="px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-[0_0_16px_rgba(20,184,166,0.5)] ring-2 ring-teal-400/60"
                      title="Enviar una nota o sugerencia al desarrollador sobre la página"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                      <span>Sugerencias</span>
                    </button>

                    <PWAInstallButton variant="hero" />

                    {/* Panel de Control strictly for admin */}
                    {isAdmin && (
                      <button
                        onClick={() => setActiveTab('admin')}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-xs ${themeTokens.heroSecondaryBtn}`}
                        title="Ingresar al Panel de Control de Administrador"
                      >
                        <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Panel de Control</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Dancing Santa Claus at Inicio */}
                <div className="shrink-0 flex justify-center w-full lg:w-auto">
                  <DancingSanta />
                </div>
              </div>
            </div>

            {/* Ward Bed Board Component embedded directly in landing */}
            <WardBedBoard
              patients={isTutorialMode && tutorialSandbox ? tutorialSandbox.patients : patients}
              beds={isTutorialMode && tutorialSandbox ? tutorialSandbox.beds : beds}
              onUpdatePatients={handleSavePatientList}
              onUpdateBeds={handleSaveBedList}
              onAddEvolution={handleAddEvolution}
              onOpenHistoriaClinicaForm={handleOpenHistoriaClinicaForm}
              onOpenLaboratorios={handleOpenLaboratorios}
              historias={isTutorialMode && tutorialSandbox ? tutorialSandbox.historias : historias}
              isVisitor={isTutorialMode ? false : isVisitor}
              isAdmin={isAdmin}
              currentDoctorName={doctorEvolutionDisplayName}
            />
          </div>
        )}

        {/* WARD BED BOARD TAB */}
        {activeTab === 'ward' && (
          <WardBedBoard
            patients={isTutorialMode && tutorialSandbox ? tutorialSandbox.patients : patients}
            beds={isTutorialMode && tutorialSandbox ? tutorialSandbox.beds : beds}
            onUpdatePatients={handleSavePatientList}
            onUpdateBeds={handleSaveBedList}
            onAddEvolution={handleAddEvolution}
            onOpenHistoriaClinicaForm={handleOpenHistoriaClinicaForm}
            onOpenLaboratorios={handleOpenLaboratorios}
            historias={isTutorialMode && tutorialSandbox ? tutorialSandbox.historias : historias}
            isVisitor={isTutorialMode ? false : isVisitor}
            isAdmin={isAdmin}
            currentDoctorName={doctorEvolutionDisplayName}
          />
        )}

        {/* ROL DE GUARDIAS TAB */}
        {activeTab === 'guardias' && (
          <Suspense fallback={LazyTabFallback}>
            <RolGuardiasView
              guardias={guardias}
              isAdmin={isAdmin}
              isOnline={isOnline}
              onSyncGuardias={async () => {
                const latest = await fetchGuardiasApi();
                setGuardias(latest);
              }}
              onOpenAdminGuardias={() => {
                setAdminInitialTab('guardias');
                setActiveTab('admin');
              }}
              onBackToWard={() => setActiveTab('inicio')}
            />
          </Suspense>
        )}

        {/* LABORATORIOS TAB */}
        {activeTab === 'laboratorios' && (
          <Suspense fallback={LazyTabFallback}>
            <LaboratoriosManager
              patients={(isTutorialMode && tutorialSandbox ? tutorialSandbox.patients : patients).filter(p => p.status === 'hospitalized')}
              historias={isTutorialMode && tutorialSandbox ? tutorialSandbox.historias : historias}
              selectedPatientId={selectedLabPatientId}
              onUpdateHistoria={handleUpdateHistoriaDirect}
              onSelectPatient={(id) => setSelectedLabPatientId(id)}
              onOpenHistoriaClinicaForm={handleOpenHistoriaClinicaForm}
              onBackToWard={() => setActiveTab('ward')}
              readOnly={isTutorialMode ? false : isVisitor}
            />
          </Suspense>
        )}

        {/* ALTAS TAB */}
        {activeTab === 'altas' && (
          <Suspense fallback={LazyTabFallback}>
            <DischargedPatientsList
              patients={isTutorialMode && tutorialSandbox ? tutorialSandbox.patients : patients}
              historias={isTutorialMode && tutorialSandbox ? tutorialSandbox.historias : historias}
              onReadmitPatient={handleReadmitPatient}
              onOpenHistoriaClinicaForm={handleOpenHistoriaClinicaForm}
              onUpdatePatient={async (updatedPt) => {
                if (isTutorialMode) {
                  setTutorialSandbox(prev =>
                    prev
                      ? { ...prev, patients: prev.patients.map(p => (p.id === updatedPt.id ? updatedPt : p)) }
                      : prev
                  );
                  return;
                }
                const next = patients.map(p => p.id === updatedPt.id ? updatedPt : p);
                setPatients(next);
                await savePatientApi(updatedPt);
              }}
              isVisitor={isTutorialMode ? false : isVisitor}
            />
          </Suspense>
        )}

        {/* PERSONAL TASKS TAB */}
        {activeTab === 'tareas' && (
          <Suspense fallback={LazyTabFallback}>
            <PersonalTasksManager
              tasks={isTutorialMode && tutorialSandbox ? tutorialSandbox.tasks : tasks}
              onUpdateTasks={handleSaveTaskList}
              isVisitor={isTutorialMode ? false : isVisitor}
            />
          </Suspense>
        )}

        {/* ESTADISTICAS TAB */}
        {activeTab === 'estadisticas' && (
          <Suspense fallback={LazyTabFallback}>
            <StatisticsView
              patients={isTutorialMode && tutorialSandbox ? tutorialSandbox.patients : patients}
              beds={isTutorialMode && tutorialSandbox ? tutorialSandbox.beds : beds}
              historias={isTutorialMode && tutorialSandbox ? tutorialSandbox.historias : historias}
              onBackToWard={() => setActiveTab('inicio')}
            />
          </Suspense>
        )}

        {/* TUTORIAL INTERACTIVO TAB */}
        {activeTab === 'tutorial' && (
          <Suspense fallback={LazyTabFallback}>
            <TutorialHubView
              isVisitor={isVisitor}
              onStartTour={startTutorial}
              onBackToInicio={() => setActiveTab('inicio')}
            />
          </Suspense>
        )}

        {/* PANEL DE CONTROL / ADMIN TAB */}
        {activeTab === 'admin' && (
          <Suspense fallback={LazyTabFallback}>
            <AdminPanel
              currentUserEmail="guerrerobraste@gmail.com"
              initialTab={adminInitialTab}
              onBack={() => setActiveTab('inicio')}
              onDataImported={loadAllData}
            />
          </Suspense>
        )}
      </main>

      {/* HISTORIA CLINICA MODAL BUILDER */}
      {showHistoriaForm && (
        <AppErrorBoundary
          sectionLabel="Historia Clínica Pediátrica"
          onReset={() => setShowHistoriaForm(false)}
        >
          <Suspense fallback={LazyTabFallback}>
            <HistoriaClinicaForm
              initialData={editingHistoria}
              initialTab={(isTutorialMode ? false : isVisitor) ? 'preview' : initialHistoriaTab}
              autoOpenPrint={autoOpenPrint}
              isResumeDraft={isTutorialMode || isVisitor ? false : isResumeDraft}
              readOnly={isTutorialMode ? false : isVisitor}
              onSave={handleSaveHistoria}
              onClose={() => {
                setShowHistoriaForm(false);
                setEditingPatientForHistoriaId(null);
                setInitialHistoriaTab('editor');
                setAutoOpenPrint(false);
                if (activeTutorialStep?.requiresHistoriaOpen) {
                  stopTutorial();
                }
              }}
              existingPatients={(isTutorialMode && tutorialSandbox ? tutorialSandbox.patients : patients).filter(p => p.status === 'hospitalized')}
              historias={isTutorialMode && tutorialSandbox ? tutorialSandbox.historias : historias}
            />
          </Suspense>
        </AppErrorBoundary>
      )}

      {/* INTERACTIVE FLOATING TUTORIAL COACHMARK OVERLAY */}
      {Boolean(activeTutorialStep) && (
        <Suspense fallback={null}>
          <InteractiveTutorialOverlay
            active={Boolean(activeTutorialStep)}
            steps={activeTutorialSteps}
            currentStepIndex={tutorialStepIndex}
            onGoToStep={idx => {
              const bounded = Math.max(0, Math.min(activeTutorialSteps.length - 1, idx));
              setTutorialStepIndex(bounded);
            }}
            onNext={handleTutorialNext}
            onPrev={handleTutorialPrev}
            onGoToStepId={handleTutorialGoToStepId}
            onClose={stopTutorial}
            onTriggerStepAction={handleTriggerTutorialStepAction}
          />
        </Suspense>
      )}

      {/* VENTANA FLOTANTE DE SUGERENCIAS AL DESARROLLADOR */}
      {showSuggestionsModal && (
        <div className="fixed inset-0 z-[180] bg-slate-900/70 dark:bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 ${themeTokens.cardSurface}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${themeTokens.sectionDivider}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.5)]">
                  <MessageSquarePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Buzón de Sugerencias al Desarrollador
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Envía una nota o recomendación para mejorar la plataforma clínica
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSuggestionsModal(false)}
                className="p-2 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                title="Cerrar ventana de sugerencias"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!suggestionMessage.trim() || isSubmittingSuggestion) return;
                setIsSubmittingSuggestion(true);
                try {
                  const createdList = await submitSuggestionApi({
                    userName: suggestionUserName.trim() || (isAdmin ? 'Dr. Brayan Guerrero' : (doctorEvolutionDisplayName || currentUserFullName || currentUsername || 'Médico Usuario')),
                    userEmail: currentUserEmail || (isAdmin ? 'guerrerobraste@gmail.com' : ''),
                    userRole: isAdmin ? 'Administrador' : 'Médico',
                    message: suggestionMessage.trim(),
                    dateFormatted: suggestionDateStr,
                  });
                  const created = createdList[0];
                  if (created) {
                    logDatabaseActivity({
                      module: 'seguridad',
                      action: 'INSERT',
                      user: created.userName,
                      description: `Nueva sugerencia enviada al desarrollador por ${created.userName}: "${created.message.slice(0, 80)}${created.message.length > 80 ? '...' : ''}"`,
                      details: {
                        entityType: 'page_suggestion',
                        id: created.id,
                        snapshot: created
                      },
                      severity: 'info'
                    });
                  }
                  setSuggestionSuccessMsg('¡Tu sugerencia ha sido enviada al Buzón de Sugerencias del Panel de Control del Administrador!');
                  setSuggestionMessage('');
                } catch (err) {
                  console.error('Error al enviar sugerencia:', err);
                } finally {
                  setIsSubmittingSuggestion(false);
                }
              }}
              className="p-6 space-y-4"
            >
              {suggestionSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/40 text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p>{suggestionSuccessMsg}</p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSuggestionsModal(false);
                          setAdminInitialTab('sugerencias');
                          setActiveTab('admin');
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-black underline text-emerald-800 dark:text-emerald-200 cursor-pointer"
                      >
                        Ir al Buzón de Sugerencias en el Panel de Control →
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Nombre del Usuario</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={suggestionUserName}
                    onChange={(e) => setSuggestionUserName(e.target.value)}
                    placeholder="Nombre del médico o usuario"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Fecha de Envío</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={suggestionDateStr}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-200/70 dark:bg-slate-900/70 border border-slate-300 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-default"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nota / Sugerencia para el Desarrollador *
                </label>
                <textarea
                  required
                  rows={4}
                  value={suggestionMessage}
                  onChange={(e) => {
                    setSuggestionMessage(e.target.value);
                    if (suggestionSuccessMsg) setSuggestionSuccessMsg(null);
                  }}
                  placeholder="Escribe aquí tu sugerencia, idea de mejora o comentario sobre la página..."
                  className="w-full px-3.5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 resize-y"
                />
              </div>

              <div className={`flex items-center justify-between gap-2 pt-3 border-t ${themeTokens.sectionDivider}`}>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Se enviará directamente al Buzón del Administrador
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSuggestionsModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSuggestion || !suggestionMessage.trim()}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-black shadow-[0_0_14px_rgba(20,184,166,0.45)] flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingSuggestion ? 'Enviando...' : 'Enviar Sugerencia'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

