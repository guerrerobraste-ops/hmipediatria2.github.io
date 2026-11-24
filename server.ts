import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { INITIAL_PATIENTS, INITIAL_BEDS, INITIAL_TASKS } from './src/data/initialData.ts';
import type { Patient, Bed, PersonalTask, HistoriaClinicaPediatrica } from './src/types/index.ts';
import {
  resolveCanonicalPresenceKey,
  normalizePresenceToken,
  isPresenceRecordOnline,
  type UserPresenceRecord,
} from './src/utils/userPresence.ts';
import { buildSeasonalWebManifest } from './src/utils/seasonalAppIcon.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createHttpServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: 'text/plain', limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure Service Worker scope and caching headers for offline installation
app.use((req, res, next) => {
  if (req.url === '/sw.js' || req.url === '/registerSW.js' || req.url.includes('workbox')) {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

// Local Data Persistence Setup
const DATA_DIR = path.join(__dirname, 'data_store');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'db.json');

interface MaintenanceState {
  enabled: boolean;
  message: string;
  updatedAt: string;
}

interface AmbientSoundState {
  enabled: boolean;
  intensity: number;
  updatedAt: string;
  updatedBy?: string;
}

interface PanelControlState {
  seasonalTheme?: string;
  autoVenezuelaMode?: boolean;
  autoNightShiftMode?: boolean;
  seasonalOverlayConfig?: Record<string, any>;
  ambientSound?: AmbientSoundState;
  maintenanceMode?: MaintenanceState;
  darkMode?: string | boolean;
  adminMasterPassword?: string;
  adminMasterPasswordUpdatedAt?: string;
  updatedAt: string;
  updatedBy?: string;
}

interface DbSchema {
  patients: Patient[];
  beds: Bed[];
  tasks: PersonalTask[];
  historias: HistoriaClinicaPediatrica[];
  maintenance?: MaintenanceState;
  ambientSound?: AmbientSoundState;
  panelControl?: PanelControlState;
  userPresence?: Record<string, UserPresenceRecord>;
}

const DEFAULT_MAINTENANCE: MaintenanceState = {
  enabled: false,
  message: 'Página en mantenimiento, por favor espere que el desarrollador repare el sistema, gracias por su paciencia :)',
  updatedAt: new Date().toISOString()
};

const DEFAULT_AMBIENT_SOUND: AmbientSoundState = {
  enabled: true,
  intensity: 0.45,
  updatedAt: new Date().toISOString(),
  updatedBy: 'Administrador'
};

const DEFAULT_PANEL_CONTROL: PanelControlState = {
  seasonalTheme: 'navidad',
  autoVenezuelaMode: false,
  autoNightShiftMode: true,
  ambientSound: DEFAULT_AMBIENT_SOUND,
  maintenanceMode: DEFAULT_MAINTENANCE,
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistema'
};

function nextMonotonicIso(prevIso?: string): string {
  const nowMs = Date.now();
  const prevMs = prevIso ? Date.parse(prevIso) : 0;
  const nextMs = Number.isFinite(prevMs) && prevMs >= nowMs ? prevMs + 1 : nowMs;
  return new Date(nextMs).toISOString();
}

function loadDb(): DbSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      const maintenance = parsed.maintenance || DEFAULT_MAINTENANCE;
      const ambientSound = parsed.ambientSound || DEFAULT_AMBIENT_SOUND;
      const panelControl: PanelControlState = {
        ...DEFAULT_PANEL_CONTROL,
        ...(parsed.panelControl && typeof parsed.panelControl === 'object' ? parsed.panelControl : {}),
        ambientSound: parsed.panelControl?.ambientSound || ambientSound,
        maintenanceMode: parsed.panelControl?.maintenanceMode || maintenance,
      };
      return {
        ...parsed,
        maintenance,
        ambientSound,
        panelControl,
        userPresence:
          parsed.userPresence && typeof parsed.userPresence === 'object' ? parsed.userPresence : {},
      };
    }
  } catch (err) {
    console.error('Error reading db.json, initializing defaults:', err);
  }

  const initialDb: DbSchema = {
    patients: INITIAL_PATIENTS,
    beds: INITIAL_BEDS,
    tasks: INITIAL_TASKS,
    historias: [],
    maintenance: DEFAULT_MAINTENANCE,
    ambientSound: DEFAULT_AMBIENT_SOUND,
    panelControl: DEFAULT_PANEL_CONTROL,
    userPresence: {}
  };

  saveDb(initialDb);
  return initialDb;
}

