import React, { useState } from 'react';
import { supabase, fetchAllProfiles, fetchUserProfile, upsertUserProfile } from '../lib/supabase';
import { Shield, Lock, AlertCircle, CheckCircle2, Clock, UserPlus, KeyRound, Check, Sparkles, ArrowRight, UserCheck, Sun, Moon, Volume2, VolumeX } from 'lucide-react';
import { MedicalRoleType, UserProfile, Gender } from '../types';
import { logDatabaseActivity } from '../services/activityLogger';
import { SeasonalOverlay, SeasonalStyle } from './SeasonalOverlay';
import { getSeasonalThemeTokens, useSeasonalTheme } from '../utils/seasonalTheme';
import { getAudioButtonNeonClasses } from '../utils/headerNeonStyles';
import { verifyMasterAdminPassword } from '../utils/adminAuth';

interface Props {
  onDemoLogin?: () => void;
  onLoginSuccess?: (
    role: 'admin' | 'doctor' | 'visitor',
    username?: string,
    fullName?: string,
    gender?: Gender,
    meta?: { profileId?: string; email?: string }
  ) => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  seasonalTheme?: SeasonalStyle;
  ambientSoundEnabled?: boolean;
  userSoundMuted?: boolean;
  onToggleMuteSound?: () => void;
}

const FIRST_TIME_SESSION_KEY = 'hmi_first_time_login_done';

// ==========================================
// CUTE ANIMATED BABY COMPONENT
// ==========================================
const CuteAnimatedBabySVG: React.FC = () => {
  return (
    <div className="relative w-56 h-56 mx-auto flex items-center justify-center my-2 select-none">
      {/* Floating Sparkles & Hearts Animation */}
      <div className="absolute top-2 left-4 text-pink-400 animate-floating-sparkle-1 pointer-events-none text-2xl font-bold">💖</div>
      <div className="absolute top-0 right-6 text-amber-300 animate-floating-sparkle-2 pointer-events-none text-2xl font-bold">✨</div>
      <div className="absolute top-8 right-2 text-teal-300 animate-floating-sparkle-3 pointer-events-none text-xl font-bold">⭐</div>
      <div className="absolute bottom-4 left-6 text-emerald-400 animate-floating-sparkle-1 pointer-events-none text-xl font-bold">🩺</div>

      {/* Main Bouncing Container */}
      <div className="animate-baby-bounce relative w-48 h-48 flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
          <defs>
            <radialGradient id="babySkinGrad" cx="40%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fff3e0" />
              <stop offset="70%" stopColor="#ffcc80" />
              <stop offset="100%" stopColor="#ffa726" />
            </radialGradient>
            <linearGradient id="babyHatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="babyBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          {/* Baby Legs (Kicking) */}
          <g className="animate-baby-legs">
            <ellipse cx="75" cy="165" rx="14" ry="10" fill="url(#babySkinGrad)" stroke="#fb8c00" strokeWidth="1.5" />
            <ellipse cx="125" cy="165" rx="14" ry="10" fill="url(#babySkinGrad)" stroke="#fb8c00" strokeWidth="1.5" />
            <circle cx="68" cy="166" r="2.5" fill="#e65100" />
            <circle cx="73" cy="168" r="2" fill="#e65100" />
            <circle cx="132" cy="166" r="2.5" fill="#e65100" />
            <circle cx="127" cy="168" r="2" fill="#e65100" />
          </g>

          {/* Baby Body Onesie */}
          <path d="M 65 115 Q 100 105 135 115 Q 145 150 100 155 Q 55 150 65 115 Z" fill="url(#babyBodyGrad)" stroke="#0369a1" strokeWidth="2" />

          {/* Stethoscope Print */}
          <path d="M 90 125 Q 100 140 110 125" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="100" cy="138" r="4" fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />

          {/* Left Arm (Waving) */}
          <g className="animate-baby-arm-l">
            <path d="M 68 120 Q 42 110 38 95" fill="none" stroke="url(#babySkinGrad)" strokeWidth="15" strokeLinecap="round" />
            <circle cx="38" cy="95" r="8.5" fill="url(#babySkinGrad)" stroke="#fb8c00" strokeWidth="1.5" />
          </g>

          {/* Right Arm (Waving) */}
          <g className="animate-baby-arm-r">
            <path d="M 132 120 Q 158 110 162 95" fill="none" stroke="url(#babySkinGrad)" strokeWidth="15" strokeLinecap="round" />
            <circle cx="162" cy="95" r="8.5" fill="url(#babySkinGrad)" stroke="#fb8c00" strokeWidth="1.5" />
          </g>

          {/* Baby Head & Face */}
          <g className="animate-baby-laugh">
            <circle cx="100" cy="80" r="46" fill="url(#babySkinGrad)" stroke="#fb8c00" strokeWidth="2" />

            {/* Rosy Cheeks */}
            <circle cx="72" cy="88" r="9" fill="#ff4081" opacity="0.5" />
            <circle cx="128" cy="88" r="9" fill="#ff4081" opacity="0.5" />

            {/* Twinkling Eyes */}
            <g>
              <ellipse cx="80" cy="74" rx="5.5" ry="7" fill="#1e293b" />
              <circle cx="82" cy="72" r="2.5" fill="#ffffff" />
              <ellipse cx="120" cy="74" rx="5.5" ry="7" fill="#1e293b" />
              <circle cx="122" cy="72" r="2.5" fill="#ffffff" />
            </g>

            {/* Eyebrows */}
            <path d="M 73 63 Q 80 58 87 63" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 113 63 Q 120 58 127 63" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />

            {/* Cheerful Laughing Mouth */}
            <path d="M 83 90 Q 100 114 117 90 Z" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="1.5" />
            <path d="M 90 98 Q 100 92 110 98 Q 100 108 90 98 Z" fill="#f43f5e" />

            {/* Doctor Cap */}
            <path d="M 68 50 Q 100 30 132 50 L 126 36 Q 100 24 74 36 Z" fill="url(#babyHatGrad)" stroke="#047857" strokeWidth="2" />
            <circle cx="100" cy="38" r="7" fill="#ffffff" />
            <path d="M 100 34 L 100 42 M 96 38 L 104 38" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </div>
  );
};

