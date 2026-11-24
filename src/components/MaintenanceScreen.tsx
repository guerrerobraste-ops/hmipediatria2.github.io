import React, { useState } from 'react';
import {
  Wrench,
  ShieldCheck,
  Lock,
  AlertCircle,
  LogOut,
  Sun,
  Moon,
  Clock,
  X,
  KeyRound,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SeasonalOverlay, SeasonalStyle } from './SeasonalOverlay';
import { getSeasonalThemeTokens, useSeasonalTheme } from '../utils/seasonalTheme';
import { getAudioButtonNeonClasses } from '../utils/headerNeonStyles';
import { verifyMasterAdminPassword } from '../utils/adminAuth';
import { supabase, fetchAllProfiles, fetchUserProfile } from '../lib/supabase';
import type { Gender } from '../types';

interface Props {
  message: string;
  isLoggedInUser: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  seasonalTheme?: SeasonalStyle;
  ambientSoundEnabled?: boolean;
  userSoundMuted?: boolean;
  onToggleMuteSound?: () => void;
  onAdminLoginSuccess: (
    role: 'admin',
    username: string,
    fullName: string,
    gender: Gender
  ) => void;
  onLogout?: () => void;
}

export const MaintenanceScreen: React.FC<Props> = ({
  message,
  isLoggedInUser,
  darkMode,
  onToggleDarkMode,
  seasonalTheme,
  ambientSoundEnabled = false,
  userSoundMuted = false,
  onToggleMuteSound,
  onAdminLoginSuccess,
  onLogout,
}) => {
  const { style: hookStyle } = useSeasonalTheme();
  const activeSeasonal = seasonalTheme || hookStyle;
  const themeTokens = getSeasonalThemeTokens(activeSeasonal);

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAdminAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = adminUsername.trim().toLowerCase();
    const cleanPass = adminPassword.trim();

    if (!cleanUser || !cleanPass) {
      setAuthError('Ingrese usuario y contraseña de administrador.');
      return;
    }

    if (cleanUser === 'admin' && verifyMasterAdminPassword(cleanPass)) {
      localStorage.setItem('hmi_first_time_login_done', 'true');
      localStorage.setItem('hmi_user_role', 'admin');
      localStorage.setItem('hmi_username', 'admin');
      localStorage.setItem('hmi_user_name', 'Administrador');
      localStorage.setItem('hmi_user_gender', 'M');
      sessionStorage.setItem('hmi_admin_session_unlocked', 'true');
      onAdminLoginSuccess('admin', 'admin', 'Administrador', 'M');
      return;
    }

    try {
      setLoading(true);
      setAuthError(null);

      const profiles = await fetchAllProfiles();
      const matched = profiles.find((p) => {
        const emailMatch = (p.email || '').toLowerCase() === cleanUser;
        const usernameMatch = (p.details?.username || '').toLowerCase() === cleanUser;
        return emailMatch || usernameMatch;
      });

      if (matched) {
        const isAdminProfile =
          Boolean(matched.is_admin) ||
          matched.email?.toLowerCase() === 'guerrerobraste@gmail.com' ||
          cleanUser === 'admin';

        if (!isAdminProfile) {
          setAuthError('Acceso restringido: la página está en mantenimiento. Solo el administrador puede ingresar.');
          return;
        }

        if (matched.details?.password && matched.details.password !== cleanPass) {
          setAuthError('Contraseña de administrador incorrecta.');
          return;
        }

        const resolvedName =
          [matched.details?.firstName, matched.details?.lastName].filter(Boolean).join(' ').trim() ||
          matched.full_name ||
          'Administrador';
        const resolvedGender: Gender = matched.details?.gender === 'F' ? 'F' : 'M';

        localStorage.setItem('hmi_first_time_login_done', 'true');
        localStorage.setItem('hmi_user_role', 'admin');
        localStorage.setItem('hmi_username', matched.details?.username || cleanUser);
        localStorage.setItem('hmi_user_name', resolvedName);
        localStorage.setItem('hmi_user_gender', resolvedGender);
        sessionStorage.setItem('hmi_admin_session_unlocked', 'true');
        onAdminLoginSuccess('admin', matched.details?.username || cleanUser, resolvedName, resolvedGender);
        return;
      }

      const loginEmail = cleanUser.includes('@') ? cleanUser : `${cleanUser}@hospital.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: cleanPass,
      });

      if (!error && data.user) {
        const profile = await fetchUserProfile(data.user.id);
        const isAdminProfile =
          cleanUser === 'admin' ||
          loginEmail === 'guerrerobraste@gmail.com' ||
          Boolean(profile?.is_admin);

        if (!isAdminProfile) {
          await supabase.auth.signOut();
          setAuthError('Acceso restringido: la página está en mantenimiento. Solo el administrador puede ingresar.');
          return;
        }

        const resolvedName =
          [profile?.details?.firstName, profile?.details?.lastName].filter(Boolean).join(' ').trim() ||
          profile?.full_name ||
          'Administrador';
        const resolvedGender: Gender = profile?.details?.gender === 'F' ? 'F' : 'M';

        localStorage.setItem('hmi_first_time_login_done', 'true');
        localStorage.setItem('hmi_user_role', 'admin');
        localStorage.setItem('hmi_username', profile?.details?.username || cleanUser);
        localStorage.setItem('hmi_user_name', resolvedName);
        localStorage.setItem('hmi_user_gender', resolvedGender);
        sessionStorage.setItem('hmi_admin_session_unlocked', 'true');
        onAdminLoginSuccess('admin', profile?.details?.username || cleanUser, resolvedName, resolvedGender);
        return;
      }

      setAuthError('Credenciales de administrador inválidas.');
    } catch {
      setAuthError('No se pudo validar el acceso de administrador.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden transition-colors duration-200 ${themeTokens.rootCanvas}`}
    >
      <SeasonalOverlay style={activeSeasonal} />

      {/* Top right Sound Mute & Theme Toggle */}
      <div className="fixed top-4 right-4 z-30 flex items-center gap-2">
        {ambientSoundEnabled && onToggleMuteSound && (() => {
          const audioNeon = getAudioButtonNeonClasses(!userSoundMuted, activeSeasonal);
          return (
            <button
              type="button"
              onClick={onToggleMuteSound}
              aria-label={userSoundMuted ? 'Activar sonido ambiental' : 'Silenciar sonido ambiental'}
              className={`p-2.5 rounded-xl md:backdrop-blur-md border hover:scale-105 transition cursor-pointer flex items-center justify-center active:scale-95 ${audioNeon.buttonClasses}`}
              title={userSoundMuted ? 'Activar sonido ambiental' : 'Silenciar sonido ambiental'}
            >
              {userSoundMuted ? (
                <VolumeX className={`w-4 h-4 ${audioNeon.iconClasses}`} />
              ) : (
                <Volume2 className={`w-4 h-4 ${audioNeon.iconClasses}`} />
              )}
            </button>
          );
        })()}

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="p-2.5 rounded-xl bg-white/95 dark:bg-slate-800/95 md:backdrop-blur-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm hover:scale-105 transition cursor-pointer"
          title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>

      {/* Main Maintenance Card */}
      <div
        className={`relative z-20 w-full max-w-lg border rounded-3xl p-6 sm:p-10 text-center space-y-6 shadow-2xl md:backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 ${themeTokens.cardSurface}`}
      >
        {/* Logo & Hospital Title */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/assets/aistudio/image-Photoroom_060cd80d.png"
            alt="Hospital Materno Infantil"
            className="w-16 h-16 object-contain drop-shadow-md"
          />
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${themeTokens.heroBadge}`}
          >
            Hospital Materno Infantil del Valle · Pediatría
          </span>
        </div>

        {/* Maintenance Animated Icon */}
        <div className="flex justify-center">
          <div className="relative w-24 h-24 rounded-3xl bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center shadow-inner">
            <Wrench className="w-11 h-11 text-amber-600 dark:text-amber-400 animate-pulse" />
            <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
              En Reparación
            </span>
          </div>
        </div>

        {/* Exact Maintenance Notice */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 text-xs font-extrabold">
            <Clock className="w-3.5 h-3.5" />
            <span>Aviso del Sistema</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
            {message}
          </h1>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            El acceso temporal para usuarios y registro médico se encuentra pausado mientras se realizan mejoras técnicas. Esta pantalla se actualizará automáticamente en cuanto el servicio sea restablecido.
          </p>
        </div>

        {/* Subtle Admin / Logout Footer */}
        <div className={`pt-4 border-t flex flex-wrap items-center justify-center gap-3 ${themeTokens.sectionDivider}`}>
          <button
            type="button"
            onClick={() => {
              setAuthError(null);
              setShowAdminModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Acceso Administrador</span>
          </button>

          {isLoggedInUser && onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-100/80 dark:bg-rose-950/40 hover:bg-rose-200 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin-Only Login Modal while Maintenance is Active */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm border rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 ${themeTokens.cardSurface}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                  <Lock className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">
                    Acceso Administrador
                  </h2>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                    Solo el administrador puede ingresar en mantenimiento
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-2.5 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAdminAccessSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Usuario Administrador
                </label>
                <input
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{loading ? 'Validando...' : 'Ingresar como Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