function saveDb(data: DbSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

let db = loadDb();

// Server-Sent Events (SSE) Clients for Real-time Multi-device Sync
let sseClients: express.Response[] = [];

function writeSseEvent(client: express.Response, type: string, payload: any) {
  const data = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  client.write(`data: ${data}\n\n`);
}

function broadcastChange(type: string, payload: any) {
  const aliveClients: express.Response[] = [];
  for (const client of sseClients) {
    try {
      writeSseEvent(client, type, payload);
      aliveClients.push(client);
    } catch {
      // Drop disconnected SSE client
    }
  }
  sseClients = aliveClients;
}

// API Routes

// SSE Real-time Endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  // Immediately push authoritative global UI/style/sound/maintenance snapshots on connect
  try {
    if (db.panelControl) {
      writeSseEvent(res, 'PANEL_CONTROL_UPDATED', db.panelControl);
    }
    if (db.ambientSound) {
      writeSseEvent(res, 'AMBIENT_SOUND_UPDATED', db.ambientSound);
    }
    if (db.maintenance) {
      writeSseEvent(res, 'MAINTENANCE_UPDATED', db.maintenance);
    }
    writeSseEvent(res, 'PRESENCE_UPDATED', getNormalizedPresenceSnapshot());
  } catch {
    // Ignore early disconnect
  }

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(c => c !== res);
  });
});

