import React, { useState, useEffect } from 'react';
import { UserProfile, MedicalRoleType, RolGuardiasData, GuardiaGroup, GuardiaMember, Gender } from '../types';
import { 
  fetchAllProfiles, approveUserProfile, deleteUserProfile, upsertUserProfile, supabase,
  mapEvolutionToRow, fetchPatientsMetaFromSupabase,
  PageSuggestion, fetchSuggestionsApi, getLocalSuggestions, markSuggestionReadApi, deleteSuggestionApi
} from '../lib/supabase';
import { 
  getGuardiasFromIDB, 
  getPatientsFromIDB, 
  getBedsFromIDB,
  getHistoriasFromIDB,
  getTasksFromIDB,
  getOfflineQueueFromIDB,
  getAutoBackupsList,
  getLatestExportedBackup,
  draftsStore,
  DEFAULT_ROL_GUARDIAS,
  normalizeGuardiasData,
  GUARDIAS_GROUP_COLORS
} from '../services/storage';
import {
  fetchGuardiasApi,
  saveGuardiasApi,
  restoreActivityLogApi,
  fetchMaintenanceStatusApi,
  saveMaintenanceStatusApi,
  getLocalMaintenanceStatus,
  DEFAULT_MAINTENANCE_MESSAGE,
  fetchAmbientSoundConfigApi,
  saveAmbientSoundConfigApi,
  getLocalAmbientSoundConfig,
  AmbientSoundConfig,
  fetchPanelControlApi,
  savePanelControlApi,
  pushFullDatabaseBackupToSupabase,
  fetchUserPresenceApi,
  getLocalUserPresenceMap,
  type UserPresenceRecord,
} from '../services/api';
import { resolveProfilePresence } from '../utils/userPresence';
import {
  getMasterAdminPassword,
  verifyMasterAdminPassword,
  setMasterAdminPasswordLocal,
  validateAndComputeAdminPasswordChange,
} from '../utils/adminAuth';
import { syncDynamicPwaIcons } from '../utils/dynamicPwaIconSync';
import { 
  getActivityLogs, 
  logDatabaseActivity, 
  markActivityLogReverted,
  syncActivityLogsWithSupabase,
  MAX_LOGS,
  ActivityLog, 
  ActivityModule, 
  ActivityChangeCategory
} from '../services/activityLogger';
import { 
  ShieldCheck, Lock, Unlock, KeyRound, Users, UserPlus, Search, 
  RefreshCw, Award, Hospital, School, UserCheck, Mail, Calendar, 
  CheckCircle2, Clock, Check, Trash2, AlertCircle, Eye, EyeOff, 
  Download, Database, ChevronDown, 
  ArrowLeft, Phone, Stethoscope, Sparkles, X, Edit3, Upload, Palette,
  CalendarDays, Plus, RotateCcw, Sliders, Gauge, Layers, Wrench, Power, PowerOff, Volume2, VolumeX, Volume1,
  MessageSquare, Inbox
} from 'lucide-react';
import {
  useSeasonalTheme,
  SEASONAL_STYLE_CARDS,
  SEASONAL_THEME_MAP,
  readStoredSeasonalStyle,
  isSeasonalAutoVenezuelaEnabled,
  isSeasonalAutoNightEnabled,
  setSeasonalAutoVenezuelaMode,
  detectVenezuelaCalendarStyle,
  getVenezuelaNowParts,
} from '../utils/seasonalTheme';
import {
  SeasonalStyle,
  SeasonalOverlayConfig,
  readSeasonalOverlayConfig,
  saveSeasonalOverlayConfig,
  DEFAULT_SEASONAL_OVERLAY_CONFIG,
  getStyleIconMeta,
} from './SeasonalOverlay';
import {
  CURRENT_DATABASE_BACKUP_VERSION,
  collectTutorialCatalogSnapshot,
} from '../utils/databaseBackupHelpers';
import { ambientSoundEngine, STYLE_SOUND_META, STYLE_SOUND_CATALOG, AmbientTrack } from '../utils/ambientSoundEngine';

interface Props {
  currentUserEmail?: string;
  initialTab?: 'doctores' | 'logs' | 'password' | 'estilos' | 'guardias' | 'sugerencias';
  onBack?: () => void;
  onDataImported?: () => void;
}

const SESSION_STORAGE_KEY = 'hmi_admin_session_unlocked';