export const AuthScreen: React.FC<Props> = ({
  onDemoLogin,
  onLoginSuccess,
  darkMode,
  onToggleDarkMode,
  seasonalTheme,
  ambientSoundEnabled = false,
  userSoundMuted = false,
  onToggleMuteSound,
}) => {
  const { style: hookStyle } = useSeasonalTheme();
  const activeSeasonal = seasonalTheme || hookStyle;
  const themeTokens = getSeasonalThemeTokens(activeSeasonal);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authSuccessNotice, setAuthSuccessNotice] = useState<string | null>(null);

  // Mode: 'login' | 'signup'
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  // Animated baby modal for pending approval
  const [showPendingModal, setShowPendingModal] = useState<boolean>(false);
  const [pendingDoctorName, setPendingDoctorName] = useState<string>('');
  const [pendingUsername, setPendingUsername] = useState<string>('');

  // Login inputs (only username and password)
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signup form fields (with MANDATORY username, separated firstName/lastName, gender and password >= 7 chars)
  const [signupForm, setSignupForm] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    gender: 'M' as Gender,
    email: '',
    roleType: 'Residente' as MedicalRoleType,
    universidad: 'Universidad Central de Venezuela (UCV)',
    nivelAcademico: 'R1',
    especialidad: 'Pediatría y Puericultura',
    telefono: '',
  });

  const formatAuthError = (err: any): string => {
    if (!err) return 'Ocurrió un error inesperado al procesar su solicitud.';
    const msg = String(err.message || err.error_description || err);
    if (msg.includes('Invalid login credentials') || msg.includes('invalid claim')) {
      return 'Usuario o contraseña incorrectos. Verifique sus credenciales.';
    }
    return msg;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = usernameOrEmail.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('Por favor ingrese su usuario y su contraseña.');
      return;
    }

    // Check master admin credentials (defaults to Bg250997 and follows admin password rotation)
    if (cleanUser === 'admin' && verifyMasterAdminPassword(cleanPass)) {
      try {
        setLoading(true);
        localStorage.setItem(FIRST_TIME_SESSION_KEY, 'true');
        localStorage.setItem('hmi_user_role', 'admin');
        localStorage.setItem('hmi_user_name', 'Administrador');
        localStorage.setItem('hmi_user_gender', 'M');
        sessionStorage.setItem('hmi_admin_session_unlocked', 'true');
        if (onLoginSuccess) {
          onLoginSuccess('admin', 'admin', 'Administrador', 'M', {
            email: 'guerrerobraste@gmail.com',
          });
        }
        return;
      } finally {
        setLoading(false);
      }
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      // Fetch all registered profiles to find matching user/username
      const profiles = await fetchAllProfiles();
      const matchedProfile = profiles.find((p) => {
        const emailMatch = (p.email || '').toLowerCase() === cleanUser;
        const usernameMatch = (p.details?.username || '').toLowerCase() === cleanUser;
        return emailMatch || usernameMatch;
      });

      if (matchedProfile) {
        const isAdmin = matchedProfile.is_admin || matchedProfile.email?.toLowerCase() === 'guerrerobraste@gmail.com' || cleanUser === 'admin';
        
        // If not approved yet, trigger cute animated baby screen "Esperando aprobación"
        if (!isAdmin && matchedProfile.is_approved === false) {
          setPendingDoctorName(matchedProfile.full_name || cleanUser);
          setPendingUsername(matchedProfile.details?.username || cleanUser);
          setShowPendingModal(true);
          setLoading(false);
          return;
        }

        // Verify password if stored in profile
        if (matchedProfile.details?.password && matchedProfile.details.password !== cleanPass) {
          setErrorMessage('Contraseña incorrecta. Verifique sus credenciales.');
          setLoading(false);
          return;
        }

        // Approved doctor! Login success
        const resolvedName =
          [matchedProfile.details?.firstName, matchedProfile.details?.lastName].filter(Boolean).join(' ').trim() ||
          matchedProfile.full_name ||
          cleanUser;
        const resolvedGender: Gender = matchedProfile.details?.gender === 'F' ? 'F' : 'M';

        localStorage.setItem(FIRST_TIME_SESSION_KEY, 'true');
        localStorage.setItem('hmi_user_role', isAdmin ? 'admin' : 'doctor');
        localStorage.setItem('hmi_user_name', resolvedName);
        localStorage.setItem('hmi_user_gender', resolvedGender);
        if (isAdmin) {
          sessionStorage.setItem('hmi_admin_session_unlocked', 'true');
        }
        if (onLoginSuccess) {
          onLoginSuccess(
            isAdmin ? 'admin' : 'doctor',
            matchedProfile.details?.username || cleanUser,
            resolvedName,
            resolvedGender,
            { profileId: matchedProfile.id, email: matchedProfile.email }
          );
        }
        return;
      }

      // Try Supabase auth as secondary resolution
      let loginEmail = cleanUser;
      if (!loginEmail.includes('@')) {
        loginEmail = cleanUser + '@hospital.com';
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: cleanPass,
      });

      if (!error && data.user) {
        const directProfile = await fetchUserProfile(data.user.id);
        const profile = directProfile || profiles.find((p) => {
          const emailMatch = (p.email || '').toLowerCase() === loginEmail.toLowerCase();
          const usernameMatch = (p.details?.username || '').toLowerCase() === cleanUser;
          return emailMatch || usernameMatch;
        }) || null;

        if (profile && profile.is_approved === false) {
          await supabase.auth.signOut();
          setPendingDoctorName(profile.full_name || cleanUser);
          setPendingUsername(profile.details?.username || cleanUser);
          setShowPendingModal(true);
          setLoading(false);
          return;
        }

        const isAdmin = cleanUser === 'admin' || loginEmail === 'guerrerobraste@gmail.com' || Boolean(profile?.is_admin);
        const resolvedName =
          [profile?.details?.firstName, profile?.details?.lastName].filter(Boolean).join(' ').trim() ||
          profile?.full_name ||
          cleanUser;
        const resolvedGender: Gender = profile?.details?.gender === 'F' ? 'F' : 'M';
        localStorage.setItem(FIRST_TIME_SESSION_KEY, 'true');
        localStorage.setItem('hmi_user_role', isAdmin ? 'admin' : 'doctor');
        localStorage.setItem('hmi_user_name', resolvedName);
        localStorage.setItem('hmi_user_gender', resolvedGender);
        if (isAdmin) {
          sessionStorage.setItem('hmi_admin_session_unlocked', 'true');
        }
        if (onLoginSuccess) {
          onLoginSuccess(
            isAdmin ? 'admin' : 'doctor',
            profile?.details?.username || cleanUser,
            resolvedName,
            resolvedGender,
            { profileId: profile?.id || data.user.id, email: profile?.email || loginEmail }
          );
        }
        return;
      }

      setErrorMessage('Usuario o contraseña incorrectos. Verifique sus datos o regístrese como nuevo doctor.');
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = signupForm.username.trim().toLowerCase();
    const cleanFirstName = signupForm.firstName.trim();
    const cleanLastName = signupForm.lastName.trim();
    const cleanEmail = signupForm.email.trim().toLowerCase();
    const cleanPass = signupForm.password.trim();

    if (!cleanUsername) {
      setErrorMessage('El nombre de usuario es obligatorio para poder registrarse e ingresar.');
      return;
    }

    if (cleanUsername.includes('@') || cleanUsername.includes('.com')) {
      setErrorMessage('El usuario no debe contener "@" ni ".com". Escriba un usuario corto (ej: dr_brayan).');
      return;
    }

    if (!cleanFirstName || !cleanLastName) {
      setErrorMessage('Por favor complete su Nombre completo y Apellidos completos.');
      return;
    }

    if (
      cleanFirstName.includes('@') || cleanFirstName.toLowerCase().includes('.com') ||
      cleanLastName.includes('@') || cleanLastName.toLowerCase().includes('.com')
    ) {
      setErrorMessage('El Nombre completo y los Apellidos completos no pueden contener "@" ni ".com".');
      return;
    }

    if (!cleanEmail) {
      setErrorMessage('Por favor ingrese su correo electrónico.');
      return;
    }

    if (!cleanPass || cleanPass.length < 7) {
      setErrorMessage('La contraseña debe tener 7 dígitos o más.');
      return;
    }

    const combinedFullName = `${cleanFirstName} ${cleanLastName}`.trim();

    try {
      setLoading(true);
      setErrorMessage(null);

      // Register profile payload into Supabase & Local Cache
      const userId = 'doc-' + Date.now();
      const profilePayload: UserProfile = {
        id: userId,
        email: cleanEmail,
        full_name: combinedFullName,
        role_type: signupForm.roleType,
        role: 'doctor',
        is_approved: false, // SOLICITUD PENDIENTE DE APROBACIÓN POR EL ADMINISTRADOR
        is_admin: false,
        details: {
          username: cleanUsername,
          password: cleanPass,
          firstName: cleanFirstName,
          lastName: cleanLastName,
          gender: signupForm.gender,
          universidad: signupForm.universidad.trim(),
          anoResidencia: signupForm.roleType === 'Residente' ? signupForm.nivelAcademico : undefined,
          anoCursado: signupForm.roleType === 'Interno' ? signupForm.nivelAcademico : undefined,
          especialidad: signupForm.roleType === 'Especialista' ? signupForm.especialidad : undefined,
          telefono: signupForm.telefono.trim(),
          fechaRegistro: new Date().toISOString()
        },
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      // Try creating Supabase auth user
      try {
        await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
        });
      } catch {
        // Continue to save profile record even if network is offline
      }

      await upsertUserProfile(profilePayload);

      try {
        logDatabaseActivity({
          module: 'doctores',
          action: 'INSERT',
          user: combinedFullName,
          description: `Nueva solicitud de registro médico: ${combinedFullName} [@${cleanUsername}]`,
          details: {
            entityType: 'doctor',
            id: userId,
            email: cleanEmail,
            username: cleanUsername,
            aprobado: false,
            snapshot: profilePayload
          },
          severity: 'warning'
        });
      } catch {}

      // Trigger animated baby modal for pending approval
      setPendingDoctorName(`${signupForm.gender === 'F' ? 'Dra.' : 'Dr.'} ${combinedFullName}`);
      setPendingUsername(cleanUsername);
      setShowPendingModal(true);

      // Reset form mode to login prefilled with username
      setUsernameOrEmail(cleanUsername);
      setPassword('');
      setMode('login');
    } catch (err: any) {
      console.error('Signup error:', err);
      setErrorMessage(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center p-4 font-sans selection:bg-teal-500 selection:text-white relative transition-colors ${themeTokens.rootCanvas}`}>
      <SeasonalOverlay style={activeSeasonal} />

      {/* Top-right Sound Mute & Light / Dark Mode Switch */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        {ambientSoundEnabled && onToggleMuteSound && (() => {
          const audioNeon = getAudioButtonNeonClasses(!userSoundMuted, activeSeasonal);
          return (
            <button
              type="button"
              onClick={onToggleMuteSound}
              aria-label={userSoundMuted ? 'Activar sonido ambiental' : 'Silenciar sonido ambiental'}
              className={`p-2.5 rounded-2xl border md:backdrop-blur-md transition cursor-pointer flex items-center justify-center active:scale-95 ${audioNeon.buttonClasses}`}
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

        {onToggleDarkMode && (
          <button
            type="button"
            onClick={onToggleDarkMode}
            className={`p-2.5 rounded-2xl border shadow-xs transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${themeTokens.cardSurface}`}
            title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            <span className="hidden sm:inline text-slate-700 dark:text-slate-200">{darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        )}
      </div>

      {/* ========================================== */}
      {/* ANIMATED BABY MODAL: ESPERANDO APROBACIÓN  */}
      {/* ========================================== */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-slate-900/75 dark:bg-slate-950/90 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className={`relative w-full max-w-md border rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl ${themeTokens.cardSurface}`}>
            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40 text-xs font-black uppercase tracking-wider">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Esperando Aprobación</span>
            </div>

            {/* Cute Animated Baby SVG */}
            <CuteAnimatedBabySVG />

            {/* Status Message */}
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                ¡Solicitud Registrada con Éxito!
              </h2>
              <p className={`text-xs sm:text-sm font-extrabold ${themeTokens.accentText}`}>
                Doctor(a): {pendingDoctorName || 'Médico'} <span className="font-mono text-slate-900 dark:text-white">(@{pendingUsername})</span>
              </p>
              <div className={`border rounded-2xl p-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed text-left space-y-2 ${themeTokens.cardInnerSurface}`}>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Tu solicitud ha ingresado a la lista de <strong>Solicitudes Pendientes</strong> en el Panel de Control del Administrador.</span>
                </p>
                <p className="flex items-start gap-2">
                  <UserCheck className={`w-4 h-4 shrink-0 mt-0.5 ${themeTokens.accentIcon}`} />
                  <span>Una vez que el administrador apruebe tu perfil, podrás ingresar al sistema de inmediato usando tu <strong>Usuario</strong> y <strong>Contraseña</strong>.</span>
                </p>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => setShowPendingModal(false)}
                className={`w-full py-3 px-4 font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${themeTokens.primaryButton}`}
              >
                <span>Entendido / Volver al Inicio de Sesión</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MAIN AUTH CARD                            */}
      {/* ========================================== */}
      <div className={`relative w-full max-w-lg backdrop-blur-xl border rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl space-y-6 ${themeTokens.cardSurface}`}>
        {/* Hospital Branding Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center">
            <img
              src="/assets/aistudio/Icono_86bb4792.png"
              alt="HMI Pediatría"
              className="w-20 h-20 rounded-2xl object-contain shadow-lg"
            />
          </div>
          <div>
            <span className={`text-[10px] uppercase font-bold tracking-widest border px-3 py-1 rounded-full ${themeTokens.heroBadge}`}>
              Hospital Materno Infantil del Valle
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">
              Bienvenido al área de hospitalización del Hospital Materno Infantil del Valle
            </h1>
            <p className={`text-xs font-semibold mt-1.5 ${themeTokens.accentText}`}>
              {mode === 'login' 
                ? 'Para ingresar se requiere usuario y contraseña, solamente usuario y contraseña.' 
                : 'Complete el formulario con su usuario y contraseña obligatorios y datos médicos.'}
            </p>
          </div>
        </div>

        {/* Error / Notice Alert */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/40 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {authSuccessNotice && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">{authSuccessNotice}</div>
          </div>
        )}

        {/* ========================================== */}
        {/* FORM 1: LOGIN                             */}
        {/* ========================================== */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Usuario</span>
                <span className={`text-[10px] font-semibold ${themeTokens.accentText}`}>Obligatorio</span>
              </label>
              <input
                type="text"
                required
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="Ej: admin o dr_brayan"
                className="w-full px-3.5 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-teal-600 dark:focus:border-teal-500 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Contraseña</span>
                <span className={`text-[10px] font-semibold ${themeTokens.accentText}`}>Obligatoria</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-teal-600 dark:focus:border-teal-500 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none font-mono"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 py-3 px-4 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 ${themeTokens.primaryButton}`}
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? 'Ingresando...' : 'Ingresar al Sistema'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage(null);
                  setAuthSuccessNotice(null);
                }}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-teal-300 border border-slate-300 dark:border-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Registrarse</span>
              </button>
            </div>
          </form>
        ) : (
          /* ========================================== */
          /* FORM 2: REGISTRAR NUEVO DOCTOR            */
          /* ========================================== */
          <form onSubmit={handleSignupSubmit} className="space-y-3.5">
            <div className={`border rounded-2xl p-3 text-[11px] font-semibold space-y-1 ${themeTokens.cardInnerSurface}`}>
              <p className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold">
                <Sparkles className={`w-3.5 h-3.5 ${themeTokens.accentIcon}`} /> Formulario de Registro Médico
              </p>
              <p className="text-slate-600 dark:text-slate-400">Complete su Usuario y Contraseña obligatorios para quedar en Solicitudes Pendientes de Aprobación.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* MANDATORY USERNAME */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Usuario *</span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-black">Sin @ ni .com</span>
                </label>
                <input
                  type="text"
                  required
                  value={signupForm.username}
                  onChange={(e) => setSignupForm({ ...signupForm, username: e.target.value })}
                  placeholder="Ej: dr_brayan"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono"
                />
              </div>

              {/* MANDATORY PASSWORD */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Contraseña *</span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-black">Mín. 7 dígitos</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={7}
                  value={signupForm.password}
                  onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                  placeholder="Mínimo 7 dígitos o más"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono"
                />
              </div>

              {/* SEPARATED FIRST NAME & LAST NAME */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nombre completo *</label>
                <input
                  type="text"
                  required
                  value={signupForm.firstName}
                  onChange={(e) => setSignupForm({ ...signupForm, firstName: e.target.value })}
                  placeholder="Ej: María Alejandra"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Apellidos completos *</label>
                <input
                  type="text"
                  required
                  value={signupForm.lastName}
                  onChange={(e) => setSignupForm({ ...signupForm, lastName: e.target.value })}
                  placeholder="Ej: Pérez Rodríguez"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                />
              </div>

              {/* GENDER SELECTOR (BLUE / PINK BUTTONS) */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Sexo (para saludo Dr. / Dra.) *</span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400">
                    {signupForm.gender === 'M' ? 'Bienvenido Dr.' : 'Bienvenida Dra.'}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSignupForm({ ...signupForm, gender: 'M' })}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs border-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      signupForm.gender === 'M'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-sm dark:shadow-[0_0_16px_rgba(37,99,235,0.55)] scale-[1.01]'
                        : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                    }`}
                  >
                    <span>♂ Masculino (Dr.)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupForm({ ...signupForm, gender: 'F' })}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs border-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      signupForm.gender === 'F'
                        ? 'bg-pink-600 text-white border-pink-500 shadow-sm dark:shadow-[0_0_16px_rgba(219,39,119,0.55)] scale-[1.01]'
                        : 'bg-pink-50 dark:bg-pink-950/40 text-pink-800 dark:text-pink-300 border-pink-200 dark:border-pink-500/30 hover:bg-pink-100 dark:hover:bg-pink-900/50'
                    }`}
                  >
                    <span>♀ Femenino (Dra.)</span>
                  </button>
                </div>
              </div>

              {/* EMAIL */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={signupForm.email}
                  onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  placeholder="maria.pediatria@hospital.com"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                />
              </div>

              {/* ROLE */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Rol Asistencial *</label>
                <select
                  value={signupForm.roleType}
                  onChange={(e) => setSignupForm({ ...signupForm, roleType: e.target.value as MedicalRoleType })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 cursor-pointer"
                >
                  <option value="Especialista">Especialista (Pediatra)</option>
                  <option value="Residente">Residente</option>
                  <option value="Interno">Interno de Pregrado</option>
                  <option value="Médico de Guardia">Médico de Guardia</option>
                </select>
              </div>

              {/* PHONE */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Teléfono Móvil</label>
                <input
                  type="text"
                  value={signupForm.telefono}
                  onChange={(e) => setSignupForm({ ...signupForm, telefono: e.target.value })}
                  placeholder="Ej: 0414-1234567"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                />
              </div>

              {/* ACADEMIC LEVEL */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {signupForm.roleType === 'Residente' ? 'Nivel de Residencia' : signupForm.roleType === 'Interno' ? 'Año Académico (1 al 6)' : 'Especialidad'}
                </label>
                {signupForm.roleType === 'Residente' ? (
                  <select
                    value={signupForm.nivelAcademico}
                    onChange={(e) => setSignupForm({ ...signupForm, nivelAcademico: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 cursor-pointer"
                  >
                    <option value="R1">Residente 1er Año (R1)</option>
                    <option value="R2">Residente 2do Año (R2)</option>
                    <option value="R3">Residente 3er Año (R3)</option>
                  </select>
                ) : signupForm.roleType === 'Interno' ? (
                  <select
                    value={signupForm.nivelAcademico}
                    onChange={(e) => setSignupForm({ ...signupForm, nivelAcademico: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 cursor-pointer"
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
                    value={signupForm.nivelAcademico}
                    onChange={(e) => setSignupForm({ ...signupForm, nivelAcademico: e.target.value })}
                    placeholder="Ej: Pediatra Puericultor"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                  />
                )}
              </div>

              {/* UNIVERSITY */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Universidad / Hospital de Origen</label>
                <input
                  type="text"
                  value={signupForm.universidad}
                  onChange={(e) => setSignupForm({ ...signupForm, universidad: e.target.value })}
                  placeholder="Ej: Universidad Central de Venezuela"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Volver a Iniciar Sesión
              </button>

              <button
                type="submit"
                disabled={loading}
                className={`flex-1 py-3 px-4 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 ${themeTokens.primaryButton}`}
              >
                <Check className="w-4 h-4" />
                <span>{loading ? 'Enviando...' : 'Enviar Solicitud de Registro'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Security badges footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-[10px] text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className={`w-3.5 h-3.5 shrink-0 ${themeTokens.accentIcon}`} />
            <span>Base de Datos Supabase</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Acceso Clínico Seguro</span>
          </div>
        </div>
      </div>
    </div>
  );
};