// Deduplicate existing patient evolutions on server start
if (Array.isArray(db.patients)) {
  db.patients.forEach(p => {
    if (Array.isArray(p.evolutions)) {
      const seen = new Set<string>();
      p.evolutions = p.evolutions.filter(e => {
        if (!e || !e.id || seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    }
  });
  saveDb(db);
}

// Patients API
app.get('/api/patients', (req, res) => {
  res.json(db.patients);
});

app.post('/api/patients', (req, res) => {
  const patientData: Patient = req.body;
  
  // Deduplicate evolutions within the incoming patient data
  if (Array.isArray(patientData.evolutions)) {
    const seenIds = new Set<string>();
    patientData.evolutions = patientData.evolutions.filter(ev => {
      if (!ev || !ev.id || seenIds.has(ev.id)) return false;
      seenIds.add(ev.id);
      return true;
    });
  }

  const existingIdx = db.patients.findIndex(p => p.id === patientData.id);

  if (existingIdx >= 0) {
    db.patients[existingIdx] = { ...patientData, updatedAt: new Date().toISOString() };
  } else {
    db.patients.unshift({ ...patientData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  saveDb(db);
  broadcastChange('PATIENTS_UPDATED', db.patients);
  res.json({ success: true, patient: patientData });
});

app.post('/api/patients/batch', (req, res) => {
  const { patients } = req.body;
  if (Array.isArray(patients)) {
    db.patients = patients;
    saveDb(db);
    broadcastChange('PATIENTS_UPDATED', db.patients);
  }
  res.json({ success: true });
});

app.delete('/api/patients/:id', (req, res) => {
  const { id } = req.params;
  db.patients = db.patients.filter(p => p.id !== id);
  // Free up bed if assigned
  db.beds = db.beds.map(b => b.patientId === id ? { ...b, status: 'free', patientId: undefined, patientName: undefined } : b);

  saveDb(db);
  broadcastChange('PATIENTS_UPDATED', db.patients);
  broadcastChange('BEDS_UPDATED', db.beds);
  res.json({ success: true });
});

// Bulk Database Restore
app.post('/api/database/restore', (req, res) => {
  const { patients, historias, beds, tasks } = req.body;
  if (Array.isArray(patients)) {
    // Deduplicate evolutions
    patients.forEach(p => {
      if (Array.isArray(p.evolutions)) {
        const seen = new Set<string>();
        p.evolutions = p.evolutions.filter((e: any) => {
          if (!e || !e.id || seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
      }
    });
    db.patients = patients;
  }
  if (Array.isArray(historias)) {
    db.historias = historias;
  }
  if (Array.isArray(beds)) {
    db.beds = beds;
  }
  if (Array.isArray(tasks)) {
    db.tasks = tasks;
  }
  saveDb(db);
  if (Array.isArray(patients)) broadcastChange('PATIENTS_UPDATED', db.patients);
  if (Array.isArray(historias)) broadcastChange('HISTORIAS_UPDATED', db.historias);
  if (Array.isArray(beds)) broadcastChange('BEDS_UPDATED', db.beds);
  if (Array.isArray(tasks)) broadcastChange('TASKS_UPDATED', db.tasks);
  res.json({ success: true, count: db.patients.length });
});

// Evolution Note Add
app.post('/api/patients/:id/evolution', (req, res) => {
  const { id } = req.params;
  const evolution = req.body; // MedicalEvolution object
  const patient = db.patients.find(p => p.id === id);

  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  patient.evolutions = patient.evolutions || [];
  
  // Guard against duplicate evolution entries by ID or exact date/time/doctor
  const alreadyExists = patient.evolutions.some(
    e => e.id === evolution.id || 
    (e.date === evolution.date && e.time === evolution.time && e.doctorName === evolution.doctorName && e.subjetivo === evolution.subjetivo)
  );

  if (!alreadyExists) {
    patient.evolutions.unshift(evolution);
    patient.updatedAt = new Date().toISOString();
    saveDb(db);
    broadcastChange('PATIENTS_UPDATED', db.patients);
  }
  
  res.json({ success: true, patient });
});

// Beds API
app.get('/api/beds', (req, res) => {
  res.json(db.beds);
});

app.put('/api/beds', (req, res) => {
  db.beds = req.body;
  saveDb(db);
  broadcastChange('BEDS_UPDATED', db.beds);
  res.json({ success: true, beds: db.beds });
});

// Historias Clínicas API
app.get('/api/historias', (req, res) => {
  res.json(db.historias);
});

app.get('/api/historias/:id', (req, res) => {
  const historia = db.historias.find(h => h.id === req.params.id);
  if (!historia) {
    return res.status(404).json({ error: 'Historia clínica no encontrada' });
  }
  res.json(historia);
});

app.post('/api/historias', (req, res) => {
  const historia: HistoriaClinicaPediatrica = req.body;
  const existingIdx = db.historias.findIndex(h => h.id === historia.id);

  if (existingIdx >= 0) {
    db.historias[existingIdx] = { ...historia, updatedAt: new Date().toISOString() };
  } else {
    db.historias.unshift({ ...historia, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  saveDb(db);
  broadcastChange('HISTORIAS_UPDATED', db.historias);
  res.json({ success: true, historia });
});

// Tasks API
app.get('/api/tasks', (req, res) => {
  res.json(db.tasks);
});

app.post('/api/tasks', (req, res) => {
  db.tasks = req.body;
  saveDb(db);
  broadcastChange('TASKS_UPDATED', db.tasks);
  res.json({ success: true, tasks: db.tasks });
});

// File Upload (Base64 or Document link)
app.post('/api/upload', (req, res) => {
  const { title, fileType, fileName, dataUrl, uploadedBy, patientId } = req.body;

  const newDoc = {
    id: 'doc-' + Date.now(),
    title: title || fileName,
    fileType: fileType || 'pdf',
    dataUrl,
    fileName,
    fileSize: `${(dataUrl.length / 1024 / 1024).toFixed(2)} MB`,
    uploadedAt: new Date().toISOString(),
    uploadedBy: uploadedBy || 'Médico'
  };

  if (patientId) {
    const patient = db.patients.find(p => p.id === patientId);
    if (patient) {
      patient.documents = patient.documents || [];
      patient.documents.unshift(newDoc);
      saveDb(db);
      broadcastChange('PATIENTS_UPDATED', db.patients);
    }
  }

  res.json({ success: true, document: newDoc });
});

// Global Maintenance Mode API
app.get('/api/maintenance', (req, res) => {
  res.json(db.maintenance || DEFAULT_MAINTENANCE);
});

app.post('/api/maintenance', (req, res) => {
  const { enabled, message } = req.body || {};
  const updatedAt = nextMonotonicIso(db.maintenance?.updatedAt);
  db.maintenance = {
    enabled: Boolean(enabled),
    message: typeof message === 'string' && message.trim()
      ? message.trim()
      : DEFAULT_MAINTENANCE.message,
    updatedAt
  };
  db.panelControl = {
    ...(db.panelControl || DEFAULT_PANEL_CONTROL),
    maintenanceMode: db.maintenance,
    updatedAt: nextMonotonicIso(db.panelControl?.updatedAt),
  };
  saveDb(db);
  broadcastChange('MAINTENANCE_UPDATED', db.maintenance);
  broadcastChange('PANEL_CONTROL_UPDATED', db.panelControl);
  res.json({ success: true, maintenance: db.maintenance });
});

// Global Ambient Sound API
app.get('/api/ambient-sound', (req, res) => {
  res.json(db.ambientSound || DEFAULT_AMBIENT_SOUND);
});

app.post('/api/ambient-sound', (req, res) => {
  const { enabled, intensity, updatedBy } = req.body || {};
  const parsedIntensity = Number(intensity);
  const updatedAt = nextMonotonicIso(db.ambientSound?.updatedAt);
  db.ambientSound = {
    enabled: Boolean(enabled),
    intensity: Number.isFinite(parsedIntensity) ? Math.min(1, Math.max(0.05, parsedIntensity)) : 0.4,
    updatedAt,
    updatedBy: updatedBy ? String(updatedBy) : 'Administrador'
  };
  db.panelControl = {
    ...(db.panelControl || DEFAULT_PANEL_CONTROL),
    ambientSound: db.ambientSound,
    updatedAt: nextMonotonicIso(db.panelControl?.updatedAt),
    updatedBy: db.ambientSound.updatedBy,
  };
  saveDb(db);
  broadcastChange('AMBIENT_SOUND_UPDATED', db.ambientSound);
  broadcastChange('PANEL_CONTROL_UPDATED', db.panelControl);
  res.json({ success: true, ambientSound: db.ambientSound });
});

// Global Panel Control (Visual Styles, VE Auto Calendar, Falling Icons, Ambient Sound) API
app.get('/api/panel-control', (req, res) => {
  res.json(db.panelControl || DEFAULT_PANEL_CONTROL);
});

app.post('/api/panel-control', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const prev = db.panelControl || DEFAULT_PANEL_CONTROL;
  const updatedAt = nextMonotonicIso(prev.updatedAt);

  let nextAmbientSound = prev.ambientSound || db.ambientSound || DEFAULT_AMBIENT_SOUND;
  if (body.ambientSound && typeof body.ambientSound === 'object') {
    const parsedInt = Number(body.ambientSound.intensity);
    nextAmbientSound = {
      enabled: Boolean(body.ambientSound.enabled),
      intensity: Number.isFinite(parsedInt) ? Math.min(1, Math.max(0.05, parsedInt)) : nextAmbientSound.intensity,
      updatedAt: nextMonotonicIso(db.ambientSound?.updatedAt),
      updatedBy: body.ambientSound.updatedBy ? String(body.ambientSound.updatedBy) : (body.updatedBy ? String(body.updatedBy) : 'Administrador'),
    };
    db.ambientSound = nextAmbientSound;
  }

  let nextMaintenance = prev.maintenanceMode || db.maintenance || DEFAULT_MAINTENANCE;
  if (body.maintenanceMode && typeof body.maintenanceMode === 'object') {
    nextMaintenance = {
      enabled: Boolean(body.maintenanceMode.enabled),
      message: typeof body.maintenanceMode.message === 'string' && body.maintenanceMode.message.trim()
        ? body.maintenanceMode.message.trim()
        : DEFAULT_MAINTENANCE.message,
      updatedAt: nextMonotonicIso(db.maintenance?.updatedAt),
    };
    db.maintenance = nextMaintenance;
  }

  db.panelControl = {
    ...prev,
    ...(typeof body.seasonalTheme === 'string' ? { seasonalTheme: body.seasonalTheme } : {}),
    ...(typeof body.autoVenezuelaMode === 'boolean' ? { autoVenezuelaMode: body.autoVenezuelaMode } : {}),
    ...(typeof body.autoNightShiftMode === 'boolean' ? { autoNightShiftMode: body.autoNightShiftMode } : {}),
    ...(body.seasonalOverlayConfig && typeof body.seasonalOverlayConfig === 'object'
      ? { seasonalOverlayConfig: body.seasonalOverlayConfig }
      : {}),
    ...(body.darkMode !== undefined ? { darkMode: body.darkMode } : {}),
    ...(typeof body.adminMasterPassword === 'string' && body.adminMasterPassword.trim().length >= 4
      ? {
          adminMasterPassword: body.adminMasterPassword.trim(),
          adminMasterPasswordUpdatedAt:
            typeof body.adminMasterPasswordUpdatedAt === 'string' && body.adminMasterPasswordUpdatedAt.trim()
              ? body.adminMasterPasswordUpdatedAt.trim()
              : updatedAt,
        }
      : {}),
    ambientSound: nextAmbientSound,
    maintenanceMode: nextMaintenance,
    updatedAt,
    updatedBy: body.updatedBy ? String(body.updatedBy) : 'Administrador',
  };

  saveDb(db);
  broadcastChange('PANEL_CONTROL_UPDATED', db.panelControl);
  if (body.ambientSound && typeof body.ambientSound === 'object') {
    broadcastChange('AMBIENT_SOUND_UPDATED', db.ambientSound);
  }
  if (body.maintenanceMode && typeof body.maintenanceMode === 'object') {
    broadcastChange('MAINTENANCE_UPDATED', db.maintenance);
  }
  res.json({ success: true, panelControl: db.panelControl });
});

// Real-time User Presence & Last Sign-In Tracking API
function parseBeaconOrJsonBody(body: any): Record<string, any> {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof body === 'object' ? body : {};
}

function getNormalizedPresenceSnapshot(): Record<string, UserPresenceRecord> {
  const nowMs = Date.now();
  const source = db.userPresence && typeof db.userPresence === 'object' ? db.userPresence : {};
  const result: Record<string, UserPresenceRecord> = {};
  for (const [k, rec] of Object.entries(source)) {
    if (!rec || typeof rec !== 'object') continue;
    result[k] = {
      ...rec,
      isOnline: isPresenceRecordOnline(rec, nowMs),
    };
  }
  return result;
}

function findMatchingPresenceKeys(
  store: Record<string, UserPresenceRecord>,
  input: { profileId?: string; username?: string; email?: string; isAdmin?: boolean }
): string[] {
  const pid = String(input.profileId || '').trim();
  const uname = normalizePresenceToken(input.username);
  const email = normalizePresenceToken(input.email);
  const matches: string[] = [];

  for (const [k, rec] of Object.entries(store)) {
    if (!rec) continue;
    const matchId = Boolean(pid && (rec.profileId === pid || k === `id:${pid}`));
    const matchUser = Boolean(uname && (normalizePresenceToken(rec.username) === uname || k === `user:${uname}`));
    const matchEmail = Boolean(email && (normalizePresenceToken(rec.email) === email || k === `email:${email}`));
    const matchAdmin = Boolean(input.isAdmin && uname === 'admin' && (rec.isAdmin || k === 'user:admin'));
    if (matchId || matchUser || matchEmail || matchAdmin) {
      matches.push(k);
    }
  }
  return matches;
}

app.get('/api/presence', (req, res) => {
  res.json(getNormalizedPresenceSnapshot());
});

app.post('/api/presence/heartbeat', (req, res) => {
  const body = parseBeaconOrJsonBody(req.body);
  const profileId = body.profileId ? String(body.profileId).trim() : undefined;
  const username = body.username ? String(body.username).trim() : undefined;
  const email = body.email ? String(body.email).trim() : undefined;
  const fullName = body.fullName ? String(body.fullName).trim() : undefined;
  const isAdmin = Boolean(body.isAdmin);
  const eventType = body.event === 'login' ? 'login' : 'heartbeat';

  const store = (db.userPresence = db.userPresence || {});
  const canonicalKey = resolveCanonicalPresenceKey({ profileId, username, email, isAdmin });
  if (canonicalKey === 'unknown') {
    return res.status(400).json({ error: 'Missing user identity' });
  }

  const matchedKeys = findMatchingPresenceKeys(store, { profileId, username, email, isAdmin });
  const existing =
    store[canonicalKey] ||
    (matchedKeys.length > 0 ? store[matchedKeys[0]] : undefined);

  const nowIso = new Date().toISOString();
  const nextRecord: UserPresenceRecord = {
    key: canonicalKey,
    profileId: profileId || existing?.profileId,
    username: username || existing?.username,
    email: email || existing?.email,
    fullName: fullName || existing?.fullName,
    isAdmin: isAdmin || existing?.isAdmin,
    isOnline: true,
    lastLoginAt: eventType === 'login' || !existing?.lastLoginAt ? nowIso : existing.lastLoginAt,
    lastSeenAt: nowIso,
    updatedAt: nowIso,
  };

  for (const oldKey of matchedKeys) {
    if (oldKey !== canonicalKey && profileId && oldKey !== 'user:admin') {
      delete store[oldKey];
    }
  }
  store[canonicalKey] = nextRecord;
  saveDb(db);

  const snapshot = getNormalizedPresenceSnapshot();
  broadcastChange('PRESENCE_UPDATED', snapshot);
  res.json({ success: true, record: nextRecord, presence: snapshot });
});

app.post('/api/presence/logout', (req, res) => {
  const body = parseBeaconOrJsonBody(req.body);
  const profileId = body.profileId ? String(body.profileId).trim() : undefined;
  const username = body.username ? String(body.username).trim() : undefined;
  const email = body.email ? String(body.email).trim() : undefined;
  const isAdmin = Boolean(body.isAdmin);

  const store = (db.userPresence = db.userPresence || {});
  const canonicalKey = resolveCanonicalPresenceKey({ profileId, username, email, isAdmin });
  const matchedKeys = findMatchingPresenceKeys(store, { profileId, username, email, isAdmin });
  const targetKeys = Array.from(new Set([...matchedKeys, ...(canonicalKey !== 'unknown' ? [canonicalKey] : [])]));

  const nowIso = new Date().toISOString();
  for (const key of targetKeys) {
    const prev = store[key];
    if (prev) {
      store[key] = {
        ...prev,
        isOnline: false,
        lastSeenAt: nowIso,
        updatedAt: nowIso,
      };
    } else if (key !== 'unknown') {
      store[key] = {
        key,
        profileId,
        username,
        email,
        isAdmin,
        isOnline: false,
        lastLoginAt: nowIso,
        lastSeenAt: nowIso,
        updatedAt: nowIso,
      };
    }
  }

  saveDb(db);
  const snapshot = getNormalizedPresenceSnapshot();
  broadcastChange('PRESENCE_UPDATED', snapshot);
  res.json({ success: true, presence: snapshot });
});

// AI Pediatric Referral Generator Endpoint (/api/gemini/referencia)
app.post('/api/gemini/referencia', async (req, res) => {
  try {
    const {
      servicioReferido,
      motivoUsuario,
      patientName,
      medicalHistoryNumber,
      age,
      gender,
      weightKg,
      admissionDate,
      bedNumber,
      area,
      estanciaHosp,
      vitalSigns,
      examenFisico,
      diagnoses,
      treatment,
      latestSubjetivo,
      latestObjetivo,
      enfermedadActual,
      doctorName
    } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ aiGenerated: false, reason: 'missing_api_key' });
    }

    const { GoogleGenAI, ThinkingLevel, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Eres un Médico Pediatra Adjunto del Hospital Materno Infantil Comandante Supremo "Hugo Chávez Frías" (Servicio de Pediatría y Puericultura - Hospitalización).
Redacta el contenido clínico formal y profesional para una REFERENCIA MÉDICA PARA ${String(servicioReferido || 'ESPECIALIDAD').toUpperCase()}.

DATOS REALES DEL PACIENTE:
- Nombre: ${patientName || 'Paciente Pediátrico'}
- Historia Clínica N°: ${medicalHistoryNumber || '---'}
- Edad: ${age || '---'}
- Sexo: ${gender || '---'}
- Peso Actual: ${weightKg || '---'}
- Fecha de Ingreso: ${admissionDate || '---'} (Estancia: ${estanciaHosp || '---'})
- Servicio / Cama: ${area || 'Hospitalización Pediátrica'} (Cama ${bedNumber || '---'})
- Motivo indicado por el médico para la referencia a ${servicioReferido}: ${motivoUsuario || 'Valoración especializada y conducta terapéutica conjunta'}
- Enfermedad actual / Antecedentes de ingreso: ${enfermedadActual || '---'}
- Última evolución Subjetivo: ${latestSubjetivo || '---'}
- Última evolución Objetivo: ${latestObjetivo || '---'}
- Signos Vitales actuales: FC: ${vitalSigns?.fc || '---'}, FR: ${vitalSigns?.fr || '---'}, Temp: ${vitalSigns?.temp || '---'}, TA: ${vitalSigns?.ta || '---'}, SatO2: ${vitalSigns?.so2 || '---'}
- Examen Físico registrado: ${JSON.stringify(examenFisico || {})}
- Diagnósticos actuales: ${Array.isArray(diagnoses) ? diagnoses.join('; ') : (diagnoses || '---')}
- Tratamiento actual: ${treatment || 'Sintomático'}
- Médico que refiere: ${doctorName || 'Dr. Brayan Stiven Guerrero Silva'}

Genera un JSON estructurado con lenguaje médico pediátrico venezolano impecable:
1. "motivoReferencia": Párrafo formal de 3 a 5 líneas explicando por qué se solicita valoración especializada por el servicio de ${servicioReferido}, integrando la edad del paciente, sus diagnósticos principales, el tratamiento cumplido e INCLUYENDO OBLIGATORIAMENTE de manera explícita y textual el motivo indicado por el médico ("${motivoUsuario || 'valoración y conducta'}"). No omitas ni resumas el motivo ingresado por el médico.
2. "enfermedadActualEvolucion": Párrafo clínico detallado que integre la fecha/contexto de ingreso, cuadro clínico, tratamiento intrahospitalario recibido (con dosis y días cumplidos si están disponibles) y la evolución clínica actual.
3. "examenFisicoPertinente": Objeto con 6 campos concisos y clínicos:
   - "general"
   - "pielFaneras"
   - "orlCuello"
   - "cardiopulmonarAbdomen"
   - "extremidades"
   - "neurologico"
4. "planConductaSolicitada": Arreglo de 3 o 4 puntos concretos solicitados al servicio de ${servicioReferido}, incluyendo explícitamente el punto relacionado al motivo indicado ("${motivoUsuario || 'valoración integral'}").`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        motivoReferencia: { type: Type.STRING },
        enfermedadActualEvolucion: { type: Type.STRING },
        examenFisicoPertinente: {
          type: Type.OBJECT,
          properties: {
            general: { type: Type.STRING },
            pielFaneras: { type: Type.STRING },
            orlCuello: { type: Type.STRING },
            cardiopulmonarAbdomen: { type: Type.STRING },
            extremidades: { type: Type.STRING },
            neurologico: { type: Type.STRING },
          },
          required: [
            'general',
            'pielFaneras',
            'orlCuello',
            'cardiopulmonarAbdomen',
            'extremidades',
            'neurologico',
          ],
        },
        planConductaSolicitada: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        'motivoReferencia',
        'enfermedadActualEvolucion',
        'examenFisicoPertinente',
        'planConductaSolicitada',
      ],
    };

    const attempts = [
      { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, timeoutMs: 6000 },
      { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, timeoutMs: 7000 },
    ];

    let lastError: any = null;
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      const attemptController = new AbortController();
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            try {
              attemptController.abort();
            } catch {
              // ignore abort error
            }
            reject(new Error(`timeout_${attempt.model}_${attempt.timeoutMs}ms`));
          }, attempt.timeoutMs);
        });

        const response = await Promise.race([
          ai.models.generateContent({
            model: attempt.model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema,
              thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
              abortSignal: attemptController.signal,
            },
          }),
          timeoutPromise,
        ]);

        const rawText = (response.text || '')
          .trim()
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        if (!rawText) {
          throw new Error('empty_model_response');
        }

        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === 'object') {
          return res.json({ aiGenerated: true, model: attempt.model, data: parsed });
        }
        throw new Error('invalid_json_structure');
      } catch (attemptErr: any) {
        lastError = attemptErr;
        console.warn(
          `[Gemini Referencia] Attempt ${i + 1} (${attempt.model}) failed:`,
          attemptErr?.message || attemptErr
        );
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    }

    console.warn('Gemini referral generation fallback triggered:', lastError?.message || lastError);
    return res.status(200).json({
      aiGenerated: false,
      reason: lastError?.message || 'ai_error',
    });
  } catch (err: any) {
    console.warn('Gemini referral generation fallback triggered:', err?.message || err);
    return res.status(200).json({
      aiGenerated: false,
      reason: err?.message || 'ai_error',
    });
  }
});

// Dynamic Seasonal PWA Manifest & Browser Tab Favicons (served before Vite/static middleware)
function resolveActiveServerSeasonalStyle(req: express.Request): string {
  const queryStyle = typeof req.query.style === 'string' ? req.query.style : undefined;
  return queryStyle || db.panelControl?.seasonalTheme || 'navidad';
}

function handleDynamicManifestRequest(req: express.Request, res: express.Response) {
  const activeStyle = resolveActiveServerSeasonalStyle(req);
  const manifest = buildSeasonalWebManifest(activeStyle);
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(manifest);
}

function resolveStaticTabIconFile(): string {
  const officialIconPath = path.join(__dirname, 'public', 'assets', 'aistudio', 'Icono_86bb4792.png');
  if (fs.existsSync(officialIconPath)) return officialIconPath;
  const publicIconPath = path.join(__dirname, 'public', 'Icon', 'Icono.png');
  if (fs.existsSync(publicIconPath)) return publicIconPath;
  return path.join(__dirname, 'public', 'pwa-192x192.png');
}

function handleStaticIconoRequest(_req: express.Request, res: express.Response) {
  const iconFile = resolveStaticTabIconFile();
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(iconFile);
}

app.use('/Icon', express.static(path.join(__dirname, 'Icon')));
app.get('/Icon/Icono.png', handleStaticIconoRequest);
app.get('/api/manifest.webmanifest', handleDynamicManifestRequest);
app.get('/manifest.webmanifest', handleDynamicManifestRequest);
app.get('/favicon.ico', handleStaticIconoRequest);
app.get('/favicon.png', handleStaticIconoRequest);
app.get('/api/favicon.png', handleStaticIconoRequest);
app.get('/apple-touch-icon.png', handleStaticIconoRequest);

// Vite Integration in Development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        maxAge: '1y',
        immutable: true,
        fallthrough: true,
      })
    );
    app.use('/assets/*', (_req, res) => {
      res.status(404).type('text/plain').send('Asset not found');
    });
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      if (
        req.path.startsWith('/api/') ||
        /\.(js|mjs|css|map|png|jpg|jpeg|svg|ico|webp|woff2?|json)$/i.test(req.path)
      ) {
        return res.status(404).type('text/plain').send('Not found');
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🏥 Hospital Materno Infantil Clinical Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
