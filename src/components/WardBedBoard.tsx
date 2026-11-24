import React, { useState, useEffect } from 'react';
import { Patient, Bed, HospitalArea, MedicalEvolution, PatientDocument, HistoriaClinicaPediatrica, OrdenMedicaItem, BalanceHidricoData } from '../types';
import { calculateHospitalizationTime, generateWhatsAppReport, uploadDocumentApi } from '../services/api';
import { getPediatricNormalVitals, NormalVitalSigns } from '../utils/pediatricVitals';
import { EXAMEN_FISICO_NORMAL, getPediatricNormalPhysicalExam } from '../data/initialData';
import { ResumenEgresoDocument } from './ResumenEgresoDocument';
import { ResumenEvolutivoDocument } from './ResumenEvolutivoDocument';
import { OrdenesMedicasDocument } from './OrdenesMedicasDocument';
import { ConstanciaHospitalizacionDocument } from './ConstanciaHospitalizacionDocument';
import { NotaRecibimientoDocument } from './NotaRecibimientoDocument';
import { ReferenciaMedicaDocument } from './ReferenciaMedicaDocument';
import {
  BulkNotasRecibimientoPrintView,
  BulkOrdenesMedicasPrintView,
  resolveUpdatedOrdersForPatient
} from './BulkClinicalDocumentsPrintView';
import { 
  Clock, Stethoscope, FileText, Upload, Eye, Share2, 
  Search, Plus, Activity, MessageSquare, Download, ArrowRightLeft,
  UserCheck, AlertCircle, FileCheck, Layers, CheckCircle, CheckCircle2, X,
  Wind, Droplets, Printer, Edit2, AlertTriangle, Scale, FlaskConical,
  Zap, ShieldAlert, BedDouble, RefreshCw, ShieldCheck, Trash2, ClipboardList,
  Sparkles, ChevronDown, ChevronUp, ChevronsUpDown, RotateCcw, CalendarDays
} from 'lucide-react';
import { MedicalEvolutionDocument } from './MedicalEvolutionDocument';
import { BulkEvolutionsPrintView } from './BulkEvolutionsPrintView';
import { PatientEvolutionsSummarySection, PatientEvolutionsCalendarTab } from './PatientEvolutionsCalendarView';
import { PWAInstallButton } from './PWAInstallButton';
import { isTutorialDemoId } from '../utils/tutorialDemoData';
import { getDraftFromIDB, saveDraftToIDB, removeDraftFromIDB, saveAutoBackupSnapshot } from '../services/storage';
import { useSeasonalTheme } from '../utils/seasonalTheme';
import {
  DxNode,
  TxNode,
  DoseUnit,
  DoseIntervalHours,
  DOSE_INTERVAL_OPTIONS,
  calculateDiasCumplidos,
  calculateTotalActiveDays,
  parseTreatmentText,
  serializeTreatmentNodes,
  markTreatmentCulminado,
  readministrarTreatment,
  buildSeparatedDiagnosisSuggestions,
  buildMedicationNameSuggestions,
  normalizeTreatmentDisplay,
  SINTOMATICO_LABEL
} from '../utils/evolutionFormHelpers';
import {
  sanitizeNumericDecimal,
  sanitizeBloodPressure,
} from '../utils/clinicalInputSanitizers';

interface Props {
  patients: Patient[];
  beds: Bed[];
  historias: HistoriaClinicaPediatrica[];
  isVisitor?: boolean;
  isAdmin?: boolean;
  currentDoctorName?: string;
  onUpdatePatients: (patients: Patient[]) => void;
  onUpdateBeds: (beds: Bed[]) => void;
  onAddEvolution: (patientId: string, evolution: MedicalEvolution, beforePatientSnapshot?: Patient) => void;
  onOpenHistoriaClinicaForm: (patient?: Patient, defaultTab?: 'editor' | 'preview', openPrint?: boolean, specificHistoriaId?: string) => void;
  onOpenLaboratorios?: (patientId: string) => void;
}

// Iconos amigables para cada área asistencial
const getAreaFriendlyIcon = (area: HospitalArea, className: string = "w-4 h-4") => {
  switch (area) {
    case 'Traumashock':
      return <Zap className={`${className} text-rose-500`} />;
    case 'ÁREA DE OBSERVACIÓN':
      return <Activity className={`${className} text-amber-500`} />;
    case 'Respiratorio':
      return <Wind className={`${className} text-sky-400`} />;
    case 'Aislamiento':
      return <ShieldAlert className={`${className} text-purple-400`} />;
    case 'Hospitalización':
      return <BedDouble className={`${className} text-teal-400`} />;
    default:
      return <BedDouble className={className} />;
  }
};

// Paleta de colores distintivos y visuales para cada área asistencial
export const getAreaColorTheme = (area: HospitalArea) => {
  switch (area) {
    case 'Traumashock':
      return {
        cardBorder: 'border-rose-400 dark:border-rose-800/80',
        cardBg: 'bg-rose-500/[0.04] dark:bg-rose-950/20',
        headerBorder: 'border-rose-200 dark:border-rose-800/60',
        iconBg: 'bg-rose-500/20 dark:bg-rose-900/40 border border-rose-500/40 text-rose-500',
        titleText: 'text-rose-700 dark:text-rose-300',
        badge: 'text-rose-700 dark:text-rose-300 bg-rose-100/90 dark:bg-rose-950/90 border border-rose-300 dark:border-rose-800',
        filterActive: 'bg-rose-600 text-white shadow-md shadow-rose-900/40',
        emptyBg: 'bg-rose-500/[0.03] dark:bg-rose-950/15 border-rose-200 dark:border-rose-900/40 text-rose-500/70'
      };
    case 'ÁREA DE OBSERVACIÓN':
      return {
        cardBorder: 'border-amber-400 dark:border-amber-800/80',
        cardBg: 'bg-amber-500/[0.04] dark:bg-amber-950/20',
        headerBorder: 'border-amber-200 dark:border-amber-800/60',
        iconBg: 'bg-amber-500/20 dark:bg-amber-900/40 border border-amber-500/40 text-amber-500',
        titleText: 'text-amber-800 dark:text-amber-300',
        badge: 'text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/90 border border-amber-300 dark:border-amber-800',
        filterActive: 'bg-amber-600 text-white shadow-md shadow-amber-900/40',
        emptyBg: 'bg-amber-500/[0.03] dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/40 text-amber-500/70'
      };
    case 'Respiratorio':
      return {
        cardBorder: 'border-sky-400 dark:border-sky-800/80',
        cardBg: 'bg-sky-500/[0.04] dark:bg-sky-950/20',
        headerBorder: 'border-sky-200 dark:border-sky-800/60',
        iconBg: 'bg-sky-500/20 dark:bg-sky-900/40 border border-sky-500/40 text-sky-400',
        titleText: 'text-sky-800 dark:text-sky-300',
        badge: 'text-sky-800 dark:text-sky-300 bg-sky-100/90 dark:bg-sky-950/90 border border-sky-300 dark:border-sky-800',
        filterActive: 'bg-sky-600 text-white shadow-md shadow-sky-900/40',
        emptyBg: 'bg-sky-500/[0.03] dark:bg-sky-950/15 border-sky-200 dark:border-sky-900/40 text-sky-500/70'
      };
    case 'Aislamiento':
      return {
        cardBorder: 'border-purple-400 dark:border-purple-800/80',
        cardBg: 'bg-purple-500/[0.04] dark:bg-purple-950/20',
        headerBorder: 'border-purple-200 dark:border-purple-800/60',
        iconBg: 'bg-purple-500/20 dark:bg-purple-900/40 border border-purple-500/40 text-purple-400',
        titleText: 'text-purple-800 dark:text-purple-300',
        badge: 'text-purple-800 dark:text-purple-300 bg-purple-100/90 dark:bg-purple-950/90 border border-purple-300 dark:border-purple-800',
        filterActive: 'bg-purple-600 text-white shadow-md shadow-purple-900/40',
        emptyBg: 'bg-purple-500/[0.03] dark:bg-purple-950/15 border-purple-200 dark:border-purple-900/40 text-purple-500/70'
      };
    case 'Hospitalización':
    default:
      return {
        cardBorder: 'border-teal-400 dark:border-teal-800/80',
        cardBg: 'bg-teal-500/[0.04] dark:bg-teal-950/20',
        headerBorder: 'border-teal-200 dark:border-teal-800/60',
        iconBg: 'bg-teal-500/20 dark:bg-teal-900/40 border border-teal-500/40 text-teal-400',
        titleText: 'text-teal-800 dark:text-teal-300',
        badge: 'text-teal-800 dark:text-teal-300 bg-teal-100/90 dark:bg-teal-950/90 border border-teal-300 dark:border-teal-800',
        filterActive: 'bg-teal-600 text-white shadow-md shadow-teal-900/40',
        emptyBg: 'bg-teal-500/[0.03] dark:bg-teal-950/15 border-teal-200 dark:border-teal-900/40 text-teal-500/70'
      };
  }
};

interface DxBranch {
  mainNode: DxNode;
  children: DxNode[];
}

function getDxBranches(nodes: DxNode[]): DxBranch[] {
  const branches: DxBranch[] = [];
  let currentBranch: DxBranch | null = null;

  nodes.forEach(node => {
    if (node.level === 1) {
      if (currentBranch) {
        branches.push(currentBranch);
      }
      currentBranch = { mainNode: node, children: [] };
    } else {
      if (currentBranch) {
        currentBranch.children.push(node);
      } else {
        currentBranch = {
          mainNode: { id: 'fallback-' + Math.random().toString(36).substring(2, 6), numberStr: '1.', text: '', level: 1 },
          children: [node]
        };
      }
    }
  });
  if (currentBranch) branches.push(currentBranch);
  return branches;
}

function rebuildNodesFromBranches(branches: DxBranch[]): DxNode[] {
  const result: DxNode[] = [];
  branches.forEach(branch => {
    result.push(branch.mainNode);
    branch.children.forEach(child => result.push(child));
  });
  return result;
}

function parseDiagnosesText(text: string): DxNode[] {
  if (!text) return [{ id: 'd-1', numberStr: '1.', text: '', level: 1 }];
  const lines = text.split(/\r?\n/);
  const nodes: DxNode[] = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^([\d\.]+)\s*(.*)$/);
    if (match) {
      const numStr = match[1].replace(/\.$/, '');
      const content = match[2] || '';
      const dots = (numStr.match(/\./g) || []).length;
      nodes.push({
        id: `dx-node-${idx}-${numStr}`,
        numberStr: numStr,
        text: content,
        level: dots === 0 ? 1 : dots === 1 ? 2 : 3
      });
    } else {
      nodes.push({
        id: `dx-node-${idx}-main`,
        numberStr: String(nodes.length + 1),
        text: trimmed,
        level: 1
      });
    }
  });
  return nodes.length > 0 ? nodes : [{ id: 'd-1', numberStr: '1.', text: '', level: 1 }];
}

function serializeDiagnosesNodes(nodes: DxNode[]): string {
  let mainCount = 0;
  let subCount = 0;
  let subSubCount = 0;

  const lines: string[] = [];
  nodes.forEach((node) => {
    if (node.level === 1) {
      mainCount++;
      subCount = 0;
      subSubCount = 0;
      node.numberStr = `${mainCount}.`;
      lines.push(`${node.numberStr} ${node.text}`);
    } else if (node.level === 2) {
      subCount++;
      subSubCount = 0;
      node.numberStr = `${mainCount}.${subCount}`;
      lines.push(`   ${node.numberStr} ${node.text}`);
    } else {
      subSubCount++;
      node.numberStr = `${mainCount}.${subCount}.${subSubCount}`;
      lines.push(`     ${node.numberStr} ${node.text}`);
    }
  });
  return lines.join('\n');
}