export const AdminPanel: React.FC<Props> = ({ currentUserEmail, initialTab, onBack, onDataImported }) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const guardiasFileInputRef = React.useRef<HTMLInputElement>(null);
  // Authentication & Gatekeeper State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
    }
    return false;
  });
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authShaking, setAuthShaking] = useState<boolean>(false);

  // Active Tab inside Admin Panel
  const [adminTab, setAdminTab] = useState<'doctores' | 'logs' | 'password' | 'estilos' | 'guardias' | 'sugerencias'>(initialTab || 'doctores');

  useEffect(() => {
    if (initialTab) {
      setAdminTab(initialTab);
    }
  }, [initialTab]);

  // Buzón de Sugerencias State
  const [suggestions, setSuggestions] = useState<PageSuggestion[]>(() => getLocalSuggestions());
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [suggestionFilter, setSuggestionFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [suggestionSearch, setSuggestionSearch] = useState<string>('');

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const list = await fetchSuggestionsApi();
      setSuggestions(list);
    } catch {
      setSuggestions(getLocalSuggestions());
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
    const onSuggestionsUpdated = () => {
      setSuggestions(getLocalSuggestions());
    };
    window.addEventListener('hmi_suggestions_updated', onSuggestionsUpdated);
    window.addEventListener('storage', onSuggestionsUpdated);
    return () => {
      window.removeEventListener('hmi_suggestions_updated', onSuggestionsUpdated);
      window.removeEventListener('storage', onSuggestionsUpdated);
    };
  }, []);

  // Rol de Guardias State
  const [guardiasData, setGuardiasData] = useState<RolGuardiasData>(DEFAULT_ROL_GUARDIAS);
  const [isEditingGuardias, setIsEditingGuardias] = useState<boolean>(false);

  // Seasonal Theme State for Admin Control (17 Styles + Venezuelan Calendar Auto Mode)
  const [currentSeasonalTheme, setCurrentSeasonalTheme] = useState<SeasonalStyle>(() =>
    readStoredSeasonalStyle()
  );
  const [autoVenezuelaMode, setAutoVenezuelaMode] = useState<boolean>(() =>
    isSeasonalAutoVenezuelaEnabled()
  );
  const [autoNightShiftMode, setAutoNightShiftMode] = useState<boolean>(() =>
    isSeasonalAutoNightEnabled()
  );

  // Falling Icons Overlay Customization State (Transparencia, Iconos, Cantidad, Velocidad)
  const [overlayConfig, setOverlayConfig] = useState<SeasonalOverlayConfig>(() => readSeasonalOverlayConfig());
  const [activeOverlayPanel, setActiveOverlayPanel] = useState<'transparencia' | 'iconos' | 'cantidad' | 'velocidad'>('transparencia');
  const [customEmojiInput, setCustomEmojiInput] = useState<string>('');
  const [isStylesCatalogOpen, setIsStylesCatalogOpen] = useState<boolean>(false);

  // Global Maintenance Mode State
  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean>(() =>
    getLocalMaintenanceStatus().enabled
  );
  const [isMaintenanceMenuOpen, setIsMaintenanceMenuOpen] = useState<boolean>(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState<boolean>(false);

  // Global Ambient Sound State (enabled for all users + intensity 0.05..1.0)
  const [ambientSoundConfig, setAmbientSoundConfig] = useState<AmbientSoundConfig>(() =>
    getLocalAmbientSoundConfig()
  );
  const [isSoundSettingsOpen, setIsSoundSettingsOpen] = useState<boolean>(false);
  const [ambientSoundSaving, setAmbientSoundSaving] = useState<boolean>(false);
  const [activeAmbientTrack, setActiveAmbientTrack] = useState<AmbientTrack | null>(() =>
    ambientSoundEngine.getCurrentTrack()
  );
  const soundSaveTimeoutRef = React.useRef<number | null>(null);
  const panelControlSaveTimeoutRef = React.useRef<number | null>(null);

  useEffect(() => {
    setActiveAmbientTrack(ambientSoundEngine.getCurrentTrack());
    return ambientSoundEngine.subscribeTrackChange((track) => {
      setActiveAmbientTrack(track);
    });
  }, []);

  const schedulePanelControlPersist = (patch: Record<string, any>) => {
    if (panelControlSaveTimeoutRef.current !== null) {
      window.clearTimeout(panelControlSaveTimeoutRef.current);
    }
    panelControlSaveTimeoutRef.current = window.setTimeout(() => {
      savePanelControlApi(patch).catch(() => {});
    }, 280);
  };

  useEffect(() => {
    fetchMaintenanceStatusApi()
      .then((status) => setMaintenanceEnabled(Boolean(status.enabled)))
      .catch(() => {});

    fetchAmbientSoundConfigApi()
      .then((cfg) => setAmbientSoundConfig(cfg))
      .catch(() => {});

    fetchPanelControlApi()
      .then((pc) => {
        if (pc) {
          setCurrentSeasonalTheme(readStoredSeasonalStyle());
          setAutoVenezuelaMode(isSeasonalAutoVenezuelaEnabled());
          setAutoNightShiftMode(isSeasonalAutoNightEnabled());
          setOverlayConfig(readSeasonalOverlayConfig());
        }
      })
      .catch(() => {});

    const handleSync = () => {
      setMaintenanceEnabled(getLocalMaintenanceStatus().enabled);
    };
    const handleSoundSync = () => {
      setAmbientSoundConfig(getLocalAmbientSoundConfig());
    };
    const handleThemeSync = () => {
      setCurrentSeasonalTheme(readStoredSeasonalStyle());
      setAutoVenezuelaMode(isSeasonalAutoVenezuelaEnabled());
      setAutoNightShiftMode(isSeasonalAutoNightEnabled());
    };
    const handleOverlaySync = () => {
      setOverlayConfig(readSeasonalOverlayConfig());
    };

    window.addEventListener('hmi_maintenance_changed', handleSync);
    window.addEventListener('hmi_ambient_sound_changed', handleSoundSync);
    window.addEventListener('hmi_seasonal_theme_changed', handleThemeSync);
    window.addEventListener('hmi_seasonal_overlay_config_changed', handleOverlaySync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('storage', handleSoundSync);
    window.addEventListener('storage', handleThemeSync);
    return () => {
      window.removeEventListener('hmi_maintenance_changed', handleSync);
      window.removeEventListener('hmi_ambient_sound_changed', handleSoundSync);
      window.removeEventListener('hmi_seasonal_theme_changed', handleThemeSync);
      window.removeEventListener('hmi_seasonal_overlay_config_changed', handleOverlaySync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('storage', handleSoundSync);
      window.removeEventListener('storage', handleThemeSync);
      if (soundSaveTimeoutRef.current !== null) {
        window.clearTimeout(soundSaveTimeoutRef.current);
      }
      if (panelControlSaveTimeoutRef.current !== null) {
        window.clearTimeout(panelControlSaveTimeoutRef.current);
      }
    };
  }, []);

  const handleToggleGlobalAmbientSound = async (nextEnabled?: boolean) => {
    const targetEnabled = typeof nextEnabled === 'boolean' ? nextEnabled : !ambientSoundConfig.enabled;
    const currentIntensity = ambientSoundConfig.intensity ?? 0.4;
    setIsSoundSettingsOpen(true);
    setAmbientSoundSaving(true);
    try {
      const saved = await saveAmbientSoundConfigApi(targetEnabled, currentIntensity, 'Administrador');
      setAmbientSoundConfig(saved);
      savePanelControlApi({
        ambientSound: saved,
        seasonalTheme: currentSeasonalTheme,
        autoVenezuelaMode,
        autoNightShiftMode,
      }).catch(() => {});
      if (targetEnabled) {
        const picked = ambientSoundEngine.triggerTestPreview(currentSeasonalTheme, saved.intensity);
        setActionNotice(
          `🔊 Sonido ambiental ACTIVADO para todos (${Math.round(saved.intensity * 100)}% · Pista aleatoria: "${picked?.title || STYLE_SOUND_META[currentSeasonalTheme]?.name}").`
        );
      } else {
        ambientSoundEngine.stop();
        setActionNotice('🔇 Sonido ambiental DESACTIVADO para todos los usuarios.');
      }
      setTimeout(() => setActionNotice(null), 4500);
    } catch {
      showErrorBanner('No se pudo actualizar la configuración global de sonido ambiental.');
    } finally {
      setAmbientSoundSaving(false);
    }
  };

  const handleChangeAmbientSoundIntensity = (nextIntensity: number, commitImmediately: boolean = false) => {
    const clamped = Math.min(1, Math.max(0.05, Number(nextIntensity) || 0.4));
    const optimistic: AmbientSoundConfig = {
      ...ambientSoundConfig,
      intensity: clamped,
      updatedAt: new Date().toISOString(),
    };
    setAmbientSoundConfig(optimistic);

    if (optimistic.enabled) {
      ambientSoundEngine.sync(currentSeasonalTheme, true, clamped, false);
    }

    if (soundSaveTimeoutRef.current !== null) {
      window.clearTimeout(soundSaveTimeoutRef.current);
    }

    const persist = async () => {
      try {
        const saved = await saveAmbientSoundConfigApi(optimistic.enabled, clamped, 'Administrador');
        setAmbientSoundConfig(saved);
        savePanelControlApi({
          ambientSound: saved,
          seasonalTheme: currentSeasonalTheme,
          autoVenezuelaMode,
          autoNightShiftMode,
        }).catch(() => {});
      } catch {
        // Keep optimistic UI state on transient failure
      }
    };

    if (commitImmediately) {
      persist();
    } else {
      soundSaveTimeoutRef.current = window.setTimeout(persist, 260);
    }
  };

  const handleSetMaintenanceMode = async (enable: boolean) => {
    setMaintenanceLoading(true);
    try {
      const savedMaint = await saveMaintenanceStatusApi(enable, DEFAULT_MAINTENANCE_MESSAGE, 'Administrador');
      savePanelControlApi({ maintenanceMode: savedMaint }).catch(() => {});
      setMaintenanceEnabled(enable);
      setIsMaintenanceMenuOpen(false);
      if (enable) {
        setActionNotice(
          '🔧 Mantenimiento ACTIVADO: todos los usuarios y visitantes verán el mensaje de mantenimiento (excepto el administrador).'
        );
      } else {
        setActionNotice(
          '✅ Mantenimiento DESACTIVADO: se ha quitado el mantenimiento y la página está disponible normalmente.'
        );
      }
      setTimeout(() => setActionNotice(null), 5000);
    } catch {
      showErrorBanner('No se pudo actualizar el estado de mantenimiento.');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleUpdateOverlayConfig = (patch: Partial<SeasonalOverlayConfig>, noticeText?: string) => {
    setOverlayConfig(prev => {
      const saved = saveSeasonalOverlayConfig({ ...prev, ...patch });
      schedulePanelControlPersist({ seasonalOverlayConfig: saved });
      return saved;
    });
    if (noticeText) {
      setActionNotice(noticeText);
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const handleToggleFallingIcon = (emoji: string, targetStyle: SeasonalStyle) => {
    const { key } = getStyleIconMeta(targetStyle);
    const currentList = overlayConfig[key] || [];
    const exists = currentList.includes(emoji);
    const nextList = exists ? currentList.filter(e => e !== emoji) : [...currentList, emoji];
    handleUpdateOverlayConfig({ [key]: nextList });
  };

  const handleAdminThemeChange = (newTheme: SeasonalStyle) => {
    setAutoVenezuelaMode(false);
    setCurrentSeasonalTheme(newTheme);
    setIsStylesCatalogOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hmi_seasonal_auto_ve', 'false');
      localStorage.setItem('hmi_seasonal_theme', newTheme);
      document.documentElement.setAttribute('data-seasonal', newTheme);
      syncDynamicPwaIcons(newTheme);
      window.dispatchEvent(new Event('hmi_seasonal_theme_changed'));
    }
    savePanelControlApi({
      seasonalTheme: newTheme,
      autoVenezuelaMode: false,
      autoNightShiftMode,
    }).catch(() => {});
    const label = SEASONAL_THEME_MAP[newTheme]?.label || newTheme.toUpperCase();
    setActionNotice(`Estilo visual seleccionado manualmente y sincronizado globalmente: ${label}`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleToggleAutoVenezuelaCalendar = (nextEnabled: boolean, nextNightShift?: boolean) => {
    const nightFlag = typeof nextNightShift === 'boolean' ? nextNightShift : autoNightShiftMode;
    setAutoVenezuelaMode(nextEnabled);
    setAutoNightShiftMode(nightFlag);
    const appliedStyle = setSeasonalAutoVenezuelaMode(nextEnabled, nightFlag);
    setCurrentSeasonalTheme(appliedStyle);
    syncDynamicPwaIcons(appliedStyle);
    savePanelControlApi({
      seasonalTheme: appliedStyle,
      autoVenezuelaMode: nextEnabled,
      autoNightShiftMode: nightFlag,
    }).catch(() => {});
    const label = SEASONAL_THEME_MAP[appliedStyle]?.label || appliedStyle.toUpperCase();
    if (nextEnabled) {
      setActionNotice(
        `🇻🇪 Modo Automático (Calendario de Venezuela) activado y sincronizado. Estilo actual: ${label}`
      );
    } else {
      setActionNotice(`Modo manual activado. Puede elegir libremente cualquier estilo cuando desee.`);
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Change Admin Password Form State
  const [currentAdminPasswordInput, setCurrentAdminPasswordInput] = useState<string>('');
  const [newAdminPasswordInput, setNewAdminPasswordInput] = useState<string>('');
  const [confirmAdminPasswordInput, setConfirmAdminPasswordInput] = useState<string>('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string | null>(null);
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);

  // Doctors State
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterApproval, setFilterApproval] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [restoringLogId, setRestoringLogId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    tone?: 'danger' | 'restore';
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const showErrorBanner = (msg: string) => {
    setActionNotice(null);
    setActionError(msg);
    setTimeout(() => setActionError(null), 5500);
  };

  // New Doctor Modal
  const [showNewDoctorModal, setShowNewDoctorModal] = useState<boolean>(false);
  const [editingDoctor, setEditingDoctor] = useState<UserProfile | null>(null);
  const [doctorModalError, setDoctorModalError] = useState<string | null>(null);
  const [doctorForm, setDoctorForm] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    fullName: '',
    gender: 'M' as Gender,
    email: '',
    roleType: 'Residente' as MedicalRoleType,
    universidad: '',
    nivelAcademico: 'R1',
    especialidad: 'Pediatría y Puericultura',
    telefono: '',
    isApproved: false,
  });

  // Password reveal toggle state for doctor table
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresenceRecord>>(() =>
    getLocalUserPresenceMap()
  );
  const [presenceNowMs, setPresenceNowMs] = useState<number>(() => Date.now());

  // Activity Logs State
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logSearch, setLogSearch] = useState<string>('');
  const [logModuleFilter, setLogModuleFilter] = useState<string>('ALL');
  const [logActionFilter, setLogActionFilter] = useState<string>('ALL');
  const [logCategoryFilter, setLogCategoryFilter] = useState<'ALL' | ActivityChangeCategory>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Load Profiles
  const loadProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const data = await fetchAllProfiles();
      setProfiles(data);
    } catch (err) {
      console.error('Error cargando perfiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  // Load Logs (max 100) + Cloud sync
  const loadLogs = () => {
    const list = getActivityLogs().slice(0, MAX_LOGS);
    setLogs(list);
  };

  // Load Guardias (Supabase system_configs + IndexedDB)
  const loadGuardias = async () => {
    try {
      const cached = await getGuardiasFromIDB();
      setGuardiasData(cached);
      const synced = await fetchGuardiasApi();
      setGuardiasData(synced);
    } catch {}
  };

  useEffect(() => {
    if (isUnlocked) {
      loadProfiles();
      loadLogs();
      syncActivityLogsWithSupabase().then(synced => setLogs(synced.slice(0, MAX_LOGS))).catch(() => {});
      loadGuardias();
      fetchUserPresenceApi().then(setPresenceMap).catch(() => {});

      const handleLogEvent = () => loadLogs();
      const handlePresenceSync = () => {
        setPresenceMap(getLocalUserPresenceMap());
        setPresenceNowMs(Date.now());
      };
      const presencePoll = window.setInterval(() => {
        setPresenceNowMs(Date.now());
        fetchUserPresenceApi().then(setPresenceMap).catch(() => {});
      }, 10000);

      window.addEventListener('hmi_activity_logged', handleLogEvent);
      window.addEventListener('hmi_presence_changed', handlePresenceSync);
      window.addEventListener('storage', handlePresenceSync);
      return () => {
        window.clearInterval(presencePoll);
        window.removeEventListener('hmi_activity_logged', handleLogEvent);
        window.removeEventListener('hmi_presence_changed', handlePresenceSync);
        window.removeEventListener('storage', handlePresenceSync);
      };
    }
  }, [isUnlocked]);

  // Handle Admin Password Verification
  const handleUnlockSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (verifyMasterAdminPassword(passwordInput)) {
      setIsUnlocked(true);
      sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
      setAuthError(null);
      setPasswordInput('');
    } else {
      setAuthError('Contraseña incorrecta. Acceso restringido al personal autorizado.');
      setAuthShaking(true);
      setTimeout(() => setAuthShaking(false), 600);
      setPasswordInput('');
    }
  };

  // Handle Change Admin Password (rotates password & invalidates old password everywhere)
  const handleChangeAdminPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(null);

    const validation = validateAndComputeAdminPasswordChange({
      currentPassword: currentAdminPasswordInput,
      newPassword: newAdminPasswordInput,
      confirmPassword: confirmAdminPasswordInput,
    });

    if (!validation.ok || !validation.nextPassword || !validation.updatedAt) {
      setChangePasswordError(validation.error || 'No se pudo validar el cambio de contraseña.');
      return;
    }

    setMasterAdminPasswordLocal(validation.nextPassword, validation.updatedAt);
    try {
      await savePanelControlApi({
        adminMasterPassword: validation.nextPassword,
        adminMasterPasswordUpdatedAt: validation.updatedAt,
      });
    } catch {
      // Local rotation is already committed cleanly
    }

    setChangePasswordSuccess(
      '¡Contraseña de administrador actualizada! La contraseña anterior ha quedado invalidada de inmediato.'
    );
    setCurrentAdminPasswordInput('');
    setNewAdminPasswordInput('');
    setConfirmAdminPasswordInput('');
  };

  const handleLockSession = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setPasswordInput('');
    setAuthError(null);
  };

  // Doctor Approval / Unblock
  const handleApprove = async (user: UserProfile) => {
    try {
      setActionLoadingId(user.id);
      const success = await approveUserProfile(user.id);
      if (success) {
        setActionNotice(`Acceso aprobado/desbloqueado con éxito para ${user.full_name || user.email}`);
        setProfiles((prev) =>
          prev.map((p) => (p.id === user.id ? { ...p, is_approved: true, role: 'doctor' } : p))
        );

        logDatabaseActivity({
          module: 'doctores',
          action: 'UPDATE',
          user: currentUserEmail || 'Administrador',
          description: `Doctor ${user.full_name || user.email} aprobado y habilitado en el sistema.`,
          details: { id: user.id, email: user.email, rol: user.role_type },
          severity: 'success'
        });
      }
    } catch (err) {
      console.error('Error aprobando doctor:', err);
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Doctor Block (Toggle approval to false)
  const handleBlockDoctor = async (user: UserProfile) => {
    try {
      setActionLoadingId(user.id);
      await upsertUserProfile({
        ...user,
        is_approved: false,
        updated_at: new Date().toISOString()
      });
      setActionNotice(`Acceso bloqueado para el médico ${user.full_name || user.email}`);
      setProfiles((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, is_approved: false } : p))
      );

      logDatabaseActivity({
        module: 'doctores',
        action: 'STATUS_CHANGE',
        user: currentUserEmail || 'Administrador',
        description: `Acceso bloqueado temporalmente para ${user.full_name || user.email}`,
        details: { id: user.id, email: user.email },
        severity: 'warning'
      });
    } catch (err) {
      console.error('Error bloqueando doctor:', err);
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Doctor Toggle Edit Data Permission (can_edit_data)
  const handleToggleDoctorEditPermission = async (user: UserProfile) => {
    const currentCanEdit = user.details?.can_edit_data !== false && user.can_edit_data !== false;
    const newCanEdit = !currentCanEdit;

    const updatedProfile: UserProfile = {
      ...user,
      can_edit_data: newCanEdit,
      details: {
        ...(user.details || {}),
        can_edit_data: newCanEdit,
      },
      updated_at: new Date().toISOString()
    };

    try {
      setActionLoadingId(user.id);
      await upsertUserProfile(updatedProfile);
      setProfiles((prev) =>
        prev.map((p) => (p.id === user.id ? updatedProfile : p))
      );

      setActionNotice(`Permiso de modificación de datos ${newCanEdit ? 'permitido' : 'restringido (solo lectura)'} para ${user.full_name || user.email}`);

      logDatabaseActivity({
        module: 'doctores',
        action: 'UPDATE',
        user: currentUserEmail || 'Administrador',
        description: `Permiso de modificación de datos para ${user.full_name || user.email} cambiado a: ${newCanEdit ? 'Permitido (Edición)' : 'Restringido (Solo lectura)'}`,
        details: { id: user.id, email: user.email, can_edit_data: newCanEdit },
        severity: 'info'
      });
    } catch (err) {
      console.error('Error al cambiar permisos de edición:', err);
      showErrorBanner('Error al actualizar los permisos de modificación de datos.');
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Doctor Deletion
  const executeDeleteDoctor = async (user: UserProfile) => {
    try {
      setActionLoadingId(user.id);
      const isSelf = user.email?.toLowerCase() === currentUserEmail?.toLowerCase();
      const success = await deleteUserProfile(user.id);
      if (success) {
        setActionNotice(`Registro eliminado para ${user.full_name || user.email}`);
        setProfiles((prev) => prev.filter((p) => p.id !== user.id));

        logDatabaseActivity({
          module: 'doctores',
          action: 'DELETE',
          user: currentUserEmail || 'Administrador',
          description: `Registro médico de ${user.full_name || user.email} eliminado del sistema.`,
          details: { entityType: 'doctor', id: user.id, email: user.email, snapshot: user },
          severity: 'danger'
        });

        if (isSelf) {
          setActionNotice('Has eliminado tu propia cuenta. Recargando sesión...');
          setTimeout(() => window.location.reload(), 1200);
        }
      }
    } catch (err) {
      console.error('Error eliminando doctor:', err);
      showErrorBanner('No se pudo eliminar el registro del médico.');
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleDeleteDoctor = (user: UserProfile) => {
    setConfirmDialog({
      title: 'Eliminar Médico',
      message: `¿Está seguro de eliminar el registro del médico "${user.full_name || user.email}"?`,
      confirmLabel: 'Eliminar Definitivamente',
      tone: 'danger',
      onConfirm: () => executeDeleteDoctor(user)
    });
  };

  // Deny Pending Registration Request
  const executeDenyRequest = async (p: UserProfile) => {
    try {
      setActionLoadingId(p.id);
      await deleteUserProfile(p.id);
      setActionNotice(`Solicitud de ${p.full_name || p.email} denegada y removida.`);
      loadProfiles();

      logDatabaseActivity({
        module: 'doctores',
        action: 'DELETE',
        user: currentUserEmail || 'Administrador',
        description: `Denegación de solicitud de registro: ${p.full_name || p.email} [@${p.details?.username || 'sin_usuario'}]`,
        details: { entityType: 'doctor', id: p.id, email: p.email, motivo: 'Denegada por el administrador', snapshot: p },
        severity: 'danger'
      });
    } catch (err) {
      console.error('Error denegando solicitud:', err);
      showErrorBanner('Error al denegar la solicitud.');
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleDenyRequest = (p: UserProfile) => {
    setConfirmDialog({
      title: 'Denegar Solicitud de Registro',
      message: `¿Está seguro de denegar y descartar la solicitud de registro del doctor(a) ${p.full_name || p.email}?`,
      confirmLabel: 'Denegar Solicitud',
      tone: 'danger',
      onConfirm: () => executeDenyRequest(p)
    });
  };

  // Open New Doctor Modal (Registration Request)
  const handleOpenCreateDoctor = () => {
    setEditingDoctor(null);
    setDoctorModalError(null);
    setDoctorForm({
      username: '',
      password: '',
      firstName: '',
      lastName: '',
      fullName: '',
      gender: 'M',
      email: '',
      roleType: 'Residente',
      universidad: 'Universidad Central de Venezuela (UCV)',
      nivelAcademico: 'R1',
      especialidad: 'Pediatría y Puericultura',
      telefono: '',
      isApproved: false,
    });
    setShowNewDoctorModal(true);
  };

  // Open Edit Doctor Modal
  const handleOpenEditDoctor = (p: UserProfile) => {
    setEditingDoctor(p);
    setDoctorModalError(null);
    const details = p.details || {};
    const nameParts = (p.full_name || '').trim().split(/\s+/);
    const derivedFirst = details.firstName || nameParts.slice(0, Math.max(1, Math.floor(nameParts.length / 2))).join(' ');
    const derivedLast = details.lastName || nameParts.slice(Math.max(1, Math.floor(nameParts.length / 2))).join(' ');
    setDoctorForm({
      username: details.username || '',
      password: details.password || '',
      firstName: derivedFirst,
      lastName: derivedLast,
      fullName: p.full_name || '',
      gender: details.gender === 'F' ? 'F' : 'M',
      email: p.email || '',
      roleType: p.role_type || 'Residente',
      universidad: details.universidad || '',
      nivelAcademico: details.anoResidencia || details.anoCursado || 'R1',
      especialidad: details.especialidad || 'Pediatría y Puericultura',
      telefono: details.telefono || '',
      isApproved: p.is_approved ?? true,
    });
    setShowNewDoctorModal(true);
  };

  // Save Doctor / Submit Registration Request
  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setDoctorModalError(null);
    const cleanUsername = doctorForm.username.trim().toLowerCase();
    const cleanPass = doctorForm.password.trim();
    const cleanFirst = doctorForm.firstName.trim();
    const cleanLast = doctorForm.lastName.trim();
    const combinedName = `${cleanFirst} ${cleanLast}`.trim() || doctorForm.fullName.trim();

    if (!cleanUsername || cleanUsername.includes('@') || cleanUsername.includes('.com')) {
      setDoctorModalError('El nombre de usuario es obligatorio y no debe contener "@" ni ".com".');
      return;
    }

    if (!cleanPass || (!editingDoctor && cleanPass.length < 7)) {
      setDoctorModalError('La contraseña es obligatoria (mínimo 7 dígitos o más).');
      return;
    }

    if (!cleanFirst || !cleanLast || !doctorForm.email.trim()) {
      setDoctorModalError('Por favor ingrese Nombre completo, Apellidos completos y correo electrónico.');
      return;
    }

    const doctorId = editingDoctor ? editingDoctor.id : 'doc-' + Date.now();
    const isAdminAccount = doctorForm.email.toLowerCase() === 'guerrerobraste@gmail.com' || cleanUsername === 'admin';

    const profilePayload: UserProfile = {
      id: doctorId,
      email: doctorForm.email.trim().toLowerCase(),
      full_name: combinedName,
      role_type: doctorForm.roleType,
      role: isAdminAccount ? 'admin' : 'doctor',
      is_approved: isAdminAccount ? true : doctorForm.isApproved,
      is_admin: isAdminAccount,
      details: {
        ...(editingDoctor?.details || {}),
        username: cleanUsername,
        password: cleanPass,
        firstName: cleanFirst,
        lastName: cleanLast,
        gender: doctorForm.gender,
        universidad: doctorForm.universidad.trim(),
        anoResidencia: doctorForm.roleType === 'Residente' ? doctorForm.nivelAcademico : undefined,
        anoCursado: doctorForm.roleType === 'Interno' ? doctorForm.nivelAcademico : undefined,
        especialidad: doctorForm.roleType === 'Especialista' ? doctorForm.especialidad : undefined,
        telefono: doctorForm.telefono.trim(),
        fechaRegistro: editingDoctor?.details?.fechaRegistro || new Date().toISOString()
      },
      updated_at: new Date().toISOString(),
      created_at: editingDoctor?.created_at || new Date().toISOString(),
    };

    try {
      await upsertUserProfile(profilePayload);
      setShowNewDoctorModal(false);

      if (!profilePayload.is_approved) {
        setActionNotice(`Solicitud enviada para ${profilePayload.full_name}. Pendiente de aprobación en Panel de Control.`);
      } else {
        setActionNotice(editingDoctor ? `Doctor ${profilePayload.full_name} actualizado exitosamente.` : `Nuevo médico ${profilePayload.full_name} registrado y aprobado.`);
      }

      loadProfiles();

      logDatabaseActivity({
        module: 'doctores',
        action: editingDoctor ? 'UPDATE' : 'INSERT',
        user: currentUserEmail || 'Administrador',
        description: `${editingDoctor ? 'Actualización' : 'Solicitud de registro'} de médico: ${profilePayload.full_name} [@${cleanUsername}]`,
        details: {
          entityType: 'doctor',
          id: profilePayload.id,
          email: profilePayload.email,
          username: cleanUsername,
          aprobado: profilePayload.is_approved,
          snapshot: profilePayload
        },
        severity: profilePayload.is_approved ? 'success' : 'warning'
      });
    } catch (err) {
      console.error('Error guardando perfil del doctor:', err);
      setDoctorModalError('Hubo un error al procesar el registro.');
    } finally {
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  // Build Complete Database Backup Payload (v3.2.0)
  const buildCompleteDatabaseBackupPayload = async () => {
    const [
      patientsData,
      bedsData,
      historiasData,
      tasksData,
      profilesData,
      idbPatients,
      idbBeds,
      idbHistorias,
      idbTasks,
      guardiasSynced,
      idbGuardias,
      evolutionsData,
      syncedLogs,
      systemConfigsRes,
      patientsMeta,
      offlineQueue,
      autoBackupsList,
      latestExportedBackup,
      maintenanceStatusSnapshot,
      ambientSoundSnapshot,
      suggestionsSnapshot
    ] = await Promise.all([
      supabase.from('patients').select('*'),
      supabase.from('beds').select('*'),
      supabase.from('historias').select('*'),
      supabase.from('tasks').select('*'),
      fetchAllProfiles(),
      getPatientsFromIDB(),
      getBedsFromIDB(),
      getHistoriasFromIDB(),
      getTasksFromIDB(),
      fetchGuardiasApi().catch((): null => null),
      getGuardiasFromIDB(),
      supabase.from('evolutions').select('*'),
      syncActivityLogsWithSupabase().catch(() => getActivityLogs()),
      supabase.from('system_configs').select('*'),
      fetchPatientsMetaFromSupabase().catch((): Awaited<ReturnType<typeof fetchPatientsMetaFromSupabase>> => ({})),
      getOfflineQueueFromIDB().catch((): never[] => []),
      getAutoBackupsList().catch((): never[] => []),
      getLatestExportedBackup().catch((): null => null),
      fetchMaintenanceStatusApi().catch(() => getLocalMaintenanceStatus()),
      fetchAmbientSoundConfigApi().catch(() => getLocalAmbientSoundConfig()),
      fetchSuggestionsApi().catch(() => getLocalSuggestions())
    ]);

    // Collect all drafts and builder states from IndexedDB draftsStore + localStorage
    const draftsRecord: Record<string, any> = {};
    try {
      const draftKeys = await draftsStore.keys();
      for (const key of draftKeys) {
        draftsRecord[`idb:${key}`] = await draftsStore.getItem(key);
      }
    } catch {}
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (
            k.startsWith('historia_backup_') ||
            k === 'historia_last_active_backup' ||
            k.startsWith('hmi_ordenes_builder_state_v1_') ||
            k.startsWith('hmi_ordenes_sheet_draft_v1_') ||
            k === 'hmi_theme_mode' ||
            k === 'hmi_dark_mode'
          ) {
            const raw = localStorage.getItem(k);
            if (raw) {
              try {
                draftsRecord[`ls:${k}`] = JSON.parse(raw);
              } catch {
                draftsRecord[`ls:${k}`] = raw;
              }
            }
          }
        }
      } catch {}
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const idbPatientMap = new Map<string, any>(idbPatients.map(p => [p.id, p]));
    const evsByPatient = new Map<string, any[]>();
    for (const ev of (evolutionsData.data || [])) {
      if (!ev?.patient_id) continue;
      const arr = evsByPatient.get(ev.patient_id) || [];
      arr.push(ev);
      evsByPatient.set(ev.patient_id, arr);
    }

    // Merge Supabase + offline-only IndexedDB + clinical metadata patients so nothing is lost
    const supaPatientMap = new Map<string, any>((patientsData.data || []).map((p: any) => [p.id, p]));
    const allPatientIds = new Set<string>([
      ...(patientsData.data || []).map((p: any) => p.id),
      ...idbPatients.map(p => p.id)
    ]);

    const enrichedPatients = Array.from(allPatientIds).map((pid) => {
      const srv = supaPatientMap.get(pid);
      const idbMatch = idbPatientMap.get(pid);
      const metaMatch = (patientsMeta as Record<string, any>)?.[pid];
      const p = srv || idbMatch;
      const srvEvs = evsByPatient.get(pid) || [];
      const localEvs = Array.isArray(idbMatch?.evolutions) ? idbMatch.evolutions : (Array.isArray(p?.evolutions) ? p.evolutions : []);
      const evs = localEvs.length >= srvEvs.length ? localEvs : srvEvs;
      const latestEv = evs[0];
      const evolucionadoHoy =
        Boolean(idbMatch?.evolucionadoHoy && idbMatch?.ultimaEvolucionFecha === todayStr) ||
        evs.some((e: any) => e && e.date === todayStr);

      return {
        ...p,
        historiaClinicaId: idbMatch?.historiaClinicaId || metaMatch?.historiaClinicaId || p?.historia_clinica_id || p?.historiaClinicaId || null,
        evolucionadoHoy,
        ultimaEvolucionFecha: latestEv?.date || idbMatch?.ultimaEvolucionFecha || null,
        fechaUltimaEvolucion: latestEv?.date || p?.admission_date || p?.admissionDate || null,
        horaUltimaEvolucion: latestEv?.time || p?.admission_time || p?.admissionTime || null,
        medicoUltimaEvolucion: latestEv?.doctorName || latestEv?.doctor_name || p?.doctor_in_charge || p?.doctorInCharge || null,
        totalEvoluciones: evs.length,
        evolutions: evs,
        dischargeDate: idbMatch?.dischargeDate || metaMatch?.dischargeDate || p?.discharge_date || p?.dischargeDate || null,
        dischargeTime: idbMatch?.dischargeTime || metaMatch?.dischargeTime || p?.discharge_time || p?.dischargeTime || null,
        dischargeReason: idbMatch?.dischargeReason || metaMatch?.dischargeReason || p?.discharge_reason || p?.dischargeReason || null,
        dischargeSummary: idbMatch?.dischargeSummary || p?.dischargeSummary || null,
        isReingreso: Boolean(idbMatch?.isReingreso ?? metaMatch?.isReingreso ?? p?.isReingreso),
        readmissionMode: idbMatch?.readmissionMode || metaMatch?.readmissionMode || p?.readmissionMode || null,
        readmissionCount: idbMatch?.readmissionCount ?? metaMatch?.readmissionCount ?? p?.readmissionCount ?? (idbMatch?.readmissions?.length || metaMatch?.readmissions?.length || 0),
        lastReadmissionDate: idbMatch?.lastReadmissionDate || metaMatch?.lastReadmissionDate || p?.lastReadmissionDate || null,
        previousHistoriaIds: idbMatch?.previousHistoriaIds || metaMatch?.previousHistoriaIds || p?.previousHistoriaIds || [],
        readmissions: idbMatch?.readmissions || metaMatch?.readmissions || p?.readmissions || [],
        dischargeHistory: idbMatch?.dischargeHistory || metaMatch?.dischargeHistory || p?.dischargeHistory || []
      };
    });

    // Deduplicated flat evolutions list for direct SQL migration
    const evMap = new Map<string, any>();
    for (const ev of (evolutionsData.data || [])) {
      if (ev?.id) evMap.set(ev.id, ev);
    }
    for (const pt of enrichedPatients) {
      for (const ev of (pt.evolutions || [])) {
        if (ev?.id && !evMap.has(ev.id)) {
          evMap.set(ev.id, ev.patient_id ? ev : mapEvolutionToRow(ev));
        }
      }
    }

    // Merge Beds (Supabase + IDB)
    const bedsMap = new Map<string, any>();
    for (const b of idbBeds) if (b?.id) bedsMap.set(b.id, b);
    for (const b of (bedsData.data || [])) if (b?.id) bedsMap.set(b.id, { ...(bedsMap.get(b.id) || {}), ...b });
    const finalBeds = Array.from(bedsMap.values());

    // Merge Historias (Supabase + IDB)
    const historiasMap = new Map<string, any>();
    for (const h of idbHistorias) if (h?.id) historiasMap.set(h.id, h);
    for (const h of (historiasData.data || [])) if (h?.id) historiasMap.set(h.id, { ...(historiasMap.get(h.id) || {}), ...h });
    const finalHistorias = Array.from(historiasMap.values());

    // Merge Tasks (Supabase + IDB)
    const tasksMap = new Map<string, any>();
    for (const t of idbTasks) if (t?.id) tasksMap.set(t.id, t);
    for (const t of (tasksData.data || [])) if (t?.id) tasksMap.set(t.id, { ...(tasksMap.get(t.id) || {}), ...t });
    const finalTasks = Array.from(tasksMap.values());

    const guardiasSnapshot = guardiasSynced || idbGuardias;
    const cappedLogs = (Array.isArray(syncedLogs) ? syncedLogs : getActivityLogs()).slice(0, MAX_LOGS);
    const rawSystemConfigs = Array.isArray(systemConfigsRes?.data) ? systemConfigsRes.data : [];

    // Ensure app_maintenance_mode & app_ambient_sound are present with latest state in systemConfigs
    const systemConfigsMap = new Map<string, any>();
    for (const cfg of rawSystemConfigs) {
      if (cfg?.key) systemConfigsMap.set(cfg.key, cfg);
    }
    if (!systemConfigsMap.has('app_maintenance_mode') || maintenanceStatusSnapshot?.updatedAt) {
      systemConfigsMap.set('app_maintenance_mode', {
        key: 'app_maintenance_mode',
        value: maintenanceStatusSnapshot,
        updated_at: maintenanceStatusSnapshot?.updatedAt || new Date().toISOString()
      });
    }
    if (!systemConfigsMap.has('app_ambient_sound') || ambientSoundSnapshot?.updatedAt) {
      systemConfigsMap.set('app_ambient_sound', {
        key: 'app_ambient_sound',
        value: ambientSoundSnapshot,
        updated_at: ambientSoundSnapshot?.updatedAt || new Date().toISOString()
      });
    }
    const finalSuggestions = Array.isArray(suggestionsSnapshot) ? suggestionsSnapshot : getLocalSuggestions();
    systemConfigsMap.set('hmi_page_suggestions', {
      key: 'hmi_page_suggestions',
      value: finalSuggestions,
      updated_at: new Date().toISOString()
    });
    const systemConfigsList = Array.from(systemConfigsMap.values());

    // Extract structured laboratorios, ordenesMedicas & resumenesEvolutivos from all historias for complete backup
    const laboratoriosSnapshot = finalHistorias.map((h: any) => ({
      historiaId: h.id,
      patientId: h.patientId || null,
      numHistoria: h.numHistoria || '',
      paciente: `${h.apellidos || ''} ${h.nombres || ''}`.trim(),
      laboratorios: Array.isArray(h.laboratorios) ? h.laboratorios : []
    }));
    const ordenesMedicasSnapshot = finalHistorias.flatMap((h: any) =>
      (Array.isArray(h.ordenesMedicas) ? h.ordenesMedicas : []).map((ord: any) => ({
        ...ord,
        historiaId: h.id,
        patientId: h.patientId || null,
        numHistoria: h.numHistoria || ''
      }))
    );
    const resumenesEvolutivosSnapshot = finalHistorias.flatMap((h: any) =>
      (Array.isArray(h.resumenesEvolutivos) ? h.resumenesEvolutivos : []).map((res: any) => ({
        ...res,
        historiaId: h.id,
        patientId: h.patientId || null,
        numHistoria: h.numHistoria || ''
      }))
    );

    // Collect complete localStorage configuration & cache snapshot
    const localStorageState: Record<string, any> = {};
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (
            k.startsWith('hmi_') ||
            k.startsWith('historia_') ||
            k === 'latest_backup_meta' ||
            k === 'auto_export_always'
          ) {
            const rawVal = localStorage.getItem(k);
            if (rawVal !== null) {
              try {
                localStorageState[k] = JSON.parse(rawVal);
              } catch {
                localStorageState[k] = rawVal;
              }
            }
          }
        }
      } catch {}
    }

    const venezuelaNowParts = getVenezuelaNowParts();
    const venezuelaDetectedHoliday = detectVenezuelaCalendarStyle();
    const nowIso = new Date().toISOString();

    const panelControlSettings = {
      seasonalTheme: typeof window !== 'undefined' ? (localStorage.getItem('hmi_seasonal_theme') || currentSeasonalTheme) : currentSeasonalTheme,
      themeMode: typeof window !== 'undefined' ? (localStorage.getItem('hmi_theme_mode') || 'auto') : 'auto',
      branding: {
        appName: 'HMI Pediatría',
        officialIconUrl: '/assets/aistudio/Icono_86bb4792.png',
        mobileBrandMenuEnabled: true,
      },
      autoVenezuelaMode: isSeasonalAutoVenezuelaEnabled(),
      autoNightShiftMode: isSeasonalAutoNightEnabled(),
      venezuelaCalendar: {
        nowParts: venezuelaNowParts,
        detectedStyle: venezuelaDetectedHoliday
      },
      availableSeasonalStyles: SEASONAL_STYLE_CARDS.map(card => ({
        id: card.style,
        label: card.title,
        emoji: card.emoji,
        description: card.description,
        veCalendarDateLabel: card.veCalendarDateLabel,
        ambientSound: STYLE_SOUND_META[card.style] || null
      })),
      seasonalOverlayConfig: readSeasonalOverlayConfig(),
      ambientSound: {
        ...ambientSoundSnapshot,
        activeStyleSound: STYLE_SOUND_META[currentSeasonalTheme] || null
      },
      maintenanceMode: maintenanceStatusSnapshot,
      darkMode: typeof window !== 'undefined' ? (localStorage.getItem('hmi_dark_mode') || 'dark') : 'dark',
      adminMasterPassword: getMasterAdminPassword(),
      currentAdminEmail: currentUserEmail || 'guerrerobraste@gmail.com',
      updatedAt: nowIso,
      doctorsSummary: {
        totalProfiles: profilesData.length,
        approvedCount: profilesData.filter(p => p.is_admin || p.is_approved || p.email?.toLowerCase() === 'guerrerobraste@gmail.com').length,
        pendingCount: profilesData.filter(p => !(p.is_admin || p.is_approved || p.email?.toLowerCase() === 'guerrerobraste@gmail.com')).length
      }
    };

    const tutorialCatalogSnapshot = collectTutorialCatalogSnapshot();

    const completeDbBackup = {
      app: 'Hospital Materno Infantil Clinical Database',
      timestamp: nowIso,
      version: CURRENT_DATABASE_BACKUP_VERSION,
      supabaseProject: 'uhacyaueohkrtbzgoucl.supabase.co',
      stats: {
        totalPatients: enrichedPatients.length,
        hospitalizedPatientsCount: enrichedPatients.filter((p: any) => p.status === 'hospitalized').length,
        evolucionadosHoyCount: enrichedPatients.filter((p: any) => p.status === 'hospitalized' && p.evolucionadoHoy).length,
        pendientesEvolucionHoyCount: enrichedPatients.filter((p: any) => p.status === 'hospitalized' && !p.evolucionadoHoy).length,
        dischargedPatientsCount: enrichedPatients.filter((p: any) => p.status === 'discharged').length,
        totalReingresos: enrichedPatients.reduce((acc: number, p: any) => acc + (Array.isArray(p.readmissions) ? p.readmissions.length : 0), 0),
        evolutionsCount: evMap.size,
        bedsCount: finalBeds.length,
        historiasCount: finalHistorias.length,
        tasksCount: finalTasks.length,
        profilesCount: profilesData.length,
        approvedDoctorsCount: panelControlSettings.doctorsSummary.approvedCount,
        pendingDoctorsCount: panelControlSettings.doctorsSummary.pendingCount,
        guardiasGruposCount: guardiasSnapshot.grupos?.length || 0,
        activityLogsCount: cappedLogs.length,
        insertLogsCount: cappedLogs.filter(l => l.action === 'INSERT').length,
        maxActivityLogsAllowed: MAX_LOGS,
        systemConfigsCount: systemConfigsList.length,
        draftsCount: Object.keys(draftsRecord).length,
        offlineQueueCount: offlineQueue.length,
        autoBackupsCount: autoBackupsList.length,
        localStorageKeysCount: Object.keys(localStorageState).length,
        seasonalStylesCount: SEASONAL_STYLE_CARDS.length,
        tutorialToursCount: tutorialCatalogSnapshot.length,
        seasonalTheme: panelControlSettings.seasonalTheme,
        themeMode: panelControlSettings.themeMode,
        autoVenezuelaMode: panelControlSettings.autoVenezuelaMode,
        autoNightShiftMode: panelControlSettings.autoNightShiftMode,
        ambientSoundEnabled: Boolean(ambientSoundSnapshot?.enabled),
        ambientSoundIntensityPercent: Math.round((ambientSoundSnapshot?.intensity ?? 0.4) * 100),
        maintenanceEnabled: Boolean(maintenanceStatusSnapshot?.enabled),
        suggestionsCount: finalSuggestions.length,
        unreadSuggestionsCount: finalSuggestions.filter(s => !s.isRead).length,
        laboratoriosRegistrosCount: laboratoriosSnapshot.length,
        ordenesMedicasCount: ordenesMedicasSnapshot.length,
        resumenesEvolutivosCount: resumenesEvolutivosSnapshot.length
      },
      panelControl: panelControlSettings,
      tables: {
        patients: enrichedPatients,
        evolutions: Array.from(evMap.values()),
        beds: finalBeds,
        historias: finalHistorias,
        laboratorios: laboratoriosSnapshot,
        ordenesMedicas: ordenesMedicasSnapshot,
        resumenesEvolutivos: resumenesEvolutivosSnapshot,
        tasks: finalTasks,
        profiles: profilesData,
        guardias: guardiasSnapshot,
        tutorialCatalog: tutorialCatalogSnapshot,
        suggestions: finalSuggestions,
        buzonSugerencias: finalSuggestions,
        activityLogs: cappedLogs,
        patientsClinicalMeta: patientsMeta || {},
        systemConfigs: systemConfigsList,
        maintenanceStatus: maintenanceStatusSnapshot,
        ambientSoundConfig: ambientSoundSnapshot,
        styleSoundCatalog: STYLE_SOUND_META,
        drafts: draftsRecord,
        offlineQueue,
        localStorageState,
        autoBackups: autoBackupsList,
        autoBackupsMeta: autoBackupsList.map(b => ({
          id: b.id,
          timestamp: b.timestamp,
          patientsCount: b.patientsCount,
          bedsCount: b.bedsCount,
          historiasCount: b.historiasCount,
          tasksCount: b.tasksCount,
          note: b.note
        })),
        latestExportedBackup: latestExportedBackup || null,
        latestExportedBackupMeta: latestExportedBackup
          ? { filename: latestExportedBackup.filename, timestamp: latestExportedBackup.timestamp }
          : null
      }
    };

    return {
      completeDbBackup,
      summary: {
        patientsCount: enrichedPatients.length,
        evolutionsCount: evMap.size,
        historiasCount: finalHistorias.length,
        profilesCount: profilesData.length,
        logsCount: cappedLogs.length,
        suggestionsCount: finalSuggestions.length,
      }
    };
  };

  // Export Complete Database as JSON + sync 'hmi_database_backup_full' to Supabase
  const handleExportCompleteDatabaseAsJson = async () => {
    try {
      setActionNotice('Generando copia completa de la base de datos (.JSON) y sincronizando con Supabase...');
      const { completeDbBackup, summary } = await buildCompleteDatabaseBackupPayload();

      // Also push to Supabase system_configs['hmi_database_backup_full'] in background
      pushFullDatabaseBackupToSupabase(completeDbBackup).catch(() => {});

      const jsonBlob = new Blob([JSON.stringify(completeDbBackup, null, 2)], {
        type: 'application/json;charset=utf-8'
      });
      const blobUrl = URL.createObjectURL(jsonBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', blobUrl);
      downloadAnchor.setAttribute('download', `hmi_database_backup_supabase_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);

      setActionNotice(`¡Base de Datos .JSON descargada con éxito! (${summary.patientsCount} pacientes, ${summary.evolutionsCount} evoluciones, ${summary.historiasCount} historias, ${summary.profilesCount} doctores, ${summary.suggestionsCount} sugerencias, ${summary.logsCount}/${MAX_LOGS} logs y configuraciones)`);
    } catch (err) {
      console.error('Error exportando base de datos:', err);
      showErrorBanner('Error al generar la descarga de la base de datos .JSON.');
    } finally {
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  // Importar / Actualizar Guardias .JSON
  const handleUploadGuardiasJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || ''));
        const candidate: RolGuardiasData | undefined =
          parsed?.grupos ? parsed :
          parsed?.tables?.guardias?.grupos ? parsed.tables.guardias :
          parsed?.data?.guardias?.grupos ? parsed.data.guardias :
          undefined;

        if (!candidate || !Array.isArray(candidate.grupos)) {
          showErrorBanner('El archivo JSON de guardias no contiene un arreglo válido de "grupos".');
          return;
        }

        const normalized: RolGuardiasData = normalizeGuardiasData({
          mes: candidate.mes || guardiasData.mes || 'Noviembre 2026',
          anio: Number(candidate.anio) || 2026,
          mesNumero: Number(candidate.mesNumero) || 11,
          hospital: candidate.hospital || 'Hospital Materno Infantil',
          servicio: candidate.servicio || 'Pediatría y Puericultura',
          grupos: candidate.grupos,
          turnos: Array.isArray(candidate.turnos) ? candidate.turnos : [],
          updatedAt: new Date().toISOString()
        });

        const saved = await saveGuardiasApi(normalized);
        setGuardiasData(saved);
        setActionNotice(`¡Rol de Guardias actualizado y sincronizado con Supabase para ${saved.mes} (${saved.grupos.length} grupos)!`);
      } catch {
        showErrorBanner('Error al leer el archivo .JSON de guardias. Verifique la sintaxis del archivo.');
      } finally {
        if (guardiasFileInputRef.current) guardiasFileInputRef.current.value = '';
        setTimeout(() => setActionNotice(null), 5000);
      }
    };
    reader.readAsText(file);
  };

  const handleExportGuardiasJson = () => {
    const blob = new Blob([JSON.stringify(guardiasData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    const slug = (guardiasData.mes || 'mensual').replace(/\s+/g, '_').toLowerCase();
    a.setAttribute('download', `rol_guardias_${slug}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setActionNotice('Archivo Rol de Guardias .JSON exportado correctamente.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSaveGuardiasEdits = async () => {
    const saved = await saveGuardiasApi(guardiasData);
    setGuardiasData(saved);
    setIsEditingGuardias(false);
    setActionNotice(`Cambios guardados y sincronizados en Supabase (${saved.mes}).`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleRestoreNov2026Guardias = async () => {
    const saved = await saveGuardiasApi(DEFAULT_ROL_GUARDIAS);
    setGuardiasData(saved);
    setIsEditingGuardias(false);
    setActionNotice('Cronograma oficial de Noviembre 2026 (6 grupos) restaurado y sincronizado con Supabase.');
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Revert / Restore an Action from Logs (evoluciones, ingresos, altas, traslados, reingresos, historias, etc.)
  const executeRestoreLog = async (log: ActivityLog) => {
    try {
      setRestoringLogId(log.id);
      const res = await restoreActivityLogApi(log);
      if (res.success) {
        markActivityLogReverted(log.id, currentUserEmail || 'Administrador');
        setActionNotice(res.message);
        await Promise.all([
          loadProfiles(),
          loadGuardias(),
          onDataImported ? onDataImported() : Promise.resolve()
        ]);
        loadLogs();
      } else {
        showErrorBanner(res.message);
      }
    } catch (err: any) {
      showErrorBanner(err?.message || 'Error al revertir la acción seleccionada.');
    } finally {
      setRestoringLogId(null);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const handleRequestRestoreLog = (log: ActivityLog) => {
    setConfirmDialog({
      title: 'Revertir Cambio del Historial',
      message: `¿Desea revertir este cambio "${log.description}" (${log.dateFormatted})? Se restablecerá exactamente el estado previo en IndexedDB y Supabase.`,
      confirmLabel: 'Revertir Ahora',
      tone: 'restore',
      onConfirm: () => executeRestoreLog(log)
    });
  };

  // Filtered Profiles
  const filteredProfiles = profiles.filter((p) => {
    const isAdmin = p.is_admin || p.email?.toLowerCase() === 'guerrerobraste@gmail.com';
    const isApproved = isAdmin || p.is_approved === true;

    const matchesSearch =
      (p.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(p.details || {}).toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === 'ALL' || p.role_type === filterRole;

    let matchesApproval = true;
    if (filterApproval === 'PENDING') {
      matchesApproval = !isApproved;
    } else if (filterApproval === 'APPROVED') {
      matchesApproval = isApproved;
    }

    return matchesSearch && matchesRole && matchesApproval;
  });

  const inferLogCategory = (l: ActivityLog): ActivityChangeCategory => {
    if (l.changeCategory) return l.changeCategory;
    if (l.details?.changeType) return l.details.changeType as ActivityChangeCategory;
    const desc = (l.description || '').toLowerCase();
    if (l.module === 'evoluciones' || desc.includes('evolución') || desc.includes('evolucion')) return 'evolucion';
    if (desc.includes('alta médica') || desc.includes('egreso') || desc.includes('fallecido')) return 'alta';
    if (desc.includes('traslado') || desc.includes('cambio de área') || desc.includes('cambio de area')) return 'traslado';
    if (desc.includes('reingreso')) return 'reingreso';
    if (l.module === 'historias' || desc.includes('historia clínica')) return 'historia';
    if (l.action === 'DELETE' || desc.includes('eliminación') || desc.includes('eliminado')) return 'eliminacion';
    if (l.module === 'pacientes' && l.action === 'INSERT') return 'ingreso';
    return 'edicion_clinica';
  };

  // Filtered Logs
  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.description.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.user.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.module.toLowerCase().includes(logSearch.toLowerCase()) ||
      (l.details ? JSON.stringify(l.details).toLowerCase().includes(logSearch.toLowerCase()) : false);

    const matchesModule = logModuleFilter === 'ALL' || l.module === logModuleFilter;
    const matchesAction = logActionFilter === 'ALL' || l.action === logActionFilter;
    const matchesCategory = logCategoryFilter === 'ALL' || inferLogCategory(l) === logCategoryFilter;

    return matchesSearch && matchesModule && matchesAction && matchesCategory;
  });

  // Counters
  const totalProfiles = profiles.length;
  const pendingRequestsCount = profiles.filter((p) => !p.is_admin && p.email?.toLowerCase() !== 'guerrerobraste@gmail.com' && p.is_approved === false).length;
  const approvedDoctorsCount = profiles.filter((p) => p.is_admin || p.email?.toLowerCase() === 'guerrerobraste@gmail.com' || p.is_approved === true).length;
  const countEspecialistas = profiles.filter((p) => p.role_type === 'Especialista').length;
  const countResidentes = profiles.filter((p) => p.role_type === 'Residente').length;

  const countEvolucionLogs = logs.filter(l => inferLogCategory(l) === 'evolucion').length;
  const countIngresoLogs = logs.filter(l => inferLogCategory(l) === 'ingreso').length;
  const countAltaLogs = logs.filter(l => inferLogCategory(l) === 'alta').length;
  const countTrasladoLogs = logs.filter(l => inferLogCategory(l) === 'traslado').length;
  const countReingresoLogs = logs.filter(l => inferLogCategory(l) === 'reingreso').length;
  const countDeleteLogs = logs.filter(l => l.action === 'DELETE' || inferLogCategory(l) === 'eliminacion').length;
  const countRevertibleLogs = logs.filter(l => Boolean(l.details?.beforeSnapshot || l.details?.snapshot || l.action === 'INSERT' || l.details?.entityType === 'beds')).length;

  // Render Badges
  const getRoleBadge = (role: MedicalRoleType | string) => {
    switch (role) {
      case 'Especialista':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-400 border border-purple-300 dark:border-purple-500/30">
            <Award className="w-3 h-3" /> Especialista
          </span>
        );
      case 'Residente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
            <Hospital className="w-3 h-3" /> Residente
          </span>
        );
      case 'Interno':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-400 border border-sky-300 dark:border-sky-500/30">
            <School className="w-3 h-3" /> Interno
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
            <Stethoscope className="w-3 h-3" /> {role || 'Médico'}
          </span>
        );
    }
  };

  const getChangeCategoryBadge = (l: ActivityLog) => {
    const cat = inferLogCategory(l);
    switch (cat) {
      case 'evolucion':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-500/40">Evolución</span>;
      case 'ingreso':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">Ingreso</span>;
      case 'alta':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40">Alta / Egreso</span>;
      case 'traslado':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">Cambio de Área</span>;
      case 'reingreso':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-500/40">Reingreso</span>;
      case 'historia':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40">Historia Clínica</span>;
      case 'eliminacion':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40">Eliminación</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40">Edición Clínica</span>;
    }
  };

  const getModuleBadge = (module: ActivityModule) => {
    const map: Record<ActivityModule, { label: string; color: string }> = {
      pacientes: { label: 'PACIENTES', color: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/30' },
      evoluciones: { label: 'EVOLUCIONES', color: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-500/30' },
      camas: { label: 'CAMAS', color: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30' },
      historias: { label: 'HISTORIAS', color: 'bg-teal-100 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-500/30' },
      tareas: { label: 'TAREAS', color: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/30' },
      doctores: { label: 'DOCTORES', color: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30' },
      seguridad: { label: 'SISTEMA', color: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600' },
    };
    const c = map[module] || { label: module.toUpperCase(), color: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600' };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${c.color}`}>
        {c.label}
      </span>
    );
  };

  // ==========================================
  // RENDER: PASSWORD GATEKEEPER IF LOCKED
  // ==========================================
  if (!isUnlocked) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className={`w-full max-w-md border rounded-3xl p-6 sm:p-8 text-slate-800 dark:text-slate-100 shadow-lg dark:shadow-2xl space-y-6 ${themeTokens.cardSurface} ${
          authShaking ? 'animate-shake' : 'animate-in fade-in zoom-in-95 duration-200'
        }`}>
          {/* Header Icon */}
          <div className="text-center space-y-2">
            <div className={`w-16 h-16 mx-auto rounded-3xl border flex items-center justify-center shadow-sm ${themeTokens.accentBadge}`}>
              <KeyRound className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Panel de Control
            </h2>
            <p className={`text-xs font-semibold uppercase tracking-wider ${themeTokens.accentText}`}>
              Acceso Restringido para Administradores
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
              Ingrese la contraseña de administrador para gestionar solicitudes, bloqueo de doctores y exportar la base de datos en JSON.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Contraseña Maestra</span>
                <span className={`text-[10px] font-semibold ${themeTokens.accentText}`}>Requerida</span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Ingrese la contraseña..."
                  autoFocus
                  className="w-full pl-4 pr-11 py-3 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-teal-600 dark:focus:border-teal-500 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono tracking-wider transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="bg-rose-100/90 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/40 rounded-xl p-3 flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full py-3 px-4 font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${themeTokens.heroPrimaryBtn}`}
            >
              <Unlock className="w-4 h-4" />
              <span>Desbloquear e Ingresar al Panel</span>
            </button>

            {/* Registrarse Button for unauthenticated/new users */}
            <div className={`pt-2 text-center border-t space-y-2 ${themeTokens.sectionDivider}`}>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">¿Eres médico y aún no tienes cuenta?</p>
              <button
                type="button"
                onClick={handleOpenCreateDoctor}
                className="w-full py-2.5 px-4 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-800 dark:text-teal-300 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>Registrarse como nuevo doctor</span>
              </button>
            </div>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full py-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Regresar al inicio</span>
              </button>
            )}
          </form>

          {/* Footer note */}
          <div className={`pt-2 border-t text-center ${themeTokens.sectionDivider}`}>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck className={`w-3.5 h-3.5 ${themeTokens.accentIcon}`} />
              <span>Protección activa con clave autorizada</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: UNLOCKED ADMIN PANEL
  // ==========================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-3 sm:p-6 text-slate-800 dark:text-slate-100 font-sans">
      {/* Top Banner */}
      <div className={`border rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${themeTokens.heroCard}`}>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className={`p-3 rounded-2xl border shadow-xs ${themeTokens.accentBadge}`}>
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Panel de Control del Administrador
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 uppercase tracking-wider">
                  Acceso Autorizado
                </span>
              </div>
              <p className={`text-xs font-semibold ${themeTokens.accentText}`}>
                Gestión de nuevos doctores, solicitudes pendientes, bloqueo/desbloqueo y base de datos JSON
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Realizar Mantenimiento Button with 2 Options */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMaintenanceMenuOpen(prev => !prev)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-2xl shadow-sm transition active:scale-95 cursor-pointer border ${
                maintenanceEnabled
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-white dark:text-amber-300 border-slate-700 dark:border-amber-500/40'
              }`}
              title="Activar o quitar el mensaje de mantenimiento para todos los usuarios"
            >
              <Wrench className="w-4 h-4" />
              <span>Realizar Mantenimiento</span>
              {maintenanceEnabled && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-950 text-amber-300 uppercase">
                  Activo
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMaintenanceMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMaintenanceMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMaintenanceMenuOpen(false)}
                />
                <div className={`absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border shadow-2xl p-3 space-y-2 z-50 animate-in fade-in zoom-in-95 duration-150 ${themeTokens.cardSurface}`}>
                  <div className="px-2 py-1 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/70 pb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Control de Mantenimiento
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        maintenanceEnabled
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {maintenanceEnabled ? 'En Mantenimiento' : 'Operativa'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={maintenanceLoading}
                    onClick={() => handleSetMaintenanceMode(true)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition cursor-pointer border ${
                      maintenanceEnabled
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-900 dark:text-amber-200'
                        : 'bg-slate-50 dark:bg-slate-800/70 hover:bg-amber-50 dark:hover:bg-amber-500/15 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <Power className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black">Mostrar mensaje de mantenimiento</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug mt-0.5">
                        Bloquea la web y el acceso con el aviso de reparación para todos excepto el Admin.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={maintenanceLoading}
                    onClick={() => handleSetMaintenanceMode(false)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition cursor-pointer border ${
                      !maintenanceEnabled
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-900 dark:text-emerald-200'
                        : 'bg-slate-50 dark:bg-slate-800/70 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <PowerOff className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black">Quitar el mantenimiento de la página</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug mt-0.5">
                        Restablece el acceso normal a toda la aplicación para todos los usuarios.
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportCompleteDatabaseAsJson}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-cyan-700 to-teal-700 hover:from-cyan-600 hover:to-teal-600 dark:from-cyan-600 dark:to-teal-600 dark:hover:from-cyan-500 dark:hover:to-teal-500 text-white text-xs font-bold rounded-2xl shadow-sm transition active:scale-95 cursor-pointer"
            title="Descargar respaldo completo v3.3.0 en JSON y sincronizar con Supabase"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Base de Datos .JSON</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateDoctor}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 dark:from-teal-600 dark:to-emerald-600 dark:hover:from-teal-500 dark:hover:to-emerald-500 text-white text-xs font-bold rounded-2xl shadow-sm transition active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Registrar Nuevo Doctor</span>
          </button>

          <button
            type="button"
            onClick={() => {
              loadProfiles();
              loadLogs();
              syncActivityLogsWithSupabase().then(synced => setLogs(synced.slice(0, MAX_LOGS))).catch(() => {});
              loadGuardias();
              loadSuggestions();
            }}
            disabled={loadingProfiles}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold rounded-2xl transition cursor-pointer"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loadingProfiles ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            type="button"
            onClick={handleLockSession}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-100 hover:bg-rose-600 dark:bg-rose-500/20 dark:hover:bg-rose-600 text-rose-800 dark:text-rose-300 hover:text-white border border-rose-300 dark:border-rose-500/30 text-xs font-bold rounded-2xl transition cursor-pointer"
            title="Bloquear sesión de administrador"
          >
            <Lock className="w-4 h-4" />
            <span>Bloquear</span>
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
              title="Volver a la vista clínica"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Action Notice Toast */}
      {actionNotice && (
        <div className="bg-emerald-100/90 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-300 animate-in fade-in duration-200 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="font-bold">{actionNotice}</span>
          </div>
          <button type="button" onClick={() => setActionNotice(null)} className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Error Toast */}
      {actionError && (
        <div className="bg-rose-100/90 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-300 animate-in fade-in duration-200 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-700 dark:text-rose-400 shrink-0" />
            <span className="font-bold">{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-700 dark:text-rose-400 hover:text-rose-950 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Admin Tabs */}
      <div className={`flex items-center gap-2 border-b pb-2 overflow-x-auto whitespace-nowrap scrollbar-hide ${themeTokens.sectionDivider}`}>
        <button
          type="button"
          onClick={() => setAdminTab('doctores')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 border ${
            adminTab === 'doctores'
              ? `${themeTokens.activePill} border-transparent`
              : `${themeTokens.cardSurface} text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestión de Doctores ({totalProfiles})</span>
          {pendingRequestsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 dark:animate-pulse">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 border ${
            adminTab === 'logs'
              ? `${themeTokens.activePill} border-transparent`
              : `${themeTokens.cardSurface} text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Logs de Actividad de la BD</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            adminTab === 'logs'
              ? 'bg-white/20 text-white'
              : 'bg-slate-200 dark:bg-slate-800 text-teal-800 dark:text-teal-300'
          }`}>
            {logs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('password')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 border ${
            adminTab === 'password'
              ? 'bg-amber-600 text-white border-transparent shadow-sm'
              : `${themeTokens.cardSurface} text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`
          }`}
        >
          <KeyRound className={`w-4 h-4 ${adminTab === 'password' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
          <span>Cambiar Contraseña Admin</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('estilos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 border ${
            adminTab === 'estilos'
              ? 'bg-purple-700 dark:bg-purple-600 text-white border-transparent shadow-sm'
              : `${themeTokens.cardSurface} text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`
          }`}
        >
          <Palette className={`w-4 h-4 ${adminTab === 'estilos' ? 'text-white' : 'text-purple-700 dark:text-purple-400'}`} />
          <span>Estilos Visuales (Tema)</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('guardias')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 border ${
            adminTab === 'guardias'
              ? 'bg-cyan-700 dark:bg-cyan-600 text-white border-transparent shadow-sm'
              : `${themeTokens.cardSurface} text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`
          }`}
        >
          <CalendarDays className={`w-4 h-4 ${adminTab === 'guardias' ? 'text-white' : 'text-cyan-700 dark:text-cyan-300'}`} />
          <span>Rol de Guardias</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('sugerencias')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 border ${
            adminTab === 'sugerencias'
              ? 'bg-teal-700 dark:bg-teal-600 text-white border-transparent shadow-[0_0_14px_rgba(20,184,166,0.45)]'
              : `${themeTokens.cardSurface} text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`
          }`}
        >
          <Inbox className={`w-4 h-4 ${adminTab === 'sugerencias' ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
          <span>Buzón de Sugerencias</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            suggestions.some(s => !s.isRead)
              ? 'bg-amber-500 text-slate-950'
              : adminTab === 'sugerencias'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-teal-800 dark:text-teal-300'
          }`}>
            {suggestions.length}
          </span>
        </button>
      </div>

      {/* ========================================== */}
      {/* TAB 1: GESTIÓN DE DOCTORES                */}
      {/* ========================================== */}
      {adminTab === 'doctores' && (
        <div className="space-y-6">
          {/* Enhanced Dashboard Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setFilterApproval('PENDING')}
              className={`text-left border-2 rounded-3xl p-5 space-y-3 transition-all relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                filterApproval === 'PENDING'
                  ? 'bg-amber-100/80 dark:bg-amber-500/15 border-amber-500/70 ring-4 ring-amber-500/10'
                  : `${themeTokens.cardSurface} hover:border-amber-500/50`
              }`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Clock className="w-16 h-16 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 text-xs font-black uppercase tracking-widest">
                <span className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
                  <Clock className={`w-4 h-4 ${pendingRequestsCount > 0 ? 'dark:animate-pulse' : ''}`} />
                </span>
                <span>Solicitudes Pendientes</span>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-black text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors tabular-nums">{pendingRequestsCount}</div>
                <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400/70 uppercase">Doc(s)</div>
              </div>
              <div className="space-y-1.5">
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (pendingRequestsCount / (totalProfiles || 1)) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Pendientes de revisión clínica</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilterApproval('APPROVED')}
              className={`text-left border-2 rounded-3xl p-5 space-y-3 transition-all relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                filterApproval === 'APPROVED'
                  ? 'bg-emerald-100/80 dark:bg-emerald-500/15 border-emerald-500/70 ring-4 ring-emerald-500/10'
                  : `${themeTokens.cardSurface} hover:border-emerald-500/50`
              }`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <UserCheck className="w-16 h-16 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 text-xs font-black uppercase tracking-widest">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                  <UserCheck className="w-4 h-4" />
                </span>
                <span>Médicos Aprobados</span>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-black text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors tabular-nums">{approvedDoctorsCount}</div>
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400/70 uppercase">Activos</div>
              </div>
              <div className="space-y-1.5">
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (approvedDoctorsCount / (totalProfiles || 1)) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Acceso clínico habilitado</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilterApproval('ALL')}
              className={`text-left border-2 rounded-3xl p-5 space-y-3 transition-all relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                filterApproval === 'ALL'
                  ? 'bg-teal-100/80 dark:bg-teal-500/15 border-teal-500/70 ring-4 ring-teal-500/10'
                  : `${themeTokens.cardSurface} hover:border-teal-500/50`
              }`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users className="w-16 h-16 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex items-center gap-2 text-teal-800 dark:text-teal-400 text-xs font-black uppercase tracking-widest">
                <span className="p-1.5 rounded-lg bg-teal-500/20 border border-teal-500/30">
                  <Users className="w-4 h-4" />
                </span>
                <span>Censo de Usuarios</span>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-black text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors tabular-nums">{totalProfiles}</div>
                <div className="text-[10px] font-bold text-teal-700 dark:text-teal-400/70 uppercase">Registrados</div>
              </div>
              <div className="space-y-1.5">
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-teal-600 to-teal-400 w-full" />
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Total de doctores en el sistema</p>
              </div>
            </button>

            <div className={`text-left border-2 rounded-3xl p-5 space-y-3 relative overflow-hidden group ${themeTokens.cardSurface}`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Award className="w-16 h-16 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex items-center gap-2 text-purple-800 dark:text-purple-400 text-xs font-black uppercase tracking-widest">
                <span className="p-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30">
                  <Award className="w-4 h-4" />
                </span>
                <span>Plana Asistencial</span>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-black text-slate-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors tabular-nums">{countEspecialistas + countResidentes}</div>
                <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400/70 uppercase">Cargos</div>
              </div>
              <div className="space-y-1.5">
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-1000" 
                    style={{ width: `${Math.min(100, ((countEspecialistas + countResidentes) / (totalProfiles || 1)) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Especialistas y Residentes activos</p>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className={`border rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between ${themeTokens.cardSurface}`}>
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por usuario, correo o universidad..."
                className="w-full pl-9 pr-4 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Role filter */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-2 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">Todos los Roles</option>
                <option value="Especialista">Especialistas</option>
                <option value="Residente">Residentes</option>
                <option value="Interno">Internos</option>
                <option value="Médico de Guardia">Médicos de Guardia</option>
              </select>

              {/* Status filter buttons */}
              {[
                { id: 'ALL', label: `Todos (${totalProfiles})` },
                { id: 'PENDING', label: `Solicitudes Pendientes (${pendingRequestsCount})` },
                { id: 'APPROVED', label: `Aprobados (${approvedDoctorsCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterApproval(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    filterApproval === tab.id
                      ? themeTokens.activePill
                      : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Profiles Table */}
          <div className={`border rounded-3xl overflow-hidden shadow-sm dark:shadow-xl ${themeTokens.cardSurface}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b font-bold ${themeTokens.cardInnerSurface}`}>
                  <tr>
                    <th className="py-3.5 px-4">Usuario y Contacto</th>
                    <th className="py-3.5 px-4">Rol Asistencial</th>
                    <th className="py-3.5 px-4">Universidad / Año Académico</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-right">Acciones (Aprobar / Bloquear)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                  {loadingProfiles ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-600 dark:text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600 dark:text-teal-400" />
                        <span>Cargando doctores desde la base de datos...</span>
                      </td>
                    </tr>
                  ) : filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-600 dark:text-slate-400">
                        <Users className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700 dark:text-slate-300">No hay solicitudes ni doctores con los filtros seleccionados.</p>
                        <button
                          type="button"
                          onClick={handleOpenCreateDoctor}
                          className={`mt-3 inline-flex items-center gap-1.5 px-4 py-2 font-bold rounded-xl text-xs transition cursor-pointer ${themeTokens.primaryButton}`}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Registrar Nuevo Doctor Ahora</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map((p) => {
                      const isAdmin = p.is_admin || p.email?.toLowerCase() === 'guerrerobraste@gmail.com';
                      const isApproved = isAdmin || p.is_approved === true;
                      const isBusy = actionLoadingId === p.id;
                      const details = p.details || {};
                      const presence = resolveProfilePresence(p, presenceMap, presenceNowMs);

                      return (
                        <tr key={p.id} className="hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition">
                          {/* User & Contacts */}
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                              <div className="relative shrink-0">
                                <span className={`w-9 h-9 rounded-2xl border flex items-center justify-center font-black text-xs uppercase ${
                                  details.gender === 'F' 
                                    ? 'bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-500/40 dark:shadow-[0_0_10px_rgba(219,39,119,0.3)]' 
                                    : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/40 dark:shadow-[0_0_10px_rgba(37,99,235,0.3)]'
                                }`} title={details.gender === 'F' ? 'Femenino (Dra.)' : 'Masculino (Dr.)'}>
                                  {details.gender === 'F' ? '♀' : '♂'}
                                </span>
                                <span
                                  data-presence-dot={presence.isOnline ? 'online' : 'offline'}
                                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                    presence.isOnline
                                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.95)]'
                                      : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                                  }`}
                                  title={presence.isOnline ? 'Usuario Online ahora' : 'Usuario Offline'}
                                />
                              </div>
                              <div className="space-y-1 min-w-0">
                                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                  <span>{p.full_name || 'Sin usuario registrado'}</span>
                                  {isAdmin && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                                      ADMIN
                                    </span>
                                  )}
                                  {presence.isOnline ? (
                                    <span
                                      data-presence-status="online"
                                      className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 border border-emerald-200 dark:border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.95)] animate-pulse"
                                      title="Usuario conectado en el sistema"
                                      aria-label="Usuario Online"
                                    />
                                  ) : (
                                    <span
                                      data-presence-status="offline"
                                      className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-rose-500 border border-rose-200 dark:border-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.9)]"
                                      title="Usuario desconectado"
                                      aria-label="Usuario Offline"
                                    />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1 font-mono">
                                  <Mail className="w-3 h-3 text-slate-500" /> {p.email}
                                </p>
                                {details.username && (
                                  <p className="text-[11px] text-teal-700 dark:text-teal-300 font-mono font-extrabold flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" /> @{details.username}
                                  </p>
                                )}
                                {details.telefono && (
                                  <p className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" /> {details.telefono}
                                  </p>
                                )}
                                <p
                                  data-last-login="true"
                                  className="text-[10.5px] text-slate-600 dark:text-slate-400 flex items-center gap-1 font-medium"
                                >
                                  <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
                                  <span>Última sesión iniciada:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {presence.formattedLastLogin}
                                  </span>
                                </p>
                                {details.password && (
                                  <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-slate-950/80 px-2 py-0.5 rounded-md border border-amber-200 dark:border-slate-800 w-fit">
                                    <KeyRound className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span>Clave: {revealedPasswords[p.id] ? details.password : '••••••••'}</span>
                                    <button
                                      type="button"
                                      onClick={() => setRevealedPasswords(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                      className="ml-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                      title={revealedPasswords[p.id] ? 'Ocultar contraseña' : 'Ver contraseña'}
                                    >
                                      {revealedPasswords[p.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4">
                            {getRoleBadge(p.role_type)}
                          </td>

                          {/* University & Academic Year */}
                          <td className="py-3.5 px-4">
                            <div className="text-xs space-y-0.5">
                              {details.universidad && (
                                <p className="font-semibold text-teal-800 dark:text-teal-300 truncate max-w-xs">
                                  🏛️ {details.universidad}
                                </p>
                              )}
                              {details.anoResidencia && (
                                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                                  Residencia: {details.anoResidencia}
                                </p>
                              )}
                              {details.anoCursado && (
                                <p className="text-[11px] text-sky-700 dark:text-sky-400 font-bold">
                                  Año Académico: {details.anoCursado}
                                </p>
                              )}
                              {details.especialidad && (
                                <p className="text-[11px] text-purple-700 dark:text-purple-400">
                                  Especialidad: {details.especialidad}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Approval Status */}
                          <td className="py-3.5 px-4 text-center">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Aprobado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 dark:animate-pulse">
                                <Clock className="w-3.5 h-3.5" /> Solicitud Pendiente
                              </span>
                            )}
                          </td>

                          {/* Actions: Approve / Deny / Block / Edit / Delete */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {!isApproved ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApprove(p)}
                                    disabled={isBusy}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                                    title="Aprobar solicitud pendiente"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Aprobar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDenyRequest(p)}
                                    disabled={isBusy}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-100 dark:bg-rose-600/20 hover:bg-rose-600 text-rose-800 dark:text-rose-300 hover:text-white border border-rose-300 dark:border-rose-500/40 font-bold rounded-xl text-xs transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                                    title="Denegar y descartar solicitud pendiente"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Denegar</span>
                                  </button>
                                </>
                              ) : !isAdmin ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleDoctorEditPermission(p)}
                                    disabled={isBusy}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 border cursor-pointer ${
                                      p.details?.can_edit_data !== false && p.can_edit_data !== false
                                        ? 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:hover:bg-emerald-600/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                                        : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-600/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                                    }`}
                                    title={
                                      p.details?.can_edit_data !== false && p.can_edit_data !== false
                                        ? 'Edición de datos habilitada. Clic para cambiar a Solo Lectura (Bloquear modificación)'
                                        : 'Solo Lectura. Clic para permitir modificar datos'
                                    }
                                  >
                                    {p.details?.can_edit_data !== false && p.can_edit_data !== false ? (
                                      <>
                                        <Edit3 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                                        <span>Permitir Edición</span>
                                      </>
                                    ) : (
                                      <>
                                        <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                                        <span>Solo Lectura</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleBlockDoctor(p)}
                                    disabled={isBusy}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-600 text-rose-800 dark:text-rose-300 hover:text-white border border-rose-300 dark:border-rose-500/30 font-bold rounded-xl text-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                                    title="Bloquear acceso al sistema"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Bloquear</span>
                                  </button>
                                </>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => handleOpenEditDoctor(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-800 dark:text-teal-300 font-bold rounded-xl text-xs transition cursor-pointer border border-slate-300 dark:border-slate-700"
                                title="Editar nombre, usuario, contraseña o datos del doctor"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Editar</span>
                              </button>

                              {!isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDoctor(p)}
                                  disabled={isBusy}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-600 text-rose-800 dark:text-rose-300 hover:text-white border border-rose-300 dark:border-rose-500/30 font-bold rounded-xl text-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                                  title="Eliminar médico definitivamente"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: HISTORIAL CLÍNICO DE CAMBIOS & REVERSIÓN (MÁXIMO 100)      */}
      {/* ================================================================= */}
      {adminTab === 'logs' && (
        <div className="space-y-5">
          {/* Dedicated Header Section */}
          <div className={`border rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm dark:shadow-lg ${themeTokens.cardSurface}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${themeTokens.accentBadge}`}>
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  Historial Clínico de Cambios &amp; Reversión (Máx. {MAX_LOGS})
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Solo registra cambios clínicos relevantes: evoluciones, ingresos, altas/egresos, traslados de área, reingresos, historias clínicas y eliminaciones. Use <span className="text-amber-700 dark:text-amber-300 font-bold">Revertir Cambio</span> para regresar exactamente al estado previo.
                </p>
              </div>
            </div>
            <div className={`flex items-center gap-3 shrink-0 border px-3.5 py-2 rounded-2xl ${themeTokens.cardInnerSurface}`}>
              <div className="text-right">
                <div className="text-xs font-black text-slate-900 dark:text-white tabular-nums">{logs.length} / {MAX_LOGS}</div>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 tabular-nums">{countRevertibleLogs} revertibles</div>
              </div>
            </div>
          </div>

          {/* Clickable Clinical Category Filter Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { id: 'ALL' as const, label: 'Todos', count: logs.length, activeCls: 'bg-teal-100 dark:bg-teal-500/20 border-teal-500 dark:border-teal-400 text-teal-900 dark:text-teal-200', idleCls: `${themeTokens.cardSurface} text-slate-700 dark:text-slate-300 hover:border-teal-500/50` },
              { id: 'evolucion' as const, label: 'Evoluciones', count: countEvolucionLogs, activeCls: 'bg-fuchsia-100 dark:bg-fuchsia-500/20 border-fuchsia-500 dark:border-fuchsia-400 text-fuchsia-900 dark:text-fuchsia-200', idleCls: `${themeTokens.cardSurface} text-slate-700 dark:text-slate-300 hover:border-fuchsia-500/50` },
              { id: 'ingreso' as const, label: 'Ingresos', count: countIngresoLogs, activeCls: 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-500 dark:border-emerald-400 text-emerald-900 dark:text-emerald-200', idleCls: `${themeTokens.cardSurface} text-slate-700 dark:text-slate-300 hover:border-emerald-500/50` },
              { id: 'alta' as const, label: 'Altas / Egresos', count: countAltaLogs, activeCls: 'bg-cyan-100 dark:bg-cyan-500/20 border-cyan-500 dark:border-cyan-400 text-cyan-900 dark:text-cyan-200', idleCls: `${themeTokens.cardSurface} text-slate-700 dark:text-slate-300 hover:border-cyan-500/50` },
              { id: 'traslado' as const, label: 'Cambios Área', count: countTrasladoLogs, activeCls: 'bg-amber-100 dark:bg-amber-500/20 border-amber-500 dark:border-amber-400 text-amber-900 dark:text-amber-200', idleCls: `${themeTokens.cardSurface} text-slate-700 dark:text-slate-300 hover:border-amber-500/50` },
              { id: 'reingreso' as const, label: 'Reingresos', count: countReingresoLogs, activeCls: 'bg-orange-100 dark:bg-orange-500/20 border-orange-500 dark:border-orange-400 text-orange-900 dark:text-orange-200', idleCls: `${themeTokens.cardSurface} text-slate-700 dark:text-slate-300 hover:border-orange-500/50` },
              { id: 'eliminacion' as const, label: 'Eliminaciones', count: countDeleteLogs, activeCls: 'bg-rose-100 dark:bg-rose-500/20 border-rose-500 dark:border-rose-400 text-rose-900 dark:text-rose-200', idleCls: `${themeTokens.cardSurface} text-slate-700 dark:text-slate-300 hover:border-rose-500/50` },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLogCategoryFilter(item.id)}
                className={`rounded-2xl p-3 text-left border-2 transition cursor-pointer ${
                  logCategoryFilter === item.id ? item.activeCls : item.idleCls
                }`}
              >
                <div className="text-[11px] font-bold truncate">{item.label}</div>
                <div className="text-lg font-black mt-0.5 tabular-nums">{item.count}</div>
              </button>
            ))}
          </div>

          {/* Logs Control Bar */}
          <div className={`border rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between ${themeTokens.cardSurface}`}>
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Buscar por paciente, médico, área o acción..."
                className="w-full pl-9 pr-4 py-2 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Module Filter */}
              <select
                value={logModuleFilter}
                onChange={(e) => setLogModuleFilter(e.target.value)}
                className="px-3 py-2 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">Todos los Módulos</option>
                <option value="pacientes">Pacientes</option>
                <option value="evoluciones">Evoluciones</option>
                <option value="historias">Historias Clínicas</option>
                <option value="tareas">Tareas de Guardia</option>
                <option value="doctores">Doctores</option>
              </select>

              {/* Action Filter */}
              <select
                value={logActionFilter}
                onChange={(e) => setLogActionFilter(e.target.value)}
                className="px-3 py-2 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">Todas las Operaciones</option>
                <option value="INSERT">Nuevos Registros</option>
                <option value="UPDATE">Ediciones / Actualizaciones</option>
                <option value="STATUS_CHANGE">Altas / Traslados / Reingresos</option>
                <option value="DELETE">Eliminaciones</option>
              </select>
            </div>
          </div>

          {/* Logs List Table */}
          <div className={`border rounded-3xl overflow-hidden shadow-sm dark:shadow-xl ${themeTokens.cardSurface}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b font-bold ${themeTokens.cardInnerSurface}`}>
                  <tr>
                    <th className="py-3.5 px-4">Fecha y Hora</th>
                    <th className="py-3.5 px-4">Módulo</th>
                    <th className="py-3.5 px-4">Tipo de Cambio</th>
                    <th className="py-3.5 px-4">Médico / Usuario</th>
                    <th className="py-3.5 px-4">Detalle del Cambio</th>
                    <th className="py-3.5 px-4 text-right">Reversión &amp; Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-600 dark:text-slate-400">
                        <Database className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                        <span>No hay cambios registrados que coincidan con los filtros seleccionados.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      const isRestoring = restoringLogId === log.id;
                      const canRevert =
                        Boolean(log.details?.beforeSnapshot) ||
                        Boolean(log.details?.snapshot) ||
                        log.action === 'INSERT' ||
                        log.details?.entityType === 'beds';

                      return (
                        <React.Fragment key={log.id}>
                          <tr className={`hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition ${log.reverted ? 'opacity-80 bg-slate-100/50 dark:bg-slate-950/30' : ''}`}>
                            {/* Timestamp */}
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {log.dateFormatted}
                              </span>
                            </td>

                            {/* Module */}
                            <td className="py-3 px-4">
                              {getModuleBadge(log.module)}
                            </td>

                            {/* Change Category */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              {getChangeCategoryBadge(log)}
                            </td>

                            {/* User */}
                            <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-teal-600 dark:bg-teal-400" />
                                {log.user}
                              </span>
                            </td>

                            {/* Description */}
                            <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                              <div>{log.description}</div>
                              {log.reverted && (
                                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/40 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Revertido por {log.revertedBy || 'Administrador'}</span>
                                </div>
                              )}
                            </td>

                            {/* Actions: Revertir Cambio + Ver JSON */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {canRevert && (
                                  <button
                                    type="button"
                                    disabled={isRestoring}
                                    onClick={() => handleRequestRestoreLog(log)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 border font-bold text-[10px] rounded-lg transition cursor-pointer disabled:opacity-50 ${
                                      log.reverted
                                        ? 'bg-slate-200/80 hover:bg-amber-200 dark:bg-slate-800 dark:hover:bg-amber-600/30 text-slate-700 dark:text-slate-300 hover:text-amber-900 dark:hover:text-amber-200 border-slate-300 dark:border-slate-700'
                                        : 'bg-amber-100 hover:bg-amber-500 dark:bg-amber-500/20 dark:hover:bg-amber-500 text-amber-900 dark:text-amber-200 hover:text-slate-950 border-amber-300 dark:border-amber-500/50'
                                    }`}
                                    title="Revertir este cambio al estado anterior en la base de datos"
                                  >
                                    <RotateCcw className={`w-3 h-3 ${isRestoring ? 'animate-spin' : ''}`} />
                                    <span>{isRestoring ? 'Revirtiendo...' : log.reverted ? 'Re-aplicar Reversión' : 'Revertir Cambio'}</span>
                                  </button>
                                )}

                                {log.details ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    className="px-2 py-1 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-800 dark:text-teal-300 border border-slate-300 dark:border-slate-700 font-mono text-[10px] rounded-lg transition cursor-pointer"
                                  >
                                    {isExpanded ? 'Ocultar' : 'Detalle'}
                                  </button>
                                ) : (
                                  !canRevert && <span className="text-[10px] text-slate-500 dark:text-slate-600">-</span>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded JSON details drawer */}
                          {isExpanded && log.details && (
                            <tr className="bg-slate-100/70 dark:bg-slate-950/70">
                              <td colSpan={6} className="p-4">
                                <div className="bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl p-3 text-[11px] font-mono text-teal-800 dark:text-teal-300 space-y-1 overflow-x-auto">
                                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[10px] uppercase font-bold border-b border-slate-300 dark:border-slate-800 pb-1 mb-2">
                                    <span>Payload del Cambio ({log.id})</span>
                                    <span>{log.timestamp}</span>
                                  </div>
                                  <pre className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: CAMBIAR CONTRASEÑA DE ADMINISTRADOR  */}
      {/* ========================================== */}
      {adminTab === 'password' && (
        <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-200">
          <div className={`border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-xl ${themeTokens.cardSurface}`}>
            <div className={`flex items-center gap-3 border-b pb-4 ${themeTokens.sectionDivider}`}>
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Cambiar Contraseña del Administrador</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">Modifique la clave maestra de acceso requerida para la cuenta administradora.</p>
              </div>
            </div>

            {changePasswordError && (
              <div className="p-4 bg-rose-100 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/40 rounded-2xl text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-700 dark:text-rose-400" />
                <span>{changePasswordError}</span>
              </div>
            )}

            {changePasswordSuccess && (
              <div className="p-4 bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/40 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                <span>{changePasswordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangeAdminPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Contraseña Actual del Administrador *</span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">Requerida</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentAdminPasswordInput}
                    onChange={(e) => setCurrentAdminPasswordInput(e.target.value)}
                    placeholder="Ingrese su clave actual de administrador"
                    className="w-full px-4 py-3 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-600 dark:focus:border-amber-500 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Nueva Contraseña *</span>
                  <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold">Mínimo 4 caracteres</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newAdminPasswordInput}
                    onChange={(e) => setNewAdminPasswordInput(e.target.value)}
                    placeholder="Ingrese la nueva contraseña deseada"
                    className="w-full px-4 py-3 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirmar Nueva Contraseña *</label>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  value={confirmAdminPasswordInput}
                  onChange={(e) => setConfirmAdminPasswordInput(e.target.value)}
                  placeholder="Repita exactamente la nueva contraseña"
                  className="w-full px-4 py-3 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 pt-3 mt-2"
              >
                <KeyRound className="w-4 h-4 text-slate-950" />
                <span>Actualizar Contraseña del Administrador</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 4: CONFIGURACIÓN DE ESTILOS VISUALES  */}
      {/* ========================================== */}
      {adminTab === 'estilos' && (() => {
        const veNow = getVenezuelaNowParts(new Date());
        const veDetected = detectVenezuelaCalendarStyle(new Date(), autoNightShiftMode);
        const currentThemeMeta = SEASONAL_THEME_MAP[currentSeasonalTheme];
        const currentIconMeta = getStyleIconMeta(currentSeasonalTheme);
        const currentActiveIcons = overlayConfig[currentIconMeta.key] || currentIconMeta.defaults;

        return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
          <div className={`border rounded-3xl p-5 sm:p-8 space-y-6 shadow-sm dark:shadow-xl ${themeTokens.cardSurface}`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 ${themeTokens.sectionDivider}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-500/40 flex items-center justify-center shrink-0">
                  <Palette className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Control Global de Estilos Visuales del Sistema
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Active el modo automático con el Calendario de Venezuela o elija manualmente cualquiera de los 17 estilos visuales cuando lo desee.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsSoundSettingsOpen(prev => !prev)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-2 transition cursor-pointer shadow-xs ${
                    ambientSoundConfig.enabled
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'
                  }`}
                  title="Activar/desactivar sonido ambiental global y ajustar intensidad para todos los usuarios"
                >
                  {ambientSoundConfig.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  <span>
                    {ambientSoundConfig.enabled
                      ? `Sonido Ambiental: ON (${Math.round((ambientSoundConfig.intensity ?? 0.4) * 100)}%)`
                      : 'Activar Sonido e Intensidad'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSoundSettingsOpen ? 'rotate-180' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleUpdateOverlayConfig(
                      DEFAULT_SEASONAL_OVERLAY_CONFIG,
                      'Configuración de iconos restaurada a los valores por defecto.'
                    )
                  }
                  className="px-3 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Restaurar configuración predeterminada de los iconos que caen"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Iconos</span>
                </button>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* CONTROL GLOBAL DE SONIDO AMBIENTAL E INTENSIDAD (PARA TODOS USUARIOS) */}
            {/* ===================================================================== */}
            {(isSoundSettingsOpen || ambientSoundConfig.enabled) && (
              <div
                className={`rounded-2xl border-2 p-4 sm:p-5 space-y-4 transition-all animate-in fade-in duration-200 ${
                  ambientSoundConfig.enabled
                    ? 'bg-gradient-to-r from-emerald-50/90 via-teal-50/90 to-cyan-50/90 dark:from-emerald-950/30 dark:via-teal-950/35 dark:to-cyan-950/30 border-emerald-500/70 dark:border-emerald-400/60 shadow-sm'
                    : `${themeTokens.cardInnerSurface}`
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Volume2 className={`w-4 h-4 ${ambientSoundConfig.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        Sonido Ambiental del Sistema (Según el Estilo Activo)
                      </h4>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          ambientSoundConfig.enabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-600 text-white'
                        }`}
                      >
                        {ambientSoundConfig.enabled ? 'Activo para Todos los Usuarios' : 'Desactivado Globalmente'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Estilo sonoro:{' '}
                      <strong className="font-black text-teal-700 dark:text-teal-300">
                        {STYLE_SOUND_META[currentSeasonalTheme]?.name || 'Estilo Normal'}
                      </strong>{' '}
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        — {STYLE_SOUND_META[currentSeasonalTheme]?.description}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {(STYLE_SOUND_CATALOG[currentSeasonalTheme]?.tracks || []).map((track) => {
                        const isPlayingThis = activeAmbientTrack?.id === track.id;
                        return (
                          <span
                            key={track.id}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                              isPlayingThis
                                ? 'bg-teal-600 text-white border-teal-500 shadow-xs'
                                : 'bg-white/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border-slate-300/70 dark:border-slate-700'
                            }`}
                          >
                            {isPlayingThis ? '▶ ' : '♪ '}
                            {track.title}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={ambientSoundSaving}
                      onClick={() => handleToggleGlobalAmbientSound(!ambientSoundConfig.enabled)}
                      className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-60 ${
                        ambientSoundConfig.enabled
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {ambientSoundConfig.enabled ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      <span>
                        {ambientSoundConfig.enabled
                          ? 'Desactivar Sonido Global'
                          : 'Activar Sonido para Todos'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const picked = ambientSoundEngine.playNextRandomTrack(
                          currentSeasonalTheme,
                          ambientSoundConfig.intensity ?? 0.4
                        );
                        if (picked) {
                          setActionNotice(`🎵 Pista aleatoria reproduciéndose: "${picked.title}"`);
                          setTimeout(() => setActionNotice(null), 3500);
                        }
                      }}
                      className="px-3 py-2.5 rounded-xl bg-white/80 hover:bg-white dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      title="Seleccionar aleatoriamente otra canción disponible para este estilo sin repetir"
                    >
                      <Volume1 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <span>Pista Aleatoria</span>
                    </button>
                  </div>
                </div>

                {/* Control de Intensidad / Volumen */}
                <div className="pt-2 border-t border-slate-300/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                  <div className="flex items-center gap-2 shrink-0">
                    <Sliders className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      Intensidad del Sonido:
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-teal-600/15 text-teal-800 dark:text-teal-300 text-xs font-black">
                      {Math.round((ambientSoundConfig.intensity ?? 0.4) * 100)}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={Math.round((ambientSoundConfig.intensity ?? 0.4) * 100)}
                    onChange={(e) => handleChangeAmbientSoundIntensity(Number(e.target.value) / 100, false)}
                    className="flex-1 accent-teal-600 dark:accent-teal-400 cursor-pointer h-2 rounded-lg"
                  />

                  <div className="flex items-center gap-1.5 shrink-0">
                    {[
                      { label: 'Suave', val: 0.2 },
                      { label: 'Medio', val: 0.45 },
                      { label: 'Fuerte', val: 0.75 },
                    ].map((preset) => {
                      const activePreset = Math.abs((ambientSoundConfig.intensity ?? 0.4) - preset.val) < 0.04;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleChangeAmbientSoundIntensity(preset.val, true)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                            activePreset
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'bg-white/70 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ===================================================================== */}
            {/* BANNER: MODO AUTOMÁTICO (CALENDARIO DE VENEZUELA) VS MODO MANUAL      */}
            {/* ===================================================================== */}
            <div className={`rounded-2xl border-2 p-4 sm:p-5 transition-all ${
              autoVenezuelaMode
                ? 'bg-gradient-to-r from-amber-50/90 via-blue-50/90 to-rose-50/90 dark:from-amber-950/30 dark:via-blue-950/40 dark:to-rose-950/30 border-amber-500/70 dark:border-amber-400/60 shadow-sm'
                : `${themeTokens.cardInnerSurface}`
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg">🇻🇪</span>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                       Sincronización con el Calendario de Venezuela (America/Caracas)
                    </h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      autoVenezuelaMode
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-white'
                    }`}>
                      {autoVenezuelaMode ? 'Automático por Fecha VE Activo' : 'Selección Manual Activa'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Fecha y hora oficial en Venezuela: <strong className="font-black text-slate-900 dark:text-white">{veNow.formattedDate} · {veNow.formattedTime} VET</strong>
                    {' '}— Según el calendario venezolano hoy corresponde:{' '}
                    <strong className="font-black text-teal-700 dark:text-teal-300">
                      {SEASONAL_THEME_MAP[veDetected.style]?.label}
                    </strong>{' '}
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">({veDetected.reason})</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleAutoVenezuelaCalendar(!autoVenezuelaMode)}
                    className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition cursor-pointer shadow-xs ${
                      autoVenezuelaMode
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>
                      {autoVenezuelaMode
                        ? 'Automático VE Activado'
                        : 'Activar Automático (Calendario VE)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleAutoVenezuelaCalendar(true, !autoNightShiftMode)}
                    className={`px-3 py-2.5 rounded-xl font-bold text-[11px] border transition cursor-pointer flex items-center gap-1.5 ${
                      autoNightShiftMode
                        ? 'bg-indigo-600/15 dark:bg-indigo-500/25 border-indigo-500/50 text-indigo-900 dark:text-indigo-200'
                        : 'bg-white/80 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                    title="Cambiar automáticamente a Guardia Nocturna entre las 7:00 PM y 6:00 AM (hora de Venezuela) en días no festivos"
                  >
                    <span>🌙</span>
                    <span>Guardia Nocturna Auto (7pm-6am): {autoNightShiftMode ? 'SÍ' : 'NO'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Selector Desplegable de los 17 Estilos Visuales */}
            <div className="space-y-3">
              {(() => {
                const activeCard =
                  SEASONAL_STYLE_CARDS.find((c) => c.style === currentSeasonalTheme) ||
                  SEASONAL_STYLE_CARDS[0];
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen = !isStylesCatalogOpen;
                      setIsStylesCatalogOpen(nextOpen);
                      if (nextOpen) {
                        ambientSoundEngine.prefetchStyles([
                          veDetected.style,
                          'normal',
                          'navidad',
                          'guardia_nocturna',
                        ]);
                      }
                    }}
                    className={`w-full p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${activeCard.activeCardClasses}`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-300/70 dark:border-slate-700 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                        {activeCard.emoji.split(' ')[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                            Catálogo de 17 Estilos Visuales (Toque cualquiera para activarlo cuando desee)
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${activeCard.activeBadgeClasses}`}
                          >
                            Activo: {activeCard.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                          {activeCard.emoji} {activeCard.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-xs">
                        <Palette className="w-3.5 h-3.5" />
                        <span>
                          {isStylesCatalogOpen ? 'Cerrar Catálogo' : 'Elegir Estilo (17)'}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isStylesCatalogOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </span>
                    </div>
                  </button>
                );
              })()}

              {isStylesCatalogOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  {SEASONAL_STYLE_CARDS.map((card) => {
                    const isSelected = currentSeasonalTheme === card.style;
                    const isTodayVe = veDetected.style === card.style;
                    return (
                      <button
                        key={card.style}
                        type="button"
                        onMouseEnter={() => {
                          void ambientSoundEngine.prefetchStyle(card.style, 'high');
                        }}
                        onFocus={() => {
                          void ambientSoundEngine.prefetchStyle(card.style, 'high');
                        }}
                        onClick={() => handleAdminThemeChange(card.style)}
                        className={`p-4 rounded-2xl border-2 text-left space-y-2.5 transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? `${card.activeCardClasses} text-slate-900 dark:text-white shadow-md scale-[1.01]`
                            : `${card.inactiveCardClasses} text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`
                        }`}
                      >
                        <div className="space-y-2 w-full">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-2xl leading-none">{card.emoji}</span>
                            <div className="flex items-center gap-1">
                              {isTodayVe && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40">
                                  🇻🇪 Hoy en VE
                                </span>
                              )}
                              {isSelected && (
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${card.activeBadgeClasses}`}>
                                  Activo
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{card.title}</h4>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                              {card.description}
                            </p>
                          </div>
                          {card.style === 'fiestas_patrias' && (
                            <div className="w-full rounded-lg overflow-hidden border border-yellow-500/50 shadow-2xs">
                              <div className="h-1.5 bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-400" />
                              <div className="h-2 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 flex items-center justify-center">
                                <span className="text-[6px] text-white font-black tracking-[0.2em] leading-none">
                                  ★ ★ ★ ★ ★ ★ ★ ★
                                </span>
                              </div>
                              <div className="h-1.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700" />
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-300/50 dark:border-slate-800/80 w-full flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          <span>📅</span>
                          <span className="truncate">{card.veCalendarDateLabel}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ===================================================================== */}
            {/* 4 BOTONES DE PERSONALIZACIÓN DE ICONOS QUE CAEN                       */}
            {/* ===================================================================== */}
            <div className={`border-t pt-5 space-y-4 ${themeTokens.sectionDivider}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className={`w-4 h-4 ${themeTokens.accentIcon}`} />
                    <span>Personalización de Iconos que Caen ({currentThemeMeta?.label || currentSeasonalTheme.toUpperCase()})</span>
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Toque cualquiera de los 4 botones para ajustar la transparencia, los iconos visibles, la cantidad o la velocidad de caída en tiempo real.
                  </p>
                </div>
              </div>

              {/* Banner Especial Tricolor Degradado cuando está activo Fiestas Patrias (Venezuela) */}
              {currentSeasonalTheme === 'fiestas_patrias' && (
                <div className="rounded-2xl overflow-hidden border-2 border-yellow-400/80 dark:border-yellow-500/60 shadow-md">
                  <div className="bg-gradient-to-r from-[#FFCC00] via-[#00247D] to-[#CF142B] px-4 py-2.5 text-white flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🇻🇪</span>
                      <span className="text-xs font-black uppercase tracking-wider drop-shadow-xs">
                        Tricolor Nacional de Venezuela · Amarillo, Azul y Rojo + 8 Estrellas
                      </span>
                    </div>
                    <span className="text-[10px] font-black tracking-[0.2em] bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-white/30">
                      ★ ★ ★ ★ ★ ★ ★ ★
                    </span>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-yellow-100/90 via-blue-100/90 to-red-100/90 dark:from-yellow-950/45 dark:via-blue-950/55 dark:to-red-950/45 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                      Combinaciones rápidas de colores de la Bandera para la lluvia de iconos:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateOverlayConfig(
                            {
                              fiestasPatriasIcons: [
                                '🇻🇪',
                                '💛',
                                '💙',
                                '❤️',
                                '🟡',
                                '🔵',
                                '🔴',
                                '🟨',
                                '🟦',
                                '🟥',
                                '⭐',
                                '🌼',
                                '🦜',
                              ],
                            },
                            '🇻🇪 Activado Tricolor Completo (Amarillo, Azul, Rojo y Estrellas).'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black text-white bg-gradient-to-r from-yellow-500 via-blue-700 to-red-600 hover:opacity-95 shadow-xs cursor-pointer"
                      >
                        🇻🇪 Tricolor Completo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateOverlayConfig(
                            {
                              fiestasPatriasIcons: ['🇻🇪', '💛', '💙', '❤️', '🟡', '🔵', '🔴', '🟨', '🟦', '🟥', '⭐'],
                            },
                            '💛💙❤️ Activados todos los colores y franjas de la Bandera de Venezuela.'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black text-white bg-gradient-to-r from-amber-500 via-blue-600 to-rose-600 hover:opacity-95 shadow-xs cursor-pointer"
                      >
                        💛💙❤️ Solo Colores Bandera
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateOverlayConfig(
                            { fiestasPatriasIcons: ['💛', '🟡', '🟨', '🌼', '🌟', '🇻🇪'] },
                            '💛 Activada Franja Amarilla (Oro, Sol y Araguaney).'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black text-slate-950 bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 hover:opacity-95 shadow-xs cursor-pointer"
                      >
                        💛 Amarillo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateOverlayConfig(
                            { fiestasPatriasIcons: ['💙', '🔵', '🟦', '⭐', '🌟', '🇻🇪'] },
                            '💙 Activada Franja Azul y las 8 Estrellas.'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black text-white bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 hover:opacity-95 shadow-xs cursor-pointer"
                      >
                        💙 Azul + ⭐ Estrellas
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateOverlayConfig(
                            { fiestasPatriasIcons: ['❤️', '🔴', '🟥', '🌺', '🎖️', '🇻🇪'] },
                            '❤️ Activada Franja Roja Patriota.'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:opacity-95 shadow-xs cursor-pointer"
                      >
                        ❤️ Rojo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4 Botones Principales Solicitados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* Botón 1: Transparencia */}
                <button
                  type="button"
                  onClick={() => setActiveOverlayPanel('transparencia')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    activeOverlayPanel === 'transparencia'
                      ? `${themeTokens.activePill} border-transparent shadow-sm`
                      : `${themeTokens.cardInnerSurface} text-slate-800 dark:text-slate-200 hover:border-purple-500/50`
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Eye className="w-4 h-4 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-black leading-tight">Transparencia</div>
                      <div className={`text-[10px] font-bold ${activeOverlayPanel === 'transparencia' ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'}`}>
                        {overlayConfig.transparency}% transp. ({100 - overlayConfig.transparency}% visible)
                      </div>
                    </div>
                  </div>
                </button>

                {/* Botón 2: Iconos que aparecen */}
                <button
                  type="button"
                  onClick={() => setActiveOverlayPanel('iconos')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    activeOverlayPanel === 'iconos'
                      ? `${themeTokens.activePill} border-transparent shadow-sm`
                      : `${themeTokens.cardInnerSurface} text-slate-800 dark:text-slate-200 hover:border-purple-500/50`
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-black leading-tight">Iconos que Aparecen</div>
                      <div className={`text-[10px] font-bold truncate ${activeOverlayPanel === 'iconos' ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'}`}>
                        {currentActiveIcons.join(' ') || 'Ninguno activo'}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Botón 3: Cantidad que caen */}
                <button
                  type="button"
                  onClick={() => setActiveOverlayPanel('cantidad')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    activeOverlayPanel === 'cantidad'
                      ? `${themeTokens.activePill} border-transparent shadow-sm`
                      : `${themeTokens.cardInnerSurface} text-slate-800 dark:text-slate-200 hover:border-purple-500/50`
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Layers className="w-4 h-4 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-black leading-tight">Cantidad que Caen</div>
                      <div className={`text-[10px] font-bold ${activeOverlayPanel === 'cantidad' ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'}`}>
                        {overlayConfig.count} iconos en pantalla
                      </div>
                    </div>
                  </div>
                </button>

                {/* Botón 4: Velocidad que caen */}
                <button
                  type="button"
                  onClick={() => setActiveOverlayPanel('velocidad')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    activeOverlayPanel === 'velocidad'
                      ? `${themeTokens.activePill} border-transparent shadow-sm`
                      : `${themeTokens.cardInnerSurface} text-slate-800 dark:text-slate-200 hover:border-purple-500/50`
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Gauge className="w-4 h-4 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-black leading-tight">Velocidad que Caen</div>
                      <div className={`text-[10px] font-bold ${activeOverlayPanel === 'velocidad' ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'}`}>
                        Velocidad {overlayConfig.speedMultiplier}x
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {/* ===================================================================== */}
              {/* PANEL ACTIVO DE CONFIGURACIÓN                                         */}
              {/* ===================================================================== */}
              <div className={`border rounded-2xl p-4 sm:p-5 space-y-4 ${themeTokens.cardInnerSurface}`}>
                {/* 1. PANEL DE TRANSPARENCIA */}
                {activeOverlayPanel === 'transparencia' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <Eye className={`w-4 h-4 ${themeTokens.accentIcon}`} />
                          <span>Nivel de Transparencia de los Iconos</span>
                        </h5>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          0% = totalmente sólido sin transparencia · 80% = muy tenue y transparente.
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-xl text-xs font-black border ${themeTokens.accentBadge}`}>
                        Transparencia: {overlayConfig.transparency}% · Opacidad: {100 - overlayConfig.transparency}%
                      </span>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="range"
                        min={0}
                        max={90}
                        step={5}
                        value={overlayConfig.transparency}
                        onChange={(e) => handleUpdateOverlayConfig({ transparency: Number(e.target.value) })}
                        className="w-full accent-teal-600 dark:accent-teal-400 cursor-pointer h-2 rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        <span>0% (Sin transparencia / 100% Nítido)</span>
                        <span>45% (Media)</span>
                        <span>90% (Muy transparente)</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {[
                        { label: '0% (Sin Transparencia)', val: 0 },
                        { label: '15% (Casi Sólido)', val: 15 },
                        { label: '30% (Suave)', val: 30 },
                        { label: '50% (Medio)', val: 50 },
                        { label: '70% (Tenue)', val: 70 },
                        { label: '85% (Muy Transparente)', val: 85 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() =>
                            handleUpdateOverlayConfig(
                              { transparency: preset.val },
                              `Transparencia de iconos ajustada a ${preset.val}%`
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            overlayConfig.transparency === preset.val
                              ? `${themeTokens.activePill} border-transparent`
                              : 'bg-white/85 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-500'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. PANEL DE ICONOS QUE APARECEN */}
                {activeOverlayPanel === 'iconos' && (() => {
                  const catalog = currentIconMeta.catalog as Array<{
                    emoji: string;
                    label: string;
                    flagColor?: 'amarillo' | 'azul' | 'rojo' | 'tricolor';
                  }>;
                  const activeList = currentActiveIcons;
                  const stateKey = currentIconMeta.key;
                  const defaultList = currentIconMeta.defaults;
                  const extraCustomIcons = activeList.filter(
                    (em) => !catalog.some((c) => c.emoji === em)
                  );

                  const getFiestasPatriasTileClass = (
                    flagColor: 'amarillo' | 'azul' | 'rojo' | 'tricolor' | undefined,
                    isSelected: boolean
                  ) => {
                    if (currentSeasonalTheme !== 'fiestas_patrias') {
                      return isSelected
                        ? `${themeTokens.activePill} border-transparent shadow-xs scale-[1.02]`
                        : 'bg-white/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 opacity-65 hover:opacity-100';
                    }
                    if (!isSelected) {
                      return 'bg-white/85 dark:bg-slate-900/80 border-yellow-400/50 dark:border-blue-700/60 text-slate-700 dark:text-slate-300 opacity-70 hover:opacity-100';
                    }
                    if (flagColor === 'amarillo') {
                      return 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-slate-950 border-yellow-600 shadow-sm scale-[1.02]';
                    }
                    if (flagColor === 'azul') {
                      return 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 text-white border-blue-400 shadow-sm scale-[1.02]';
                    }
                    if (flagColor === 'rojo') {
                      return 'bg-gradient-to-br from-red-600 via-rose-600 to-red-800 text-white border-red-400 shadow-sm scale-[1.02]';
                    }
                    return 'bg-gradient-to-r from-[#eab308] via-[#1d4ed8] to-[#dc2626] text-white border-yellow-300 shadow-sm scale-[1.02]';
                  };

                  return (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Sparkles className={`w-4 h-4 ${themeTokens.accentIcon}`} />
                            <span>Selección de Iconos que Aparecen ({currentThemeMeta?.label || currentSeasonalTheme.toUpperCase()})</span>
                          </h5>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            Marque o desmarque los iconos que desea que caigan en el tema actual ({activeList.length} seleccionados).
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateOverlayConfig(
                                { [stateKey]: catalog.map((c) => c.emoji) },
                                'Todos los iconos del tema activados.'
                              )
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer transition"
                          >
                            Seleccionar Todos
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateOverlayConfig(
                                { [stateKey]: defaultList },
                                'Iconos por defecto restaurados.'
                              )
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold cursor-pointer transition border border-slate-300 dark:border-slate-700"
                          >
                            Por Defecto
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateOverlayConfig(
                                { [stateKey]: [] },
                                'Se ocultaron todos los iconos que caen en este tema.'
                              )
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-600 text-rose-800 dark:text-rose-300 hover:text-white text-[11px] font-bold cursor-pointer transition border border-rose-300 dark:border-rose-500/30"
                          >
                            Ninguno
                          </button>
                        </div>
                      </div>

                      {/* Grid de Iconos Seleccionables */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {catalog.map((item) => {
                          const isSelected = activeList.includes(item.emoji);
                          const tileClass = getFiestasPatriasTileClass(item.flagColor, isSelected);
                          const isLightYellowTile =
                            currentSeasonalTheme === 'fiestas_patrias' &&
                            isSelected &&
                            item.flagColor === 'amarillo';
                          return (
                            <button
                              key={item.emoji}
                              type="button"
                              onClick={() => handleToggleFallingIcon(item.emoji, currentSeasonalTheme)}
                              className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${tileClass}`}
                            >
                              <span className="text-xl leading-none">{item.emoji}</span>
                              <span className="text-[10px] font-bold truncate max-w-full">{item.label}</span>
                              <span
                                className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                                  isSelected
                                    ? isLightYellowTile
                                      ? 'bg-slate-950/20 text-slate-950'
                                      : 'bg-white/25 text-white'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                }`}
                              >
                                {isSelected ? 'Activo' : 'Oculto'}
                              </span>
                            </button>
                          );
                        })}

                        {extraCustomIcons.map((customEm) => (
                          <button
                            key={customEm}
                            type="button"
                            onClick={() => handleToggleFallingIcon(customEm, currentSeasonalTheme)}
                            className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${themeTokens.activePill} border-transparent shadow-xs`}
                          >
                            <span className="text-xl leading-none">{customEm}</span>
                            <span className="text-[10px] font-bold">Personalizado</span>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-white/25 text-white">
                              Activo ✕
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Añadir cualquier otro emoji o icono personalizado */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-300/60 dark:border-slate-800">
                        <input
                          type="text"
                          value={customEmojiInput}
                          onChange={(e) => setCustomEmojiInput(e.target.value)}
                          placeholder="Añadir otro icono o emoji (ej: 🌟, 🎈, 🧸)..."
                          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 w-64"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const clean = customEmojiInput.trim();
                            if (!clean) return;
                            if (!activeList.includes(clean)) {
                              handleUpdateOverlayConfig(
                                { [stateKey]: [...activeList, clean] },
                                `Icono ${clean} añadido a la caída.`
                              );
                            }
                            setCustomEmojiInput('');
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${themeTokens.primaryButton}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar Icono</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. PANEL DE CANTIDAD QUE CAEN */}
                {activeOverlayPanel === 'cantidad' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <Layers className={`w-4 h-4 ${themeTokens.accentIcon}`} />
                          <span>Cantidad de Iconos que Caen</span>
                        </h5>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Ajuste cuántos iconos caen simultáneamente por la pantalla (de 0 a 70 iconos).
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-xl text-xs font-black border ${themeTokens.accentBadge}`}>
                        Cantidad actual: {overlayConfig.count} iconos
                      </span>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="range"
                        min={0}
                        max={70}
                        step={2}
                        value={overlayConfig.count}
                        onChange={(e) => handleUpdateOverlayConfig({ count: Number(e.target.value) })}
                        className="w-full accent-teal-600 dark:accent-teal-400 cursor-pointer h-2 rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        <span>0 (Desactivado)</span>
                        <span>24 (Estándar)</span>
                        <span>70 (Lluvia intensa)</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {[
                        { label: '0 (Sin caída)', val: 0 },
                        { label: '8 (Muy Poca)', val: 8 },
                        { label: '16 (Moderada)', val: 16 },
                        { label: '24 (Normal)', val: 24 },
                        { label: '36 (Abundante)', val: 36 },
                        { label: '50 (Intensa)', val: 50 },
                        { label: '66 (Máxima)', val: 66 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() =>
                            handleUpdateOverlayConfig(
                              { count: preset.val },
                              `Cantidad de iconos ajustada a ${preset.val}`
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            overlayConfig.count === preset.val
                              ? `${themeTokens.activePill} border-transparent`
                              : 'bg-white/85 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-500'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. PANEL DE VELOCIDAD QUE CAEN */}
                {activeOverlayPanel === 'velocidad' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <Gauge className={`w-4 h-4 ${themeTokens.accentIcon}`} />
                          <span>Velocidad de Caída de los Iconos</span>
                        </h5>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Controle qué tan rápido o suave descienden los iconos por la pantalla.
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-xl text-xs font-black border ${themeTokens.accentBadge}`}>
                        Velocidad actual: {overlayConfig.speedMultiplier}x
                      </span>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="range"
                        min={0.3}
                        max={2.8}
                        step={0.1}
                        value={overlayConfig.speedMultiplier}
                        onChange={(e) => handleUpdateOverlayConfig({ speedMultiplier: Number(e.target.value) })}
                        className="w-full accent-teal-600 dark:accent-teal-400 cursor-pointer h-2 rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        <span>0.3x (Flotación muy lenta)</span>
                        <span>1.0x (Velocidad normal)</span>
                        <span>2.8x (Caída rápida)</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {[
                        { label: '0.4x (Muy Lenta)', val: 0.4 },
                        { label: '0.7x (Suave)', val: 0.7 },
                        { label: '1.0x (Normal)', val: 1 },
                        { label: '1.4x (Rápida)', val: 1.4 },
                        { label: '1.8x (Muy Rápida)', val: 1.8 },
                        { label: '2.4x (Turbo)', val: 2.4 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() =>
                            handleUpdateOverlayConfig(
                              { speedMultiplier: preset.val },
                              `Velocidad de caída ajustada a ${preset.val}x`
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            overlayConfig.speedMultiplier === preset.val
                              ? `${themeTokens.activePill} border-transparent`
                              : 'bg-white/85 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-500'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ========================================== */}
      {/* TAB 5: ROL DE GUARDIAS (JSON + EDITOR)     */}
      {/* ========================================== */}
      {adminTab === 'guardias' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className={`border rounded-3xl p-5 sm:p-6 space-y-5 shadow-sm dark:shadow-xl ${themeTokens.cardSurface}`}>
            <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 ${themeTokens.sectionDivider}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/40 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    Gestión del Rol de Guardias Mensual
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Sincronizado con Supabase (<code className="text-cyan-800 dark:text-cyan-300 font-semibold">system_configs / cronograma_guardias_nov_2026</code>). Sube .JSON, exporta o edita los 6 grupos y áreas.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={guardiasFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleUploadGuardiasJson}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleRestoreNov2026Guardias}
                  className="px-3.5 py-2.5 rounded-2xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-800 dark:text-cyan-300 border border-cyan-400/60 dark:border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Cargar y sincronizar estructura oficial de 6 grupos (Noviembre 2026)"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Sincronizar Nov 2026</span>
                </button>

                <button
                  type="button"
                  onClick={() => guardiasFileInputRef.current?.click()}
                  className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-700 to-teal-700 hover:from-cyan-600 hover:to-teal-600 dark:from-cyan-600 dark:to-teal-600 dark:hover:from-cyan-500 dark:hover:to-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Actualizar guardias (.JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportGuardiasJson}
                  className="px-3.5 py-2.5 rounded-2xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-800 dark:text-teal-300 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar guardias (.JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingGuardias(!isEditingGuardias)}
                  className={`px-3.5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                    isEditingGuardias
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  <span>{isEditingGuardias ? 'Cerrar editor' : 'Rol de guardias editar'}</span>
                </button>
              </div>
            </div>

            {/* Metadata del mes */}
            {isEditingGuardias ? (
              <div className="space-y-5">
                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl border ${themeTokens.cardInnerSurface}`}>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Nombre del Mes *</label>
                    <input
                      type="text"
                      value={guardiasData.mes}
                      onChange={e => setGuardiasData({ ...guardiasData, mes: e.target.value })}
                      placeholder="Ej: Noviembre 2026"
                      className="w-full px-3 py-2 bg-white/85 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-600 dark:focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Año</label>
                    <input
                      type="number"
                      value={guardiasData.anio}
                      onChange={e => setGuardiasData({ ...guardiasData, anio: Number(e.target.value) || new Date().getFullYear() })}
                      className="w-full px-3 py-2 bg-white/85 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-600 dark:focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Mes N° (1-12)</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={guardiasData.mesNumero}
                      onChange={e => setGuardiasData({ ...guardiasData, mesNumero: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })}
                      className="w-full px-3 py-2 bg-white/85 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-600 dark:focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Grupos editables */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
                      Grupos de Guardia ({guardiasData.grupos.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        const nextColor = GUARDIAS_GROUP_COLORS[guardiasData.grupos.length % GUARDIAS_GROUP_COLORS.length];
                        const newGrp: GuardiaGroup = {
                          id: 'grp-' + Date.now(),
                          nombreGrupo: `Grupo ${guardiasData.grupos.length + 1}`,
                          color: nextColor,
                          areas: ['Hospitalización / Observación'],
                          miembros: [],
                          diasDelMes: []
                        };
                        setGuardiasData({ ...guardiasData, grupos: [...guardiasData.grupos, newGrp] });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${themeTokens.primaryButton}`}
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Grupo
                    </button>
                  </div>

                  <datalist id="guardias-areas-datalist">
                    <option value="Triaje" />
                    <option value="Hospitalización / Observación" />
                    <option value="Sala de Parto / Quirófano" />
                    <option value="Guardia General" />
                    <option value="Control de Niño Sano / Nutrición" />
                    <option value="Hospitalización / Observación / Sala de Parto / Quirófano" />
                    <option value="Traumashock" />
                    <option value="Respiratorio" />
                    <option value="Aislamiento" />
                  </datalist>

                  {guardiasData.grupos.map((grp, gIdx) => {
                    const updateGroup = (patch: Partial<GuardiaGroup>) => {
                      const next = guardiasData.grupos.map((g, idx) => idx === gIdx ? { ...g, ...patch } : g);
                      setGuardiasData({ ...guardiasData, grupos: next });
                    };
                    const areasList: string[] = Array.from(new Set([
                      'Triaje',
                      'Hospitalización / Observación',
                      'Sala de Parto / Quirófano',
                      'Guardia General',
                      'Control de Niño Sano / Nutrición',
                      'Hospitalización / Observación / Sala de Parto / Quirófano',
                      ...(grp.areas || [])
                    ]));

                    return (
                      <div key={grp.id} className={`border rounded-2xl p-4 space-y-3 ${themeTokens.cardInnerSurface}`}>
                        <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3 ${themeTokens.sectionDivider}`}>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
                            <input
                              type="text"
                              value={grp.nombreGrupo}
                              onChange={e => updateGroup({ nombreGrupo: e.target.value })}
                              placeholder="Nombre del Grupo"
                              className="px-3 py-2 bg-white/85 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                            />
                            <input
                              type="text"
                              value={grp.jefeGuardia || ''}
                              onChange={e => updateGroup({ jefeGuardia: e.target.value })}
                              placeholder="Jefe de Guardia (Opcional)"
                              className="px-3 py-2 bg-white/85 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                            />
                            <select
                              value={grp.color || 'teal'}
                              onChange={e => updateGroup({ color: e.target.value })}
                              className="px-3 py-2 bg-white/85 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white cursor-pointer"
                            >
                              <option value="teal">Color Teal (Verde Azulado)</option>
                              <option value="cyan">Color Cyan (Cian)</option>
                              <option value="amber">Color Amber (Ámbar)</option>
                              <option value="indigo">Color Indigo (Índigo)</option>
                              <option value="emerald">Color Emerald (Esmeralda)</option>
                              <option value="rose">Color Rose (Rosa)</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setGuardiasData({
                                ...guardiasData,
                                grupos: guardiasData.grupos.filter((_, idx) => idx !== gIdx)
                              });
                            }}
                            className="p-2 rounded-xl bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-600 text-rose-800 dark:text-rose-300 hover:text-white border border-rose-300 dark:border-rose-500/30 transition cursor-pointer"
                            title="Eliminar grupo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Áreas asignadas */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Áreas Correspondientes:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {areasList.map(areaName => {
                              const active = grp.areas?.includes(areaName);
                              return (
                                <button
                                  key={areaName}
                                  type="button"
                                  onClick={() => {
                                    const nextAreas = active
                                      ? grp.areas.filter(a => a !== areaName)
                                      : [...(grp.areas || []), areaName];
                                    updateGroup({ areas: nextAreas });
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                    active
                                      ? `${themeTokens.activePill} border-transparent`
                                      : 'bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                                  }`}
                                >
                                  {areaName}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Días del mes */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">
                            Días del mes asignados (separados por coma, ej: 6, 12, 18, 24, 30):
                          </span>
                          <input
                            type="text"
                            value={(grp.diasDelMes || []).join(', ')}
                            onChange={e => {
                              const nums = e.target.value
                                .split(/[,\s]+/)
                                .map(s => parseInt(s.trim(), 10))
                                .filter(n => !isNaN(n) && n >= 1 && n <= 31);
                              updateGroup({ diasDelMes: Array.from(new Set(nums)).sort((a, b) => a - b) });
                            }}
                            placeholder="Ej: 6, 12, 18, 24, 30"
                            className="w-full px-3 py-2 bg-white/85 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                          />
                        </div>

                        {/* Miembros */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Médicos y Áreas del Grupo:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newMember: GuardiaMember = {
                                  id: 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
                                  nombre: 'Nuevo Médico',
                                  rol: 'Médico de Guardia',
                                  area: grp.areas?.[0] || 'Hospitalización / Observación'
                                };
                                updateGroup({ miembros: [...(grp.miembros || []), newMember] });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-800 dark:text-teal-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Añadir Médico
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(grp.miembros || []).map((mem, mIdx) => {
                              const updateMember = (mp: Partial<GuardiaMember>) => {
                                const nextM = grp.miembros.map((m, idx) => idx === mIdx ? { ...m, ...mp } : m);
                                updateGroup({ miembros: nextM });
                              };
                              return (
                                <div key={mem.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white/80 dark:bg-slate-900 p-2 rounded-xl border border-slate-300 dark:border-slate-800">
                                  <input
                                    type="text"
                                    value={mem.nombre}
                                    onChange={e => updateMember({ nombre: e.target.value })}
                                    placeholder="Nombre completo del médico"
                                    className="sm:col-span-5 px-2.5 py-1.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                                  />
                                  <select
                                    value={mem.rol}
                                    onChange={e => updateMember({ rol: e.target.value })}
                                    className="sm:col-span-2 px-2.5 py-1.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white cursor-pointer"
                                  >
                                    <option value="Médico de Guardia">Médico de Guardia</option>
                                    <option value="Especialista">Especialista</option>
                                    <option value="Residente">Residente</option>
                                    <option value="Interno">Interno</option>
                                    <option value="Otro">Otro</option>
                                  </select>
                                  <input
                                    type="text"
                                    list="guardias-areas-datalist"
                                    value={mem.area}
                                    onChange={e => updateMember({ area: e.target.value })}
                                    placeholder="Área asignada"
                                    className="sm:col-span-4 px-2.5 py-1.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateGroup({ miembros: grp.miembros.filter((_, idx) => idx !== mIdx) })}
                                    className="sm:col-span-1 p-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-600 text-rose-800 dark:text-rose-300 hover:text-white flex items-center justify-center cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={`flex justify-end gap-3 pt-2 border-t ${themeTokens.sectionDivider}`}>
                  <button
                    type="button"
                    onClick={() => setIsEditingGuardias(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGuardiasEdits}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer ${themeTokens.primaryButton}`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Guardar y Sincronizar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-2xl border text-xs ${themeTokens.cardInnerSurface}`}>
                  <span>Mes activo: <strong className="text-cyan-800 dark:text-cyan-300">{guardiasData.mes}</strong></span>
                  <span>Grupos configurados: <strong className="text-teal-800 dark:text-teal-300 tabular-nums">{guardiasData.grupos.length}</strong></span>
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">Última actualización: {guardiasData.updatedAt ? new Date(guardiasData.updatedAt).toLocaleString() : 'Inicial'}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guardiasData.grupos.map(grp => {
                    const colorBadges: Record<string, { pill: string; border: string; areaText: string }> = {
                      teal: { pill: 'bg-teal-700 dark:bg-teal-600 text-white', border: 'border-teal-300 dark:border-teal-500/40', areaText: 'text-teal-800 dark:text-teal-300' },
                      cyan: { pill: 'bg-cyan-700 dark:bg-cyan-600 text-white', border: 'border-cyan-300 dark:border-cyan-500/40', areaText: 'text-cyan-800 dark:text-cyan-300' },
                      amber: { pill: 'bg-amber-500 text-slate-950', border: 'border-amber-300 dark:border-amber-500/40', areaText: 'text-amber-800 dark:text-amber-300' },
                      indigo: { pill: 'bg-indigo-700 dark:bg-indigo-600 text-white', border: 'border-indigo-300 dark:border-indigo-500/40', areaText: 'text-indigo-800 dark:text-indigo-300' },
                      emerald: { pill: 'bg-emerald-700 dark:bg-emerald-600 text-white', border: 'border-emerald-300 dark:border-emerald-500/40', areaText: 'text-emerald-800 dark:text-emerald-300' },
                      rose: { pill: 'bg-rose-700 dark:bg-rose-600 text-white', border: 'border-rose-300 dark:border-rose-500/40', areaText: 'text-rose-800 dark:text-rose-300' }
                    };
                    const st = colorBadges[grp.color || 'teal'] || colorBadges.teal;
                    return (
                      <div key={grp.id} className={`border ${st.border} rounded-2xl p-4 space-y-2.5 ${themeTokens.cardInnerSurface}`}>
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${st.pill}`}>{grp.nombreGrupo}</span>
                          {grp.jefeGuardia && (
                            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Jefe: {grp.jefeGuardia}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-800 dark:text-slate-300">Áreas:</strong> {(grp.areas || []).join(' · ') || 'Ninguna'}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                          <strong className="text-slate-800 dark:text-slate-300 font-sans">Días del mes:</strong> {(grp.diasDelMes || []).join(', ') || 'Sin días'}
                        </p>
                        <div className="space-y-1 pt-1">
                          {(grp.miembros || []).map(m => (
                            <div key={m.id} className="flex items-center justify-between gap-2 text-[11px] bg-white/80 dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{m.nombre}</span>
                              <span className={`${st.areaText} font-semibold text-right`}>{m.area}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 6: BUZÓN DE SUGERENCIAS                */}
      {/* ========================================== */}
      {adminTab === 'sugerencias' && (
        <div className="space-y-5">
          <div className={`border rounded-3xl p-5 sm:p-6 space-y-4 ${themeTokens.cardSurface}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-600 text-white flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.4)]">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Buzón de Sugerencias del Desarrollador</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-500/30">
                      {suggestions.length} {suggestions.length === 1 ? 'sugerencia' : 'sugerencias'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Listado de notas y sugerencias enviadas por los usuarios desde la pantalla de Inicio.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSuggestionFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    suggestionFilter === 'ALL'
                      ? 'bg-teal-600 text-white border-teal-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Todas ({suggestions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestionFilter('UNREAD')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    suggestionFilter === 'UNREAD'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  No leídas ({suggestions.filter(s => !s.isRead).length})
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestionFilter('READ')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    suggestionFilter === 'READ'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Leídas ({suggestions.filter(s => s.isRead).length})
                </button>
                <button
                  type="button"
                  onClick={loadSuggestions}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSuggestions ? 'animate-spin' : ''}`} />
                  <span>Sincronizar</span>
                </button>
              </div>
            </div>

            {/* Buscador de sugerencias */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={suggestionSearch}
                onChange={(e) => setSuggestionSearch(e.target.value)}
                placeholder="Buscar por nombre del usuario, fecha o contenido de la sugerencia..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Lista de sugerencias */}
            {(() => {
              const filteredSuggestions = suggestions.filter(s => {
                if (suggestionFilter === 'UNREAD' && s.isRead) return false;
                if (suggestionFilter === 'READ' && !s.isRead) return false;
                if (suggestionSearch.trim()) {
                  const q = suggestionSearch.toLowerCase();
                  return (
                    (s.userName || '').toLowerCase().includes(q) ||
                    (s.message || '').toLowerCase().includes(q) ||
                    (s.dateFormatted || '').toLowerCase().includes(q)
                  );
                }
                return true;
              });

              if (filteredSuggestions.length === 0) {
                return (
                  <div className="py-12 text-center space-y-2 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
                    <MessageSquare className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      No hay sugerencias registradas en esta vista
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Las notas enviadas desde el botón &ldquo;Sugerencias&rdquo; en el Inicio aparecerán aquí en forma de lista.
                    </p>
                  </div>
                );
              }

              return (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {filteredSuggestions.map((item, idx) => (
                    <li
                      key={item.id}
                      className={`p-4 sm:p-5 transition flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                        item.isRead
                          ? 'bg-white/60 dark:bg-slate-900/40'
                          : 'bg-teal-50/70 dark:bg-teal-950/25'
                      }`}
                    >
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            #{idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                            <span>{item.userName || 'Usuario'}</span>
                          </span>
                          {item.userRole && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30">
                              {item.userRole}
                            </span>
                          )}
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>{item.dateFormatted || new Date(item.createdAt).toLocaleString('es-VE')}</span>
                          </span>
                          {!item.isRead && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                              NUEVA
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-100/80 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                          {item.message}
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = await markSuggestionReadApi(item.id, !item.isRead);
                            setSuggestions(updated);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                            item.isRead
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{item.isRead ? 'Marcar no leída' : 'Marcar leída'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = await deleteSuggestionApi(item.id);
                            setSuggestions(updated);
                            setActionNotice('Sugerencia eliminada del buzón.');
                            setTimeout(() => setActionNotice(null), 3000);
                          }}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-100 dark:bg-rose-500/15 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white border border-rose-300 dark:border-rose-500/30 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: REGISTRAR / EDITAR DOCTOR           */}
      {/* ========================================== */}
      {showNewDoctorModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className={`border rounded-3xl max-w-xl w-full text-slate-800 dark:text-slate-100 shadow-xl dark:shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col overflow-hidden ${themeTokens.cardSurface}`}>
            <div className={`shrink-0 flex items-start justify-between border-b px-5 sm:px-6 pt-5 pb-4 ${themeTokens.sectionDivider}`}>
              <div className="space-y-1 pr-3">
                <div className="flex items-center gap-2">
                  <span className={`p-2 rounded-xl border shrink-0 ${themeTokens.accentBadge}`}>
                    <UserPlus className="w-5 h-5" />
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {editingDoctor ? 'Editar Doctor' : 'Registro de Nuevo Doctor (Solicitud)'}
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {editingDoctor 
                    ? 'Modifique el rol asistencial o datos del doctor.'
                    : 'Complete sus datos para enviar la solicitud de registro al panel de control del administrador.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewDoctorModal(false)}
                className="p-2 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDoctor} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              {doctorModalError && (
                <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/40 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{doctorModalError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Separated First Name & Last Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nombre completo *</label>
                  <input
                    type="text"
                    required
                    value={doctorForm.firstName}
                    onChange={(e) => setDoctorForm({ ...doctorForm, firstName: e.target.value })}
                    placeholder="Ej: Carlos Eduardo"
                    className="w-full px-3.5 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Apellidos completos *</label>
                  <input
                    type="text"
                    required
                    value={doctorForm.lastName}
                    onChange={(e) => setDoctorForm({ ...doctorForm, lastName: e.target.value })}
                    placeholder="Ej: Mendoza Pérez"
                    className="w-full px-3.5 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
                  />
                </div>

                {/* Gender Selector */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Sexo *</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDoctorForm({ ...doctorForm, gender: 'M' })}
                      className={`py-2 px-3 rounded-xl font-black text-xs border-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        doctorForm.gender === 'M'
                          ? 'bg-blue-600 text-white border-blue-500 dark:border-blue-400 shadow-xs'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                      }`}
                    >
                      <span>♂ Masculino (Dr.)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDoctorForm({ ...doctorForm, gender: 'F' })}
                      className={`py-2 px-3 rounded-xl font-black text-xs border-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        doctorForm.gender === 'F'
                          ? 'bg-pink-600 text-white border-pink-500 dark:border-pink-400 shadow-xs'
                          : 'bg-pink-50 dark:bg-pink-950/40 text-pink-800 dark:text-pink-300 border-pink-200 dark:border-pink-500/30'
                      }`}
                    >
                      <span>♀ Femenino (Dra.)</span>
                    </button>
                  </div>
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Usuario (sin @ ni .com) *</label>
                  <input
                    type="text"
                    required
                    value={doctorForm.username || ''}
                    onChange={(e) => setDoctorForm({ ...doctorForm, username: e.target.value.toLowerCase().trim() })}
                    placeholder="Ej: carlosm"
                    className="w-full px-3.5 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Contraseña (mín. 7 dígitos) *</label>
                  <input
                    type="text"
                    required
                    value={doctorForm.password || ''}
                    onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })}
                    placeholder="Mínimo 7 dígitos o más"
                    className="w-full px-3.5 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 font-mono"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={doctorForm.email}
                    onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                    placeholder="carlos.medico@hospital.com"
                    className="w-full px-3.5 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
                  />
                </div>

                {/* Role Type */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Rol Asistencial *</label>
                  <select
                    value={doctorForm.roleType}
                    onChange={(e) => setDoctorForm({ ...doctorForm, roleType: e.target.value as MedicalRoleType })}
                    className="w-full px-3.5 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 cursor-pointer"
                  >
                    <option value="Especialista">Especialista (Pediatra / Cirujano)</option>
                    <option value="Residente">Residente</option>
                    <option value="Interno">Interno de Pregrado</option>
                    <option value="Médico de Guardia">Médico de Guardia</option>
                  </select>
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Teléfono Móvil</label>
                  <input
                    type="text"
                    value={doctorForm.telefono}
                    onChange={(e) => setDoctorForm({ ...doctorForm, telefono: e.target.value })}
                    placeholder="Ej: 0414-1234567"
                    className="w-full px-3.5 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
                  />
                </div>

                {/* Academic Level / Year (If Interno: 1 to 6) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {doctorForm.roleType === 'Residente' ? 'Nivel de Residencia' : doctorForm.roleType === 'Interno' ? 'Año Académico (1 al 6)' : 'Especialidad'}
                  </label>
                  {doctorForm.roleType === 'Residente' ? (
                    <select
                      value={doctorForm.nivelAcademico}
                      onChange={(e) => setDoctorForm({ ...doctorForm, nivelAcademico: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 cursor-pointer"
                    >
                      <option value="R1">Residente 1er Año (R1)</option>
                      <option value="R2">Residente 2do Año (R2)</option>
                      <option value="R3">Residente 3er Año (R3)</option>
                    </select>
                  ) : doctorForm.roleType === 'Interno' ? (
                    <select
                      value={doctorForm.nivelAcademico}
                      onChange={(e) => setDoctorForm({ ...doctorForm, nivelAcademico: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 cursor-pointer"
                    >
                      <option value="1er Año">1er Año</option>
                      <option value="2do Año">2do Año</option>
                      <option value="3er Año">3er Año</option>
                      <option value="4to Año">4to Año</option>
                      <option value="5to Año">5to Año</option>
                      <option value="6to Año (Internado)">6to Año (Internado)</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={doctorForm.nivelAcademico}
                      onChange={(e) => setDoctorForm({ ...doctorForm, nivelAcademico: e.target.value })}
                      placeholder="Ej: Pediatra Puericultor"
                      className="w-full px-3.5 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
                    />
                  )}
                </div>

                {/* University */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Universidad / Hospital de Origen</label>
                  <input
                    type="text"
                    value={doctorForm.universidad}
                    onChange={(e) => setDoctorForm({ ...doctorForm, universidad: e.target.value })}
                    placeholder="Ej: Universidad Central de Venezuela (Escuela Luis Razetti)"
                    className="w-full px-3.5 py-2.5 bg-[#f0f5f6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
                  />
                </div>

                {/* Approval Switch (Only if admin editing) */}
                {isUnlocked && (
                  <div className="sm:col-span-2 pt-2">
                    <label className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer ${themeTokens.cardInnerSurface}`}>
                      <input
                        type="checkbox"
                        checked={doctorForm.isApproved}
                        onChange={(e) => setDoctorForm({ ...doctorForm, isApproved: e.target.checked })}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Aprobar y habilitar acceso de inmediato</p>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400">Si se desmarca, quedará en solicitudes pendientes para aprobación del admin.</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className={`flex items-center justify-end gap-2.5 pt-3 border-t ${themeTokens.sectionDivider}`}>
                <button
                  type="button"
                  onClick={() => setShowNewDoctorModal(false)}
                  className="px-4 py-2.5 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 font-bold rounded-xl text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${themeTokens.primaryButton}`}
                >
                  <Check className="w-4 h-4" />
                  <span>{editingDoctor ? 'Guardar Cambios' : 'Enviar Solicitud de Registro'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* IN-APP CONFIRMATION DIALOG MODAL           */}
      {/* ========================================== */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[220] bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-3xl max-w-md w-full p-6 text-slate-800 dark:text-slate-100 shadow-xl dark:shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 ${themeTokens.cardSurface}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                confirmDialog.tone === 'restore'
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40'
                  : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/40'
              }`}>
                {confirmDialog.tone === 'restore' ? <RotateCcw className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{confirmDialog.message}</p>
            <div className={`flex items-center justify-end gap-2.5 pt-2 border-t ${themeTokens.sectionDivider}`}>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await fn();
                }}
                className={`px-4 py-2 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  confirmDialog.tone === 'restore'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {confirmDialog.tone === 'restore' ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{confirmDialog.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