export const WardBedBoard: React.FC<Props> = ({
  patients,
  beds,
  historias,
  isVisitor = false,
  isAdmin = false,
  currentDoctorName,
  onUpdatePatients,
  onUpdateBeds,
  onAddEvolution,
  onOpenHistoriaClinicaForm,
  onOpenLaboratorios
}) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const resolveDefaultDoctorName = (): string => {
    if (currentDoctorName && currentDoctorName.trim() && currentDoctorName !== 'Administrador') {
      return currentDoctorName.trim();
    }
    if (typeof window !== 'undefined') {
      const savedName = (localStorage.getItem('hmi_user_name') || '').trim();
      const savedGender = localStorage.getItem('hmi_user_gender') === 'F' ? 'F' : 'M';
      if (savedName && savedName !== 'Administrador') {
        if (/^(dr\.?|dra\.?)\s+/i.test(savedName)) return savedName;
        return `${savedGender === 'F' ? 'Dra.' : 'Dr.'} ${savedName}`;
      }
    }
    return 'Dr. Brayan';
  };
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<HospitalArea | 'ALL'>('ALL');
  const [evolutionStatusFilter, setEvolutionStatusFilter] = useState<'ALL' | 'EVOLVED' | 'NOT_EVOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedPatientIds, setExpandedPatientIds] = useState<Record<string, boolean>>({});
  const [showMobileEvoFilterMenu, setShowMobileEvoFilterMenu] = useState<boolean>(false);
  const [showMobileAreaFilterMenu, setShowMobileAreaFilterMenu] = useState<boolean>(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const togglePatientExpanded = (patientId: string, forceExpanded?: boolean) => {
    setExpandedPatientIds(prev => ({
      ...prev,
      [patientId]: forceExpanded !== undefined ? forceExpanded : !prev[patientId],
    }));
  };

  // Support interactive tutorial steps that highlight patient actions or bulk download panel
  useEffect(() => {
    const onExpandFirst = () => {
      const firstHospitalized = patients.find(p => p.status === 'hospitalized');
      if (firstHospitalized) {
        setSelectedAreaFilter('ALL');
        setEvolutionStatusFilter('ALL');
        setSearchQuery('');
        setExpandedPatientIds(prev => ({ ...prev, [firstHospitalized.id]: true }));
      }
    };
    const onToggleBulkDownload = (ev: Event) => {
      const custom = ev as CustomEvent<{ open?: boolean }>;
      setShowBulkDownloadMenu(custom.detail?.open !== false);
    };
    window.addEventListener('hmi_tutorial_expand_first_patient', onExpandFirst);
    window.addEventListener('hmi_tutorial_toggle_bulk_download', onToggleBulkDownload);
    return () => {
      window.removeEventListener('hmi_tutorial_expand_first_patient', onExpandFirst);
      window.removeEventListener('hmi_tutorial_toggle_bulk_download', onToggleBulkDownload);
    };
  }, [patients]);
  
  // Modals
  const [showEvolutionModal, setShowEvolutionModal] = useState<boolean>(false);
  const [showDocUploadModal, setShowDocUploadModal] = useState<boolean>(false);
  const [showViewProfileModal, setShowViewProfileModal] = useState<boolean>(false);
  const [profileActiveTab, setProfileActiveTab] = useState<'expediente' | 'calendario_evoluciones'>('expediente');
  const [calendarInitialDate, setCalendarInitialDate] = useState<string | null>(null);

  useEffect(() => {
    if (showViewProfileModal) {
      setProfileActiveTab('expediente');
      setCalendarInitialDate(null);
    }
  }, [showViewProfileModal]);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<0 | 1>(0);
  const [showChangeAreaModal, setShowChangeAreaModal] = useState<boolean>(false);
  const [showDischargeModal, setShowDischargeModal] = useState<boolean>(false);
  const [showResumenEgresoDoc, setShowResumenEgresoDoc] = useState<boolean>(false);
  const [showResumenEvolutivoDoc, setShowResumenEvolutivoDoc] = useState<boolean>(false);
  const [showConstanciaHospitalizacionDoc, setShowConstanciaHospitalizacionDoc] = useState<boolean>(false);
  const [showNotaRecibimientoDoc, setShowNotaRecibimientoDoc] = useState<boolean>(false);
  const [showReferenciaDoc, setShowReferenciaDoc] = useState<boolean>(false);
  const [resumenEvolutivoPatient, setResumenEvolutivoPatient] = useState<Patient | null>(null);
  const [activePrintEvolution, setActivePrintEvolution] = useState<MedicalEvolution | null>(null);
  const [activeDownloadEvolution, setActiveDownloadEvolution] = useState<MedicalEvolution | null>(null);
  const [showBulkDownloadMenu, setShowBulkDownloadMenu] = useState<boolean>(false);
  const [activePrintAllEvolutions, setActivePrintAllEvolutions] = useState<boolean>(false);
  const [activeDownloadAllEvolutions, setActiveDownloadAllEvolutions] = useState<boolean>(false);
  const [activePrintAllNotasRecibimiento, setActivePrintAllNotasRecibimiento] = useState<boolean>(false);
  const [activeDownloadAllNotasRecibimiento, setActiveDownloadAllNotasRecibimiento] = useState<boolean>(false);
  const [activePrintAllOrdenesMedicas, setActivePrintAllOrdenesMedicas] = useState<boolean>(false);
  const [activeDownloadAllOrdenesMedicas, setActiveDownloadAllOrdenesMedicas] = useState<boolean>(false);
  const [confirmCulminadoTxId, setConfirmCulminadoTxId] = useState<string | null>(null);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const [todayEvolution, setTodayEvolution] = useState<MedicalEvolution | null>(null);
  
  // Keep selectedPatient in sync with latest patients data
  useEffect(() => {
    if (selectedPatient) {
      const refreshed = patients.find(p => p.id === selectedPatient.id);
      if (refreshed && refreshed !== selectedPatient) {
        setSelectedPatient(refreshed);
      }
    }
  }, [patients, selectedPatient]);
  // Órdenes Médicas state
  const [showOrdenesMedicasModal, setShowOrdenesMedicasModal] = useState<boolean>(false);
  const [activeEvolutionOrders, setActiveEvolutionOrders] = useState<OrdenMedicaItem[] | undefined>(undefined);
  const [activeOrdenesFecha, setActiveOrdenesFecha] = useState<string | undefined>(undefined);
  const [activeOrdenesHora, setActiveOrdenesHora] = useState<string | undefined>(undefined);
  const [activeOrdenesPeso, setActiveOrdenesPeso] = useState<string | undefined>(undefined);
  const [viewOrdenesEvolution, setViewOrdenesEvolution] = useState<{ patient: Patient; evolution: MedicalEvolution } | null>(null);
  
  const [previewDoc, setPreviewDoc] = useState<PatientDocument | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [whatsAppText, setWhatsAppText] = useState<string>('');
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // New Evolution Form State
  const [doctorName, setDoctorName] = useState<string>(() => resolveDefaultDoctorName());

  useEffect(() => {
    setDoctorName(resolveDefaultDoctorName());
  }, [currentDoctorName]);
  const [evolutionNote, setEvolutionNote] = useState<string>('');
  const [interrogatory24h, setInterrogatory24h] = useState<string>('');
  const [medicalRoundSummary, setMedicalRoundSummary] = useState<string>('');
  const [comentariosPlan, setComentariosPlan] = useState<string>('');
  const [diagnosesModified, setDiagnosesModified] = useState<string>('');
  const [dxNodes, setDxNodes] = useState<DxNode[]>(() => parseDiagnosesText(diagnosesModified));

  useEffect(() => {
    // Only re-parse if diagnosesModified changed externally (e.g. reload from patient file) and does not match current state
    if (serializeDiagnosesNodes(dxNodes) !== diagnosesModified) {
      setDxNodes(parseDiagnosesText(diagnosesModified));
    }
  }, [diagnosesModified]);

  const [treatmentModified, setTreatmentModified] = useState<string>('');
  const [txNodes, setTxNodes] = useState<TxNode[]>(() => parseTreatmentText(treatmentModified));

  useEffect(() => {
    const serializedCurrent = serializeTreatmentNodes(txNodes);
    const normalizedIncoming = normalizeTreatmentDisplay(treatmentModified);
    if (serializedCurrent !== normalizedIncoming) {
      setTxNodes(parseTreatmentText(treatmentModified));
    }
  }, [treatmentModified]);

  const handleUpdateDxNodeText = (index: number, text: string) => {
    const next = [...dxNodes];
    next[index].text = text;
    setDxNodes(next);
    const serialized = serializeDiagnosesNodes(next);
    setDiagnosesModified(serialized);
    liveSyncEvolutionToPatient(serialized, treatmentModified);
  };

  const handleAddDxMain = () => {
    const next = [...dxNodes, { id: 'dx-' + Math.random().toString(36).substring(2, 6), numberStr: '', text: '', level: 1 }];
    setDxNodes(next);
    const serialized = serializeDiagnosesNodes(next);
    setDiagnosesModified(serialized);
    liveSyncEvolutionToPatient(serialized, treatmentModified);
  };

  const handleAddDxSub = (index: number) => {
    const next = [...dxNodes];
    next.splice(index + 1, 0, { id: 'dx-' + Math.random().toString(36).substring(2, 6), numberStr: '', text: '', level: 2 });
    setDxNodes(next);
    const serialized = serializeDiagnosesNodes(next);
    setDiagnosesModified(serialized);
    liveSyncEvolutionToPatient(serialized, treatmentModified);
  };

  const handleAddDxSubSub = (index: number) => {
    const next = [...dxNodes];
    next.splice(index + 1, 0, { id: 'dx-' + Math.random().toString(36).substring(2, 6), numberStr: '', text: '', level: 3 });
    setDxNodes(next);
    const serialized = serializeDiagnosesNodes(next);
    setDiagnosesModified(serialized);
    liveSyncEvolutionToPatient(serialized, treatmentModified);
  };

  const handleDeleteDxNode = (index: number) => {
    if (dxNodes.length === 1) {
      const next = [{ id: 'd-1', numberStr: '1.', text: '', level: 1 }];
      setDxNodes(next);
      const serialized = serializeDiagnosesNodes(next);
      setDiagnosesModified(serialized);
      liveSyncEvolutionToPatient(serialized, treatmentModified);
      return;
    }
    const next = dxNodes.filter((_, i) => i !== index);
    setDxNodes(next);
    const serialized = serializeDiagnosesNodes(next);
    setDiagnosesModified(serialized);
    liveSyncEvolutionToPatient(serialized, treatmentModified);
  };

  const [focusedDxIndex, setFocusedDxIndex] = useState<number | null>(null);
  const [focusedTxIndex, setFocusedTxIndex] = useState<number | null>(null);

  const { mainSuggestions: mainDiagnosisSuggestions, subSuggestions: subDiagnosisSuggestions } = React.useMemo(
    () => buildSeparatedDiagnosisSuggestions(patients, historias),
    [patients, historias]
  );

  const allTreatmentSuggestions = React.useMemo(
    () => buildMedicationNameSuggestions(patients, historias),
    [patients, historias]
  );

  const handleUpdateTxNodeText = (index: number, text: string) => {
    const next = txNodes.map((n, i) => (i === index ? { ...n, text } : n));
    setTxNodes(next);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const handleUpdateTxNodeStartDate = (index: number, startDate: string) => {
    const next = txNodes.map((n, i) => {
      if (i !== index) return n;
      return {
        ...n,
        startDate,
        culminadoDias: n.isCulminado
          ? calculateTotalActiveDays({ startDate, priorCompletedDays: n.priorCompletedDays })
          : n.culminadoDias
      };
    });
    setTxNodes(next);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const handleUpdateTxNodeDoseValue = (index: number, doseValue: string) => {
    const next = txNodes.map((n, i) => (i === index ? { ...n, doseValue } : n));
    setTxNodes(next);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const handleUpdateTxNodeDoseUnit = (index: number, doseUnit: DoseUnit) => {
    const next = txNodes.map((n, i) => (i === index ? { ...n, doseUnit } : n));
    setTxNodes(next);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const [isEditingDxTx, setIsEditingDxTx] = useState<boolean>(false);

  const handleMoveDxBranch = (fromBranchIndex: number, toBranchIndex: number) => {
    if (fromBranchIndex === toBranchIndex) return;
    const branches = getDxBranches(dxNodes);
    if (fromBranchIndex < 0 || fromBranchIndex >= branches.length) return;
    if (toBranchIndex < 0 || toBranchIndex >= branches.length) return;

    const [movedBranch] = branches.splice(fromBranchIndex, 1);
    branches.splice(toBranchIndex, 0, movedBranch);

    const reorderedNodes = rebuildNodesFromBranches(branches);
    setDxNodes(reorderedNodes);
    const serialized = serializeDiagnosesNodes(reorderedNodes);
    setDiagnosesModified(serialized);
    liveSyncEvolutionToPatient(serialized, treatmentModified);
  };

  const handleToggleTxNoCumplido = (index: number) => {
    const next = txNodes.map((n, i) => (i === index ? { ...n, isNoCumplido: !n.isNoCumplido } : n));
    setTxNodes(next);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const handleUpdateTxNoCumplidoMotivo = (index: number, motivo: string) => {
    const next = txNodes.map((n, i) => (i === index ? { ...n, noCumplidoMotivo: motivo } : n));
    setTxNodes(next);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const handleUpdateTxNodeDoseBasis = (index: number, doseBasis: 'dosis' | 'día') => {
    const next = txNodes.map((n, i) =>
      i === index
        ? {
            ...n,
            doseBasis,
            doseIntervalHours: doseBasis === 'dosis' ? (n.doseIntervalHours || '6') : n.doseIntervalHours
          }
        : n
    );
    setTxNodes(next);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const handleUpdateTxNodeDoseIntervalHours = (index: number, doseIntervalHours: DoseIntervalHours) => {
    const next = txNodes.map((n, i) => (i === index ? { ...n, doseIntervalHours } : n));
    setTxNodes(next);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const handleConfirmTxCulminado = (index: number) => {
    const next = markTreatmentCulminado(txNodes, index);
    setTxNodes(next);
    setConfirmCulminadoTxId(null);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const handleReadministrarTx = (index: number) => {
    const next = readministrarTreatment(txNodes, index);
    setTxNodes(next);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const handleAddTxMain = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newNode: TxNode = {
      id: 'tx-' + Math.random().toString(36).substring(2, 6),
      numberStr: '',
      text: '',
      startDate: todayStr,
      doseValue: '',
      doseUnit: 'mg',
      doseBasis: 'día',
      doseIntervalHours: '6',
      isNoCumplido: false,
      noCumplidoMotivo: '',
      isCulminado: false
    };
    const activeNodes = txNodes.filter(n => !n.isCulminado);
    const culminatedNodes = txNodes.filter(n => Boolean(n.isCulminado));
    const next = [...activeNodes, newNode, ...culminatedNodes].map((n, idx) => ({
      ...n,
      numberStr: `${idx + 1}.`
    }));
    setTxNodes(next);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const handleDeleteTxNode = (index: number) => {
    const todayStr = new Date().toISOString().split('T')[0];
    setConfirmCulminadoTxId(null);
    if (txNodes.length === 1) {
      const next: TxNode[] = [
        {
          id: 't-1',
          numberStr: '1.',
          text: '',
          startDate: todayStr,
          doseValue: '',
          doseUnit: 'mg',
          doseBasis: 'día',
          doseIntervalHours: '6',
          isNoCumplido: false,
          noCumplidoMotivo: '',
          isCulminado: false
        }
      ];
      setTxNodes(next);
      const serialized = serializeTreatmentNodes(next);
      setTreatmentModified(serialized);
      liveSyncEvolutionToPatient(diagnosesModified, serialized);
      return;
    }
    const next = txNodes.filter((_, i) => i !== index).map((n, idx) => ({
      ...n,
      numberStr: `${idx + 1}.`
    }));
    setTxNodes(next);
    const serialized = serializeTreatmentNodes(next);
    setTreatmentModified(serialized);
    liveSyncEvolutionToPatient(diagnosesModified, serialized);
  };

  const [subjetivo, setSubjetivo] = useState<string>('');
  const [objetivo, setObjetivo] = useState<string>('');
  
  const [examenFisico, setExamenFisico] = useState({
    piel: '',
    cabezaOjos: '',
    oidosOtoscopia: '',
    narizOrofaringe: '',
    cuello: '',
    toraxCP: '',
    cardiovascular: '',
    abdomen: '',
    genitourinario: '',
    extremidades: '',
    neurologico: ''
  });
  
  // Controls which exam field is being edited
  const [editingExamField, setEditingExamField] = useState<string | null>(null);

  // Vital Signs inputs (empty default so age-based normal values show as placeholder)
  const [vitalTemp, setVitalTemp] = useState<string>('');
  const [vitalFC, setVitalFC] = useState<string>('');
  const [vitalFR, setVitalFR] = useState<string>('');
  const [vitalTA, setVitalTA] = useState<string>('');
  const [vitalSO2, setVitalSO2] = useState<string>('');
  const [vitalPeso, setVitalPeso] = useState<string>('');

  // Oxygen support state
  const [hasOxygenSupport, setHasOxygenSupport] = useState<boolean>(false);
  const [o2Type, setO2Type] = useState<'Seco' | 'Húmedo'>('Húmedo');
  const [o2FlowLmin, setO2FlowLmin] = useState<string>('3');
  const [o2Modalidad, setO2Modalidad] = useState<string>('Cánula nasal');
  const [o2FiO2, setO2FiO2] = useState<string>('21');
  const [o2So2, setO2So2] = useState<string>('98');

  // Categorized File Upload State
  const [uploadCategory, setUploadCategory] = useState<'Laboratorios' | 'Rx' | 'Eco' | 'Referencia'>('Laboratorios');
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadFileType, setUploadFileType] = useState<'pdf' | 'image' | 'doc'>('pdf');
  const [uploadDataUrl, setUploadDataUrl] = useState<string>('');
  const [uploadFileName, setUploadFileName] = useState<string>('');

  // Change Area State
  const [newTargetArea, setNewTargetArea] = useState<HospitalArea>('Hospitalización');

  // Balance Hídrico Pediátrico State
  const [reqBalanceHidrico, setReqBalanceHidrico] = useState<boolean>(false);
  const [ingeridosCc, setIngeridosCc] = useState<string>('');
  const [excretadosCc, setExcretadosCc] = useState<string>('');

  const numericWeightForBH = parseFloat(vitalPeso.replace(/[^\d.]/g, '')) || selectedPatient?.weightKg || 10;
  const numericIngeridos = parseFloat(ingeridosCc) || 0;
  const numericExcretados = parseFloat(excretadosCc) || 0;
  const liveBalanceNeto = numericIngeridos - numericExcretados;
  
  const liveSC = numericWeightForBH < 10 
    ? ((numericWeightForBH * 4) + 9) / 100 
    : ((numericWeightForBH * 4) + 7) / (numericWeightForBH + 90);

  const liveFU = numericWeightForBH > 0 ? (numericExcretados / (numericWeightForBH * 24)) : 0;
  const liveBalanceM2 = liveSC > 0 ? (liveBalanceNeto / liveSC) : 0;
  
  let liveInterpFU = 'Euurico (Normal)';
  if (numericExcretados > 0) {
    if (liveFU < 0.5) liveInterpFU = 'Oliguria Severa';
    else if (liveFU < 1.0) liveInterpFU = 'Oliguria';
    else if (liveFU > 3.5) liveInterpFU = 'Poliuria';
  }

  // PERSISTENCIA: Draft saving for Evolution (con debounce para guardar al instante sin trabar el teclado)
  useEffect(() => {
    if (!selectedPatient || !showEvolutionModal) return;
    
    const handler = setTimeout(() => {
      const draft = {
        doctorName,
        evolutionNote,
        interrogatory24h,
        medicalRoundSummary,
        comentariosPlan,
        diagnosesModified,
        treatmentModified,
        subjetivo,
        objetivo,
        examenFisico,
        vitalTemp,
        vitalFC,
        vitalFR,
        vitalTA,
        vitalSO2,
        vitalPeso,
        reqBalanceHidrico,
        ingeridosCc,
        excretadosCc,
        hasOxygenSupport,
        o2Type,
        o2FlowLmin,
        o2Modalidad,
        o2FiO2,
        o2So2,
        activeEvolutionOrders,
        activeOrdenesFecha,
        activeOrdenesHora,
        activeOrdenesPeso,
        timestamp: Date.now()
      };
      
      saveDraftToIDB(`evolution_draft_${selectedPatient.id}`, draft);
    }, 300);

    return () => clearTimeout(handler);
  }, [
    selectedPatient, showEvolutionModal, doctorName, evolutionNote, interrogatory24h, 
    medicalRoundSummary, comentariosPlan, diagnosesModified, treatmentModified, subjetivo, objetivo, 
    examenFisico, vitalTemp, vitalFC, vitalFR, vitalTA, vitalSO2, vitalPeso, 
    reqBalanceHidrico, ingeridosCc, excretadosCc, hasOxygenSupport, o2Type, 
    o2FlowLmin, o2Modalidad, o2FiO2, o2So2, activeEvolutionOrders, activeOrdenesFecha, 
    activeOrdenesHora, activeOrdenesPeso
  ]);
  
  // PERSISTENCIA: Draft saving for Medical Orders (con debounce)
  useEffect(() => {
    if (!selectedPatient || !activeEvolutionOrders) return;
    
    const handler = setTimeout(() => {
      saveDraftToIDB(`patient_orders_${selectedPatient.id}`, {
        orders: activeEvolutionOrders,
        fecha: activeOrdenesFecha,
        hora: activeOrdenesHora,
        peso: activeOrdenesPeso,
        updatedAt: new Date().toISOString()
      });
    }, 300);

    return () => clearTimeout(handler);
  }, [selectedPatient, activeEvolutionOrders, activeOrdenesFecha, activeOrdenesHora, activeOrdenesPeso]);

  const persistPatientVitals = (overrides?: Partial<{
    temp: string;
    fc: string;
    fr: string;
    ta: string;
    so2: string;
    peso: string;
    hasOxygenSupport: boolean;
    o2Type: 'Seco' | 'Húmedo';
    o2FlowLmin: string;
    o2Modalidad: string;
    fio2: string;
    o2So2: string;
  }>) => {
    if (!selectedPatient) return;
    const vitalsData = {
      temp: overrides?.temp !== undefined ? overrides.temp : vitalTemp,
      fc: overrides?.fc !== undefined ? overrides.fc : vitalFC,
      fr: overrides?.fr !== undefined ? overrides.fr : vitalFR,
      ta: overrides?.ta !== undefined ? overrides.ta : vitalTA,
      so2: overrides?.so2 !== undefined ? overrides.so2 : vitalSO2,
      peso: overrides?.peso !== undefined ? overrides.peso : vitalPeso,
      hasOxygenSupport: overrides?.hasOxygenSupport !== undefined ? overrides.hasOxygenSupport : hasOxygenSupport,
      o2Type: overrides?.o2Type !== undefined ? overrides.o2Type : o2Type,
      o2FlowLmin: overrides?.o2FlowLmin !== undefined ? overrides.o2FlowLmin : o2FlowLmin,
      o2Modalidad: overrides?.o2Modalidad !== undefined ? overrides.o2Modalidad : o2Modalidad,
      fio2: overrides?.fio2 !== undefined ? overrides.fio2 : o2FiO2,
      o2So2: overrides?.o2So2 !== undefined ? overrides.o2So2 : o2So2,
      updatedAt: new Date().toISOString()
    };
    saveDraftToIDB(`patient_vitals_${selectedPatient.id}`, vitalsData);
  };

  const handleVitalChange = (field: 'temp' | 'fc' | 'fr' | 'ta' | 'so2' | 'peso', val: string) => {
    const sanitized = field === 'ta' ? sanitizeBloodPressure(val) : sanitizeNumericDecimal(val);
    if (field === 'temp') {
      setVitalTemp(sanitized);
      persistPatientVitals({ temp: sanitized });
    } else if (field === 'fc') {
      setVitalFC(sanitized);
      persistPatientVitals({ fc: sanitized });
    } else if (field === 'fr') {
      setVitalFR(sanitized);
      persistPatientVitals({ fr: sanitized });
    } else if (field === 'ta') {
      setVitalTA(sanitized);
      persistPatientVitals({ ta: sanitized });
    } else if (field === 'so2') {
      setVitalSO2(sanitized);
      persistPatientVitals({ so2: sanitized });
    } else if (field === 'peso') {
      handleVitalPesoChange(sanitized);
      persistPatientVitals({ peso: sanitized });
    }
  };

  const handleVitalPesoChange = (val: string) => {
    const sanitized = sanitizeNumericDecimal(val);
    setVitalPeso(sanitized);
    const formattedPeso = sanitized.trim() 
      ? `${sanitized} kg`
      : (selectedPatient ? `${selectedPatient.weightKg} kg` : '');
    setActiveOrdenesPeso(formattedPeso);
  };



  // Helper to format patient diagnoses into readable text matching table, modal, and evolution sheet
  const getPatientDiagnosesAsText = (p: Patient): string => {
    if (!p || !p.diagnoses || p.diagnoses.length === 0) return '';
    const lines: string[] = [];
    p.diagnoses.forEach(d => {
      if (d.title) lines.push(d.title);
      if (d.subDiagnoses && d.subDiagnoses.length > 0) {
        d.subDiagnoses.forEach(sd => {
          if (sd) lines.push(sd);
        });
      }
    });
    return lines.join('\n');
  };

  // Open Medical Orders Modal for a specific patient, completely isolated
  const handleOpenOrdenesModal = (patient: Patient) => {
    setSelectedPatient(patient);

    const latestEv = patient.evolutions && patient.evolutions.length > 0 ? patient.evolutions[0] : null;
    const latestWithOrders = patient.evolutions?.find(e => e.ordenesMedicas && e.ordenesMedicas.length > 0);

    const resolvedOrders = patient.ordenesMedicas && patient.ordenesMedicas.length > 0
      ? patient.ordenesMedicas
      : (latestWithOrders?.ordenesMedicas && latestWithOrders.ordenesMedicas.length > 0
        ? latestWithOrders.ordenesMedicas
        : undefined);

    setActiveEvolutionOrders(resolvedOrders);
    setActiveOrdenesFecha(patient.ordenesFecha || latestEv?.ordenesFecha || undefined);
    setActiveOrdenesHora(patient.ordenesHora || latestEv?.ordenesHora || undefined);
    setActiveOrdenesPeso(patient.ordenesPeso || latestEv?.ordenesPeso || (patient.weightKg ? `${patient.weightKg} kg` : undefined));

    // Only hydrate from IndexedDB if patient has no orders yet or local cache is strictly newer
    getDraftFromIDB<any>(`patient_orders_${patient.id}`).then(cached => {
      if (cached && cached.orders && cached.orders.length > 0) {
        const patientUpdatedMs = patient.updatedAt ? Date.parse(patient.updatedAt) : 0;
        const cacheUpdatedMs = cached.updatedAt ? Date.parse(cached.updatedAt) : 0;
        const shouldUseCache =
          !resolvedOrders ||
          resolvedOrders.length === 0 ||
          (cacheUpdatedMs > 0 && patientUpdatedMs > 0 && cacheUpdatedMs > patientUpdatedMs);
        if (shouldUseCache) {
          setActiveEvolutionOrders(cached.orders);
          if (cached.fecha) setActiveOrdenesFecha(cached.fecha);
          if (cached.hora) setActiveOrdenesHora(cached.hora);
          if (cached.peso) setActiveOrdenesPeso(cached.peso);
        }
      }
    });

    setShowOrdenesMedicasModal(true);
  };

  // Save Medical Orders specifically for one patient, updating state, IndexedDB and server
  const handleSavePatientOrders = (
    patientId: string,
    orders: OrdenMedicaItem[],
    f?: string,
    h?: string,
    p?: string
  ) => {
    const updatedPatients = patients.map(pt => {
      if (pt.id === patientId) {
        let updatedEvs = pt.evolutions;
        if (updatedEvs && updatedEvs.length > 0) {
          const firstEv = {
            ...updatedEvs[0],
            ordenesMedicas: orders,
            ordenesFecha: f || updatedEvs[0].ordenesFecha,
            ordenesHora: h || updatedEvs[0].ordenesHora,
            ordenesPeso: p || updatedEvs[0].ordenesPeso
          };
          updatedEvs = [firstEv, ...updatedEvs.slice(1)];
        }

        return {
          ...pt,
          ordenesMedicas: orders,
          ordenesFecha: f || pt.ordenesFecha,
          ordenesHora: h || pt.ordenesHora,
          ordenesPeso: p || pt.ordenesPeso,
          evolutions: updatedEvs,
          updatedAt: new Date().toISOString()
        };
      }
      return pt;
    });

    onUpdatePatients(updatedPatients);

    const targetPatient = updatedPatients.find(pt => pt.id === patientId);
    if (targetPatient && selectedPatient?.id === patientId) {
      setSelectedPatient(targetPatient);
      setActiveEvolutionOrders(orders);
      if (f) setActiveOrdenesFecha(f);
      if (h) setActiveOrdenesHora(h);
      if (p) {
        setActiveOrdenesPeso(p);
        setVitalPeso(p.replace(/kg/i, '').trim());
      }
    }

    // Persist in IndexedDB localForage for offline and emergency recovery
    saveDraftToIDB(`patient_orders_${patientId}`, {
      orders,
      fecha: f,
      hora: h,
      peso: p,
      updatedAt: new Date().toISOString()
    });
  };

  // Open Evolution Modal
  const handleOpenEvolutionModal = (patient: Patient) => {
    setSelectedPatient(patient);
    const hasO2 = patient.area === 'Respiratorio';
    
    // Start with null so button initially says Guardar Evolución until user clicks save
    setTodayEvolution(null);
    
    const applyVitalsData = (v: any) => {
      if (!v) return;
      if (v.temp) setVitalTemp(String(v.temp).replace(/[^\d.]/g, ''));
      if (v.fc) setVitalFC(String(v.fc).replace(/[^\d]/g, ''));
      if (v.fr) setVitalFR(String(v.fr).replace(/[^\d]/g, ''));
      if (v.ta) setVitalTA(String(v.ta).replace(/[^\d/]/g, ''));
      if (v.so2) setVitalSO2(String(v.so2).replace(/[^\d.]/g, ''));
      if (v.peso) {
        const cleanP = String(v.peso).replace(/kg/i, '').trim();
        setVitalPeso(cleanP);
        setActiveOrdenesPeso(`${cleanP} kg`);
      }
      if (v.hasOxygenSupport !== undefined) setHasOxygenSupport(Boolean(v.hasOxygenSupport));
      if (v.o2Type) setO2Type(v.o2Type);
      if (v.o2FlowLmin) setO2FlowLmin(String(v.o2FlowLmin));
      if (v.o2Modalidad) setO2Modalidad(String(v.o2Modalidad));
      if (v.fio2) setO2FiO2(String(v.fio2));
      if (v.o2So2) setO2So2(String(v.o2So2));
    };

    // Find historia if linked
    const historia = historias.find(h => h.id === patient.historiaClinicaId);
    // Find latest evolution if exists to preserve previous daily modifications
    const latestEv = patient.evolutions && patient.evolutions.length > 0 ? patient.evolutions[0] : null;
    const latestWithOrders = patient.evolutions?.find(e => e.ordenesMedicas && e.ordenesMedicas.length > 0);

    const resolvedOrders = patient.ordenesMedicas && patient.ordenesMedicas.length > 0
      ? patient.ordenesMedicas
      : (latestWithOrders?.ordenesMedicas && latestWithOrders.ordenesMedicas.length > 0
        ? latestWithOrders.ordenesMedicas
        : undefined);

    setActiveEvolutionOrders(resolvedOrders);
    setActiveOrdenesFecha(patient.ordenesFecha || latestEv?.ordenesFecha || undefined);
    setActiveOrdenesHora(patient.ordenesHora || latestEv?.ordenesHora || undefined);
    setActiveOrdenesPeso(patient.ordenesPeso || latestEv?.ordenesPeso || `${patient.weightKg} kg`);

    // Check if patient-specific saved orders exist in IndexedDB
    getDraftFromIDB<any>(`patient_orders_${patient.id}`).then(cachedOrders => {
      if (cachedOrders && cachedOrders.orders && cachedOrders.orders.length > 0) {
        setActiveEvolutionOrders(cachedOrders.orders);
        if (cachedOrders.fecha) setActiveOrdenesFecha(cachedOrders.fecha);
        if (cachedOrders.hora) setActiveOrdenesHora(cachedOrders.hora);
        if (cachedOrders.peso) setActiveOrdenesPeso(cachedOrders.peso);
      }
    });

    // Default population of specialist comments/plan
    const fallbackPlan = 'En revista médica con especialista de guardia el mismo decide.';
    setComentariosPlan(latestEv?.comentariosPlan || latestEv?.medicalRoundSummary || fallbackPlan);
    setMedicalRoundSummary(latestEv?.medicalRoundSummary || latestEv?.comentariosPlan || fallbackPlan);

    // Check for draft in IndexedDB localForage
    getDraftFromIDB<any>(`evolution_draft_${patient.id}`).then(draft => {
      if (draft) {
        setDoctorName(resolveDefaultDoctorName());
        setEvolutionNote(draft.evolutionNote || '');
        setInterrogatory24h(draft.interrogatory24h || '');
        setMedicalRoundSummary(draft.medicalRoundSummary || draft.comentariosPlan || fallbackPlan);
        setComentariosPlan(draft.comentariosPlan ? draft.comentariosPlan : (draft.medicalRoundSummary || fallbackPlan));

        // Prioridad absoluta: los diagnósticos y tratamiento de la ficha / importación JSON actual
        // tienen precedencia sobre borradores antiguos para no mostrar diagnósticos caducados.
        const currentPtDiagnoses = getPatientDiagnosesAsText(patient);
        const currentPtTreatment = patient.treatment || '';

        setDiagnosesModified(currentPtDiagnoses.trim() ? currentPtDiagnoses : (draft.diagnosesModified || ''));
        setTreatmentModified(currentPtTreatment.trim() ? currentPtTreatment : (draft.treatmentModified || ''));
        setSubjetivo(draft.subjetivo || '');
        setObjetivo(draft.objetivo || '');
        setExamenFisico(draft.examenFisico || EXAMEN_FISICO_NORMAL);
        if (draft.vitalTemp) setVitalTemp(draft.vitalTemp);
        if (draft.vitalFC) setVitalFC(draft.vitalFC);
        if (draft.vitalFR) setVitalFR(draft.vitalFR);
        if (draft.vitalTA) setVitalTA(draft.vitalTA);
        if (draft.vitalSO2) setVitalSO2(draft.vitalSO2);
        if (draft.vitalPeso) setVitalPeso(draft.vitalPeso);
        setReqBalanceHidrico(draft.reqBalanceHidrico || false);
        setIngeridosCc(draft.ingeridosCc || '');
        setExcretadosCc(draft.excretadosCc || '');
        if (draft.hasOxygenSupport !== undefined) setHasOxygenSupport(draft.hasOxygenSupport);
        if (draft.o2Type) setO2Type(draft.o2Type);
        if (draft.o2FlowLmin) setO2FlowLmin(draft.o2FlowLmin);
        if (draft.o2Modalidad) setO2Modalidad(draft.o2Modalidad);
        if (draft.o2FiO2) setO2FiO2(draft.o2FiO2);
        if (draft.o2So2) setO2So2(draft.o2So2);
        if (Array.isArray(draft.activeEvolutionOrders) && draft.activeEvolutionOrders.length > 0) {
          setActiveEvolutionOrders(draft.activeEvolutionOrders);
        }
        if (draft.activeOrdenesFecha) setActiveOrdenesFecha(draft.activeOrdenesFecha);
        if (draft.activeOrdenesHora) setActiveOrdenesHora(draft.activeOrdenesHora);
        if (draft.activeOrdenesPeso) setActiveOrdenesPeso(draft.activeOrdenesPeso);
      } else {
        // If no ongoing draft note exists, check if there are saved vital signs from prior evolution in IndexedDB
        getDraftFromIDB<any>(`patient_vitals_${patient.id}`).then(savedV => {
          if (savedV) {
            applyVitalsData(savedV);
          }
        });
      }
    });

    // Default doctor name from registered user
    setDoctorName(resolveDefaultDoctorName());

    // Initial clinical states based on request
    if (latestEv) {
      setSubjetivo(latestEv.subjetivo || 'Madre refiere mejoría clínica respecto a su ingreso. Niega emesis, diarrea, fiebre o dolor.');
      setObjetivo(latestEv.objetivo || '');
    } else {
      setSubjetivo('Madre refiere mejoría clínica respecto a su ingreso. Niega emesis, diarrea, fiebre o dolor.');
      
      const isLactante = patient.age.toLowerCase().includes('mes') || patient.age.toLowerCase().includes('día') || (patient.age.toLowerCase().includes('rn'));
      const patientType = isLactante ? 'lactante' : 'preescolar/escolar';
      const o2Text = hasO2 ? `con oxígeno a 3 L/min` : '(O₂ ambiente)';
      setObjetivo(`Paciente ${patientType} evaluado en RsCsGs, afebril, eupneico, activo, reactivo, tolerando vía oral y aire ambiente ${o2Text}.`);
    }

    const ageNormal = getPediatricNormalPhysicalExam(
      historia?.edad || patient.age,
      historia?.generoPatient || (patient.gender === 'F' ? 'niña' : 'niño')
    );

    if (latestEv && latestEv.examenFisico && Object.values(latestEv.examenFisico).some(v => v && v.trim() !== '' && v.trim() !== 'Normal')) {
      // Auto-populate from previous day's saved evolution if it has specific clinical content
      setExamenFisico({
        piel: latestEv.examenFisico.piel && latestEv.examenFisico.piel !== 'Normal' ? latestEv.examenFisico.piel : ageNormal.pielPaniculoFanerasFisico,
        cabezaOjos: latestEv.examenFisico.cabezaOjos && latestEv.examenFisico.cabezaOjos !== 'Normal' ? latestEv.examenFisico.cabezaOjos : `${ageNormal.cabezaFisico} ${ageNormal.ojosFisico}`,
        oidosOtoscopia: latestEv.examenFisico.oidosOtoscopia && latestEv.examenFisico.oidosOtoscopia !== 'Normal' ? latestEv.examenFisico.oidosOtoscopia : ageNormal.oidosFisico,
        narizOrofaringe: latestEv.examenFisico.narizOrofaringe && latestEv.examenFisico.narizOrofaringe !== 'Normal' ? latestEv.examenFisico.narizOrofaringe : `${ageNormal.rinofaringeFisico} ${ageNormal.bocaFisico}`,
        cuello: latestEv.examenFisico.cuello && latestEv.examenFisico.cuello !== 'Normal' ? latestEv.examenFisico.cuello : `${ageNormal.cuelloFisico} ${ageNormal.gangliosLinfaticosFisico}`,
        toraxCP: latestEv.examenFisico.toraxCP && latestEv.examenFisico.toraxCP !== 'Normal' ? latestEv.examenFisico.toraxCP : ageNormal.toraxPulmonesFisico,
        cardiovascular: latestEv.examenFisico.cardiovascular && latestEv.examenFisico.cardiovascular !== 'Normal' ? latestEv.examenFisico.cardiovascular : (historia?.cardiovascularFisico || ageNormal.cardiovascularFisico),
        abdomen: latestEv.examenFisico.abdomen && latestEv.examenFisico.abdomen !== 'Normal' ? latestEv.examenFisico.abdomen : ageNormal.abdomenFisico,
        genitourinario: latestEv.examenFisico.genitourinario && latestEv.examenFisico.genitourinario !== 'Normal' ? latestEv.examenFisico.genitourinario : `${ageNormal.urinarioFisico} ${ageNormal.genitalesFisico}`,
        extremidades: latestEv.examenFisico.extremidades && latestEv.examenFisico.extremidades !== 'Normal' ? latestEv.examenFisico.extremidades : ageNormal.huesosArticulacionesMuslosFisico,
        neurologico: latestEv.examenFisico.neurologico && latestEv.examenFisico.neurologico !== 'Normal' ? latestEv.examenFisico.neurologico : ageNormal.neurologicoPsiquicoFisico
      });
    } else if (historia) {
      // Default to exact Historia Clínica Pediátrica redactada values
      setExamenFisico({
        piel: historia.pielPaniculoFanerasFisico || ageNormal.pielPaniculoFanerasFisico,
        cabezaOjos: `${historia.cabezaFisico || ageNormal.cabezaFisico} ${historia.ojosFisico || ageNormal.ojosFisico}`,
        oidosOtoscopia: historia.oidosFisico || ageNormal.oidosFisico,
        narizOrofaringe: `${historia.rinofaringeFisico || ageNormal.rinofaringeFisico} ${historia.bocaFisico || ageNormal.bocaFisico}`,
        cuello: `${historia.cuelloFisico || ageNormal.cuelloFisico} ${historia.gangliosLinfaticosFisico || ageNormal.gangliosLinfaticosFisico}`,
        toraxCP: historia.toraxPulmonesFisico || ageNormal.toraxPulmonesFisico,
        cardiovascular: historia.cardiovascularFisico || ageNormal.cardiovascularFisico,
        abdomen: historia.abdomenFisico || ageNormal.abdomenFisico,
        genitourinario: `${historia.urinarioFisico || ageNormal.urinarioFisico} ${historia.genitalesFisico || ageNormal.genitalesFisico}`,
        extremidades: historia.huesosArticulacionesMuslosFisico || ageNormal.huesosArticulacionesMuslosFisico,
        neurologico: historia.neurologicoPsiquicoFisico || ageNormal.neurologicoPsiquicoFisico
      });
    } else {
      // Official reference physical exam texts from pediatric history according to patient age group
      setExamenFisico({
        piel: ageNormal.pielPaniculoFanerasFisico,
        cabezaOjos: `${ageNormal.cabezaFisico} ${ageNormal.ojosFisico}`,
        oidosOtoscopia: ageNormal.oidosFisico,
        narizOrofaringe: `${ageNormal.rinofaringeFisico} ${ageNormal.bocaFisico}`,
        cuello: `${ageNormal.cuelloFisico} ${ageNormal.gangliosLinfaticosFisico}`,
        toraxCP: ageNormal.toraxPulmonesFisico,
        cardiovascular: ageNormal.cardiovascularFisico,
        abdomen: ageNormal.abdomenFisico,
        genitourinario: `${ageNormal.urinarioFisico} ${ageNormal.genitalesFisico}`,
        extremidades: ageNormal.huesosArticulacionesMuslosFisico,
        neurologico: ageNormal.neurologicoPsiquicoFisico
      });
    }

    // Pre-populate vital signs from latest evolution if available so they are preserved for the next evolution
    if (latestEv && latestEv.vitalSigns) {
      applyVitalsData(latestEv.vitalSigns);
    } else {
      setVitalTemp('');
      setVitalFC('');
      setVitalFR('');
      setVitalTA('');
      setVitalSO2('');
      const initialPesoStr = patient.weightKg ? `${patient.weightKg}` : '';
      setVitalPeso(initialPesoStr.replace(/kg/i, '').trim());
      setHasOxygenSupport(hasO2);
      setO2Type('Húmedo');
      setO2FlowLmin('3');
      setO2Modalidad('Cánula nasal');
      setO2FiO2('21');
      setO2So2('98');
    }

    if (latestEv?.balanceHidrico?.enabled) {
      setReqBalanceHidrico(true);
      setIngeridosCc(latestEv.balanceHidrico.ingeridosCc ? `${latestEv.balanceHidrico.ingeridosCc}` : '');
      setExcretadosCc(latestEv.balanceHidrico.excretadosCc ? `${latestEv.balanceHidrico.excretadosCc}` : '');
    } else {
      setReqBalanceHidrico(false);
      setIngeridosCc('');
      setExcretadosCc('');
    }
    setEditingExamField(null);
    
    // Automatically load exact patient Diagnoses and Treatment into modal inputs
    setDiagnosesModified(getPatientDiagnosesAsText(patient));
    setTreatmentModified(patient.treatment || '');
    
    setShowEvolutionModal(true);
  };

  // Live synchronization: Real-time update of patient Diagnoses and Treatment as the user types
  const liveSyncEvolutionToPatient = (diagStr: string, treatStr: string) => {
    if (!selectedPatient) return;
    
    const lines = diagStr.split('\n').filter(l => l.trim().length > 0);
    const newDiagnoses = lines.map((line, idx) => ({
      id: selectedPatient.diagnoses?.[idx]?.id || `diag-${Date.now()}-${idx}`,
      title: line.trim()
    }));

    const updatedPatient: Patient = {
      ...selectedPatient,
      treatment: treatStr,
      diagnoses: newDiagnoses,
      updatedAt: new Date().toISOString()
    };

    const updatedPatients = patients.map(p => p.id === selectedPatient.id ? updatedPatient : p);
    onUpdatePatients(updatedPatients);
    setSelectedPatient(updatedPatient);
  };

  // Direct 2-step confirmed patient deletion
  const handleDeletePatientDirectly = async (patientId: string) => {
    const pt = patients.find(p => p.id === patientId);
    if (!pt) return;

    // Free any occupied bed assigned to this patient
    const updatedBeds = beds.map(b => 
      b.patientId === patientId 
        ? { ...b, status: 'free' as const, patientId: undefined, patientName: undefined, updatedAt: new Date().toISOString() }
        : b
    );
    onUpdateBeds(updatedBeds);

    // Remove patient from active list
    const updatedPatients = patients.filter(p => p.id !== patientId);
    onUpdatePatients(updatedPatients);

    // Clean up local drafts for this patient
    await removeDraftFromIDB(`evolution_draft_${patientId}`);
    await removeDraftFromIDB(`patient_orders_${patientId}`);
    await removeDraftFromIDB(`patient_vitals_${patientId}`);
    await removeDraftFromIDB(`historia_draft_${patientId}`);

    // Snapshot backup for safety
    await saveAutoBackupSnapshot({
      patients: updatedPatients,
      beds: updatedBeds,
      historias: historias,
      tasks: [],
      note: `Eliminación definitiva del paciente ${pt.lastName}, ${pt.firstName}`
    });

    setDeleteConfirmStep(0);
    setShowViewProfileModal(false);
    setSelectedPatient(null);
  };

  // Normal Vitals for current selected patient
  const currentNormalVitals: NormalVitalSigns = selectedPatient
    ? getPediatricNormalVitals(selectedPatient.age)
    : { temp: '36.8°C', fc: '105 bpm', fr: '24 rpm', ta: '95/60 mmHg', so2: '98%', ageCategory: 'Preescolar' };

  // Auto-refresh dynamic time ticker
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const areas: HospitalArea[] = ['Traumashock', 'ÁREA DE OBSERVACIÓN', 'Respiratorio', 'Aislamiento', 'Hospitalización'];

  const activePatients = patients.filter(p => p.status === 'hospitalized');

  const todayStr = new Date().toISOString().split('T')[0];
  const isPatientEvolucionadoHoy = (p: Patient) => {
    const hasTodayInList = Boolean(p.evolutions?.some(e => e.date === todayStr && e.evolvedInDay !== false));
    const hasTodayFlag = Boolean(p.evolucionadoHoy && p.ultimaEvolucionFecha === todayStr);
    return hasTodayInList || hasTodayFlag;
  };

  const matchesEvolutionFilter = (p: Patient) => {
    if (evolutionStatusFilter === 'EVOLVED') return isPatientEvolucionadoHoy(p);
    if (evolutionStatusFilter === 'NOT_EVOLVED') return !isPatientEvolucionadoHoy(p);
    return true;
  };

  const countEvolucionadosTotal = activePatients.filter(p => isPatientEvolucionadoHoy(p)).length;
  const countNoEvolucionadosTotal = activePatients.length - countEvolucionadosTotal;

  // Únicamente las evoluciones ya realizadas hoy que aparecen en "Evolucionados Hoy"
  const evolucionesYaHechasItems = (() => {
    const itemsList: Array<{ patient: Patient; evolution: MedicalEvolution }> = [];
    const seenPatientIds = new Set<string>();
    const evolvedTodayPatients = activePatients.filter(p => isPatientEvolucionadoHoy(p));

    evolvedTodayPatients.forEach(p => {
      if (!p || !p.id || seenPatientIds.has(p.id)) return;
      if (p.evolutions && p.evolutions.length > 0) {
        const sortedEvs = [...p.evolutions]
          .filter(Boolean)
          .sort((a, b) => {
            const aKey = `${a.date || ''}T${a.time || '00:00'}#${a.createdAt || ''}`;
            const bKey = `${b.date || ''}T${b.time || '00:00'}#${b.createdAt || ''}`;
            return bKey.localeCompare(aKey);
          });
        const todayEv =
          sortedEvs.find(e => e.date === todayStr && e.evolvedInDay !== false) || sortedEvs[0];
        if (todayEv) {
          seenPatientIds.add(p.id);
          itemsList.push({ patient: p, evolution: todayEv });
        }
      }
    });
    return itemsList;
  })();

  // Únicamente las órdenes médicas actualizadas de cada paciente hospitalizado
  const ordenesActualizadasItems = activePatients
    .map(p => resolveUpdatedOrdersForPatient(p, resolveDefaultDoctorName()))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const matchesSearch = (p: Patient) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    
    // Support for specific prefix searches (smart search)
    if (query.includes(':')) {
      const [prefix, val] = query.split(':').map(s => s.trim());
      if (!val) return true;

      switch (prefix) {
        case 'área':
        case 'area':
          return p.area.toLowerCase().includes(val);
        case 'edad':
          return p.age.toLowerCase().includes(val);
        case 'fecha':
          return p.admissionDate.includes(val);
        case 'cédula':
        case 'cedula':
        case 'ci':
        case 'hc':
          return p.medicalHistoryNumber.toLowerCase().includes(val);
        case 'nombre':
          return (p.firstName + ' ' + p.lastName).toLowerCase().includes(val);
        case 'estancia':
        case 'tiempo':
          const time = calculateHospitalizationTime(p.admissionDate, p.admissionTime);
          return time.formatted.toLowerCase().includes(val) || String(time.days).includes(val);
      }
    }

    // Default global search across all relevant fields
    const time = calculateHospitalizationTime(p.admissionDate, p.admissionTime);
    return (
      p.firstName.toLowerCase().includes(query) ||
      p.lastName.toLowerCase().includes(query) ||
      p.medicalHistoryNumber.toLowerCase().includes(query) ||
      p.area.toLowerCase().includes(query) ||
      p.age.toLowerCase().includes(query) ||
      p.admissionDate.includes(query) ||
      time.formatted.toLowerCase().includes(query) ||
      p.diagnoses.some(d => d.title.toLowerCase().includes(query))
    );
  };

  const handleSaveEvolution = (silent: boolean = false) => {
    if (!selectedPatient) return;

    const effDoctorName = doctorName.trim() || resolveDefaultDoctorName();
    const effSubjetivo = subjetivo.trim() || 'Madre refiere paciente en condiciones clínicas estables. Niega emesis, diarrea o fiebre.';
    const effObjetivo = objetivo.trim() || 'Paciente evaluado clínicamente en buenas condiciones generales.';

    const normal = getPediatricNormalVitals(selectedPatient.age);
    
    // Vital signs calculation: if user left field empty, automatically save normal vital sign for patient's age
    const rawTemp = vitalTemp.trim();
    const effTemp = rawTemp ? (rawTemp.includes('°') ? rawTemp : `${rawTemp}°C`) : normal.temp;
    const rawFC = vitalFC.trim();
    const effFC = rawFC ? (rawFC.includes('bpm') ? rawFC : `${rawFC} bpm`) : normal.fc;
    const rawFR = vitalFR.trim();
    const effFR = rawFR ? (rawFR.includes('rpm') ? rawFR : `${rawFR} rpm`) : normal.fr;
    const rawTA = sanitizeBloodPressure(vitalTA.trim());
    const effTA = rawTA ? `${rawTA} mmHg` : '';
    const rawSO2 = vitalSO2.trim();
    const baseSO2 = rawSO2 ? (rawSO2.includes('%') ? rawSO2 : `${rawSO2}%`) : normal.so2;
    const effSO2 = baseSO2;

    const rawPeso = vitalPeso.trim();
    const effPeso = rawPeso 
      ? (rawPeso.toLowerCase().includes('kg') ? rawPeso : `${rawPeso} kg`) 
      : `${selectedPatient.weightKg} kg`;

    const parsedNumericWeight = parseFloat(rawPeso.replace(/[^\d.]/g, ''));
    const finalPatientWeightKg = !isNaN(parsedNumericWeight) && parsedNumericWeight > 0 
      ? parsedNumericWeight 
      : selectedPatient.weightKg;

    // Balance Hídrico Pediátrico Calculation
    let balanceHidricoData: BalanceHidricoData | undefined = undefined;
    if (reqBalanceHidrico) {
      const ing = parseFloat(ingeridosCc) || 0;
      const exc = parseFloat(excretadosCc) || 0;
      const weight = finalPatientWeightKg || selectedPatient.weightKg || 10;
      const net = ing - exc;
      
      const sc = weight < 10 
        ? ((weight * 4) + 9) / 100 
        : ((weight * 4) + 7) / (weight + 90);
      
      const fu = weight > 0 ? (exc / (weight * 24)) : 0;
      const balM2 = sc > 0 ? (net / sc) : 0;
      
      let interp = 'Euurico (Normal)';
      if (exc > 0) {
        if (fu < 0.5) interp = 'Oliguria Severa';
        else if (fu < 1.0) interp = 'Oliguria';
        else if (fu > 3.5) interp = 'Poliuria';
      }

      balanceHidricoData = {
        enabled: true,
        ingeridosCc: ing,
        excretadosCc: exc,
        balanceNetoCc: Math.round(net),
        flujoUrinarioCcKgH: Number(fu.toFixed(2)),
        superficieCorporalM2: Number(sc.toFixed(2)),
        balanceCcM2Dia: Number(balM2.toFixed(1)),
        interpretacionFU: interp
      };
    }

    const normalizedTreatmentToSave = normalizeTreatmentDisplay(treatmentModified);

    const newEv: MedicalEvolution = {
      id: todayEvolution ? todayEvolution.id : 'ev-' + Date.now(),
      patientId: selectedPatient.id,
      date: todayEvolution ? todayEvolution.date : new Date().toISOString().split('T')[0],
      time: todayEvolution ? todayEvolution.time : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      doctorName: effDoctorName,
      evolutionNote,
      interrogatory24h: interrogatory24h.trim() || undefined,
      medicalRoundSummary: comentariosPlan.trim() || medicalRoundSummary.trim() || 'En revista médica con especialista de guardia el mismo decide.',
      comentariosPlan: comentariosPlan.trim() || medicalRoundSummary.trim() || 'En revista médica con especialista de guardia el mismo decide.',
      diagnosesModified,
      treatmentModified: normalizedTreatmentToSave,
      subjetivo: effSubjetivo,
      objetivo: effObjetivo,
      ordenesMedicas: (activeEvolutionOrders && activeEvolutionOrders.length > 0) ? activeEvolutionOrders : selectedPatient.ordenesMedicas,
      ordenesFecha: activeOrdenesFecha || selectedPatient.ordenesFecha,
      ordenesHora: activeOrdenesHora || selectedPatient.ordenesHora,
      ordenesPeso: activeOrdenesPeso || selectedPatient.ordenesPeso || effPeso,
      balanceHidrico: balanceHidricoData,
      examenFisico,
      vitalSigns: {
        temp: effTemp,
        fc: effFC,
        fr: effFR,
        ta: effTA,
        so2: effSO2,
        peso: effPeso,
        hasOxygenSupport,
        o2Type,
        o2FlowLmin,
        o2Modalidad,
        fio2: o2FiO2,
        o2So2
      },
      evolvedInDay: true,
      episodeNumber: (selectedPatient.readmissionCount || 0) + 1,
      isReingreso: Boolean(selectedPatient.isReingreso),
      createdAt: todayEvolution ? todayEvolution.createdAt : new Date().toISOString()
    };

    // SYNC: Update patient main diagnoses and treatment if they were modified in this evolution
    const diagLines = diagnosesModified ? diagnosesModified.split('\n').filter(line => line.trim().length > 0) : [];
    const newDiagnoses = diagLines.length > 0
      ? diagLines.map((line, idx) => ({
          id: selectedPatient.diagnoses?.[idx]?.id || `diag-${Date.now()}-${idx}`,
          title: line.trim()
        }))
      : selectedPatient.diagnoses;

    // Filter out any duplicate evolution entries or entries for the SAME DAY to guarantee only 1 evolution is saved per day
    const seenIds = new Set<string>([newEv.id]);
    const cleanExistingEvs = (selectedPatient.evolutions || []).filter(e => {
      if (!e || !e.id || seenIds.has(e.id)) return false;
      // Strictly enforce one per day: if another evolution exists for the same date, remove it
      if (e.date === newEv.date) return false;
      seenIds.add(e.id);
      return true;
    });

    const updatedPatient: Patient = {
      ...selectedPatient,
      weightKg: finalPatientWeightKg,
      treatment: normalizedTreatmentToSave,
      diagnoses: newDiagnoses,
      ordenesMedicas: (activeEvolutionOrders && activeEvolutionOrders.length > 0) ? activeEvolutionOrders : selectedPatient.ordenesMedicas,
      ordenesFecha: activeOrdenesFecha || selectedPatient.ordenesFecha,
      ordenesHora: activeOrdenesHora || selectedPatient.ordenesHora,
      ordenesPeso: activeOrdenesPeso || selectedPatient.ordenesPeso || effPeso,
      evolutions: [newEv, ...cleanExistingEvs],
      evolucionadoHoy: true,
      ultimaEvolucionFecha: newEv.date,
      updatedAt: new Date().toISOString()
    };

    if (activeEvolutionOrders && activeEvolutionOrders.length > 0) {
      saveDraftToIDB(`patient_orders_${selectedPatient.id}`, {
        orders: activeEvolutionOrders,
        fecha: activeOrdenesFecha,
        hora: activeOrdenesHora,
        peso: activeOrdenesPeso || effPeso,
        updatedAt: new Date().toISOString()
      });
    }

    // Update parent state, persist evolution explicitly to Supabase 'evolutions' table + IndexedDB offline queue
    const updatedPatients = patients.map(p => p.id === selectedPatient.id ? updatedPatient : p);
    onUpdatePatients(updatedPatients);
    onAddEvolution(selectedPatient.id, newEv, selectedPatient);
    setSelectedPatient(updatedPatient);

    setShowEvolutionModal(false);

    // Clean up temporary drafts
    removeDraftFromIDB(`evolution_draft_${selectedPatient.id}`);
    removeDraftFromIDB(`patient_orders_${selectedPatient.id}`);

    // Trigger auto-backup snapshot asynchronously without blocking UI thread
    saveAutoBackupSnapshot({
      patients: updatedPatients,
      beds: beds,
      historias: historias,
      tasks: [],
      note: `Respaldo automático tras registrar evolución de ${selectedPatient.lastName}`
    }).catch(() => {});

    // Persist vital signs in IndexedDB so they automatically carry over to the next evolution
    saveDraftToIDB(`patient_vitals_${selectedPatient.id}`, {
      temp: effTemp,
      fc: effFC,
      fr: effFR,
      ta: effTA,
      so2: effSO2,
      peso: effPeso,
      hasOxygenSupport,
      o2Type,
      o2FlowLmin,
      o2Modalidad,
      fio2: o2FiO2,
      o2So2
    });

    // Provide instant feedback notification
    if (!silent) {
      setSaveSuccessToast(todayEvolution ? '¡Evolución actualizada al instante!' : '¡Evolución guardada al instante!');
      setTimeout(() => setSaveSuccessToast(null), 2500);
    }
  };

  // Auto-save on sudden exit: If the user changes any value and closes the modal suddenly, save immediately
  const handleCloseEvolutionModal = () => {
    setShowEvolutionModal(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    setUploadTitle(`${uploadCategory}: ${file.name.replace(/\.[^/.]+$/, '')}`);
    setUploadFileType(file.type.includes('pdf') ? 'pdf' : 'image');

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadDataUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmDocUpload = async () => {
    if (!selectedPatient || !uploadDataUrl) return;

    const res = await uploadDocumentApi({
      patientId: selectedPatient.id,
      title: `[${uploadCategory}] ${uploadTitle || uploadFileName}`,
      fileType: uploadFileType,
      fileName: uploadFileName,
      dataUrl: uploadDataUrl,
      uploadedBy: doctorName || resolveDefaultDoctorName()
    });

    if (res && res.document) {
      const updatedPatients = patients.map(p => {
        if (p.id === selectedPatient.id) {
          return {
            ...p,
            documents: [res.document, ...(p.documents || [])]
          };
        }
        return p;
      });
      onUpdatePatients(updatedPatients);
    }

    setShowDocUploadModal(false);
    setUploadDataUrl('');
    setUploadFileName('');
  };

  // Confirm Change Area
  const handleConfirmChangeArea = () => {
    if (!selectedPatient) return;

    const updatedPatients = patients.map(p => {
      if (p.id === selectedPatient.id) {
        return {
          ...p,
          area: newTargetArea,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    onUpdatePatients(updatedPatients);
    setShowChangeAreaModal(false);
  };

  // Confirm Discharge
  const handleConfirmDischarge = () => {
    if (!selectedPatient) return;

    const now = new Date();
    const dDate = now.toISOString().split('T')[0];
    const dTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const updatedPatients = patients.map(p => {
      if (p.id === selectedPatient.id) {
        const nextHistory = [
          ...(p.dischargeHistory || []),
          { date: dDate, time: dTime, reason: p.dischargeReason }
        ];
        return {
          ...p,
          status: 'discharged' as const,
          dischargeDate: dDate,
          dischargeTime: dTime,
          dischargeHistory: nextHistory,
          updatedAt: now.toISOString()
        };
      }
      return p;
    });

    onUpdatePatients(updatedPatients);
    setShowDischargeModal(false);
    setShowResumenEgresoDoc(true); // Automatically show printable Resumen de Egreso
  };

  const handleOpenResumenEvolutivo = (patient: Patient) => {
    setResumenEvolutivoPatient(patient);
    setShowResumenEvolutivoDoc(true);
  };

  const handleOpenWhatsAppGenerator = () => {
    const text = generateWhatsAppReport(patients, areas);
    setWhatsAppText(text);
    setShowWhatsAppModal(true);
    setCopiedText(false);
  };

  // Synchronize deep tutorial modals (Evolution, Discharge, Resumen de Egreso, Profile, Ordenes) on fictional demo patient
  useEffect(() => {
    const closeAllModals = () => {
      setShowEvolutionModal(false);
      setShowDischargeModal(false);
      setShowResumenEgresoDoc(false);
      setShowViewProfileModal(false);
      setShowOrdenesMedicasModal(false);
      setShowBulkDownloadMenu(false);
      setShowChangeAreaModal(false);
      setShowDocUploadModal(false);
      setShowConstanciaHospitalizacionDoc(false);
      setShowNotaRecibimientoDoc(false);
      setShowReferenciaDoc(false);
      setShowResumenEvolutivoDoc(false);
      setActivePrintEvolution(null);
      setIsEditingDxTx(false);
      setEditingExamField(null);
    };

    const onEvolutionUi = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          editDxTx?: boolean;
          withO2?: boolean;
          withBalance?: boolean;
          editingExamField?: string | null;
        }>
      ).detail;
      if (!detail) return;
      if (detail.editDxTx !== undefined) {
        setIsEditingDxTx(detail.editDxTx);
      }
      if (detail.withO2 !== undefined) {
        setHasOxygenSupport(detail.withO2);
      }
      if (detail.withBalance !== undefined) {
        setReqBalanceHidrico(detail.withBalance);
        if (detail.withBalance) {
          setIngeridosCc(prev => prev || '1150');
          setExcretadosCc(prev => prev || '920');
        }
      }
      if (detail.editingExamField !== undefined) {
        setEditingExamField(detail.editingExamField);
      }
    };

    const onModalState = (ev: Event) => {
      const custom = ev as CustomEvent<{ modal?: string }>;
      const modal = custom.detail?.modal || 'none';
      const demoPt =
        patients.find(p => isTutorialDemoId(p.id) && p.status === 'hospitalized') ||
        patients.find(p => p.status === 'hospitalized') ||
        patients[0];

      if (modal === 'none') {
        closeAllModals();
        return;
      }
      if (!demoPt) return;

      if (modal === 'evolution') {
        setShowDischargeModal(false);
        setShowResumenEgresoDoc(false);
        setShowViewProfileModal(false);
        setShowOrdenesMedicasModal(false);
        setActivePrintEvolution(null);
        // Only open/reset the Evolution modal if it isn't already open on the demo patient
        if (!showEvolutionModal || selectedPatient?.id !== demoPt.id) {
          handleOpenEvolutionModal(demoPt);
        }
      } else if (modal === 'evolution_print') {
        setShowEvolutionModal(false);
        setShowDischargeModal(false);
        setShowResumenEgresoDoc(false);
        setShowOrdenesMedicasModal(false);
        setSelectedPatient(demoPt);
        setShowViewProfileModal(false);
        const firstEvo = demoPt.evolutions?.[0] || null;
        if (firstEvo) {
          setActivePrintEvolution(firstEvo);
        }
      } else if (modal === 'discharge') {
        setShowEvolutionModal(false);
        setShowResumenEgresoDoc(false);
        setShowViewProfileModal(false);
        setShowOrdenesMedicasModal(false);
        setActivePrintEvolution(null);
        setSelectedPatient(demoPt);
        setShowDischargeModal(true);
      } else if (modal === 'resumen_egreso') {
        setShowEvolutionModal(false);
        setShowDischargeModal(false);
        setShowViewProfileModal(false);
        setShowOrdenesMedicasModal(false);
        setActivePrintEvolution(null);
        setSelectedPatient(demoPt);
        setShowResumenEgresoDoc(true);
      } else if (modal === 'profile') {
        setShowEvolutionModal(false);
        setShowDischargeModal(false);
        setShowResumenEgresoDoc(false);
        setShowOrdenesMedicasModal(false);
        setActivePrintEvolution(null);
        setSelectedPatient(demoPt);
        setShowViewProfileModal(true);
      } else if (modal === 'ordenes' || modal === 'ordenes_builder') {
        setShowEvolutionModal(false);
        setShowDischargeModal(false);
        setShowResumenEgresoDoc(false);
        setShowViewProfileModal(false);
        setActivePrintEvolution(null);
        handleOpenOrdenesModal(demoPt);
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('hmi_tutorial_ordenes_builder', {
              detail: { open: modal === 'ordenes_builder' },
            })
          );
        }, 90);
      }
    };

    window.addEventListener('hmi_tutorial_modal_state', onModalState);
    window.addEventListener('hmi_tutorial_evolution_ui', onEvolutionUi);
    window.addEventListener('hmi_tutorial_cleanup', closeAllModals);
    return () => {
      window.removeEventListener('hmi_tutorial_modal_state', onModalState);
      window.removeEventListener('hmi_tutorial_evolution_ui', onEvolutionUi);
      window.removeEventListener('hmi_tutorial_cleanup', closeAllModals);
    };
  }, [patients, showEvolutionModal, selectedPatient?.id]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Title & Search Bar */}
      <div className={`${themeTokens.cardSurface} border rounded-2xl p-3 sm:p-5 shadow-xs space-y-4`}>
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 border-b ${themeTokens.sectionDivider} pb-3`}>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <img src="/favicon.png" alt="Logo" className="w-7 h-7 rounded-lg shadow-sm" />
              Lista de Pacientes Ingresados por Área Asistencial
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Listado general de pacientes activos agrupados por sus respectivas áreas de hospitalización.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <button
              onClick={handleOpenWhatsAppGenerator}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" /> Reporte de Guardia (WhatsApp)
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Búsqueda inteligente: nombre, cédula, área, edad, fecha o estancia..."
              className={`w-full pl-10 pr-12 py-3 ${themeTokens.cardInnerSurface} border rounded-2xl text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-xs transition-all`}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Evolution Status, Descargar, Expand/Collapse All & Area Filter Controls */}
        {(() => {
          const visibleFilteredPatients = activePatients.filter(
            p =>
              (selectedAreaFilter === 'ALL' || p.area === selectedAreaFilter) &&
              matchesSearch(p) &&
              matchesEvolutionFilter(p)
          );
          const areAllVisibleExpanded =
            visibleFilteredPatients.length > 0 &&
            visibleFilteredPatients.every(p => Boolean(expandedPatientIds[p.id]));

          const handleToggleExpandAllCards = () => {
            if (visibleFilteredPatients.length === 0) return;
            if (areAllVisibleExpanded) {
              setExpandedPatientIds({});
            } else {
              const next: Record<string, boolean> = {};
              visibleFilteredPatients.forEach(p => {
                next[p.id] = true;
              });
              setExpandedPatientIds(next);
            }
          };

          const evoFilterLabel =
            evolutionStatusFilter === 'EVOLVED'
              ? `Evolucionados (${countEvolucionadosTotal})`
              : evolutionStatusFilter === 'NOT_EVOLVED'
                ? `Pendientes (${countNoEvolucionadosTotal})`
                : `Todos (${activePatients.length})`;

          const areaFilterLabel =
            selectedAreaFilter === 'ALL'
              ? `Áreas (${activePatients.length})`
              : `${selectedAreaFilter} (${activePatients.filter(p => p.area === selectedAreaFilter).length})`;

          return (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              {/* MOBILE COMPACT CONTROLS BAR (Expandable Estado Hoy, Áreas, Descargar & Expand/Collapse All Icon) */}
              <div className="md:hidden space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Mobile Estado de Evolución Hoy Dropdown */}
                  <button
                    type="button"
                    data-testid="mobile-evo-filter-btn"
                    aria-expanded={showMobileEvoFilterMenu}
                    onClick={() => {
                      setShowMobileEvoFilterMenu(prev => !prev);
                      setShowMobileAreaFilterMenu(false);
                      setShowBulkDownloadMenu(false);
                    }}
                    className={`flex-1 min-w-[110px] px-2.5 py-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-between gap-1 cursor-pointer border ${
                      showMobileEvoFilterMenu || evolutionStatusFilter !== 'ALL'
                        ? 'bg-teal-600 text-white border-teal-500 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1 truncate">
                      <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{evoFilterLabel}</span>
                    </span>
                    {showMobileEvoFilterMenu ? (
                      <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </button>

                  {/* Mobile Áreas Dropdown */}
                  <button
                    type="button"
                    data-testid="mobile-area-filter-btn"
                    aria-expanded={showMobileAreaFilterMenu}
                    onClick={() => {
                      setShowMobileAreaFilterMenu(prev => !prev);
                      setShowMobileEvoFilterMenu(false);
                      setShowBulkDownloadMenu(false);
                    }}
                    className={`flex-1 min-w-[100px] px-2.5 py-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-between gap-1 cursor-pointer border ${
                      showMobileAreaFilterMenu || selectedAreaFilter !== 'ALL'
                        ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1 truncate">
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{areaFilterLabel}</span>
                    </span>
                    {showMobileAreaFilterMenu ? (
                      <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </button>

                  {/* Mobile Descargar Dropdown Button */}
                  <button
                    type="button"
                    data-testid="mobile-bulk-download-btn"
                    data-tutorial="inicio-descargar-btn"
                    aria-expanded={showBulkDownloadMenu}
                    onClick={() => {
                      setShowBulkDownloadMenu(prev => !prev);
                      setShowMobileEvoFilterMenu(false);
                      setShowMobileAreaFilterMenu(false);
                    }}
                    className={`px-2.5 py-2 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 shrink-0 ${
                      showBulkDownloadMenu
                        ? 'bg-indigo-700 text-white ring-2 ring-indigo-300'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>Descargar</span>
                    {showBulkDownloadMenu ? (
                      <ChevronUp className="w-3 h-3 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 shrink-0" />
                    )}
                  </button>

                  {/* Mobile Expand / Collapse All Icon Button */}
                  <button
                    type="button"
                    data-testid="mobile-toggle-all-cards-btn"
                    onClick={handleToggleExpandAllCards}
                    disabled={visibleFilteredPatients.length === 0}
                    title={areAllVisibleExpanded ? 'Contraer todos los pacientes' : 'Expandir todos los pacientes'}
                    aria-label={areAllVisibleExpanded ? 'Contraer todos los pacientes' : 'Expandir todos los pacientes'}
                    className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 disabled:opacity-40 ${
                      areAllVisibleExpanded
                        ? 'bg-teal-600 text-white border-teal-500 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <ChevronsUpDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Mobile Expanded Estado de Evolución Hoy Menu */}
                {showMobileEvoFilterMenu && (
                  <div className={`${themeTokens.cardInnerSurface} border border-teal-200 dark:border-teal-800/70 rounded-2xl p-2 flex flex-col gap-1.5 shadow-sm`}>
                    <span className="px-2 pt-0.5 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Estado de Evolución Hoy
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEvolutionStatusFilter('ALL');
                        setShowMobileEvoFilterMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-between cursor-pointer ${
                        evolutionStatusFilter === 'ALL'
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span>🌟 Todos</span>
                      <span className="font-mono text-[11px]">({activePatients.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEvolutionStatusFilter('EVOLVED');
                        setShowMobileEvoFilterMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-between cursor-pointer ${
                        evolutionStatusFilter === 'EVOLVED'
                          ? 'bg-fuchsia-700 text-white'
                          : 'bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-500/30'
                      }`}
                    >
                      <span>✨ Evolucionados Hoy</span>
                      <span className="font-mono text-[11px]">({countEvolucionadosTotal})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEvolutionStatusFilter('NOT_EVOLVED');
                        setShowMobileEvoFilterMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-between cursor-pointer ${
                        evolutionStatusFilter === 'NOT_EVOLVED'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      <span>⏳ Pendientes por Evolucionar</span>
                      <span className="font-mono text-[11px]">({countNoEvolucionadosTotal})</span>
                    </button>
                  </div>
                )}

                {/* Mobile Expanded Áreas Menu */}
                {showMobileAreaFilterMenu && (
                  <div className={`${themeTokens.cardInnerSurface} border border-sky-200 dark:border-sky-800/70 rounded-2xl p-2 flex flex-col gap-1.5 shadow-sm`}>
                    <span className="px-2 pt-0.5 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Filtrar por Área
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAreaFilter('ALL');
                        setShowMobileAreaFilterMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-between cursor-pointer ${
                        selectedAreaFilter === 'ALL'
                          ? 'bg-teal-600 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span>Todas las Áreas</span>
                      <span className="font-mono text-[11px]">({activePatients.length})</span>
                    </button>
                    {areas.map(area => {
                      const areaRawCount = activePatients.filter(p => p.area === area).length;
                      const theme = getAreaColorTheme(area);
                      const isSelected = selectedAreaFilter === area;
                      return (
                        <button
                          key={'mob-area-' + area}
                          type="button"
                          onClick={() => {
                            setSelectedAreaFilter(area);
                            setShowMobileAreaFilterMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? theme.filterActive
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            {getAreaFriendlyIcon(area, 'w-3.5 h-3.5')}
                            <span className="truncate">{area}</span>
                          </span>
                          <span className="font-mono text-[11px] shrink-0">({areaRawCount})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* DESKTOP CONTROLS BAR */}
              <div className="hidden md:block space-y-3">
                {/* Row 1: Evolution Status Filter + Expand/Collapse All Button */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                      <Stethoscope className="w-3.5 h-3.5 text-teal-500" />
                      Estado de Evolución Hoy:
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      <button
                        type="button"
                        onClick={() => setEvolutionStatusFilter('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          evolutionStatusFilter === 'ALL'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md ring-2 ring-slate-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>🌟 Todos ({activePatients.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEvolutionStatusFilter('EVOLVED')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          evolutionStatusFilter === 'EVOLVED'
                            ? 'bg-fuchsia-700 dark:bg-fuchsia-600 text-white shadow-sm dark:shadow-lg dark:shadow-fuchsia-600/40 ring-2 ring-fuchsia-300 dark:animate-pulse'
                            : 'bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-500/30 hover:bg-fuchsia-500/20'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-fuchsia-500 dark:bg-fuchsia-400 dark:animate-ping"></span>
                        <span>✨ Evolucionados Hoy ({countEvolucionadosTotal})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEvolutionStatusFilter('NOT_EVOLVED')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          evolutionStatusFilter === 'NOT_EVOLVED'
                            ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/40 ring-2 ring-amber-300'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                        }`}
                      >
                        <span>⏳ Pendientes por Evolucionar ({countNoEvolucionadosTotal})</span>
                      </button>
                    </div>
                  </div>

                  {/* Desktop Expand / Collapse All Icon Button */}
                  <button
                    type="button"
                    data-testid="inicio-toggle-all-cards-btn"
                    onClick={handleToggleExpandAllCards}
                    disabled={visibleFilteredPatients.length === 0}
                    title={areAllVisibleExpanded ? 'Contraer todos los pacientes' : 'Expandir todos los pacientes'}
                    aria-label={areAllVisibleExpanded ? 'Contraer todos los pacientes' : 'Expandir todos los pacientes'}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-40 ${
                      areAllVisibleExpanded
                        ? 'bg-teal-600 text-white border-teal-500 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <ChevronsUpDown className="w-4 h-4" />
                    <span className="hidden lg:inline">
                      {areAllVisibleExpanded ? 'Contraer todos' : 'Expandir todos'}
                    </span>
                  </button>
                </div>

                {/* Row 1.5: Botón Descargar (Desktop trigger) */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    data-testid="inicio-bulk-download-btn"
                    data-tutorial="inicio-descargar-btn"
                    aria-expanded={showBulkDownloadMenu}
                    onClick={() => setShowBulkDownloadMenu(prev => !prev)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 ${
                      showBulkDownloadMenu
                        ? 'bg-indigo-700 text-white ring-2 ring-indigo-300 dark:ring-indigo-500/50'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar</span>
                    {showBulkDownloadMenu ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                    Descarga en PDF o imprime en una sola hoja por paciente
                  </span>
                </div>

                {/* Row 2: Filter Area Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                  <button
                    onClick={() => setSelectedAreaFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                      selectedAreaFilter === 'ALL'
                        ? 'bg-teal-600 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Todas las Áreas ({activePatients.length})
                  </button>
                  {areas.map(area => {
                    const areaRawCount = activePatients.filter(p => p.area === area).length;
                    const theme = getAreaColorTheme(area);
                    const isSelected = selectedAreaFilter === area;
                    return (
                      <button
                        key={area}
                        onClick={() => setSelectedAreaFilter(area)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? theme.filterActive
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {getAreaFriendlyIcon(area, 'w-3.5 h-3.5')}
                        <span>{area}</span>
                        <span className="opacity-80 text-[10px]">({areaRawCount})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shared Responsive Expanded Panel for Descargar (Mobile & Desktop) */}
              {showBulkDownloadMenu && (
                <div
                  data-testid="inicio-bulk-download-panel"
                  data-tutorial="inicio-descargar-panel"
                  className={`${themeTokens.cardInnerSurface} border border-indigo-200 dark:border-indigo-800/70 rounded-2xl p-2.5 sm:p-3 grid grid-cols-1 lg:grid-cols-3 gap-2.5 shadow-sm`}
                >
                  {/* 1. Evoluciones Hoy */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
                    <button
                      type="button"
                      disabled={activeDownloadAllEvolutions || evolucionesYaHechasItems.length === 0}
                      onClick={() => setActiveDownloadAllEvolutions(true)}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed text-white shadow-xs active:scale-95"
                      title="Descargar únicamente todas las evoluciones ya realizadas en Evolucionados Hoy (PDF)"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {activeDownloadAllEvolutions
                          ? 'Descargando...'
                          : `Evoluciones Hoy (${evolucionesYaHechasItems.length})`}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={evolucionesYaHechasItems.length === 0}
                      onClick={() => {
                        setShowBulkDownloadMenu(false);
                        setActivePrintAllEvolutions(true);
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-teal-600 hover:bg-teal-500 disabled:opacity-45 disabled:cursor-not-allowed text-white shadow-xs active:scale-95 shrink-0"
                      title="Imprimir evoluciones de hoy (1 hoja por evolución)"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir</span>
                    </button>
                  </div>

                  {/* 2. Notas de Recibimiento */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
                    <button
                      type="button"
                      disabled={activeDownloadAllNotasRecibimiento || activePatients.length === 0}
                      onClick={() => setActiveDownloadAllNotasRecibimiento(true)}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-sky-600 hover:bg-sky-500 disabled:opacity-45 disabled:cursor-not-allowed text-white shadow-xs active:scale-95"
                      title="Descargar todas las Notas de Recibimiento de los pacientes ingresados (PDF)"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {activeDownloadAllNotasRecibimiento
                          ? 'Descargando...'
                          : `Notas de Recibimiento (${activePatients.length})`}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={activePatients.length === 0}
                      onClick={() => {
                        setShowBulkDownloadMenu(false);
                        setActivePrintAllNotasRecibimiento(true);
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-teal-600 hover:bg-teal-500 disabled:opacity-45 disabled:cursor-not-allowed text-white shadow-xs active:scale-95 shrink-0"
                      title="Imprimir todas las Notas de Recibimiento (1 hoja por paciente)"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir</span>
                    </button>
                  </div>

                  {/* 3. Órdenes Médicas Actualizadas */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
                    <button
                      type="button"
                      disabled={activeDownloadAllOrdenesMedicas || ordenesActualizadasItems.length === 0}
                      onClick={() => setActiveDownloadAllOrdenesMedicas(true)}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-amber-500 hover:bg-amber-400 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 shadow-xs active:scale-95"
                      title="Descargar únicamente todas las Órdenes Médicas actualizadas de cada paciente (PDF)"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {activeDownloadAllOrdenesMedicas
                          ? 'Descargando...'
                          : `Órdenes Médicas (${ordenesActualizadasItems.length})`}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={ordenesActualizadasItems.length === 0}
                      onClick={() => {
                        setShowBulkDownloadMenu(false);
                        setActivePrintAllOrdenesMedicas(true);
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-teal-600 hover:bg-teal-500 disabled:opacity-45 disabled:cursor-not-allowed text-white shadow-xs active:scale-95 shrink-0"
                      title="Imprimir todas las Órdenes Médicas actualizadas (1 hoja por paciente)"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* TABLES OF HOSPITALIZED PATIENTS GROUPED SEPARATELY BY AREA */}
      <div className="space-y-5 sm:space-y-6">
        {areas
          .filter(area => {
            const matchesAreaFilter = selectedAreaFilter === 'ALL' || selectedAreaFilter === area;
            if (!matchesAreaFilter) return false;

            const areaFilteredPatients = activePatients.filter(
              p => p.area === area && matchesSearch(p) && matchesEvolutionFilter(p)
            );
            // Under "Todas las Áreas" (or when actively searching/filtering), hide areas with 0 admitted patients
            if (selectedAreaFilter === 'ALL' || searchQuery.trim() || evolutionStatusFilter !== 'ALL') {
              return areaFilteredPatients.length > 0;
            }
            return true;
          })
          .map(area => {
            const areaPatients = activePatients.filter(p => p.area === area && matchesSearch(p) && matchesEvolutionFilter(p));
            const areaTotalCount = activePatients.filter(p => p.area === area).length;
            const areaEvolucionadosCount = activePatients.filter(p => p.area === area && isPatientEvolucionadoHoy(p)).length;
            const areaPendientesCount = areaTotalCount - areaEvolucionadosCount;
            const theme = getAreaColorTheme(area);

            return (
              <div key={area} className={`${themeTokens.cardSurface} border-2 ${theme.cardBorder} rounded-2xl p-3 sm:p-5 shadow-xs space-y-3 sm:space-y-4`}>
                {/* Area Header Badge */}
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between border-b ${theme.headerBorder} pb-3 gap-2`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${theme.iconBg} shadow-xs`}>
                      {getAreaFriendlyIcon(area, "w-5 h-5")}
                    </div>
                    <div>
                      <h3 className={`text-base font-black tracking-wide uppercase ${theme.titleText} flex items-center gap-2`}>
                        Área: {area}
                      </h3>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                        {areaTotalCount} pacientes asignados en esta área
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black px-3 py-1 rounded-xl bg-fuchsia-500/12 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-500/35 flex items-center gap-1 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-fuchsia-500 dark:bg-fuchsia-400 dark:animate-ping"></span>
                      ✨ {areaEvolucionadosCount} Evolucionados hoy
                    </span>
                    {areaPendientesCount > 0 && (
                      <span className="text-[11px] font-black px-3 py-1 rounded-xl bg-amber-500/12 text-amber-800 dark:text-amber-300 border border-amber-500/35 flex items-center gap-1 shadow-xs">
                        ⏳ {areaPendientesCount} Pendientes
                      </span>
                    )}
                  </div>
                </div>

                {/* MOBILE VIEW: Collapsed Name-Only Cards by Default -> Expand on Click + Top-Right Collapse Button */}
                <div className="block md:hidden space-y-2.5">
                  {areaPatients.length === 0 ? (
                    <div className={`py-6 text-center italic text-xs rounded-xl border ${theme.emptyBg}`}>
                      Sin pacientes ingresados en {area}.
                    </div>
                  ) : (
                    areaPatients.map(patient => {
                      const isExpanded = Boolean(expandedPatientIds[patient.id]);
                      const timeCalc = calculateHospitalizationTime(patient.admissionDate, patient.admissionTime);
                      const todayEv = patient.evolutions?.some(e => e.date === new Date().toISOString().split('T')[0]);
                      const reingresoTipo = patient.readmissionMode === 'correct_errors'
                        ? 'correct_errors'
                        : (patient.readmissionMode === 'new_admission' || patient.isReingreso)
                          ? 'new_admission'
                          : null;
                      const cardSurfaceClass = reingresoTipo === 'correct_errors'
                        ? (todayEv
                            ? 'bg-fuchsia-50/90 dark:bg-fuchsia-950 border-2 border-amber-400 ring-2 ring-amber-400/50 shadow-xs dark:shadow-[0_0_22px_rgba(245,158,11,0.55)] text-slate-900 dark:text-slate-100 font-medium'
                            : 'bg-amber-50/90 dark:bg-amber-950/35 border-2 border-amber-400 dark:border-amber-500/80 shadow-xs dark:shadow-[0_0_16px_rgba(245,158,11,0.3)] text-slate-900 dark:text-slate-100')
                        : reingresoTipo === 'new_admission'
                          ? (todayEv
                              ? 'bg-fuchsia-50/90 dark:bg-fuchsia-950 border-2 border-orange-400 dark:border-orange-500 ring-2 ring-orange-400/50 dark:ring-orange-500/70 shadow-xs dark:shadow-[0_0_22px_rgba(249,115,22,0.6)] text-slate-900 dark:text-slate-100 font-medium'
                              : 'bg-orange-50/90 dark:bg-orange-950/35 border-2 border-orange-400 dark:border-orange-500/80 shadow-xs dark:shadow-[0_0_18px_rgba(249,115,22,0.35)] text-slate-900 dark:text-slate-100')
                          : (todayEv
                              ? 'bg-fuchsia-50/90 dark:bg-fuchsia-950 border-2 border-fuchsia-400 dark:border-fuchsia-600 shadow-xs dark:shadow-[0_0_22px_rgba(217,70,239,0.85)] text-slate-900 dark:text-slate-100 font-medium'
                              : `${themeTokens.cardSurface} border shadow-xs text-slate-900 dark:text-slate-100`);

                      if (!isExpanded) {
                        return (
                          <button
                            key={'mob-collapsed-' + patient.id}
                            type="button"
                            data-patient-card-collapsed={patient.id}
                            onClick={() => togglePatientExpanded(patient.id, true)}
                            className={`w-full text-left rounded-2xl px-4 py-3.5 flex items-center justify-between gap-2 transition-all cursor-pointer active:scale-[0.99] ${cardSurfaceClass}`}
                          >
                            <span className="font-black text-base text-slate-900 dark:text-white leading-snug truncate">
                              {patient.lastName}, {patient.firstName}
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                          </button>
                        );
                      }

                      return (
                        <div
                          key={'mob-' + patient.id}
                          data-patient-card-expanded={patient.id}
                          className={`rounded-2xl p-4 space-y-3 text-xs transition-all relative ${cardSurfaceClass}`}
                        >
                          {/* Top Row: Name + Top-Right Collapse Button */}
                          <div className={`border-b ${themeTokens.sectionDivider} pb-2.5 space-y-2`}>
                            <div className="bg-teal-500/12 dark:bg-teal-400/20 border border-teal-500/30 dark:border-teal-400/30 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <h4 className="font-black text-base md:text-lg text-slate-900 dark:text-white leading-snug">
                                  {patient.lastName}, {patient.firstName}
                                </h4>
                                {timeCalc.days >= 7 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 border border-amber-400 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-black text-[10px] uppercase tracking-wider shrink-0">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 shrink-0" /> &gt;7 Días
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                data-patient-collapse-btn={patient.id}
                                onClick={() => togglePatientExpanded(patient.id, false)}
                                title="Contraer paciente"
                                aria-label="Contraer paciente"
                                className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1 text-[10px] font-extrabold shrink-0 cursor-pointer transition-colors"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                            </div>
                            {reingresoTipo && (
                              <div className={`px-3 py-1.5 rounded-xl font-black text-[10.5px] uppercase tracking-wide flex items-center gap-1.5 border ${
                                reingresoTipo === 'correct_errors'
                                  ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/60'
                                  : 'bg-orange-500/20 text-orange-900 dark:text-orange-200 border-orange-500/60'
                              }`}>
                                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {reingresoTipo === 'correct_errors'
                                    ? 'Reingresó por corrección de errores'
                                    : 'Reingresó nuevamente (Nuevo Ingreso)'}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* 7-Day Prolonged Hospitalization Warning Alert Banner */}
                          {timeCalc.days >= 7 && (
                            <div className="bg-amber-500/15 border border-amber-500/40 p-2.5 rounded-xl flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                <div>
                                  <p className="font-black text-amber-900 dark:text-amber-200 text-[11px] leading-tight">
                                    Hospitalización &gt; 7 Días ({timeCalc.days}d)
                                  </p>
                                  <p className="text-[9.5px] text-amber-700 dark:text-amber-300 font-bold">
                                    Requiere Resumen Evolutivo de 7 días
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleOpenResumenEvolutivo(patient)}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg shrink-0 shadow-xs active:scale-95 transition-all flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3" /> Resumen
                              </button>
                            </div>
                          )}

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="bg-white/90 dark:bg-slate-900/90 p-2 rounded-xl border border-slate-200 dark:border-slate-700/60">
                              <span className="text-slate-600 dark:text-slate-400 font-bold block text-[10px]">Edad & Sexo:</span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200">{patient.age} ({patient.gender})</span>
                            </div>
                            <div className="bg-white/90 dark:bg-slate-900/90 p-2 rounded-xl border border-slate-200 dark:border-slate-700/60">
                              <span className="text-slate-600 dark:text-slate-400 font-bold block text-[10px]">Peso & Cama:</span>
                              <span className="font-extrabold text-teal-700 dark:text-teal-400">{patient.weightKg} kg · {patient.bedNumber}</span>
                            </div>
                          </div>

                          {/* Diagnoses & Treatment Box Mobile */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                              <span className="text-teal-700 dark:text-teal-400 font-bold text-[9px] uppercase block tracking-wider">Diagnósticos:</span>
                              <div className="font-bold text-slate-800 dark:text-slate-200 text-[10.5px] leading-relaxed whitespace-pre-wrap">
                                {getPatientDiagnosesAsText(patient) || (
                                  <span className="text-slate-500 dark:text-slate-400 italic font-normal">En evaluación</span>
                                )}
                              </div>
                            </div>
                            <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                              <span className="text-indigo-700 dark:text-indigo-400 font-bold text-[9px] uppercase block tracking-wider">Tratamiento:</span>
                              <div className="font-bold text-slate-800 dark:text-slate-200 text-[10.5px] leading-relaxed whitespace-pre-wrap">
                                {normalizeTreatmentDisplay(patient.treatment)}
                              </div>
                            </div>
                          </div>

                          {/* Estancia Hospitalaria Ticker */}
                          <div className={`flex items-center justify-between p-2.5 rounded-xl font-bold text-xs border ${
                            timeCalc.days >= 7
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/20'
                              : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300'
                          }`}>
                            <div className="flex items-center gap-1.5">
                              {timeCalc.days >= 7 ? (
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                              ) : (
                                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                              )}
                              <span>Estancia:</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {timeCalc.days >= 7 && (
                                <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">≥7 Días</span>
                              )}
                              <span className="font-mono font-black text-xs">{timeCalc.formatted}</span>
                            </div>
                          </div>

                          {/* Action Buttons for Touchscreens */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            {todayEv && (
                              <div className="col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-xl bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-500/40 text-[10px] font-black uppercase tracking-wider">
                                ✨ ¡Evolución de Hoy Ya Realizada!
                              </div>
                            )}
                            {!isVisitor && (
                              <>
                                <button
                                  data-tutorial="patient-btn-evolucionar"
                                  onClick={() => handleOpenEvolutionModal(patient)}
                                  className={`col-span-2 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer ${
                                    todayEv
                                      ? 'bg-fuchsia-700 hover:bg-fuchsia-600 dark:bg-fuchsia-500 dark:hover:bg-fuchsia-400 text-white dark:text-slate-950 shadow-xs ring-2 ring-fuchsia-300'
                                      : 'bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-sm'
                                  }`}
                                >
                                  <Stethoscope className="w-4 h-4" /> {todayEv ? 'Actualizar Evolución' : 'Evolucionar Paciente'}
                                </button>
                                {timeCalc.days >= 7 && (
                                  <button
                                    onClick={() => handleOpenResumenEvolutivo(patient)}
                                    className="col-span-2 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all bg-amber-500 text-slate-950 hover:bg-amber-400 ring-2 ring-amber-400/40 cursor-pointer"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-slate-950" /> Resumen Evolutivo (7+ Días)
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedPatient(patient);
                                    setShowDocUploadModal(true);
                                  }}
                                  className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all text-center leading-tight cursor-pointer"
                                >
                                  <Upload className="w-3.5 h-3.5 shrink-0" /> Documento
                                </button>
                              </>
                            )}
                            {!isVisitor && (
                              <button
                                data-tutorial="patient-btn-ordenes"
                                onClick={() => handleOpenOrdenesModal(patient)}
                                className="ordenes-btn-neon-yellow py-2 px-3 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all border border-yellow-300 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 text-slate-950" /> Órdenes
                              </button>
                            )}
                            {!isVisitor && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedPatient(patient);
                                    setNewTargetArea(patient.area === 'Hospitalización' ? 'Traumashock' : 'Hospitalización');
                                    setShowChangeAreaModal(true);
                                  }}
                                  className="py-2 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center gap-1 border border-amber-500/30 active:scale-95 transition-all cursor-pointer"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" /> Cambiar Área
                                </button>
                                <button
                                  data-tutorial="patient-btn-alta"
                                  onClick={() => {
                                    setSelectedPatient(patient);
                                    setShowDischargeModal(true);
                                  }}
                                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                                >
                                  <UserCheck className="w-3.5 h-3.5" /> Dar de Alta
                                </button>
                              </>
                            )}
                            <button
                              data-tutorial="patient-btn-ver-perfil"
                              onClick={() => {
                                setSelectedPatient(patient);
                                setShowViewProfileModal(true);
                              }}
                              title="Ver Perfil Completo del Paciente y Documentos"
                              className="col-span-2 py-3 px-3 rounded-xl bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                            >
                              <Eye className="w-4 h-4 text-white shrink-0" />
                              <span>Ver Perfil & Archivos</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* DESKTOP VIEW: Collapsed Name-Only Items by Default -> Click to Expand All Details + Top-Right Collapse Button */}
                <div className="hidden md:block space-y-2">
                  {areaPatients.length === 0 ? (
                    <div className={`py-6 text-center text-slate-600 dark:text-slate-400 italic text-xs rounded-xl border ${theme.emptyBg}`}>
                      Sin pacientes ingresados en {area}.
                    </div>
                  ) : (
                    areaPatients.map(patient => {
                      const isExpanded = Boolean(expandedPatientIds[patient.id]);
                      const timeCalc = calculateHospitalizationTime(patient.admissionDate, patient.admissionTime);
                      const todayEv = patient.evolutions?.some(e => e.date === new Date().toISOString().split('T')[0]);
                      const reingresoTipo = patient.readmissionMode === 'correct_errors'
                        ? 'correct_errors'
                        : (patient.readmissionMode === 'new_admission' || patient.isReingreso)
                          ? 'new_admission'
                          : null;
                      const surfaceClass = reingresoTipo === 'correct_errors'
                        ? (todayEv
                            ? 'bg-fuchsia-50/90 dark:bg-fuchsia-950/85 border-amber-400 dark:border-amber-500/80 text-slate-900 dark:text-slate-100'
                            : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-400/80 dark:border-amber-500/60 text-slate-900 dark:text-slate-100')
                        : reingresoTipo === 'new_admission'
                          ? (todayEv
                              ? 'bg-fuchsia-50/90 dark:bg-fuchsia-950/85 border-orange-400 dark:border-orange-500/80 text-slate-900 dark:text-slate-100'
                              : 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-400/80 dark:border-orange-500/60 text-slate-900 dark:text-slate-100')
                          : (todayEv
                              ? 'bg-fuchsia-50/90 dark:bg-fuchsia-950/85 border-fuchsia-400 dark:border-fuchsia-600 text-slate-900 dark:text-slate-100'
                              : 'bg-white/90 dark:bg-slate-900/75 border-slate-200 dark:border-slate-800 hover:border-teal-500/50 text-slate-900 dark:text-slate-100');

                      if (!isExpanded) {
                        return (
                          <button
                            key={'desk-collapsed-' + patient.id}
                            type="button"
                            data-patient-card-collapsed={patient.id}
                            onClick={() => togglePatientExpanded(patient.id, true)}
                            className={`w-full text-left px-4 py-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${surfaceClass}`}
                          >
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              {patient.lastName}, {patient.firstName}
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                          </button>
                        );
                      }

                      return (
                        <div
                          key={'desk-expanded-' + patient.id}
                          data-patient-card-expanded={patient.id}
                          className={`rounded-2xl border p-4 space-y-3 transition-all shadow-xs ${surfaceClass}`}
                        >
                          {/* Top Row: Patient Name + Top-Right Collapse Button */}
                          <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-slate-800">
                            <div className="min-w-0 space-y-1">
                              <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                                <span>{patient.lastName}, {patient.firstName}</span>
                                <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded-md font-mono font-bold text-[11px]">
                                  {patient.bedNumber}
                                </span>
                                {timeCalc.days >= 7 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 border border-amber-400 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-black text-[9.5px] uppercase tracking-wider">
                                    <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-500 shrink-0" /> &gt;7 Días
                                  </span>
                                )}
                                {todayEv && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-fuchsia-100 dark:bg-fuchsia-500/20 border border-fuchsia-300 dark:border-fuchsia-500/40 text-fuchsia-800 dark:text-fuchsia-300 font-black text-[9.5px] uppercase tracking-wider">
                                    Evolucionado hoy
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap font-semibold">
                                <span>H.C.: {patient.medicalHistoryNumber}</span>
                                <span>·</span>
                                <span>{patient.age}</span>
                                <span>·</span>
                                <span>{patient.gender}</span>
                                <span>·</span>
                                <span className="text-teal-700 dark:text-teal-400 font-bold">{patient.weightKg} kg</span>
                                <span>·</span>
                                <span>Ingreso: {patient.admissionDate} {patient.admissionTime}</span>
                              </div>
                              {reingresoTipo && (
                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-black text-[9.5px] uppercase tracking-wide border ${
                                  reingresoTipo === 'correct_errors'
                                    ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/60'
                                    : 'bg-orange-500/20 text-orange-800 dark:text-orange-300 border-orange-500/60'
                                }`}>
                                  <RefreshCw className="w-2.5 h-2.5 shrink-0" />
                                  <span>
                                    {reingresoTipo === 'correct_errors'
                                      ? 'Reingresó por corrección de errores'
                                      : 'Reingresó nuevamente (Nuevo Ingreso)'}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Top-Right Collapse Button */}
                            <button
                              type="button"
                              data-patient-collapse-btn={patient.id}
                              onClick={() => togglePatientExpanded(patient.id, false)}
                              title="Contraer paciente"
                              aria-label="Contraer paciente"
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[11px] font-extrabold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                            >
                              <span>Contraer</span>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Expanded Clinical Grid: Estancia, Diagnósticos, Tratamiento */}
                          <div className="grid grid-cols-12 gap-3 text-xs">
                            <div className="col-span-3 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                Días Hospitalizado
                              </span>
                              <div className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-1.5 rounded-lg text-xs font-mono border ${
                                timeCalc.days >= 7
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                              }`}>
                                {timeCalc.days >= 7 ? (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 shrink-0" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span>{timeCalc.formatted}</span>
                              </div>
                              {timeCalc.days >= 7 && (
                                <div className="text-[10px] font-black text-amber-700 dark:text-amber-400">
                                  Resumen 7D Req.
                                </div>
                              )}
                            </div>

                            <div className="col-span-4 space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-400 block">
                                Diagnósticos
                              </span>
                              <div className="text-slate-900 dark:text-slate-100 font-bold text-[11px] leading-relaxed whitespace-pre-wrap bg-teal-500/5 p-2.5 rounded-xl border border-teal-500/15">
                                {getPatientDiagnosesAsText(patient) || (
                                  <span className="text-slate-500 dark:text-slate-400 italic font-normal">En evaluación</span>
                                )}
                              </div>
                            </div>

                            <div className="col-span-5 space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-400 block">
                                Tratamiento
                              </span>
                              <div className="text-slate-800 dark:text-slate-200 text-[11px] font-bold leading-relaxed whitespace-pre-wrap bg-indigo-500/5 p-2.5 rounded-xl border border-indigo-500/15">
                                {normalizeTreatmentDisplay(patient.treatment)}
                              </div>
                            </div>
                          </div>

                          {/* Actions Bar */}
                          <div className="flex items-center justify-end gap-1.5 flex-wrap pt-2 border-t border-slate-200/80 dark:border-slate-800">
                            {!isVisitor && (
                              <>
                                <button
                                  data-tutorial="patient-btn-evolucionar"
                                  onClick={() => handleOpenEvolutionModal(patient)}
                                  title="Anotar Evolución Diaria / Revista Médica"
                                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-[10.5px] flex items-center gap-1.5 transition-all shadow-md active:scale-95 ring-2 ring-teal-500/20 cursor-pointer"
                                >
                                  <Stethoscope className="w-3.5 h-3.5" /> {todayEv ? 'Actualizar' : 'Evolucionar'}
                                </button>

                                {timeCalc.days >= 7 && (
                                  <button
                                    onClick={() => handleOpenResumenEvolutivo(patient)}
                                    title="Generar o Ver Resumen Evolutivo de los 7 Días"
                                    className="px-2.5 py-1.5 rounded-xl font-black text-[10.5px] flex items-center gap-1.5 transition-all shadow-xs active:scale-95 bg-amber-500 text-slate-950 hover:bg-amber-400 ring-2 ring-amber-400/40 shrink-0 cursor-pointer"
                                  >
                                    <AlertTriangle className="w-3 h-3 text-slate-950" /> Resumen 7D
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setSelectedPatient(patient);
                                    setShowDocUploadModal(true);
                                  }}
                                  title="Subir Documento o gestionar Laboratorios Clínicos"
                                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Upload className="w-3 h-3" /> Documento
                                </button>

                                <button
                                  data-tutorial="patient-btn-ordenes"
                                  onClick={() => handleOpenOrdenesModal(patient)}
                                  title="Ver Órdenes Médicas"
                                  className="ordenes-btn-neon-yellow px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-slate-950 font-black text-[10.5px] flex items-center gap-1 transition-all border border-yellow-300 cursor-pointer"
                                >
                                  <FileText className="w-3 h-3 text-slate-950" /> Órdenes
                                </button>
                              </>
                            )}

                            <button
                              data-tutorial="patient-btn-ver-perfil"
                              onClick={() => {
                                setSelectedPatient(patient);
                                setShowViewProfileModal(true);
                              }}
                              title="Ver Perfil Completo del Paciente y Documentos"
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 dark:from-violet-500 dark:via-purple-500 dark:to-fuchsia-500 hover:opacity-95 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                            >
                              <Eye className="w-4 h-4 text-white shrink-0" />
                              <span>Ver Perfil & Archivos</span>
                            </button>

                            {!isVisitor && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedPatient(patient);
                                    setNewTargetArea(patient.area === 'Hospitalización' ? 'Traumashock' : 'Hospitalización');
                                    setShowChangeAreaModal(true);
                                  }}
                                  title="Cambiar Área Hospitalaria"
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-700 dark:text-amber-400 font-bold text-[10.5px] flex items-center gap-1 border border-amber-500/30 transition-colors cursor-pointer"
                                >
                                  <ArrowRightLeft className="w-3 h-3" /> Cambiar Área
                                </button>

                                <button
                                  data-tutorial="patient-btn-alta"
                                  onClick={() => {
                                    setSelectedPatient(patient);
                                    setShowDischargeModal(true);
                                  }}
                                  title="Dar de Alta & Generar Resumen de Egreso"
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                                >
                                  <UserCheck className="w-3 h-3" /> Dar de Alta
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* MODAL 1: EVOLUCIÓN & REVISTA MÉDICA */}
      {showEvolutionModal && selectedPatient && (
        <div className="fixed inset-0 w-full h-full min-h-screen bg-slate-50 dark:bg-slate-950 z-[100] overflow-y-auto flex flex-col no-print">
          <div className="min-h-screen w-full px-3 py-4 sm:p-8 space-y-4 sm:space-y-6 text-slate-900 dark:text-slate-100">
            {/* Header (Sticky for mobile visibility) */}
            <div className="sticky top-0 bg-slate-50/98 dark:bg-slate-950/98 md:backdrop-blur-md z-30 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 flex-wrap gap-2 py-3 shadow-md">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-teal-500" />
                  Evolución Médica
                </h3>
                <p className="text-xs sm:text-sm font-extrabold text-teal-800 dark:text-teal-200 mt-1.5 flex items-center gap-2 flex-wrap">
                  <span>Paciente:</span>
                  <strong className="text-base sm:text-lg font-black text-slate-900 dark:text-white bg-teal-500/20 dark:bg-teal-400/25 px-2.5 py-0.5 rounded-lg border border-teal-500/40 shadow-xs">
                    {selectedPatient.lastName}, {selectedPatient.firstName}
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Botón Requerido: Guardar Evolución (Visible en Header para móvil) - GUARDADO INSTANTÁNEO */}
                <button
                  type="button"
                  onClick={() => handleSaveEvolution(false)}
                  className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-teal-600/20 transition-all active:scale-95 cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">{todayEvolution ? 'Actualizar Evolución' : 'Guardar Evolución'}</span>
                  <span className="sm:hidden">{todayEvolution ? 'Actualizar' : 'Guardar'}</span>
                </button>

                {/* Botón Requerido: Órdenes Médicas */}
                <button
                  type="button"
                  onClick={() => selectedPatient ? handleOpenOrdenesModal(selectedPatient) : setShowOrdenesMedicasModal(true)}
                  className="ordenes-btn-neon-yellow px-3.5 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border border-yellow-300"
                >
                  <FileText className="w-4 h-4 text-slate-950" />
                  <span className="hidden sm:inline">Órdenes Médicas</span>
                  <span className="sm:hidden">Órdenes</span>
                  {activeEvolutionOrders && activeEvolutionOrders.length > 0 && (
                    <span className="bg-amber-900 dark:bg-slate-950 text-amber-100 dark:text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ml-0.5">
                      {activeEvolutionOrders.length}
                    </span>
                  )}
                </button>

                <button 
                  onClick={handleCloseEvolutionModal} 
                  className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-500 hover:rotate-90 transition-all duration-200 active:scale-90 cursor-pointer"
                  title="Cerrar sin guardar cambios"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-6 text-xs">
              {/* Doctor Identification */}
              <div data-tutorial="evo-doctor-field" className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 p-3 rounded-xl space-y-1">
                <label className="block text-teal-800 dark:text-teal-300 font-bold uppercase tracking-tighter">Médico que Evoluciona *</label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700 rounded-lg p-2 font-bold text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>

              {/* Subjetivo & Objetivo */}
              <div data-tutorial="evo-subjetivo-objetivo" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">SUBJETIVO</label>
                  <textarea
                    ref={el => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = `${Math.max(90, el.scrollHeight + 4)}px`;
                      }
                    }}
                    value={subjetivo}
                    onChange={e => {
                      setSubjetivo(e.target.value);
                      e.currentTarget.style.height = 'auto';
                      e.currentTarget.style.height = `${Math.max(90, e.currentTarget.scrollHeight + 4)}px`;
                    }}
                    rows={3}
                    placeholder="Refiere mejoría clínica..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium leading-relaxed resize-y"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">OBJETIVO</label>
                  <textarea
                    ref={el => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = `${Math.max(90, el.scrollHeight + 4)}px`;
                      }
                    }}
                    value={objetivo}
                    onChange={e => {
                      setObjetivo(e.target.value);
                      e.currentTarget.style.height = 'auto';
                      e.currentTarget.style.height = `${Math.max(90, e.currentTarget.scrollHeight + 4)}px`;
                    }}
                    rows={3}
                    placeholder="Paciente afebril, activo..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium leading-relaxed resize-y"
                  />
                </div>
              </div>

              {/* Diagnósticos & Tratamiento Section */}
              <div data-tutorial="evo-dx-tx-section" className="space-y-3">
                {/* Mode Toggle Header */}
                <div className={`${themeTokens.cardSurface} border border-teal-500/35 p-3.5 rounded-2xl flex items-center justify-between flex-wrap gap-2 shadow-sm`}>
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4.5 h-4.5 text-teal-700 dark:text-teal-400" />
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm uppercase tracking-wider">
                        Diagnósticos y Tratamiento
                      </h4>
                      <p className="text-[10.5px] text-slate-600 dark:text-slate-400">
                        {isEditingDxTx ? 'Modo de edición activo. Realice los cambios necesarios:' : 'Vista previa de diagnósticos y esquemas terapéuticos activos.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    data-tutorial="evo-btn-modificar-dx-tx"
                    onClick={() => setIsEditingDxTx(!isEditingDxTx)}
                    className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer ${
                      isEditingDxTx 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                        : 'bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white'
                    }`}
                  >
                    {isEditingDxTx ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>✓ Listo / Cerrar Editor</span>
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-4 h-4" />
                        <span>✏️ Modificar Diagnósticos y Tratamiento</span>
                      </>
                    )}
                  </button>
                </div>

                {/* READ-ONLY PREVIEW MODE */}
                {!isEditingDxTx ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Diagnósticos Preview */}
                    <div className={`${themeTokens.cardInnerSurface} p-4 rounded-2xl border space-y-2`}>
                      <div className="flex items-center justify-between">
                        <span className="font-black text-[11px] text-teal-700 dark:text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" /> DIAGNÓSTICOS REGISTRADOS
                        </span>
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                          {dxNodes.length} ítems
                        </span>
                      </div>
                      <pre className="font-sans text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-medium leading-relaxed bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 min-h-[80px]">
                        {diagnosesModified || 'Sin diagnósticos registrados.'}
                      </pre>
                    </div>

                    {/* Tratamiento Preview */}
                    <div className={`${themeTokens.cardInnerSurface} p-4 rounded-2xl border space-y-2`}>
                      <div className="flex items-center justify-between">
                        <span className="font-black text-[11px] text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5" /> TRATAMIENTO Y MEDICAMENTOS
                        </span>
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                          {txNodes.filter(n => n.text.trim().length > 0).length > 0
                            ? `${txNodes.filter(n => n.text.trim().length > 0).length} ítems`
                            : SINTOMATICO_LABEL}
                        </span>
                      </div>
                      <pre className="font-sans text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-medium leading-relaxed bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 min-h-[80px]">
                        {normalizeTreatmentDisplay(treatmentModified)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  /* FULL EDITING MODE */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                    {/* Diagnósticos Tree Editor */}
                    <div data-tutorial="evo-dx-editor" className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <label className="block font-black text-teal-700 dark:text-teal-400 uppercase tracking-widest text-[10px]">DIAGNÓSTICOS (EDICIÓN Y REORDENAMIENTO)</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedPatient) {
                                const fresh = getPatientDiagnosesAsText(selectedPatient);
                                setDiagnosesModified(fresh);
                                liveSyncEvolutionToPatient(fresh, treatmentModified);
                              }
                            }}
                            title="Recargar diagnósticos actuales de la ficha del paciente"
                            className="text-[9.5px] font-bold text-teal-800 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/40 hover:bg-teal-200 dark:hover:bg-teal-800/60 px-2 py-0.5 rounded-md border border-teal-300 dark:border-teal-700 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>Recargar</span>
                          </button>
                          <span className="text-[9.5px] font-bold text-teal-700 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                            Sincronizado
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2 bg-slate-100/90 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-300 dark:border-slate-800">
                        {(() => {
                          const mainBranches = getDxBranches(dxNodes);
                          let branchCounter = -1;

                          return dxNodes.map((node, index) => {
                            if (node.level === 1) {
                              branchCounter++;
                            }
                            const thisBranchIdx = branchCounter;

                            return (
                              <div 
                                key={node.id} 
                                className={`flex items-start gap-2 transition-all ${
                                  node.level === 1 ? 'pl-0' : node.level === 2 ? 'pl-4 sm:pl-6' : 'pl-8 sm:pl-12'
                                }`}
                              >
                                {node.level === 1 ? (
                                  <div className="shrink-0 flex items-center gap-1 pt-1.5">
                                    <select
                                      value={thisBranchIdx + 1}
                                      onChange={e => handleMoveDxBranch(thisBranchIdx, parseInt(e.target.value) - 1)}
                                      className="bg-teal-50 dark:bg-teal-950/90 text-teal-800 dark:text-teal-300 border border-teal-400 dark:border-teal-500/50 rounded-lg px-1 py-1 font-mono font-black text-xs cursor-pointer outline-none focus:ring-1 focus:ring-teal-500 hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors shadow-2xs"
                                      title="Cambiar número de orden (mueve el diagnóstico principal y sus sub-diagnósticos asociados)"
                                    >
                                      {mainBranches.map((_, bIdx) => (
                                        <option key={bIdx} value={bIdx + 1}>
                                          {bIdx + 1}.
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <span className="font-mono font-black text-xs text-teal-700 dark:text-teal-400 shrink-0 min-w-[32px] pt-2">
                                    {node.numberStr}
                                  </span>
                                )}

                                <div className="flex-1 relative">
                                  <textarea
                                    ref={el => {
                                      if (el) {
                                        el.style.height = 'auto';
                                        el.style.height = `${Math.max(38, el.scrollHeight)}px`;
                                      }
                                    }}
                                    rows={1}
                                    value={node.text}
                                    onFocus={() => setFocusedDxIndex(index)}
                                    onBlur={() => setTimeout(() => setFocusedDxIndex(null), 200)}
                                    onChange={e => {
                                      handleUpdateDxNodeText(index, e.target.value);
                                      e.target.style.height = 'auto';
                                      e.target.style.height = `${Math.max(38, e.target.scrollHeight)}px`;
                                    }}
                                    placeholder={node.level === 1 ? 'Agregar diagnóstico principal...' : node.level === 2 ? 'Agregar sub-diagnóstico...' : 'Agregar sub-sub-diagnóstico...'}
                                    className={`w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 leading-snug whitespace-pre-wrap break-words resize-none overflow-hidden transition-all ${
                                      node.level === 1 ? 'font-bold text-slate-900 dark:text-teal-200' : node.level === 2 ? 'font-semibold text-slate-800 dark:text-teal-100/90' : 'text-slate-700 dark:text-slate-200'
                                    }`}
                                  />
                                  {focusedDxIndex === index && node.text.trim().length > 0 && (() => {
                                    const pool = node.level === 1 ? mainDiagnosisSuggestions : subDiagnosisSuggestions;
                                    const filtered = pool
                                      .filter(s => s.toLowerCase().includes(node.text.toLowerCase()))
                                      .slice(0, 8);
                                    if (filtered.length === 0) return null;
                                    return (
                                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-teal-500 rounded-xl shadow-2xl z-[150] max-h-48 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                                        {filtered.map((sugg, sIdx) => (
                                          <button
                                            key={sIdx}
                                            type="button"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              handleUpdateDxNodeText(index, sugg);
                                              setFocusedDxIndex(null);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-900/60 font-semibold transition-colors flex items-center justify-between cursor-pointer"
                                          >
                                            <span>{sugg}</span>
                                            <span className="text-[9px] text-teal-700 dark:text-teal-400 font-bold uppercase shrink-0 ml-2">
                                              {node.level === 1 ? 'Dx' : 'Sub-Dx'}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 pt-1">
                                  {node.level < 3 && (
                                    <button
                                      type="button"
                                      onClick={() => node.level === 1 ? handleAddDxSub(index) : handleAddDxSubSub(index)}
                                      className="px-2 py-1 bg-teal-100 hover:bg-teal-200 dark:bg-teal-600/20 dark:hover:bg-teal-600/30 text-teal-800 dark:text-teal-300 rounded-lg text-[10px] font-bold border border-teal-300 dark:border-teal-500/30 transition-all cursor-pointer"
                                      title={node.level === 1 ? 'Agregar Sub-Diagnóstico (1.1)' : 'Agregar Sub-Sub-Diagnóstico (1.2.1)'}
                                    >
                                      + Sub
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDxNode(index)}
                                    className="p-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 rounded-lg transition-all cursor-pointer"
                                    title="Eliminar diagnóstico"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          });
                        })()}

                        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-300 dark:border-slate-800/80">
                          <button
                            type="button"
                            onClick={handleAddDxMain}
                            className="px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Diagnóstico Principal</span>
                          </button>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 italic">
                            Total: {dxNodes.length} ítems
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tratamiento Editor */}
                    <div data-tutorial="evo-tx-editor" className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <label className="block font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest text-[10px]">TRATAMIENTO (CON BOTÓN NO CUMPLIDO)</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedPatient) {
                                const fresh = selectedPatient.treatment || '';
                                setTreatmentModified(fresh);
                                liveSyncEvolutionToPatient(diagnosesModified, fresh);
                              }
                            }}
                            title="Recargar tratamiento actual de la ficha del paciente"
                            className="text-[9.5px] font-bold text-indigo-800 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-200 dark:hover:bg-indigo-800/60 px-2 py-0.5 rounded-md border border-indigo-300 dark:border-indigo-700 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>Recargar</span>
                          </button>
                          <span className="text-[9.5px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                            Sincronizado
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2 bg-indigo-50/75 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-500/20">
                        {txNodes.map((node, index) => (
                          <div 
                            key={node.id} 
                            className={`p-3 border rounded-xl space-y-2.5 transition-all shadow-xs ${
                              node.isCulminado
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/60'
                                : node.isNoCumplido 
                                ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/60 ring-1 ring-rose-500/20' 
                                : 'bg-white dark:bg-slate-900/90 border-indigo-200 dark:border-indigo-500/30'
                            }`}
                          >
                            <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                              <span className="font-mono font-black text-xs text-indigo-700 dark:text-indigo-400 shrink-0 min-w-[28px] pt-2">
                                {node.numberStr}
                              </span>
                              <div className="flex-1 min-w-[160px] relative">
                                <textarea
                                  ref={el => {
                                    if (el) {
                                      el.style.height = 'auto';
                                      el.style.height = `${Math.max(38, el.scrollHeight)}px`;
                                    }
                                  }}
                                  rows={1}
                                  value={node.text}
                                  onFocus={() => setFocusedTxIndex(index)}
                                  onBlur={() => setTimeout(() => setFocusedTxIndex(null), 200)}
                                  onChange={e => {
                                    handleUpdateTxNodeText(index, e.target.value);
                                    e.currentTarget.style.height = 'auto';
                                    e.currentTarget.style.height = `${Math.max(38, e.currentTarget.scrollHeight)}px`;
                                  }}
                                  placeholder="Nombre del medicamento (si se deja vacío dirá Sintomático)..."
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold text-xs focus:outline-none focus:border-indigo-500 leading-snug whitespace-pre-wrap break-words resize-none overflow-hidden transition-all"
                                />
                                {focusedTxIndex === index && node.text.trim().length > 0 && (() => {
                                  const filtered = allTreatmentSuggestions
                                    .filter(s => s.toLowerCase().includes(node.text.toLowerCase()))
                                    .slice(0, 8);
                                  if (filtered.length === 0) return null;
                                  return (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-indigo-500 rounded-xl shadow-2xl z-[150] max-h-48 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                                      {filtered.map((sugg, sIdx) => (
                                        <button
                                          key={sIdx}
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleUpdateTxNodeText(index, sugg);
                                            setFocusedTxIndex(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs text-slate-800 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/60 font-bold transition-colors flex items-center justify-between cursor-pointer"
                                        >
                                          <span>{sugg}</span>
                                          <span className="text-[9px] text-indigo-700 dark:text-indigo-400 font-bold uppercase shrink-0 ml-2">Medicamento</span>
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {!node.isCulminado && (
                                  <>
                                    {/* Botón Requerido: (no cumplido) */}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleTxNoCumplido(index)}
                                      className={`px-2 py-1.5 rounded-lg text-[10.5px] font-black border transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                                        node.isNoCumplido 
                                          ? 'bg-rose-600 text-white border-rose-500 shadow-sm' 
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-rose-500/50 hover:text-rose-700 dark:hover:text-rose-300'
                                      }`}
                                      title="Marcar medicamento como no cumplido para este día"
                                    >
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      <span>{node.isNoCumplido ? '⚠️ No cumplido' : '(no cumplido)'}</span>
                                    </button>

                                    {/* Botón Requerido: Tratamiento culminado */}
                                    <button
                                      type="button"
                                      disabled={!node.text.trim()}
                                      onClick={() =>
                                        setConfirmCulminadoTxId(prev => (prev === node.id ? null : node.id))
                                      }
                                      className="px-2 py-1.5 rounded-lg text-[10.5px] font-black border transition-all shrink-0 cursor-pointer flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Marcar tratamiento como culminado y mover al final de la lista"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Tratamiento culminado</span>
                                    </button>
                                  </>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteTxNode(index)}
                                  className="p-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 rounded-lg transition-all cursor-pointer shrink-0"
                                  title="Eliminar tratamiento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Confirmación de Tratamiento Culminado */}
                            {confirmCulminadoTxId === node.id && !node.isCulminado && (
                              <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-100/90 dark:bg-emerald-950/80 p-2.5 rounded-lg border border-emerald-400 dark:border-emerald-600/60">
                                <span className="text-[11px] font-black text-emerald-900 dark:text-emerald-200">
                                  {(() => {
                                    const d = calculateDiasCumplidos(node.startDate);
                                    return `¿Confirmar que culminó "${node.text.trim()}"? Se moverá al final con Inicio (${node.startDate || new Date().toISOString().split('T')[0]}) y ${d} ${d === 1 ? 'día cumplido' : 'días cumplidos'}.`;
                                  })()}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmTxCulminado(index)}
                                    className="px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-black cursor-pointer shadow-xs"
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmCulminadoTxId(null)}
                                    className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Etiqueta de Tratamiento Culminado + Fechas de Inicio/Culminación + Readministrar */}
                            {node.isCulminado && (
                              <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-100/90 dark:bg-emerald-900/40 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700/60 text-[11px] font-black text-emerald-900 dark:text-emerald-200">
                                <span className="flex items-center gap-1.5 flex-wrap">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>
                                    TRATAMIENTO CULMINADO · Inicio: {node.startDate} · Culminación:{' '}
                                    {node.culminatedDate || new Date().toISOString().split('T')[0]} ·{' '}
                                    {node.culminadoDias || calculateTotalActiveDays(node)}{' '}
                                    {(node.culminadoDias || calculateTotalActiveDays(node)) === 1
                                      ? 'día cumplido'
                                      : 'días cumplidos'}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  data-testid={`tx-readministrar-btn-${index}`}
                                  onClick={() => handleReadministrarTx(index)}
                                  title="Readministrar medicamento continuando el conteo de días previos sin contar días de pausa"
                                  className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 transition-all shrink-0"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Readministrar</span>
                                </button>
                              </div>
                            )}

                            {/* Optional cause field if Marked as No Cumplido */}
                            {node.isNoCumplido && !node.isCulminado && (
                              <div className="flex items-center gap-2 bg-rose-100/80 dark:bg-rose-950/80 p-2 rounded-lg border border-rose-300 dark:border-rose-500/30">
                                <span className="text-[10px] font-black text-rose-800 dark:text-rose-300 uppercase shrink-0">Causa / Motivo:</span>
                                <input
                                  type="text"
                                  value={node.noCumplidoMotivo || ''}
                                  onChange={e => handleUpdateTxNoCumplidoMotivo(index, e.target.value)}
                                  placeholder="Ej: falta de insumo, vómitos, indicación médica..."
                                  className="w-full bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/40 rounded-md px-2 py-1 text-xs text-rose-900 dark:text-rose-100 font-bold outline-none placeholder:text-rose-500/60 dark:placeholder:text-rose-300/50"
                                />
                              </div>
                            )}

                            {/* Dosage & Administration Date Controls Grid */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 pt-1 bg-indigo-50/70 dark:bg-slate-950/60 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-500/20">
                              {/* 1. Dosis (oculta /kg cuando es gotas para nebulización) */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-extrabold text-indigo-800 dark:text-indigo-300 uppercase shrink-0">Dosis:</span>
                                <input
                                  type="number"
                                  step="any"
                                  value={node.doseValue || ''}
                                  onChange={e => handleUpdateTxNodeDoseValue(index, e.target.value)}
                                  placeholder="Ej: 50"
                                  className="w-24 sm:w-28 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-500/40 rounded-md px-2.5 py-1 text-xs font-black text-amber-700 dark:text-amber-300 outline-none focus:border-amber-500 text-right"
                                />
                                <select
                                  aria-label="Unidad de dosis"
                                  data-testid={`tx-dose-unit-select-${index}`}
                                  value={node.doseUnit || 'mg'}
                                  onChange={e => handleUpdateTxNodeDoseUnit(index, e.target.value as DoseUnit)}
                                  className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-500/40 rounded-md px-1.5 py-1 text-[11px] font-bold text-indigo-800 dark:text-indigo-200 outline-none cursor-pointer"
                                >
                                  <option value="mg">mg</option>
                                  <option value="ui">ui</option>
                                  <option value="gr">gr</option>
                                  <option value="mcg">mcg</option>
                                  <option value="mEq">mEq</option>
                                  <option value="gotas">gotas</option>
                                </select>
                                <span
                                  data-testid={`tx-dose-per-weight-${index}`}
                                  className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300"
                                >
                                  {node.doseUnit === 'gotas' ? '/' : '/kg/'}
                                </span>
                                <select
                                  aria-label="Base de dosis"
                                  value={node.doseBasis || 'día'}
                                  onChange={e => handleUpdateTxNodeDoseBasis(index, e.target.value as any)}
                                  className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-500/40 rounded-md px-1.5 py-1 text-[11px] font-bold text-indigo-800 dark:text-indigo-200 outline-none cursor-pointer"
                                >
                                  <option value="dosis">dosis</option>
                                  <option value="día">día</option>
                                </select>

                                {node.doseBasis === 'dosis' && (
                                  <select
                                    aria-label="Intervalo de horas por dosis"
                                    value={node.doseIntervalHours || '6'}
                                    onChange={e =>
                                      handleUpdateTxNodeDoseIntervalHours(index, e.target.value as DoseIntervalHours)
                                    }
                                    className="bg-amber-50 dark:bg-amber-950/60 border border-amber-400 dark:border-amber-500/50 rounded-md px-1.5 py-1 text-[11px] font-black text-amber-800 dark:text-amber-300 outline-none cursor-pointer"
                                    title="Cada cuántas horas se administra la dosis"
                                  >
                                    {DOSE_INTERVAL_OPTIONS.map(hrs => (
                                      <option key={hrs} value={hrs}>
                                        c/{hrs}h ({hrs} h)
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>

                              {/* 2. Fecha de Administración & Días Cumplidos */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold text-indigo-800 dark:text-indigo-300 uppercase shrink-0">
                                    {node.priorCompletedDays ? 'Reinicio:' : 'Inicio:'}
                                  </span>
                                  <input
                                    type="date"
                                    value={node.startDate || new Date().toISOString().split('T')[0]}
                                    onChange={e => handleUpdateTxNodeStartDate(index, e.target.value)}
                                    className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-500/40 rounded-md px-2 py-1 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <div
                                  data-testid={`tx-days-badge-${index}`}
                                  className="bg-emerald-100/90 dark:bg-indigo-900/60 border border-emerald-300 dark:border-indigo-500/40 px-2 py-1 rounded-md text-[10.5px] font-black text-emerald-800 dark:text-emerald-300 shrink-0"
                                >
                                  {(() => {
                                    const d = node.isCulminado
                                      ? node.culminadoDias || calculateTotalActiveDays(node)
                                      : calculateTotalActiveDays(node);
                                    return node.isCulminado
                                      ? `${d} ${d === 1 ? 'día cumplido' : 'días cumplidos'}`
                                      : node.priorCompletedDays
                                        ? `Día ${d} cumplido (+${node.priorCompletedDays} prev.)`
                                        : `Día ${d} cumplido`;
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        <div className="pt-2 flex items-center justify-between gap-2 border-t border-indigo-200 dark:border-indigo-800/30">
                          <button
                            type="button"
                            onClick={handleAddTxMain}
                            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Tratamiento</span>
                          </button>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 italic">
                            {txNodes.filter(n => n.text.trim().length > 0).length > 0
                              ? `Total: ${txNodes.filter(n => n.text.trim().length > 0).length} ítems`
                              : `Sin medicamentos → ${SINTOMATICO_LABEL}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Signos Vitales */}
              <div data-tutorial="evo-signos-vitales" className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-teal-500" /> Signos Vitales
                    </label>
                    <span className="text-[9.5px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 shadow-2xs">
                      💾 Guardado auto para sig. evolución
                    </span>
                  </div>
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-950/80 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
                    Valores normales ({currentNormalVitals.ageCategory}): T° {currentNormalVitals.temp} · FC {currentNormalVitals.fc} · FR {currentNormalVitals.fr} · TA {currentNormalVitals.ta} · SO2 {currentNormalVitals.so2}
                  </span>
                </div>

                {/* Grid with locked unit suffixes (Solo Números) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { 
                      label: 'T°C', 
                      value: vitalTemp, 
                      setter: (val: string) => handleVitalChange('temp', val), 
                      placeholder: currentNormalVitals.temp.replace(/[^\d.]/g, ''),
                      unit: '°C',
                      inputMode: 'decimal' as const,
                    },
                    { 
                      label: 'FC', 
                      value: vitalFC, 
                      setter: (val: string) => handleVitalChange('fc', val), 
                      placeholder: currentNormalVitals.fc.replace(/[^\d]/g, ''),
                      unit: 'bpm',
                      inputMode: 'decimal' as const,
                    },
                    { 
                      label: 'FR', 
                      value: vitalFR, 
                      setter: (val: string) => handleVitalChange('fr', val), 
                      placeholder: currentNormalVitals.fr.replace(/[^\d]/g, ''),
                      unit: 'rpm',
                      inputMode: 'decimal' as const,
                    },
                    { 
                      label: 'TA', 
                      value: vitalTA, 
                      setter: (val: string) => handleVitalChange('ta', val), 
                      placeholder: '',
                      unit: 'mmHg',
                      inputMode: 'numeric' as const,
                    },
                    { 
                      label: 'SO2', 
                      value: vitalSO2, 
                      setter: (val: string) => handleVitalChange('so2', val), 
                      placeholder: currentNormalVitals.so2.replace(/[^\d.]/g, ''),
                      unit: '%',
                      inputMode: 'decimal' as const,
                    },
                    { 
                      label: 'PESO', 
                      value: vitalPeso, 
                      setter: (val: string) => handleVitalChange('peso', val), 
                      placeholder: selectedPatient ? `${selectedPatient.weightKg}` : '0',
                      unit: 'kg',
                      inputMode: 'decimal' as const,
                    },
                  ].map((vit) => (
                    <div key={vit.label} className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">{vit.label}</span>
                      <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500 transition-all shadow-xs">
                        <input
                          type="text"
                          inputMode={vit.inputMode}
                          data-evolution-vital={vit.label}
                          value={vit.value}
                          onChange={e => vit.setter(e.target.value)}
                          placeholder={vit.placeholder}
                          className="w-full bg-transparent p-2 text-right text-xs font-bold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 placeholder:italic placeholder:font-normal pr-1"
                        />
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-extrabold text-[10px] px-1.5 py-2 border-l border-slate-200 dark:border-slate-700 select-none pointer-events-none shrink-0 min-w-[38px] text-center">
                          {vit.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Apoyo de Oxigeno toggle */}
                <div data-tutorial="evo-oxigeno-balance" className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-cyan-500" />
                      <span className="font-bold">Apoyo de Oxígeno:</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-900 p-1 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setHasOxygenSupport(false)}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${!hasOxygenSupport ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >Sin O2</button>
                      <button 
                        type="button"
                        onClick={() => setHasOxygenSupport(true)}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${hasOxygenSupport ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >Con O2</button>
                    </div>
                  </div>

                  {/* Expanded Oxygen Support Details Sub-section */}
                  {hasOxygenSupport && (
                    <div data-tutorial="evo-o2-params" className="p-3 bg-cyan-50/80 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-xl space-y-3 animate-fadeIn">
                      <div className="font-black text-cyan-900 dark:text-cyan-200 text-[10.5px] uppercase tracking-wider flex items-center gap-1.5">
                        <Wind className="w-3.5 h-3.5 text-cyan-500" /> Parámetros del Apoyo Ventilatorio
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {/* 1. Modalidad */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block uppercase">Modalidad / Dispositivo</label>
                          <select
                            value={o2Modalidad}
                            onChange={e => setO2Modalidad(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-lg p-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-cyan-500"
                          >
                            <option value="Cánula nasal">Cánula Nasal</option>
                            <option value="Mascarilla simple">Mascarilla Simple</option>
                            <option value="Mascarilla con reservorio">Mascarilla con Reservorio</option>
                            <option value="Sistema Venturi">Sistema Venturi</option>
                            <option value="CPAP">CPAP</option>
                            <option value="Cánula de alto flujo (CNAF)">Cánula de Alto Flujo (CNAF)</option>
                            <option value="Ventilación mecánica">Ventilación Mecánica</option>
                          </select>
                        </div>

                        {/* 2. Litros por minuto */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block uppercase">Flujo (Litros / min)</label>
                          <div className="relative flex items-center bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-cyan-500">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={o2FlowLmin}
                              onChange={e => setO2FlowLmin(sanitizeNumericDecimal(e.target.value))}
                              placeholder="3"
                              className="w-full bg-transparent p-2 text-right text-xs font-bold text-slate-900 dark:text-slate-100 outline-none pr-1"
                            />
                            <span className="bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 font-extrabold text-[10px] px-2 py-2 border-l border-cyan-200 dark:border-cyan-700 select-none pointer-events-none shrink-0">
                              L/min
                            </span>
                          </div>
                        </div>

                        {/* 3. Humedad */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block uppercase">Humedad</label>
                          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 p-1 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setO2Type('Seco')}
                              className={`flex-1 py-1 rounded-md font-bold text-xs transition-all ${o2Type === 'Seco' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            >
                              Seco
                            </button>
                            <button
                              type="button"
                              onClick={() => setO2Type('Húmedo')}
                              className={`flex-1 py-1 rounded-md font-bold text-xs transition-all ${o2Type === 'Húmedo' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            >
                              Húmedo
                            </button>
                          </div>
                        </div>

                        {/* 4. FiO2 */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block uppercase">FiO₂ (%)</label>
                          <div className="relative flex items-center bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-cyan-500">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={o2FiO2}
                              onChange={e => setO2FiO2(sanitizeNumericDecimal(e.target.value))}
                              placeholder="21"
                              className="w-full bg-transparent p-2 text-right text-xs font-bold text-slate-900 dark:text-slate-100 outline-none pr-1"
                            />
                            <span className="bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 font-extrabold text-[10px] px-2 py-2 border-l border-cyan-200 dark:border-cyan-700 select-none pointer-events-none shrink-0">
                              %
                            </span>
                          </div>
                        </div>

                        {/* 5. SO2 con O2 */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block uppercase">SO₂ con O₂ (%)</label>
                          <div className="relative flex items-center bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-cyan-500">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={o2So2}
                              onChange={e => setO2So2(sanitizeNumericDecimal(e.target.value))}
                              placeholder="98"
                              className="w-full bg-transparent p-2 text-right text-xs font-bold text-slate-900 dark:text-slate-100 outline-none pr-1"
                            />
                            <span className="bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 font-extrabold text-[10px] px-2 py-2 border-l border-cyan-200 dark:border-cyan-700 select-none pointer-events-none shrink-0">
                              %
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Balance Hídrico Pediátrico toggle & section */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blue-500" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">Balance Hídrico (24 Horas):</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-900 p-1 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setReqBalanceHidrico(false)}
                        className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${!reqBalanceHidrico ? 'bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >No requiere</button>
                      <button 
                        type="button"
                        onClick={() => setReqBalanceHidrico(true)}
                        className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${reqBalanceHidrico ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >Requiere BH</button>
                    </div>
                  </div>

                  {reqBalanceHidrico && (
                    <div data-tutorial="evo-balance-panel" className="p-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="font-black text-blue-900 dark:text-blue-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Droplets className="w-4 h-4 text-blue-500" /> Ingresos y Egresos de Líquidos (24h)
                        </div>
                        <span className="text-[10px] font-mono font-extrabold bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 px-2.5 py-1 rounded-lg border border-blue-300 dark:border-blue-700">
                          {liveInterpFU}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block uppercase">
                            Líquidos Ingeridos (cc / 24h) *
                          </label>
                          <input
                            type="number"
                            value={ingeridosCc}
                            onChange={e => setIngeridosCc(e.target.value)}
                            placeholder="Ej: 1200"
                            className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-xl p-2.5 font-black text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block uppercase">
                            Líquidos Excretados (cc / 24h) *
                          </label>
                          <input
                            type="number"
                            value={excretadosCc}
                            onChange={e => setExcretadosCc(e.target.value)}
                            placeholder="Ej: 950"
                            className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-xl p-2.5 font-black text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>

                      {/* Dynamic Calculated Summary Card */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-200 dark:border-blue-800 text-center font-bold shadow-2xs">
                        <div>
                          <span className="block text-[9px] text-slate-500 uppercase">Balance Neto</span>
                          <span className={`text-xs font-black ${liveBalanceNeto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {liveBalanceNeto > 0 ? `+${liveBalanceNeto}` : liveBalanceNeto} cc
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-slate-500 uppercase">Flujo Urinario (FU)</span>
                          <span className="text-xs font-black text-cyan-600 dark:text-cyan-400">
                            {liveFU.toFixed(2)} cc/kg/h
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-slate-500 uppercase">Superficie Corp (SC)</span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                            {liveSC.toFixed(2)} m²
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-slate-500 uppercase">Balance por SC</span>
                          <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                            {liveBalanceM2.toFixed(1)} cc/m²/día
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Examen Físico */}
              <div data-tutorial="evo-examen-fisico" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-indigo-500" /> Examen Físico del Día
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'piel', label: 'Piel y Faneras' },
                    { key: 'cabezaOjos', label: 'Cabeza y Ojos' },
                    { key: 'oidosOtoscopia', label: 'Oídos y Otoscopia' },
                    { key: 'narizOrofaringe', label: 'Nariz y Orofaringe' },
                    { key: 'cuello', label: 'Cuello' },
                    { key: 'toraxCP', label: 'Tórax y Pulmones (CP)' },
                    { key: 'cardiovascular', label: 'Cardiovascular' },
                    { key: 'abdomen', label: 'Abdomen' },
                    { key: 'genitourinario', label: 'Genitourinario' },
                    { key: 'extremidades', label: 'Extremidades' },
                    { key: 'neurologico', label: 'Neurológico' },
                  ].map((item) => (
                    <div 
                      key={item.key} 
                      data-tutorial={item.key === 'toraxCP' ? 'evo-examen-card-torax' : undefined}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        editingExamField === item.key 
                          ? 'sm:col-span-2 bg-white dark:bg-slate-900 border-2 border-teal-500 shadow-xl ring-4 ring-teal-500/10' 
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 group hover:border-teal-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <label className={`font-black uppercase tracking-wider text-[10px] ${
                          editingExamField === item.key ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {item.label}
                        </label>
                        <button 
                          type="button"
                          data-tutorial={item.key === 'toraxCP' ? 'evo-examen-edit-btn-torax' : undefined}
                          onClick={() => setEditingExamField(editingExamField === item.key ? null : item.key)}
                          className={`p-1.5 rounded-lg transition-all shadow-xs flex items-center gap-1 font-bold text-xs ${
                            editingExamField === item.key
                              ? 'bg-teal-600 text-white hover:bg-teal-500'
                              : 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-600 hover:text-white'
                          }`}
                          title={editingExamField === item.key ? 'Finalizar edición' : 'Editar texto'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          {editingExamField === item.key && <span>Guardar</span>}
                        </button>
                      </div>
                      
                      {editingExamField === item.key ? (
                        <div className="space-y-2.5">
                          <textarea
                            ref={el => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = `${Math.max(160, el.scrollHeight + 12)}px`;
                              }
                            }}
                            value={examenFisico[item.key as keyof typeof examenFisico]}
                            onChange={e => {
                              setExamenFisico({...examenFisico, [item.key]: e.target.value});
                              e.currentTarget.style.height = 'auto';
                              e.currentTarget.style.height = `${Math.max(160, e.currentTarget.scrollHeight + 12)}px`;
                            }}
                            autoFocus
                            placeholder={`Describa hallazgos detallados de ${item.label}...`}
                            className="w-full bg-slate-50/50 dark:bg-slate-950/80 border-2 border-teal-500/50 rounded-xl p-3.5 text-slate-900 dark:text-slate-100 font-medium leading-relaxed focus:outline-none focus:border-teal-500 text-xs sm:text-sm min-h-[160px] shadow-inner resize-y transition-all"
                            style={{ overflowY: 'hidden' }}
                          />
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                            <span>Cuadro expandido automáticamente para ver todo el contenido sin barras de desplazamiento</span>
                            <button
                              type="button"
                              onClick={() => setEditingExamField(null)}
                              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Listo</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-700 dark:text-slate-300 font-normal leading-relaxed text-xs whitespace-pre-wrap">
                          {examenFisico[item.key as keyof typeof examenFisico] || 'Sin hallazgos descritos.'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Comentarios y Plan del Especialista / Pase de Sala */}
              <div data-tutorial="evo-comentarios-plan" className="bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/80 p-4 sm:p-5 rounded-2xl space-y-3.5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-amber-950 dark:text-amber-200 text-sm flex items-center gap-2">
                        Comentarios y Plan del Especialista
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                          Pase de Visita
                        </span>
                      </h4>
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 font-medium">
                        Indicaciones, acuerdos de ronda médica y plan terapéutico dictado por el médico especialista.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Atajos rápidos de sugerencias clínicas */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const text = 'En revista médica con especialista de guardia el mismo decide.';
                      setComentariosPlan(text);
                      setMedicalRoundSummary(text);
                    }}
                    className="text-[11px] bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 font-bold px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700/60 transition-all cursor-pointer active:scale-95 text-left flex items-center gap-1 shadow-2xs"
                  >
                    ⚡ En revista médica con especialista de guardia el mismo decide.
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const text = 'En revista médica con especialista de guardia el mismo decide Mantener indicaciones';
                      setComentariosPlan(text);
                      setMedicalRoundSummary(text);
                    }}
                    className="text-[11px] bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 font-bold px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700/60 transition-all cursor-pointer active:scale-95 text-left flex items-center gap-1 shadow-2xs"
                  >
                    ⚡ En revista médica con especialista de guardia el mismo decide Mantener indicaciones
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    ref={el => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = `${Math.max(110, el.scrollHeight + 4)}px`;
                      }
                    }}
                    value={comentariosPlan}
                    onChange={e => {
                      const val = e.target.value;
                      setComentariosPlan(val);
                      setMedicalRoundSummary(val);
                      e.currentTarget.style.height = 'auto';
                      e.currentTarget.style.height = `${Math.max(110, e.currentTarget.scrollHeight + 4)}px`;
                    }}
                    rows={4}
                    placeholder="Escriba aquí los comentarios, modificaciones o plan de trabajo dictados por el especialista..."
                    className="w-full bg-white dark:bg-slate-900/90 border-2 border-amber-300 dark:border-amber-700/80 rounded-xl p-3.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-amber-500/15 focus:border-amber-500 font-medium text-xs sm:text-sm leading-relaxed min-h-[110px] resize-y shadow-xs transition-all"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 pb-12">
                <button
                  type="button"
                  onClick={handleCloseEvolutionModal}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-all cursor-pointer"
                  title="Cerrar y guardar cambios automáticamente"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  data-tutorial="evo-btn-ordenes"
                  onClick={() => selectedPatient ? handleOpenOrdenesModal(selectedPatient) : setShowOrdenesMedicasModal(true)}
                  className="ordenes-btn-neon-yellow w-full sm:flex-1 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-slate-950 border border-yellow-300 font-black rounded-2xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4 text-slate-950" />
                  <span>Redactar / Ver Órdenes Médicas</span>
                  {activeEvolutionOrders && activeEvolutionOrders.length > 0 && (
                    <span className="bg-slate-950 text-yellow-300 text-xs px-2 py-0.5 rounded-full font-black">
                      {activeEvolutionOrders.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  data-tutorial="evo-btn-guardar"
                  onClick={() => handleSaveEvolution(false)}
                  className="w-full sm:flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white font-black rounded-2xl shadow-xl shadow-teal-600/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <FileCheck className="w-5 h-5" />
                  <span>{todayEvolution ? 'Actualizar Evolución Médica' : 'Guardar & Registrar Evolución'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SUBIR DOCUMENTOS */}
      {showDocUploadModal && selectedPatient && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-500" /> Subir Documento o laboratorios
              </h3>
              <button onClick={() => setShowDocUploadModal(false)} className="text-xs text-slate-400 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Categoría del Documento *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Laboratorios', 'Rx', 'Eco', 'Referencia'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setUploadCategory(cat)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                        uploadCategory === cat
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {cat === 'Rx' ? 'Rx (Rayos X)' : cat === 'Eco' ? 'Eco (Ecografía)' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botón requerido: Redireccionar a la pestaña LABORATORIOS */}
              {uploadCategory === 'Laboratorios' && (
                <div className="p-3 bg-gradient-to-r from-teal-500/10 to-indigo-500/10 border border-teal-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                        ¿Desea ingresar o editar la tabla de Laboratorios?
                      </p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
                        Abra la nueva pestaña de LABORATORIOS para cargar valores con 1 clic (normales estándar) y sincronizarlos con la Historia Clínica.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDocUploadModal(false);
                      if (onOpenLaboratorios) {
                        onOpenLaboratorios(selectedPatient.id);
                      }
                    }}
                    className="w-full py-2 px-3 bg-teal-600 hover:bg-teal-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <FlaskConical className="w-4 h-4" />
                    <span>Ir a LABORATORIOS de {selectedPatient.firstName}</span>
                  </button>
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Título / Descripción</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="e.g. Rx de tórax AP"
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Seleccionar Archivo</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileUpload}
                  className="w-full text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300"
                />
              </div>

              {uploadDataUrl && (
                <div className="border border-indigo-200 dark:border-indigo-800 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200">
                  <p className="font-bold">✓ Archivo preparado:</p>
                  <p className="truncate text-[11px]">{uploadFileName}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDocUploadModal(false)} className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs">Cancelar</button>
              <button onClick={handleConfirmDocUpload} disabled={!uploadDataUrl} className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs disabled:opacity-50">Subir & Adjuntar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PERFIL DEL PACIENTE */}
      {showViewProfileModal && selectedPatient && (
        <div className={`fixed inset-0 ${themeTokens.rootCanvas} z-[100] overflow-y-auto no-print`}>
          <div className="min-h-screen w-full px-3 py-4 sm:p-8 space-y-4 sm:space-y-6 text-slate-900 dark:text-slate-100">
            <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-4 flex-wrap gap-3`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-extrabold text-slate-600 dark:text-slate-400">
                    Perfil del Paciente & Historial de Archivos
                  </h3>
                  <div className="mt-1">
                    <span className="text-base sm:text-xl font-black text-slate-900 dark:text-white bg-gradient-to-r from-teal-500/15 via-emerald-500/15 to-cyan-500/15 px-3.5 py-1.5 rounded-xl border border-teal-500/35 shadow-xs inline-block">
                      {selectedPatient.lastName}, {selectedPatient.firstName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Botón de 2 Pasos para Eliminar Paciente (EXCLUSIVO PARA EL ADMINISTRADOR) */}
                {isAdmin && (
                  deleteConfirmStep === 0 ? (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmStep(1)}
                      className="px-3 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 font-extrabold text-xs rounded-xl border border-red-300 dark:border-red-800/80 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
                      title="Eliminar paciente y liberar cama"
                    >
                      <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span>Eliminar Paciente</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/40 p-1.5 rounded-xl animate-in fade-in zoom-in-95">
                      <span className="text-[11px] font-bold text-red-700 dark:text-red-300 px-1">
                        ¿Confirmar eliminación?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeletePatientDirectly(selectedPatient.id)}
                        className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-lg transition-all active:scale-95 cursor-pointer shadow-md"
                      >
                        Sí, Eliminar Definitivamente
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmStep(0)}
                        className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  )
                )}

                <button 
                  type="button"
                  onClick={() => {
                    setDeleteConfirmStep(0);
                    setShowViewProfileModal(false);
                  }} 
                  className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-2 border-rose-400 dark:border-rose-500/80 shadow-xs dark:shadow-[0_0_15px_rgba(244,63,94,0.7)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center font-black"
                  title="Cerrar perfil"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl text-[11px] font-bold border border-slate-200 dark:border-slate-700/60">
              <div>Fecha Ingreso: <span className="text-teal-600 dark:text-teal-400 font-mono block sm:inline">{selectedPatient.admissionDate}</span></div>
              <div>Estancia Hosp.: <span className="text-amber-600 dark:text-amber-400 block sm:inline">{calculateHospitalizationTime(selectedPatient.admissionDate, selectedPatient.admissionTime).formatted}</span></div>
              <div>Edad: <span className="text-teal-600 dark:text-teal-400 block sm:inline">{selectedPatient.age}</span></div>
              <div>Peso: <span className="text-teal-600 dark:text-teal-400 block sm:inline">{selectedPatient.weightKg} kg</span></div>
              <div>Área: <span className="text-teal-600 dark:text-teal-400 block sm:inline">{selectedPatient.area}</span></div>
              <div>Cama: <span className="text-teal-600 dark:text-teal-400 block sm:inline">{selectedPatient.bedNumber}</span></div>
            </div>

            {/* Navigation Tabs: Expediente & Archivos vs Calendario de Evoluciones & Órdenes Médicas */}
            <div className="flex items-center gap-2 flex-wrap bg-slate-100/90 dark:bg-slate-900/70 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                data-testid="profile-tab-expediente"
                onClick={() => setProfileActiveTab('expediente')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  profileActiveTab === 'expediente'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4 text-violet-500" />
                <span>Expediente & Historial de Archivos</span>
              </button>
              <button
                type="button"
                data-testid="profile-tab-calendario"
                onClick={() => setProfileActiveTab('calendario_evoluciones')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  profileActiveTab === 'calendario_evoluciones'
                    ? 'bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/70'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                <span>Calendario de Evoluciones & Órdenes Médicas</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  profileActiveTab === 'calendario_evoluciones'
                    ? 'bg-white/20 text-white'
                    : 'bg-teal-500/15 text-teal-800 dark:text-teal-300'
                }`}>
                  {selectedPatient.evolutions.length}
                </span>
              </button>
            </div>

            {profileActiveTab === 'calendario_evoluciones' ? (
              <PatientEvolutionsCalendarTab
                patient={selectedPatient}
                initialSelectedDate={calendarInitialDate}
                onBackToProfile={() => setProfileActiveTab('expediente')}
                onOpenOrdenesModal={(ev) => setViewOrdenesEvolution({ patient: selectedPatient, evolution: ev })}
                onOpenPrintEvolutionModal={(ev) => setActivePrintEvolution(ev)}
              />
            ) : (
            <div className="space-y-4">

              {/* SECCIÓN REQUERIDA: Resumen Evolutivo (Cada 7 Días de Hospitalización - Oculto en modo visita) */}
              {!isVisitor && (() => {
                const selectedTime = calculateHospitalizationTime(selectedPatient.admissionDate, selectedPatient.admissionTime);
                const isProlonged = selectedTime.days >= 7;
                const savedResumenes = selectedPatient.resumenesEvolutivos || [];

                // Solo mostrar si tiene más de 7 días de hospitalizado, ya tiene resúmenes o es el paciente demo del tutorial
                if (!isProlonged && savedResumenes.length === 0 && !isTutorialDemoId(selectedPatient.id)) {
                  return null;
                }

                return (
                  <div data-tutorial="profile-resumen-evolutivo" className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-amber-500" /> Resumen Evolutivo (Seguimiento Cada 7 Días):
                      </h4>
                      {isProlonged ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/40 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-amber-500" /> Hospitalización Prolongada ({selectedTime.days} días)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                          Día {selectedTime.days} de 7 (Primer ciclo)
                        </span>
                      )}
                    </div>

                    <div className={`p-4 rounded-2xl border transition-all ${
                      isProlonged 
                        ? 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/20 dark:border-amber-900/60'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                    } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isProlonged 
                            ? 'bg-amber-500 text-slate-950' 
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900 dark:text-slate-100 text-xs">
                              Resumen Evolutivo de Hospitalización
                            </p>
                            {isProlonged ? (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500 text-slate-950 uppercase tracking-wide">
                                Requerido (&gt; 7 Días)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                Ciclo 1 en progreso
                              </span>
                            )}
                          </div>
                          <p className="text-[9.5px] text-amber-700 dark:text-amber-300 font-semibold mt-0.5">
                            Diagnósticos ingreso/actuales · Tratamiento · Ganancia de peso semanal · Examen físico · Labs seriados · Comentarios diarios
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          onClick={() => handleOpenResumenEvolutivo(selectedPatient)}
                          className={`px-3.5 py-2 font-black text-[10.5px] rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer ${
                            isProlonged
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/40'
                              : 'bg-teal-600 hover:bg-teal-500 text-white'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" /> VER / GENERAR RESUMEN (7 DÍAS)
                        </button>
                      </div>
                    </div>

                    {/* Resúmenes Evolutivos previamente guardados */}
                    {savedResumenes.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-500" /> Resúmenes Guardados ({savedResumenes.length}):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {savedResumenes.map(res => (
                            <div key={res.id} className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shadow-xs">
                              <div>
                                <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono font-black text-[9px] mb-1">
                                  SEMANA {res.weekNumber} (Días {(res.weekNumber - 1) * 7 + 1} - {res.weekNumber * 7})
                                </span>
                                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                  {res.endDate || res.createdAt?.split('T')[0]} · {res.doctorName}
                                </div>
                                <div className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                                  Peso: {res.diferenciaPesoGramos >= 0 ? `+${res.diferenciaPesoGramos}g` : `${res.diferenciaPesoGramos}g`} ({res.pesoActualKg} kg)
                                </div>
                              </div>
                              <button
                                onClick={() => handleOpenResumenEvolutivo(selectedPatient)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors"
                              >
                                <Eye className="w-3 h-3 text-amber-500" /> Ver
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Histórico de Evoluciones Diarias (Vista Mejorada + Acceso a Pestaña de Calendario & Órdenes) */}
              <PatientEvolutionsSummarySection
                patient={selectedPatient}
                onOpenCalendarTab={(dateStr) => {
                  setCalendarInitialDate(dateStr || null);
                  setProfileActiveTab('calendario_evoluciones');
                }}
                onOpenOrdenesModal={(ev) => setViewOrdenesEvolution({ patient: selectedPatient, evolution: ev })}
                onOpenPrintEvolutionModal={(ev) => setActivePrintEvolution(ev)}
              />

              {/* Documents List */}
              <div data-tutorial="profile-archivos-adjuntos" className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" /> Archivos Adjuntos:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedPatient.documents.map(doc => (
                    <div key={doc.id} className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{doc.title}</span>
                      <button onClick={() => setPreviewDoc(doc)} className="text-indigo-600 font-black hover:underline px-2">VER</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documento de Ingreso (al final del perfil) */}
              <div data-tutorial="profile-historia-ingreso" className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
                <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" /> Documento de Ingreso:
                </h4>
                {(() => {
                  const isReing = Boolean(selectedPatient.isReingreso || (selectedPatient.readmissions && selectedPatient.readmissions.length > 0));
                  const reingresoDateLabel = selectedPatient.lastReadmissionDate || selectedPatient.admissionDate || '';
                  const prevIds = (selectedPatient.previousHistoriaIds || []).filter(id => id && id !== selectedPatient.historiaClinicaId);
                  return (
                    <>
                      <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isReing
                          ? 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-300 dark:border-orange-500/50 shadow-[0_0_12px_rgba(249,115,22,0.2)]'
                          : 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isReing ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                          }`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 dark:text-slate-100 text-xs flex items-center gap-2 flex-wrap">
                              <span>
                                {isReing
                                  ? `Historia Clínica Pediátrica de Reingreso (${reingresoDateLabel})`
                                  : 'Historia Clínica Pediátrica'}
                              </span>
                              {isReing && (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black bg-orange-500 text-slate-950 uppercase">
                                  Reingreso
                                </span>
                              )}
                            </p>
                            <p className={`text-[9px] font-bold uppercase ${isReing ? 'text-orange-600 dark:text-orange-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                              EXPEDIENTE DE ADMISIÓN ACTUAL (8 PÁGINAS INCLUYENDO RESUMEN)
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 self-end sm:self-auto shrink-0">
                          {!isVisitor && (
                            <button
                              onClick={() => onOpenHistoriaClinicaForm(selectedPatient, 'editor', false, selectedPatient.historiaClinicaId)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-800 dark:text-teal-400 text-[10px] font-black rounded-lg flex items-center gap-1.5 transition-all border border-slate-300 dark:border-slate-700 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" /> EDITAR
                            </button>
                          )}
                          <button
                            data-tutorial="profile-btn-impresion-historia"
                            onClick={() => onOpenHistoriaClinicaForm(selectedPatient, 'preview', true, selectedPatient.historiaClinicaId)}
                            className={`px-3 py-1.5 text-white text-[10px] font-black rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                              isReing ? 'bg-orange-600 hover:bg-orange-500' : 'bg-indigo-600 hover:bg-indigo-500'
                            }`}
                          >
                            <Printer className="w-3 h-3" /> IMPRESIÓN PROFESIONAL
                          </button>
                        </div>
                      </div>

                      {prevIds.map((prevId, pIdx) => {
                        const prevHist = historias.find(item => item.id === prevId);
                        const prevFecha = prevHist?.reingresoDate || prevHist?.fechaIngreso || selectedPatient.readmissions?.[pIdx]?.previousAdmissionDate || 'Ingreso Anterior';
                        return (
                          <div key={prevId} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                  Historia Clínica Pediátrica Anterior ({prevFecha})
                                </p>
                                <p className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold uppercase">
                                  EXPEDIENTE HISTÓRICO PREVIO AL REINGRESO
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 self-end sm:self-auto shrink-0">
                              {!isVisitor && (
                                <button
                                  onClick={() => onOpenHistoriaClinicaForm(selectedPatient, 'editor', false, prevId)}
                                  className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" /> VER / EDITAR
                                </button>
                              )}
                              <button
                                onClick={() => onOpenHistoriaClinicaForm(selectedPatient, 'preview', true, prevId)}
                                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3 h-3" /> IMPRIMIR ANTERIOR
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>

              {/* Documento Constancia de Hospitalización (al final, oculto en modo visita) */}
              {!isVisitor && (
                <div data-tutorial="profile-constancia-hosp" className="space-y-2">
                  <h4 className="font-bold text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" /> Constancia de Hospitalización:
                  </h4>
                  <div className="bg-emerald-50/75 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 dark:bg-emerald-900/50 flex items-center justify-center shrink-0 border border-emerald-500/30">
                        <FileCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-slate-100 text-xs flex items-center gap-2 flex-wrap">
                          <span>
                            {selectedPatient.isReingreso
                              ? `Constancia de Hospitalización de Reingreso (${selectedPatient.lastReadmissionDate || selectedPatient.admissionDate})`
                              : 'Constancia de Hospitalización Oficial'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 uppercase">PDF Institucional</span>
                        </p>
                        <p className="text-[9.5px] text-emerald-800 dark:text-emerald-400 font-semibold mt-0.5">
                          Membrete del Ministerio para la Salud, Servicio de Pediatría y datos completos del paciente.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 self-end sm:self-auto shrink-0">
                      <button
                        onClick={() => setShowConstanciaHospitalizacionDoc(true)}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-white dark:text-emerald-300 border-2 border-emerald-600 dark:border-emerald-500/80 shadow-xs dark:shadow-[0_0_15px_rgba(16,185,129,0.7)] hover:scale-[1.02] active:scale-95 transition-all font-black text-xs rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" /> GENERAR CONSTANCIA
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Documento Nota de Recibimiento (al final del perfil) */}
              {!isVisitor && (
                <div data-tutorial="profile-nota-recibimiento" className="space-y-2 pb-4">
                  <h4 className="font-bold text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-sky-600 dark:text-sky-500" /> Nota de Recibimiento:
                  </h4>
                  <div className="bg-sky-50/75 dark:bg-sky-950/30 p-3.5 rounded-2xl border border-sky-200 dark:border-sky-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/20 dark:bg-sky-900/50 flex items-center justify-center shrink-0 border border-sky-500/30">
                        <ClipboardList className="w-5 h-5 text-sky-700 dark:text-sky-400" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-slate-100 text-xs flex items-center gap-2 flex-wrap">
                          <span>Nota de Recibimiento del Paciente</span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-500/30 uppercase">PDF 1 Hoja</span>
                        </p>
                        <p className="text-[9.5px] text-sky-800 dark:text-sky-400 font-semibold mt-0.5">
                          Informe de 1 hoja con Subjetivo y Objetivo editables desde la última evolución, signos vitales, diagnósticos y tratamiento.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowNotaRecibimientoDoc(true)}
                        className="px-4 py-2 bg-sky-700 hover:bg-sky-600 dark:bg-sky-500/20 dark:hover:bg-sky-500/30 text-white dark:text-sky-300 border-2 border-sky-600 dark:border-sky-500/80 shadow-xs dark:shadow-[0_0_15px_rgba(14,165,233,0.65)] hover:scale-[1.02] active:scale-95 transition-all font-black text-xs rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" /> NOTA DE RECIBIMIENTO
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Documento Referencia Médica Especializada (al final del perfil) */}
              {!isVisitor && (
                <div data-tutorial="profile-referencia-medica" className="space-y-2 pb-6">
                  <h4 className="font-bold text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Referencia Médica Especializada:
                  </h4>
                  <div className="bg-indigo-50/75 dark:bg-indigo-950/30 p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 dark:bg-indigo-900/50 flex items-center justify-center shrink-0 border border-indigo-500/30">
                        <Sparkles className="w-5 h-5 text-indigo-700 dark:text-indigo-300" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-slate-100 text-xs flex items-center gap-2 flex-wrap">
                          <span>Generador de Referencia Médica con IA</span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30 uppercase">
                            PDF Oficial
                          </span>
                        </p>
                        <p className="text-[9.5px] text-indigo-800 dark:text-indigo-300 font-semibold mt-0.5">
                          Indica la especialidad destino y motivo para redactar automáticamente la referencia institucional con los datos clínicos del paciente.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowReferenciaDoc(true)}
                        className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white border-2 border-indigo-600 dark:border-indigo-400/70 shadow-xs hover:scale-[1.02] active:scale-95 transition-all font-black text-xs rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" /> Referencia para...
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: CAMBIO DE ÁREA */}
      {showChangeAreaModal && selectedPatient && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2 uppercase tracking-tight">
              <ArrowRightLeft className="w-4 h-4" /> Traslado Hospitalario
            </h3>
            <p className="text-slate-600 dark:text-slate-300 font-medium">¿Trasladar a <strong>{selectedPatient.lastName}</strong> a una nueva área?</p>
            <div className="space-y-1">
              <label className="font-bold text-slate-500">Área Destino:</label>
              <select
                value={newTargetArea}
                onChange={e => setNewTargetArea(e.target.value as HospitalArea)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-black text-slate-900 dark:text-slate-100 outline-none"
              >
                {areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowChangeAreaModal(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold">Cancelar</button>
              <button onClick={handleConfirmChangeArea} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl shadow-md transition-all active:scale-95">Confirmar Traslado</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ALTA MÉDICA */}
      {showDischargeModal && selectedPatient && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-xl text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
              <UserCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Dar de Alta Médica</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium px-4">Al confirmar el alta de <strong>{selectedPatient.lastName}</strong>, se generará el documento de Resumen de Egreso.</p>
            </div>
            <div className="flex flex-col gap-2">
              <button data-tutorial="discharge-confirm-btn" onClick={handleConfirmDischarge} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95">CONFIRMAR ALTA & EGRESO</button>
              <button onClick={() => setShowDischargeModal(false)} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST DE GUARDADO INSTANTÁNEO */}
      {saveSuccessToast && (
        <div className="fixed top-6 right-6 z-[300] bg-emerald-600 dark:bg-emerald-500 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-300 font-bold text-sm shadow-emerald-950/30">
          <CheckCircle className="w-5 h-5 text-white shrink-0" />
          <span>{saveSuccessToast}</span>
        </div>
      )}

      {/* DOCUMENT PREVIEW & PDF VIEWERS */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-900/75 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[110] no-print">
          <div className={`${themeTokens.cardSurface} border rounded-2xl max-w-4xl w-full p-4 flex flex-col h-[85vh] text-slate-900 dark:text-white shadow-2xl`}>
            <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-3 mb-3`}>
              <h3 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4" /> Previsualizar: {previewDoc.title}
              </h3>
              <button onClick={() => setPreviewDoc(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">✕</button>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex items-center justify-center">
              {previewDoc.fileType === 'image' || previewDoc.dataUrl.startsWith('data:image') ? (
                <img src={previewDoc.dataUrl} alt={previewDoc.title} className="max-h-full max-w-full object-contain" />
              ) : (
                <iframe src={previewDoc.dataUrl} className="w-full h-full border-0" title={previewDoc.title} />
              )}
            </div>
          </div>
        </div>
      )}

      {showResumenEgresoDoc && selectedPatient && (
        <ResumenEgresoDocument 
          patient={selectedPatient} 
          historia={historias.find(h => h.id === selectedPatient.historiaClinicaId || h.patientId === selectedPatient.id || h.numHistoria === selectedPatient.medicalHistoryNumber)}
          onUpdatePatient={(updatedPt) => {
            const next = patients.map(p => p.id === updatedPt.id ? updatedPt : p);
            onUpdatePatients(next);
            setSelectedPatient(updatedPt);
          }}
          onClose={() => setShowResumenEgresoDoc(false)} 
        />
      )}

      {showResumenEvolutivoDoc && resumenEvolutivoPatient && (
        <ResumenEvolutivoDocument
          patient={resumenEvolutivoPatient}
          historia={historias.find(h => h.id === resumenEvolutivoPatient.historiaClinicaId)}
          onClose={() => setShowResumenEvolutivoDoc(false)}
          onSave={(updatedPatient) => {
            const updated = patients.map(p => p.id === updatedPatient.id ? updatedPatient : p);
            onUpdatePatients(updated);
            setResumenEvolutivoPatient(updatedPatient);
            if (selectedPatient?.id === updatedPatient.id) {
              setSelectedPatient(updatedPatient);
            }
          }}
        />
      )}

      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-slate-900/70 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <div className={`${themeTokens.cardSurface} border rounded-2xl max-w-2xl w-full p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl`}>
            <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-3`}>
              <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Reporte para WhatsApp</h3>
              <button onClick={() => setShowWhatsAppModal(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer">✕</button>
            </div>
            <textarea rows={12} value={whatsAppText} onChange={e => setWhatsAppText(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-900 dark:text-slate-200 outline-none focus:border-emerald-500" />
            <div className="flex justify-end gap-2">
              <button onClick={() => { navigator.clipboard.writeText(whatsAppText); setCopiedText(true); setTimeout(() => setCopiedText(false), 2000); }} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold cursor-pointer">{copiedText ? '¡Copiado!' : 'Copiar'}</button>
              <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(whatsAppText)}`, '_blank')} className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"><Share2 className="w-4 h-4" /> Abrir WhatsApp</button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE COMPONENT: MEDICAL EVOLUTION */}
      {activePrintEvolution && selectedPatient && (
        <MedicalEvolutionDocument
          patient={selectedPatient}
          evolution={activePrintEvolution}
          onClose={() => setActivePrintEvolution(null)}
        />
      )}

      {/* MODAL: EDITOR DE ÓRDENES MÉDICAS DESDE LA EVOLUCIÓN EN CURSO O TARJETA */}
      {showOrdenesMedicasModal && selectedPatient && (
        <OrdenesMedicasDocument
          key={selectedPatient.id}
          patient={selectedPatient}
          initialOrders={activeEvolutionOrders}
          initialFecha={activeOrdenesFecha}
          initialHora={activeOrdenesHora}
          initialPeso={activeOrdenesPeso || (vitalPeso ? (vitalPeso.toLowerCase().includes('kg') ? vitalPeso : `${vitalPeso} kg`) : `${selectedPatient.weightKg} kg`)}
          doctorName={doctorName}
          readOnly={isVisitor}
          onAutoSaveOrders={(orders, f, h, p) => {
            handleSavePatientOrders(selectedPatient.id, orders, f, h, p);
          }}
          onSaveOrders={(orders, f, h, p) => {
            handleSavePatientOrders(selectedPatient.id, orders, f, h, p);
            setShowOrdenesMedicasModal(false);
          }}
          onClose={() => setShowOrdenesMedicasModal(false)}
        />
      )}

      {/* MODAL: VISUALIZADOR Y EDITOR DE ÓRDENES MÉDICAS GUARDADAS EN EL HISTÓRICO */}
      {viewOrdenesEvolution && (
        <OrdenesMedicasDocument
          patient={viewOrdenesEvolution.patient}
          initialOrders={viewOrdenesEvolution.evolution.ordenesMedicas}
          initialFecha={viewOrdenesEvolution.evolution.ordenesFecha || viewOrdenesEvolution.evolution.date}
          initialHora={viewOrdenesEvolution.evolution.ordenesHora || viewOrdenesEvolution.evolution.time}
          initialPeso={viewOrdenesEvolution.evolution.ordenesPeso || `${viewOrdenesEvolution.patient.weightKg} kg`}
          doctorName={viewOrdenesEvolution.evolution.doctorName}
          readOnly={isVisitor}
          onAutoSaveOrders={(orders, f, h, p) => {
            const updatedEvs = (viewOrdenesEvolution.patient.evolutions || []).map(ev => {
              if (ev.id === viewOrdenesEvolution.evolution.id) {
                return {
                  ...ev,
                  ordenesMedicas: orders,
                  ordenesFecha: f,
                  ordenesHora: h,
                  ordenesPeso: p
                };
              }
              return ev;
            });
            const updatedPatient: Patient = {
              ...viewOrdenesEvolution.patient,
              ordenesMedicas: orders,
              ordenesFecha: f,
              ordenesHora: h,
              ordenesPeso: p,
              evolutions: updatedEvs,
              updatedAt: new Date().toISOString()
            };
            const updatedPatients = patients.map(pt => pt.id === updatedPatient.id ? updatedPatient : pt);
            onUpdatePatients(updatedPatients);
            if (selectedPatient?.id === updatedPatient.id) {
              setSelectedPatient(updatedPatient);
              setActiveEvolutionOrders(orders);
            }
            saveDraftToIDB(`patient_orders_${viewOrdenesEvolution.patient.id}`, {
              orders,
              fecha: f,
              hora: h,
              peso: p,
              updatedAt: new Date().toISOString()
            });
          }}
          onSaveOrders={(orders, f, h, p) => {
            const updatedEvs = (viewOrdenesEvolution.patient.evolutions || []).map(ev => {
              if (ev.id === viewOrdenesEvolution.evolution.id) {
                return {
                  ...ev,
                  ordenesMedicas: orders,
                  ordenesFecha: f,
                  ordenesHora: h,
                  ordenesPeso: p
                };
              }
              return ev;
            });
            const updatedPatient: Patient = {
              ...viewOrdenesEvolution.patient,
              ordenesMedicas: orders,
              ordenesFecha: f,
              ordenesHora: h,
              ordenesPeso: p,
              evolutions: updatedEvs,
              updatedAt: new Date().toISOString()
            };
            const updatedPatients = patients.map(pt => pt.id === updatedPatient.id ? updatedPatient : pt);
            onUpdatePatients(updatedPatients);
            if (selectedPatient?.id === updatedPatient.id) {
              setSelectedPatient(updatedPatient);
              setActiveEvolutionOrders(orders);
            }
            saveDraftToIDB(`patient_orders_${viewOrdenesEvolution.patient.id}`, {
              orders,
              fecha: f,
              hora: h,
              peso: p,
              updatedAt: new Date().toISOString()
            });
            setViewOrdenesEvolution(null);
          }}
          onClose={() => setViewOrdenesEvolution(null)}
        />
      )}

      {showConstanciaHospitalizacionDoc && selectedPatient && (
        <ConstanciaHospitalizacionDocument
          patient={selectedPatient}
          historia={historias.find(h => h.id === selectedPatient.historiaClinicaId || h.patientId === selectedPatient.id || h.numHistoria === selectedPatient.medicalHistoryNumber)}
          onClose={() => setShowConstanciaHospitalizacionDoc(false)}
        />
      )}

      {showNotaRecibimientoDoc && selectedPatient && (
        <NotaRecibimientoDocument
          patient={selectedPatient}
          historia={historias.find(h => h.id === selectedPatient.historiaClinicaId || h.patientId === selectedPatient.id || h.numHistoria === selectedPatient.medicalHistoryNumber)}
          onClose={() => setShowNotaRecibimientoDoc(false)}
        />
      )}

      {showReferenciaDoc && selectedPatient && (
        <ReferenciaMedicaDocument
          patient={selectedPatient}
          historia={historias.find(h => h.id === selectedPatient.historiaClinicaId || h.patientId === selectedPatient.id || h.numHistoria === selectedPatient.medicalHistoryNumber)}
          doctorName={doctorName}
          onClose={() => setShowReferenciaDoc(false)}
        />
      )}

      {activeDownloadEvolution && selectedPatient && (
        <MedicalEvolutionDocument
          patient={selectedPatient}
          evolution={activeDownloadEvolution}
          autoDownload={true}
          onClose={() => setActiveDownloadEvolution(null)}
        />
      )}

      {activePrintAllEvolutions && evolucionesYaHechasItems.length > 0 && (
        <BulkEvolutionsPrintView
          items={evolucionesYaHechasItems}
          autoPrint={true}
          onClose={() => setActivePrintAllEvolutions(false)}
        />
      )}

      {activeDownloadAllEvolutions && evolucionesYaHechasItems.length > 0 && (
        <BulkEvolutionsPrintView
          items={evolucionesYaHechasItems}
          autoDownload={true}
          onClose={() => setActiveDownloadAllEvolutions(false)}
        />
      )}

      {activePrintAllNotasRecibimiento && activePatients.length > 0 && (
        <BulkNotasRecibimientoPrintView
          patients={activePatients}
          historias={historias}
          autoPrint={true}
          onClose={() => setActivePrintAllNotasRecibimiento(false)}
        />
      )}

      {activeDownloadAllNotasRecibimiento && activePatients.length > 0 && (
        <BulkNotasRecibimientoPrintView
          patients={activePatients}
          historias={historias}
          autoDownload={true}
          onClose={() => setActiveDownloadAllNotasRecibimiento(false)}
        />
      )}

      {activePrintAllOrdenesMedicas && ordenesActualizadasItems.length > 0 && (
        <BulkOrdenesMedicasPrintView
          items={ordenesActualizadasItems}
          autoPrint={true}
          onClose={() => setActivePrintAllOrdenesMedicas(false)}
        />
      )}

      {activeDownloadAllOrdenesMedicas && ordenesActualizadasItems.length > 0 && (
        <BulkOrdenesMedicasPrintView
          items={ordenesActualizadasItems}
          autoDownload={true}
          onClose={() => setActiveDownloadAllOrdenesMedicas(false)}
        />
      )}
    </div>
  );
};
