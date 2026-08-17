const App = {
  config: null,
  state: {
    consentType: null,
    tratamiento: null,
    tratamientos: [],
    autorizacion: null,
    paciente: {},
    assessment: {
      paciente: '',
      respuestas: {},
      touched: {}
    },
    skinLab: {
      goals: [],
      relaxZones: []
    },
    signatureDataUrl: null,
    historyAccessGranted: false,
    protectedTarget: 'menu',
    historyPage: 1,
    historyArea: 'clinical',
    recaptureMonth: '',
    recapturePage: 1
  },
  signaturePad: null,
  historyRecords: [],
  recaptureRecords: [],
  recaptureStats: {},
  procedures: [],
  pdfRenderToken: 0,
  previewRecord: null,
  pendingFocusTarget: null,
  pendingConfirmAction: null
};
const HISTORY_PIN = '0000';
const PROCEDURES_STORAGE_KEY = 'iconicProcedimientos';
const RECAPTURE_STORAGE_KEY = 'iconicRecaptacion';
const RECAPTURE_STATS_STORAGE_KEY = 'iconicRecaptacionStats';
const RECAPTURE_STATUS = {
  pending: 'Pendiente',
  contacted: 'Contactada'
};
const DEFAULT_PROCEDURES = [
  'Toxina Botulínica',
  'Ácido hialurónico',
  'Sculptra',
  'Radiesse',
  'Stimulate',
  'Polinucleotidos',
  'Mallas PDO',
  'Hialuronidasa y Colagenasa'
];
const HISTORY_PAGE_SIZE = 6;
const RECAPTURE_PAGE_SIZE = 6;
const DEFAULT_CONFIG = {
  doctora: 'Patricia Navarrete',
  general: DEFAULT_PROCEDURES,
  toxina: DEFAULT_PROCEDURES
};
const ASSESSMENT_QUESTIONS = [
  {
    id: 'piel',
    number: 1,
    title: 'Cuidado de la Piel',
    question: '¿Qué tan satisfecha estás con la salud y apariencia general de tu piel?'
  },
  {
    id: 'arrugas',
    number: 2,
    title: 'Arrugas o Líneas de Expresión',
    question: '¿Cómo te sientes respecto a las líneas y arrugas alrededor de los ojos, la frente y la boca?'
  },
  {
    id: 'grasa',
    number: 3,
    title: 'Grasa No Deseada',
    question: '¿Te preocupa la presencia de grasa no deseada en áreas específicas como la barbilla, mejillas o cuello?'
  },
  {
    id: 'volumen',
    number: 4,
    title: 'Pérdida de Volumen',
    question: '¿Notas pérdida de volumen en áreas como las mejillas, labios, zona de ojeras o pómulos?'
  },
  {
    id: 'flacidez',
    number: 5,
    title: 'Flacidez',
    question: '¿Qué tan satisfecha estás con la firmeza de tu piel en el rostro y cuello?'
  },
  {
    id: 'labios',
    number: 6,
    title: 'Estructura y Soporte de los Labios',
    question: '¿Cómo te sientes con respecto a la forma y definición de tus labios?'
  },
  {
    id: 'mirada',
    number: 7,
    title: 'Mirada Cansada',
    question: '¿Te preocupan las ojeras, bolsas bajo los ojos o una apariencia de cansancio en tu mirada?'
  },
  {
    id: 'textura',
    number: 8,
    title: 'Textura de la Piel',
    question: '¿Qué tan satisfecha estás con la suavidad y uniformidad de la textura de tu piel?'
  },
  {
    id: 'manchas',
    number: 9,
    title: 'Manchas y Pigmentación',
    question: '¿Te molestan las manchas, pecas o cambios en la pigmentación de tu piel?'
  },
  {
    id: 'hidratacion',
    number: 10,
    title: 'Hidratación',
    question: '¿Cómo te sientes con respecto a la hidratación y luminosidad de tu piel?'
  }
];
const SKIN_LAB_GOALS = [
  'Acne o brotes',
  'Manchas',
  'Deshidratacion',
  'Poros visibles',
  'Lineas finas o arrugas',
  'Flacidez',
  'Falta de luminosidad'
];
const SKIN_LAB_GOAL_META = {
  'Acne o brotes': 'Acn&eacute; o brotes',
  Manchas: 'Manchas',
  Deshidratacion: 'Deshidrataci&oacute;n',
  'Poros visibles': 'Poros visibles',
  'Lineas finas o arrugas': 'L&iacute;neas finas<br>o arrugas',
  Flacidez: 'Flacidez',
  'Falta de luminosidad': 'Falta de<br>luminosidad'
};
const SKIN_LAB_RELAX_ZONES = ['Frente', 'Sienes', 'Mejillas', 'Mandíbula', 'Cuello', 'Hombros'];
const ASSESSMENT_TO_SKINLAB_GOAL_MAP = {
  piel: 'Falta de luminosidad',
  arrugas: 'Lineas finas o arrugas',
  grasa: 'Poros visibles',
  volumen: 'Flacidez',
  flacidez: 'Flacidez',
  labios: 'Lineas finas o arrugas',
  mirada: 'Falta de luminosidad',
  textura: 'Poros visibles',
  manchas: 'Manchas',
  hidratacion: 'Deshidratacion'
};
window.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  }

  App.signaturePad = initSignature(document.getElementById('signatureCanvas'), () => {
    document.getElementById('btnSignatureContinue').disabled = App.signaturePad.isEmpty();
  });
  document.getElementById('btnSignatureContinue').disabled = true;
  setBirthDateLimit();
  App.config = await loadConfig();
  App.procedures = loadStoredProcedures(App.config.general);
  App.recaptureRecords = loadRecaptureRecords();
  App.recaptureStats = loadRecaptureStats();
  App.state.recaptureMonth = getMonthKey(new Date());
  bindEvents();
  showStep('select');
  await refreshHistory();
}

async function loadConfig() {
  try {
    const response = await fetch('config/tratamientos.json');
    const config = await response.json();
    return normalizeConfig(config);
  } catch (error) {
    console.error('Error cargando configuración:', error);
    return DEFAULT_CONFIG;
  }
}

function normalizeConfig(config) {
  return {
    doctora: config?.doctora || DEFAULT_CONFIG.doctora,
    general: Array.isArray(config?.general) && config.general.length ? config.general : DEFAULT_CONFIG.general,
    toxina: Array.isArray(config?.toxina) && config.toxina.length ? config.toxina : DEFAULT_CONFIG.toxina
  };
}

function loadStoredProcedures(defaultProcedures) {
  const baseProcedures = defaultProcedures.map((name) => ({ name, enabled: true }));

  try {
    const stored = JSON.parse(localStorage.getItem(PROCEDURES_STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) {
      return baseProcedures;
    }

    const storedProcedures = stored
      .filter((procedure) => procedure && typeof procedure.name === 'string' && procedure.name.trim())
      .map((procedure) => ({
        name: procedure.name.trim(),
        enabled: procedure.enabled !== false
      }));
    const storedByName = new Map(storedProcedures.map((procedure) => [
      normalizeProcedureName(procedure.name),
      procedure
    ]));

    const procedures = baseProcedures.map((procedure) => {
      const storedProcedure = storedByName.get(normalizeProcedureName(procedure.name));
      return {
        name: procedure.name,
        enabled: storedProcedure ? storedProcedure.enabled : true
      };
    });
    storedProcedures.forEach((procedure) => {
      if (!procedures.some((item) => normalizeProcedureName(item.name) === normalizeProcedureName(procedure.name))) {
        procedures.push(procedure);
      }
    });

    localStorage.setItem(PROCEDURES_STORAGE_KEY, JSON.stringify(procedures));
    return procedures;
  } catch (error) {
    console.error('Error cargando procedimientos:', error);
    return baseProcedures;
  }
}

function saveProcedures() {
  localStorage.setItem(PROCEDURES_STORAGE_KEY, JSON.stringify(App.procedures));
}

function normalizeProcedureName(name) {
  return name.trim().toLowerCase();
}

function loadRecaptureRecords() {
  try {
    const records = JSON.parse(localStorage.getItem(RECAPTURE_STORAGE_KEY) || '[]');
    if (!Array.isArray(records)) {
      return [];
    }

    return records
      .filter((record) => record && record.id && record.status !== 'scheduled')
      .map((record) => ({
        id: record.id,
        nombre: record.nombre || '',
        rut: record.rut || '',
        procedimiento: record.procedimiento || '',
        consentDate: record.consentDate || '',
        contactFrom: record.contactFrom || '',
        status: record.status === 'contacted' ? 'contacted' : 'pending',
        contactedAt: record.contactedAt || '',
        contactedMonth: record.contactedMonth || (record.status === 'contacted' ? getMonthKey(record.contactFrom || '') : ''),
        createdAt: record.createdAt || new Date().toISOString()
      }))
      .sort((a, b) => a.contactFrom.localeCompare(b.contactFrom) || a.createdAt.localeCompare(b.createdAt));
  } catch (error) {
    console.error('Error cargando recaptacion:', error);
    return [];
  }
}

function saveRecaptureRecords() {
  localStorage.setItem(RECAPTURE_STORAGE_KEY, JSON.stringify(App.recaptureRecords));
}

function loadRecaptureStats() {
  try {
    const stats = JSON.parse(localStorage.getItem(RECAPTURE_STATS_STORAGE_KEY) || '{}');
    if (!stats || typeof stats !== 'object') {
      return { totalScheduled: 0 };
    }

    const totalScheduled = Number.isFinite(Number(stats.totalScheduled))
      ? Number(stats.totalScheduled)
      : getStoredScheduledTotal(stats);

    return {
      ...stats,
      totalScheduled
    };
  } catch (error) {
    console.error('Error cargando estadisticas de recaptacion:', error);
    return { totalScheduled: 0 };
  }
}

function saveRecaptureStats() {
  localStorage.setItem(RECAPTURE_STATS_STORAGE_KEY, JSON.stringify(App.recaptureStats));
}

function getStoredScheduledTotal(stats) {
  return Object.values(stats || {}).reduce((total, value) => {
    if (!value || typeof value !== 'object') {
      return total;
    }

    return total + Number(value.scheduled || 0);
  }, 0);
}

function getEnabledProcedures() {
  return App.procedures.filter((procedure) => procedure.enabled).map((procedure) => procedure.name);
}

function bindEvents() {
  document.getElementById('btnStartAssessment').addEventListener('click', startAssessment);
  document.getElementById('btnStartSkinLab').addEventListener('click', startSkinLab);
  document.getElementById('btnAssessmentBack').addEventListener('click', () => showStep('select'));
  document.getElementById('btnGenerateAssessment').addEventListener('click', createAssessmentPdf);
  document.getElementById('btnSkinLabBack').addEventListener('click', () => showStep('select'));
  document.getElementById('btnGenerateSkinLab').addEventListener('click', createSkinLabPdf);
  document.getElementById('btnGeneral').addEventListener('click', () => selectConsent('general'));
  document.getElementById('btnToxina').addEventListener('click', () => selectConsent('toxina'));
  document.getElementById('btnPdfContinue').addEventListener('click', () => showStep('form'));
  document.getElementById('btnPdfBack').addEventListener('click', () => showStep('select'));
  document.getElementById('readCheckbox').addEventListener('change', updateReadContinue);
  document.getElementById('selectTratamiento').addEventListener('change', onTreatmentSelect);
  document.getElementById('inputRut').addEventListener('input', onRutInput);
  document.getElementById('inputRut').addEventListener('blur', onRutBlur);
  document.getElementById('inputFechaNacimiento').addEventListener('input', onBirthDateInput);
  document.getElementById('inputFechaNacimiento').addEventListener('blur', onBirthDateBlur);
  document.getElementById('btnFormContinue').addEventListener('click', onFormContinue);
  document.getElementById('btnFormBack').addEventListener('click', () => showStep('pdf'));
  document.getElementById('btnClearSignature').addEventListener('click', () => {
    App.signaturePad.clear();
    document.getElementById('btnSignatureContinue').disabled = true;
  });
  document.getElementById('btnSignatureContinue').addEventListener('click', onSignatureContinue);
  document.getElementById('btnSummaryBack').addEventListener('click', () => showStep('signature'));
  document.getElementById('btnGeneratePdf').addEventListener('click', createConsentPdf);
  document.getElementById('btnAssessmentHome').addEventListener('click', () => {
    resetAssessmentFlow();
    showStep('select');
  });
  document.getElementById('btnNewConsent').addEventListener('click', () => {
    resetConsentFlow();
    showStep('select');
  });
  document.getElementById('btnSignatureBack').addEventListener('click', () => showStep('form'));
  document.getElementById('btnGoHistory').addEventListener('click', requestHistoryAccess);
  document.getElementById('btnShowHistory').addEventListener('click', requestHistoryAccess);
  document.getElementById('btnMenuHistory').addEventListener('click', () => openHistoryArea('clinical'));
  document.getElementById('btnMenuProcedures').addEventListener('click', () => openProtectedStep('procedures'));
  document.getElementById('btnMenuRecapture').addEventListener('click', () => openProtectedStep('recapture'));
  document.getElementById('btnMenuSkinLab').addEventListener('click', () => openHistoryArea('skinLab'));
  document.getElementById('btnMenuBack').addEventListener('click', () => showStep('select'));
  document.getElementById('btnProceduresBack').addEventListener('click', () => openProtectedStep('menu'));
  document.getElementById('btnRecaptureBack').addEventListener('click', () => openProtectedStep('menu'));
  document.getElementById('btnAddProcedure').addEventListener('click', addProcedure);
  document.getElementById('inputNewProcedure').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      addProcedure();
    }
  });
  document.getElementById('btnHistoryBackTop').addEventListener('click', () => openProtectedStep('menu'));
  document.getElementById('historySearch').addEventListener('input', () => {
    App.state.historyPage = 1;
    refreshHistory();
  });
  document.getElementById('btnExportBackup').addEventListener('click', exportBackup);
  document.getElementById('btnExportMonth').addEventListener('click', exportMonthBackup);
  document.getElementById('btnDeleteMonth').addEventListener('click', deleteMonthRecords);
  document.getElementById('recaptureMonth').addEventListener('change', () => {
    App.state.recaptureMonth = document.getElementById('recaptureMonth').value || getMonthKey(new Date());
    App.state.recapturePage = 1;
    renderRecaptureView();
  });
  document.getElementById('btnRecapturePrevMonth').addEventListener('click', () => changeRecaptureMonth(-1));
  document.getElementById('btnRecaptureNextMonth').addEventListener('click', () => changeRecaptureMonth(1));
  document.getElementById('recaptureSearch').addEventListener('input', () => {
    App.state.recapturePage = 1;
    renderRecaptureView();
  });
  document.getElementById('btnPinCancel').addEventListener('click', closePinModal);
  document.getElementById('btnPinSubmit').addEventListener('click', submitHistoryPin);
  document.getElementById('pinInput').addEventListener('input', onPinInput);
  document.getElementById('pinInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      submitHistoryPin();
    }
  });
  document.getElementById('btnMessageOk').addEventListener('click', closeMessageModal);
  document.getElementById('btnConfirmCancel').addEventListener('click', closeConfirmModal);
  document.getElementById('btnConfirmOk').addEventListener('click', confirmModalAction);
  document.getElementById('btnCloseDocumentPreview').addEventListener('click', closeDocumentPreview);
  document.getElementById('btnDownloadPreviewDocument').addEventListener('click', downloadPreviewDocument);
}

function selectConsent(type) {
  resetConsentFlow();
  App.state.consentType = type;
  updateReadContinue();
  const asset = type === 'general' ? 'assets/consentimiento_general.pdf' : 'assets/consentimiento_toxina.pdf';
  showStep('pdf');
  renderPdfPreview(asset);
}

function resetConsentFlow() {
  resetPatientForm();
  App.state.consentType = null;
  document.getElementById('readCheckbox').checked = false;
  updateReadContinue();

  const viewer = document.getElementById('pdfRenderViewer');
  if (viewer) {
    viewer.innerHTML = '';
  }
}

function startAssessment() {
  resetAssessmentFlow();
  showStep('assessment');
}

function startSkinLab() {
  resetSkinLabFlow();
  showStep('skinLab');
}

function openHistoryArea(area) {
  App.state.historyArea = area;
  App.state.historyPage = 1;
  openProtectedStep('history');
}

function resetAssessmentFlow() {
  App.state.assessment = {
    paciente: '',
    respuestas: {},
    touched: {}
  };

  const form = document.getElementById('assessmentForm');
  if (form) {
    form.reset();
  }

  const container = document.getElementById('assessmentQuestions');
  if (container) {
    container.innerHTML = '';
  }

  renderAssessmentQuestions();
}

function resetSkinLabFlow() {
  App.state.skinLab = {
    goals: [],
    relaxZones: []
  };

  const form = document.getElementById('skinLabForm');
  if (form) {
    form.reset();
  }

  const derived = deriveSkinLabDataFromAssessment();
  if (derived) {
    const nombreInput = document.getElementById('skinLabNombre');
    const concernInput = document.getElementById('skinLabConcern');
    const considerationsInput = document.getElementById('skinLabConsiderations');

    if (nombreInput && !nombreInput.value.trim()) {
      nombreInput.value = derived.nombre;
    }

    if (concernInput && !concernInput.value.trim()) {
      concernInput.value = derived.concern;
    }

    if (considerationsInput && !considerationsInput.value.trim()) {
      considerationsInput.value = derived.considerations;
    }

    App.state.skinLab.goals = derived.goals;
  }

  renderSkinLabGoals();
  renderSkinLabRelaxZones();
}

function resetPatientForm() {
  const form = document.getElementById('patientForm');
  if (form) {
    form.reset();
  }

  ['inputNombre', 'inputRut', 'inputFechaNacimiento', 'inputDireccion'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.value = '';
    }
  });
  document.querySelectorAll('input[name="autorizacion"]').forEach((input) => {
    input.checked = false;
  });

  App.state.tratamiento = null;
  App.state.tratamientos = [];
  App.state.autorizacion = null;
  App.state.paciente = {};
  App.state.signatureDataUrl = null;

  const select = document.getElementById('selectTratamiento');
  if (select) {
    select.value = '';
  }

  if (App.signaturePad) {
    App.signaturePad.clear();
  }

  document.getElementById('btnSignatureContinue').disabled = true;
  renderSelectedTreatments();
  clearSummary();
}

function clearSummary() {
  [
    'summaryNombre',
    'summaryRut',
    'summaryNacimiento',
    'summaryDireccion',
    'summaryTipo',
    'summaryTratamiento',
    'summaryAutorizacion'
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = '';
    }
  });
}

async function renderPdfPreview(asset) {
  const viewer = document.getElementById('pdfRenderViewer');
  const renderToken = App.pdfRenderToken + 1;
  App.pdfRenderToken = renderToken;
  await waitForNextFrame();
  await renderPdfIntoViewer(asset, viewer, {
    loadingText: 'Cargando PDF original...',
    errorText: 'No se pudo visualizar el PDF original. Vuelva atras e intente nuevamente.',
    shouldContinue: () => renderToken === App.pdfRenderToken
  });
}

async function renderPdfIntoViewer(source, viewer, options = {}) {
  viewer.innerHTML = `<p class="pdf-render-status">${options.loadingText || 'Cargando PDF...'}</p>`;
  viewer.scrollTop = 0;
  try {
    if (!window.pdfjsLib) {
      throw new Error('No se pudo cargar el visor PDF.');
    }

    const pdf = await loadPdfDocument(source);

    if (options.shouldContinue && !options.shouldContinue()) {
      return;
    }

    viewer.innerHTML = '';
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      if (options.shouldContinue && !options.shouldContinue()) {
        return;
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(280, viewer.clientWidth - 32);
      const scale = Math.min(1.8, availableWidth / baseViewport.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const ratio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      viewer.appendChild(canvas);
      await page.render({ canvasContext: context, viewport }).promise;
    }
  } catch (error) {
    console.error('Error renderizando PDF:', error);
    if (typeof source === 'string') {
      renderNativePdfFallback(viewer, source, options.errorText);
      return;
    }

    viewer.innerHTML = `<p class="pdf-render-status">${options.errorText || 'No se pudo visualizar el PDF.'}</p>`;
  }
}

async function loadPdfDocument(source) {
  if (typeof source === 'string') {
    try {
      const data = await loadPdfBytes(source);
      return await window.pdfjsLib.getDocument({ data }).promise;
    } catch (bytesError) {
      console.warn('No se pudo cargar PDF como bytes, intentando por URL:', bytesError);
    }
  }

  try {
    return await window.pdfjsLib.getDocument(normalizePdfSource(source)).promise;
  } catch (error) {
    throw error;
  }
}

function loadPdfBytes(url) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = () => {
      if (request.status && (request.status < 200 || request.status >= 300)) {
        reject(new Error(`No se pudo cargar ${url}`));
        return;
      }

      resolve(new Uint8Array(request.response));
    };
    request.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
    request.send();
  });
}

function renderNativePdfFallback(viewer, source, message) {
  viewer.innerHTML = '';

  const object = document.createElement('object');
  object.className = 'pdf-native-viewer';
  object.type = 'application/pdf';
  object.data = source;

  const fallback = document.createElement('p');
  fallback.className = 'pdf-render-status';
  fallback.textContent = message || 'No se pudo visualizar el PDF con el visor interno.';

  object.appendChild(fallback);
  viewer.appendChild(object);
}

function normalizePdfSource(source) {
  if (typeof source === 'string') {
    return {
      url: source,
      disableWorker: true
    };
  }

  if (source && typeof source === 'object') {
    return {
      ...source,
      disableWorker: true
    };
  }

  return source;
}

function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function updateReadContinue() {
  document.getElementById('btnPdfContinue').disabled = !document.getElementById('readCheckbox').checked;
}

function showStep(stepId) {
  if (isProtectedStep(stepId) && !App.state.historyAccessGranted) {
    requestProtectedStep(stepId);
    return;
  }

  document.querySelectorAll('.step').forEach((section) => section.classList.add('hidden'));
  document.getElementById(`step${capitalize(stepId)}`).classList.remove('hidden');
  document.getElementById('btnHistoryBackTop').classList.toggle('hidden', stepId !== 'history');
  App.state.historyAccessGranted = false;

  if (stepId === 'form') {
    populateTreatmentOptions();
  }

  if (stepId === 'assessment') {
    renderAssessmentQuestions();
  }

  if (stepId === 'skinLab') {
    renderSkinLabGoals();
  }

  if (stepId === 'history') {
    refreshHistory();
  }

  if (stepId === 'procedures') {
    renderProcedureManager();
  }

  if (stepId === 'recapture') {
    renderRecaptureView();
  }

  if (stepId === 'signature') {
    setTimeout(() => App.signaturePad.resize(), 0);
  }
}

function isProtectedStep(stepId) {
  return ['menu', 'history', 'procedures', 'recapture'].includes(stepId);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function populateTreatmentOptions() {
  const container = document.getElementById('treatmentContainer');
  const select = document.getElementById('selectTratamiento');
  if (!container || !select) {
    return;
  }

  container.style.display = 'block';
  const enabledProcedures = getEnabledProcedures();
  const enabledProcedureSet = new Set(enabledProcedures);
  App.state.tratamientos = App.state.tratamientos.filter((treatment) => enabledProcedureSet.has(treatment));
  App.state.tratamiento = getSelectedTreatmentText();
  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = enabledProcedures.length ? 'Seleccione un procedimiento' : 'No hay procedimientos habilitados';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  if (!enabledProcedures.length) {
    renderSelectedTreatments();
    return;
  }

  enabledProcedures.forEach((treatment) => {
    const option = document.createElement('option');
    option.value = treatment;
    option.textContent = treatment;
    option.disabled = App.state.tratamientos.includes(treatment);
    select.appendChild(option);
  });
  select.value = '';
  renderSelectedTreatments();
}

function onTreatmentSelect(event) {
  const treatment = event.target.value;
  if (!treatment || App.state.tratamientos.includes(treatment)) {
    event.target.value = '';
    return;
  }

  App.state.tratamientos.push(treatment);
  App.state.tratamiento = getSelectedTreatmentText();
  event.target.value = '';
  populateTreatmentOptions();
  renderSelectedTreatments();
}

function removeTreatment(treatment) {
  App.state.tratamientos = App.state.tratamientos.filter((selected) => selected !== treatment);
  App.state.tratamiento = getSelectedTreatmentText();
  populateTreatmentOptions();
}

function renderSelectedTreatments() {
  const container = document.getElementById('selectedTreatments');
  if (!container) {
    return;
  }

  container.innerHTML = '';
  if (!App.state.tratamientos.length) {
    const hint = document.createElement('p');
    hint.className = 'selection-hint';
    hint.textContent = 'Puede seleccionar uno o más procedimientos.';
    container.appendChild(hint);
    return;
  }

  App.state.tratamientos.forEach((treatment) => {
    const chip = document.createElement('span');
    chip.className = 'treatment-chip';
    chip.textContent = treatment;

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = '×';
    removeButton.setAttribute('aria-label', `Quitar ${treatment}`);
    removeButton.addEventListener('click', () => removeTreatment(treatment));

    chip.appendChild(removeButton);
    container.appendChild(chip);
  });
}

function getSelectedTreatmentText() {
  return App.state.tratamientos.join(', ');
}

function renderAssessmentQuestions() {
  const container = document.getElementById('assessmentQuestions');
  if (!container || container.children.length) {
    updateAssessmentProgress();
    return;
  }

  ASSESSMENT_QUESTIONS.forEach((item) => {
    const selectedValue = App.state.assessment.respuestas[item.id] ?? 0;
    App.state.assessment.respuestas[item.id] = selectedValue;

    const questionCard = document.createElement('article');
    questionCard.className = 'assessment-question';
    questionCard.innerHTML = `
      <h3>${item.number}. ${item.title}</h3>
      <p>${item.question}</p>
      <div class="assessment-score">
        <span>Puntuaci&oacute;n seleccionada</span>
        <strong id="assessmentScore${item.number}">${selectedValue}</strong>
      </div>
      <div class="assessment-slider-row">
        <span>0</span>
        <input type="range" min="0" max="10" step="1" value="${selectedValue}" aria-label="${item.title}">
        <span>10</span>
      </div>
    `;

    const slider = questionCard.querySelector('input[type="range"]');
    updateAssessmentSliderFill(slider);
    slider.addEventListener('input', () => {
      const value = Number(slider.value);
      App.state.assessment.respuestas[item.id] = value;
      App.state.assessment.touched[item.id] = true;
      questionCard.querySelector(`#assessmentScore${item.number}`).textContent = String(value);
      updateAssessmentSliderFill(slider);
      updateAssessmentProgress();
    });

    container.appendChild(questionCard);
  });

  updateAssessmentProgress();
}

function updateAssessmentSliderFill(slider) {
  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const value = Number(slider.value || 0);
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  slider.style.setProperty('--slider-fill', `${Math.min(Math.max(percent, 0), 100)}%`);
}

function updateAssessmentProgress() {
  const answered = ASSESSMENT_QUESTIONS.filter((item) => App.state.assessment.touched[item.id]).length;
  const percent = Math.round((answered / ASSESSMENT_QUESTIONS.length) * 100);
  const progressText = document.getElementById('assessmentProgressText');
  const progressBar = document.getElementById('assessmentProgressBar');

  if (progressText) {
    progressText.textContent = `${answered} de ${ASSESSMENT_QUESTIONS.length} respondidas`;
  }

  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }
}

function renderSkinLabGoals() {
  const container = document.getElementById('skinLabGoals');
  if (!container || container.children.length) {
    updateSkinLabGoalSelection();
    return;
  }

  SKIN_LAB_GOALS.forEach((goal) => {
    const label = SKIN_LAB_GOAL_META[goal] || goal;
    const option = document.createElement('div');
    option.className = 'skin-lab-option';
    option.dataset.goal = goal;
    option.setAttribute('role', 'checkbox');
    option.setAttribute('tabindex', '0');
    option.setAttribute('aria-checked', 'false');
    option.innerHTML = `
      <span class="skin-lab-option-body">
        <span class="skin-lab-option-label">${label}</span>
      </span>
      <span class="skin-lab-check" aria-hidden="true"></span>
    `;

    option.addEventListener('click', () => toggleSkinLabGoal(goal));
    option.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleSkinLabGoal(goal);
      }
    });
    container.appendChild(option);
  });

  updateSkinLabGoalSelection();
}

function toggleSkinLabGoal(goal) {
  const selected = App.state.skinLab.goals;
  if (selected.includes(goal)) {
    App.state.skinLab.goals = selected.filter((item) => item !== goal);
  } else {
    App.state.skinLab.goals = [...selected, goal];
  }

  updateSkinLabGoalSelection();
}

function updateSkinLabGoalSelection() {
  const selected = App.state.skinLab.goals;
  document.querySelectorAll('.skin-lab-option').forEach((button) => {
    const isSelected = selected.includes(button.dataset.goal);
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-checked', String(isSelected));
  });
}

function renderSkinLabRelaxZones() {
  const container = document.getElementById('skinLabRelaxZones');
  if (!container || container.children.length) {
    bindSkinLabRelaxMarkers();
    updateSkinLabRelaxZoneSelection();
    return;
  }

  SKIN_LAB_RELAX_ZONES.forEach((zone, index) => {
    const option = document.createElement('div');
    option.className = 'skin-lab-option relax-time-option';
    option.dataset.relaxZone = zone;
    option.setAttribute('role', 'checkbox');
    option.setAttribute('tabindex', '0');
    option.setAttribute('aria-checked', 'false');
    option.innerHTML = `
      <span class="relax-time-number" aria-hidden="true">${index + 1}</span>
      <span class="skin-lab-option-label">${zone}</span>
      <span class="skin-lab-check" aria-hidden="true"></span>
    `;

    option.addEventListener('click', () => toggleSkinLabRelaxZone(zone));
    option.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleSkinLabRelaxZone(zone);
      }
    });
    container.appendChild(option);
  });

  bindSkinLabRelaxMarkers();
  updateSkinLabRelaxZoneSelection();
}

function bindSkinLabRelaxMarkers() {
  document.querySelectorAll('button[data-relax-marker]').forEach((marker) => {
    if (marker.dataset.bound === 'true') {
      return;
    }
    marker.dataset.bound = 'true';
    marker.addEventListener('click', () => toggleSkinLabRelaxZone(marker.dataset.relaxMarker));
  });
}

function toggleSkinLabRelaxZone(zone) {
  const selected = App.state.skinLab.relaxZones;
  App.state.skinLab.relaxZones = selected.includes(zone)
    ? selected.filter((item) => item !== zone)
    : [...selected, zone];
  updateSkinLabRelaxZoneSelection();
}

function updateSkinLabRelaxZoneSelection() {
  const selected = App.state.skinLab.relaxZones;
  document.querySelectorAll('.relax-time-option').forEach((option) => {
    const isSelected = selected.includes(option.dataset.relaxZone);
    option.classList.toggle('is-selected', isSelected);
    option.setAttribute('aria-checked', String(isSelected));
  });
  document.querySelectorAll('[data-relax-marker]').forEach((marker) => {
    const isSelected = selected.includes(marker.dataset.relaxMarker);
    marker.classList.toggle('is-selected', isSelected);
    if (marker.matches('button')) {
      marker.setAttribute('aria-pressed', String(isSelected));
    }
  });
}

function deriveSkinLabDataFromAssessment() {
  const respuestas = App.state.assessment.respuestas || {};
  const touched = App.state.assessment.touched || {};
  const touchedCount = Object.values(touched).filter(Boolean).length;
  const nombre = App.state.assessment.paciente || '';

  if (!touchedCount) {
    return null;
  }

  const entries = Object.entries(respuestas).map(([id, value]) => ({ id, score: Number(value) || 0 }));
  if (!entries.length) {
    return null;
  }

  entries.sort((a, b) => a.score - b.score);
  const goals = [...new Set(entries.slice(0, 3).map(({ id }) => ASSESSMENT_TO_SKINLAB_GOAL_MAP[id]).filter(Boolean))];
  const topItems = entries.slice(0, 3).map(({ id }) => {
    const question = ASSESSMENT_QUESTIONS.find((item) => item.id === id);
    return question ? question.title : id;
  });

  return {
    nombre,
    goals: goals.length ? goals : App.state.skinLab.goals,
    concern: topItems.length
      ? `Las principales prioridades identificadas son: ${topItems.join(', ')}.`
      : 'Se ha detectado prioridad de tratamiento según la evaluación previa.',
    considerations: 'Generar recomendaciones de Skin Lab en función de la autoevaluación estética y los objetivos declarados.'
  };
}

function renderProcedureManager() {
  const list = document.getElementById('procedureList');
  if (!list) {
    return;
  }

  list.innerHTML = '';

  if (!App.procedures.length) {
    list.innerHTML = '<p>No hay procedimientos configurados.</p>';
    return;
  }

  App.procedures.forEach((procedure, index) => {
    const item = document.createElement('article');
    item.className = 'procedure-item';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = procedure.name;
    input.setAttribute('aria-label', `Nombre de procedimiento ${index + 1}`);
    input.addEventListener('change', () => updateProcedureName(index, input.value));

    const toggle = document.createElement('label');
    toggle.className = 'procedure-toggle';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = procedure.enabled;
    checkbox.addEventListener('change', () => toggleProcedure(index, checkbox.checked));

    const switchControl = document.createElement('span');
    switchControl.className = 'procedure-switch';

    const status = document.createElement('span');
    status.textContent = 'Activo';

    toggle.append(checkbox, switchControl, status);
    item.append(input, toggle);
    list.appendChild(item);
  });
}

function addProcedure() {
  const input = document.getElementById('inputNewProcedure');
  const name = input.value.trim();

  if (!name) {
    showMessage('Nombre requerido', 'Ingrese el nombre del procedimiento que desea agregar.');
    input.focus();
    return;
  }

  if (hasDuplicateProcedureName(name)) {
    showMessage('Procedimiento duplicado', 'Ya existe un procedimiento con ese nombre.');
    input.select();
    return;
  }

  App.procedures.push({ name, enabled: true });
  input.value = '';
  saveProcedures();
  renderProcedureManager();
  populateTreatmentOptions();
}

function updateProcedureName(index, value) {
  const name = value.trim();
  const procedure = App.procedures[index];

  if (!procedure) {
    return;
  }

  if (!name) {
    showMessage('Nombre requerido', 'El procedimiento debe mantener un nombre visible.');
    renderProcedureManager();
    return;
  }

  if (hasDuplicateProcedureName(name, index)) {
    showMessage('Procedimiento duplicado', 'Ya existe un procedimiento con ese nombre.');
    renderProcedureManager();
    return;
  }

  const previousName = procedure.name;
  procedure.name = name;
  App.state.tratamientos = App.state.tratamientos.map((treatment) => treatment === previousName ? name : treatment);
  App.state.tratamiento = getSelectedTreatmentText();
  saveProcedures();
  renderProcedureManager();
  populateTreatmentOptions();
}

function toggleProcedure(index, enabled) {
  const procedure = App.procedures[index];
  if (!procedure) {
    return;
  }

  procedure.enabled = enabled;

  if (!enabled) {
    App.state.tratamientos = App.state.tratamientos.filter((treatment) => treatment !== procedure.name);
    App.state.tratamiento = getSelectedTreatmentText();
  }

  saveProcedures();
  renderProcedureManager();
  populateTreatmentOptions();
}

function hasDuplicateProcedureName(name, currentIndex = -1) {
  const normalizedName = normalizeProcedureName(name);
  return App.procedures.some((procedure, index) => {
    return index !== currentIndex && normalizeProcedureName(procedure.name) === normalizedName;
  });
}

function onFormContinue() {
  const nombre = document.getElementById('inputNombre').value.trim();
  const rutInput = document.getElementById('inputRut');
  const rut = formatRut(rutInput.value);
  const birthInput = document.getElementById('inputFechaNacimiento');
  const nacimiento = parseBirthDateInput(birthInput.value);
  const direccion = document.getElementById('inputDireccion').value.trim();
  const autorizacion = document.querySelector('input[name="autorizacion"]:checked');
  const treatment = getSelectedTreatmentText();

  if (!nombre) {
    showMessage('Datos incompletos', 'Ingrese el nombre completo del paciente.', 'Atencion', 'Volver a completar', 'inputNombre');
    return;
  }

  if (!rut) {
    showMessage('Datos incompletos', 'Ingrese el RUT del paciente.', 'Atencion', 'Volver a completar', 'inputRut');
    return;
  }

  if (!birthInput.value.trim()) {
    showMessage('Datos incompletos', 'Ingrese la fecha de nacimiento del paciente.', 'Atencion', 'Volver a completar', 'inputFechaNacimiento');
    return;
  }

  if (!direccion) {
    showMessage('Datos incompletos', 'Ingrese la direccion del paciente.', 'Atencion', 'Volver a completar', 'inputDireccion');
    return;
  }

  if (!treatment) {
    showMessage('Tratamiento requerido', 'Seleccione al menos un procedimiento para continuar.', 'Atencion', 'Seleccionar tratamiento');
    return;
  }

  if (!autorizacion) {
    showMessage('Datos incompletos', 'Seleccione si autoriza o no el uso de imagen.', 'Atencion', 'Volver a completar');
    return;
  }

  if (!isValidBirthDateInput(birthInput.value)) {
    showMessage('Fecha no valida', 'Ingrese una fecha de nacimiento valida con formato DD/MM/AAAA.', 'Atencion', 'Corregir fecha', 'inputFechaNacimiento');
    return;
  }

  if (!isValidRut(rut)) {
    showMessage('RUT no valido', 'Ingrese un RUT chileno valido con digito verificador.', 'Atencion', 'Corregir RUT');
    rutInput.focus();
    rutInput.select();
    return;
  }

  if (isFutureDateInput(nacimiento)) {
    showMessage('Fecha no valida', 'La fecha de nacimiento no puede ser posterior al dia de hoy.');
    return;
  }

  birthInput.value = formatBirthDateMask(birthInput.value);
  rutInput.value = rut;
  App.state.paciente = {
    nombre,
    rut,
    nacimiento: formatDateInput(nacimiento),
    direccion
  };
  App.state.tratamiento = treatment;
  App.state.autorizacion = autorizacion.value;
  showStep('signature');
  setTimeout(() => {
    App.signaturePad.clear();
    App.signaturePad.resize();
    document.getElementById('btnSignatureContinue').disabled = true;
  }, 0);
}

function onRutInput(event) {
  event.target.value = event.target.value.replace(/[^0-9kK.-]/g, '').toUpperCase();
}

function onRutBlur(event) {
  event.target.value = formatRut(event.target.value);
}

function onBirthDateInput(event) {
  event.target.value = formatBirthDateMask(event.target.value);
}

function onBirthDateBlur(event) {
  event.target.value = formatBirthDateMask(event.target.value);
}

function formatBirthDateMask(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  const parts = [];

  if (digits.length > 0) {
    parts.push(digits.slice(0, 2));
  }
  if (digits.length > 2) {
    parts.push(digits.slice(2, 4));
  }
  if (digits.length > 4) {
    parts.push(digits.slice(4, 8));
  }

  return parts.join('/');
}

function parseBirthDateInput(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return '';
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function isValidBirthDateInput(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return false;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && year >= 1900;
}

function cleanRut(value) {
  return String(value || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

function formatRut(value) {
  const cleaned = cleanRut(value);
  if (cleaned.length < 2) {
    return cleaned;
  }

  const body = cleaned.slice(0, -1);
  const verifier = cleaned.slice(-1);
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${verifier}`;
}

function isValidRut(value) {
  const cleaned = cleanRut(value);
  if (!/^\d{7,8}[0-9K]$/.test(cleaned)) {
    return false;
  }

  const body = cleaned.slice(0, -1);
  const verifier = cleaned.slice(-1);
  let multiplier = 2;
  let sum = 0;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedValue = 11 - (sum % 11);
  const expectedVerifier = expectedValue === 11 ? '0' : expectedValue === 10 ? 'K' : String(expectedValue);
  return verifier === expectedVerifier;
}
function showSummary() {
  document.getElementById('summaryNombre').textContent = App.state.paciente.nombre;
  document.getElementById('summaryRut').textContent = App.state.paciente.rut;
  document.getElementById('summaryNacimiento').textContent = App.state.paciente.nacimiento;
  document.getElementById('summaryDireccion').textContent = App.state.paciente.direccion;
  document.getElementById('summaryTipo').textContent = App.state.consentType === 'general' ? 'Consentimiento General' : 'Consentimiento Toxina';
  document.getElementById('summaryTratamiento').textContent = App.state.tratamiento;
  document.getElementById('summaryAutorizacion').textContent = App.state.autorizacion;
}

function formatDateInput(value) {
  if (!value) {
    return '';
  }

  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function requestHistoryAccess() {
  requestProtectedStep('menu');
}

function requestProtectedStep(stepId) {
  App.state.protectedTarget = stepId;
  openPinModal();
}

function openProtectedStep(stepId) {
  App.state.historyAccessGranted = true;
  showStep(stepId);
}

function openPinModal() {
  const modal = document.getElementById('pinModal');
  const input = document.getElementById('pinInput');
  const error = document.getElementById('pinError');
  error.classList.add('hidden');
  input.value = '';
  modal.classList.remove('hidden');
  setTimeout(() => input.focus(), 0);
}

function closePinModal() {
  document.getElementById('pinModal').classList.add('hidden');
}

function onPinInput(event) {
  event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
  document.getElementById('pinError').classList.add('hidden');
}

function submitHistoryPin() {
  const input = document.getElementById('pinInput');
  const error = document.getElementById('pinError');
  if (input.value !== HISTORY_PIN) {
    error.classList.remove('hidden');
    input.select();
    return;
  }

  closePinModal();
  openProtectedStep(App.state.protectedTarget || 'menu');
  App.state.protectedTarget = 'menu';
}

function showMessage(title, message, eyebrow = 'Atención', actionLabel = 'Entendido', focusTarget = null) {
  App.pendingFocusTarget = focusTarget;
  document.getElementById('messageModalEyebrow').textContent = eyebrow;
  document.getElementById('messageModalTitle').textContent = title;
  document.getElementById('messageModalText').textContent = message;
  document.getElementById('btnMessageOk').textContent = actionLabel;
  document.getElementById('messageModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('btnMessageOk').focus(), 0);
}

function closeMessageModal() {
  document.getElementById('messageModal').classList.add('hidden');
  focusPendingTarget();
}

function showConfirmModal({ title, message, eyebrow = 'Confirmacion', cancelLabel = 'Cancelar', confirmLabel = 'Confirmar', onConfirm }) {
  App.pendingConfirmAction = typeof onConfirm === 'function' ? onConfirm : null;
  document.getElementById('confirmModalEyebrow').textContent = eyebrow;
  document.getElementById('confirmModalTitle').textContent = title;
  document.getElementById('confirmModalText').textContent = message;
  document.getElementById('btnConfirmCancel').textContent = cancelLabel;
  document.getElementById('btnConfirmOk').textContent = confirmLabel;
  document.getElementById('confirmModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('btnConfirmCancel').focus(), 0);
}

function closeConfirmModal() {
  App.pendingConfirmAction = null;
  document.getElementById('confirmModal').classList.add('hidden');
}

function confirmModalAction() {
  const action = App.pendingConfirmAction;
  App.pendingConfirmAction = null;
  document.getElementById('confirmModal').classList.add('hidden');

  if (action) {
    action();
  }
}

function focusPendingTarget() {
  const target = App.pendingFocusTarget;
  App.pendingFocusTarget = null;

  if (!target) {
    return;
  }

  setTimeout(() => {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      element.focus({ preventScroll: true });
      if (typeof element.select === 'function') {
        element.select();
      }
    }, 260);
  }, 0);
}

function setBirthDateLimit() {
  const input = document.getElementById('inputFechaNacimiento');
  if (input) {
    input.placeholder = 'DD/MM/AAAA';
  }
}

function populateBirthDateSelectors() {
  const daySelect = document.getElementById('birthDay');
  const monthSelect = document.getElementById('birthMonth');
  const yearSelect = document.getElementById('birthYear');
  if (!daySelect || !monthSelect || !yearSelect) {
    return;
  }

  fillPlaceholderOption(daySelect, 'Día');
  fillPlaceholderOption(monthSelect, 'Mes');
  fillPlaceholderOption(yearSelect, 'Año');

  const months = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
  ];

  months.forEach((name, index) => {
    const option = document.createElement('option');
    option.value = String(index + 1).padStart(2, '0');
    option.textContent = name;
    monthSelect.appendChild(option);
  });

  const currentYear = new Date().getFullYear();
  for (let year = currentYear; year >= 1900; year -= 1) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  }

  populateBirthDayOptions();
}

function fillPlaceholderOption(select, label) {
  select.innerHTML = '';
  const option = document.createElement('option');
  option.value = '';
  option.textContent = label;
  option.disabled = true;
  option.selected = true;
  select.appendChild(option);
}

function onBirthDateChange(event) {
  if (event.target.id === 'birthMonth' || event.target.id === 'birthYear') {
    populateBirthDayOptions();
  }
  updateBirthDateInput();
}

function populateBirthDayOptions() {
  const daySelect = document.getElementById('birthDay');
  const monthSelect = document.getElementById('birthMonth');
  const yearSelect = document.getElementById('birthYear');
  if (!daySelect || !monthSelect || !yearSelect) {
    return;
  }

  const selectedDay = daySelect.value;
  const month = Number(monthSelect.value || 1);
  const year = Number(yearSelect.value || new Date().getFullYear());
  const daysInMonth = new Date(year, month, 0).getDate();

  fillPlaceholderOption(daySelect, 'Día');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const option = document.createElement('option');
    option.value = String(day).padStart(2, '0');
    option.textContent = String(day).padStart(2, '0');
    daySelect.appendChild(option);
  }

  if (selectedDay && Number(selectedDay) <= daysInMonth) {
    daySelect.value = selectedDay;
  }
}

function updateBirthDateInput() {
  const day = document.getElementById('birthDay')?.value || '';
  const month = document.getElementById('birthMonth')?.value || '';
  const year = document.getElementById('birthYear')?.value || '';
  const input = document.getElementById('inputFechaNacimiento');
  if (!input) {
    return '';
  }

  input.value = day && month && year ? `${year}-${month}-${day}` : '';
  return input.value;
}

function isFutureDateInput(value) {
  return Boolean(value) && value > getTodayInputValue();
}

function getTodayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function onSignatureContinue() {
  if (App.signaturePad.isEmpty()) {
    showMessage('Firma requerida', 'Debe firmar antes de continuar.');
    return;
  }

  App.state.signatureDataUrl = App.signaturePad.toDataURL();
  showStep('summary');
  showSummary();
}

async function createConsentPdf() {
  document.getElementById('btnGeneratePdf').disabled = true;
  try {
    const consentData = {
      consentType: App.state.consentType,
      paciente: App.state.paciente,
      tratamiento: App.state.tratamiento,
      autorizacion: App.state.autorizacion,
      signatureDataUrl: App.state.signatureDataUrl,
      doctora: App.config.doctora || 'Patricia Navarrete'
    };

    const result = await PdfGenerator.generateConsentPdf(consentData);
    await downloadBlob(new Blob([result.pdfBytes], { type: 'application/pdf' }), result.fileName);

    try {
      await ConsentStorage.saveConsent({
        nombre: App.state.paciente.nombre,
        rut: App.state.paciente.rut,
        fecha: formatDate(new Date()),
        tipo: App.state.consentType === 'general' ? 'GENERAL' : 'TOXINA',
        tratamiento: App.state.tratamiento,
        autorizacion: App.state.autorizacion,
        archivo: result.fileName,
        pdfBytes: result.pdfBytes
      });
      await refreshHistory();
    } catch (storageError) {
      console.error('Error guardando historial:', storageError);
      showMessage('PDF generado', 'El consentimiento se descargó correctamente, pero no se pudo guardar en el historial de este dispositivo.');
    }

    try {
      createRecaptureTasksForConsent({
        nombre: App.state.paciente.nombre,
        rut: App.state.paciente.rut,
        procedimientos: App.state.tratamientos,
        consentType: App.state.consentType,
        consentDate: new Date()
      });
    } catch (recaptureError) {
      console.error('Error guardando recaptacion:', recaptureError);
    }

    setDoneMessage('Consentimiento generado', 'El consentimiento se generó correctamente y se guardó en el historial.');
    showStep('done');
    resetConsentFlow();
  } catch (error) {
    console.error(error);
    showMessage('No se pudo generar el PDF', error?.message || 'Revise los datos e intente nuevamente.');
  } finally {
    document.getElementById('btnGeneratePdf').disabled = false;
  }
}

async function createAssessmentPdf() {
  const button = document.getElementById('btnGenerateAssessment');
  const nombreInput = document.getElementById('assessmentNombre');
  const nombre = nombreInput.value.trim();

  if (!nombre) {
    showMessage('Datos incompletos', 'Complete todos los campos obligatorios antes de continuar.', 'Atencion', 'Volver a completar', 'assessmentNombre');
    return;
  }

  button.disabled = true;
  try {
    App.state.assessment.paciente = nombre;
    const result = await PdfGenerator.generateAssessmentPdf({
      paciente: { nombre },
      respuestas: App.state.assessment.respuestas
    });

    await downloadBlob(new Blob([result.pdfBytes], { type: 'application/pdf' }), result.fileName);

    try {
      await ConsentStorage.saveConsent({
        nombre,
        rut: 'Sin RUT',
        fecha: formatDate(new Date()),
        tipo: 'AUTOEVALUACION',
        tratamiento: 'Autoevaluación estética',
        autorizacion: '',
        archivo: result.fileName,
        pdfBytes: result.pdfBytes
      });
      await refreshHistory();
    } catch (storageError) {
      console.error('Error guardando historial:', storageError);
      showMessage('PDF generado', 'La autoevaluación se descargó correctamente, pero no se pudo guardar en el historial de este dispositivo.');
    }

    setDoneMessage('¡Gracias por completar su autoevaluación!', 'Esta información nos ayudará a comprender mejor sus necesidades y ofrecer una atención más personalizada.', 'assessment');
    showStep('done');
    resetAssessmentFlow();
  } catch (error) {
    console.error(error);
    showMessage('No se pudo generar el PDF', error?.message || 'Revise las respuestas e intente nuevamente.');
  } finally {
    button.disabled = false;
  }
}

async function createSkinLabPdf() {
  const button = document.getElementById('btnGenerateSkinLab');
  const nombreInput = document.getElementById('skinLabNombre');
  const edadInput = document.getElementById('skinLabEdad');
  const concernInput = document.getElementById('skinLabConcern');
  const considerationsInput = document.getElementById('skinLabConsiderations');

  const nombre = nombreInput.value.trim();
  const edad = edadInput.value.trim();
  const concern = concernInput.value.trim();
  const considerations = considerationsInput.value.trim();
  const goals = [...App.state.skinLab.goals];
  const relaxZones = [...App.state.skinLab.relaxZones];

  if (!nombre) {
    showMessage('Datos incompletos', 'Ingrese el nombre de la paciente.', 'Atencion', 'Volver a completar', 'skinLabNombre');
    return;
  }

  if (!edad || Number(edad) < 1 || Number(edad) > 120) {
    showMessage('Datos incompletos', 'Ingrese una edad valida para la paciente.', 'Atencion', 'Volver a completar', 'skinLabEdad');
    return;
  }

  const derived = deriveSkinLabDataFromAssessment();
  const finalGoals = goals.length ? goals : derived?.goals || [];
  const finalConcern = concern || derived?.concern || '';
  const finalConsiderations = considerations || derived?.considerations || '';

  if (!finalGoals.length) {
    showMessage('Datos incompletos', 'Seleccione al menos un objetivo para la piel.', 'Atencion', 'Volver a completar');
    return;
  }

  if (!finalConcern) {
    showMessage('Datos incompletos', 'Complete la preocupacion principal de la piel.', 'Atencion', 'Volver a completar', 'skinLabConcern');
    return;
  }

  button.disabled = true;
  try {
    const result = await PdfGenerator.generateSkinLabPdf({
      paciente: { nombre, edad },
      goals: finalGoals,
      concern: finalConcern,
      considerations: finalConsiderations,
      relaxZones,
      assessment: App.state.assessment
    });

    await downloadBlob(new Blob([result.pdfBytes], { type: 'application/pdf' }), result.fileName);

    try {
      await ConsentStorage.saveConsent({
        nombre,
        edad,
        rut: '',
        fecha: formatDate(new Date()),
        tipo: 'SKIN LAB',
        tratamiento: 'Skin Lab - Objetivos del Tratamiento',
        autorizacion: '',
        archivo: result.fileName,
        pdfBytes: result.pdfBytes
      });
      await refreshHistory();
    } catch (storageError) {
      console.error('Error guardando historial:', storageError);
      showMessage('PDF generado', 'La evaluacion Skin Lab se descargo correctamente, pero no se pudo guardar en el historial de este dispositivo.');
    }

    setDoneMessage('¡Gracias por completar tu evaluación!', 'Hemos registrado tus objetivos y preferencias. Esta información nos ayudará a personalizar tu tratamiento Skin Lab.', 'assessment');
    showStep('done');
    resetSkinLabFlow();
  } catch (error) {
    console.error(error);
    showMessage('No se pudo generar el PDF', error?.message || 'Revise las respuestas e intente nuevamente.');
  } finally {
    button.disabled = false;
  }
}

function setDoneMessage(title, message, mode = 'consent') {
  document.querySelector('#stepDone h2').textContent = title;
  document.querySelector('#stepDone > .card > p').textContent = message;
  document.getElementById('btnNewConsent').classList.toggle('hidden', mode === 'assessment');
  document.getElementById('btnGoHistory').classList.toggle('hidden', mode === 'assessment');
  document.getElementById('btnAssessmentHome').classList.toggle('hidden', mode !== 'assessment');
}

async function downloadBlob(blob, filename) {
  if (window.IconicAndroid?.saveFile) {
    const base64 = await blobToBase64(blob);
    const savedPath = window.IconicAndroid.saveFile(filename, base64, blob.type || 'application/octet-stream');
    if (!savedPath) {
      throw new Error('Android no pudo guardar el archivo generado.');
    }
    return savedPath;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function createRecaptureTasksForConsent({ nombre, rut, procedimientos, consentType, consentDate }) {
  const selectedProcedures = Array.isArray(procedimientos) ? procedimientos : [];
  const recapturableProcedures = selectedProcedures.filter((procedure) => !isExcludedRecaptureProcedure(procedure));
  if (!recapturableProcedures.length) {
    return;
  }

  if (consentType === 'toxina') {
    const toxinProcedures = recapturableProcedures.filter(isToxinProcedure);
    const annualProcedures = recapturableProcedures.filter((procedure) => !isToxinProcedure(procedure));

    if (toxinProcedures.length) {
      createRecaptureTask({
        nombre,
        rut,
        procedimiento: toxinProcedures.join(', '),
        consentType,
        consentDate
      });
    }

    if (annualProcedures.length) {
      createRecaptureTask({
        nombre,
        rut,
        procedimiento: annualProcedures.join(', '),
        consentType: null,
        consentDate
      });
    }

    return;
  }

  createRecaptureTask({
    nombre,
    rut,
    procedimiento: recapturableProcedures.join(', '),
    consentType,
    consentDate
  });
}

function createRecaptureTask({ nombre, rut, procedimiento, consentType, consentDate }) {
  const treatmentDate = consentDate instanceof Date ? consentDate : new Date();
  const monthsToContact = getRecaptureDelayMonths(procedimiento, consentType);
  const contactDate = addMonths(treatmentDate, monthsToContact);
  const id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `recapture-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  App.recaptureRecords.push({
    id,
    nombre: nombre || '',
    rut: rut || '',
    procedimiento: procedimiento || 'Procedimiento',
    consentDate: toDateInputValue(treatmentDate),
    contactFrom: toDateInputValue(contactDate),
    status: 'pending',
    contactedAt: '',
    contactedMonth: '',
    createdAt: new Date().toISOString()
  });
  App.recaptureRecords.sort((a, b) => a.contactFrom.localeCompare(b.contactFrom) || a.createdAt.localeCompare(b.createdAt));
  saveRecaptureRecords();
}

function getRecaptureDelayMonths(procedimiento, consentType) {
  const normalized = removeAccents(`${procedimiento || ''} ${consentType || ''}`).toLowerCase();
  return isToxinProcedure(normalized) ? 5 : 12;
}

function isToxinProcedure(value) {
  const normalized = removeAccents(value || '').toLowerCase();
  return normalized.includes('toxina') || normalized.includes('botulinica');
}

function isExcludedRecaptureProcedure(value) {
  const normalized = removeAccents(value || '').toLowerCase();
  return normalized.includes('hialuronidasa') || normalized.includes('colagenasa');
}

function renderRecaptureView() {
  App.recaptureRecords = loadRecaptureRecords();
  const monthInput = document.getElementById('recaptureMonth');

  if (!App.state.recaptureMonth) {
    App.state.recaptureMonth = getMonthKey(new Date());
  }

  if (monthInput) {
    monthInput.value = App.state.recaptureMonth;
  }

  updateRecaptureCounters();
  renderRecaptureList(getFilteredRecaptureRecords());
}

function updateRecaptureCounters() {
  const month = App.state.recaptureMonth || getMonthKey(new Date());
  const monthRecords = App.recaptureRecords.filter((record) => getMonthKey(record.contactFrom) === month);
  const pending = monthRecords.filter((record) => record.status === 'pending').length;
  const contacted = monthRecords.filter((record) => record.status === 'contacted').length;
  const scheduled = Number(App.recaptureStats.totalScheduled || 0);

  document.getElementById('recapturePendingCount').textContent = String(pending);
  document.getElementById('recaptureContactedCount').textContent = String(contacted);
  document.getElementById('recaptureScheduledCount').textContent = String(scheduled);
}

function getFilteredRecaptureRecords() {
  const month = App.state.recaptureMonth || getMonthKey(new Date());
  const query = removeAccents(document.getElementById('recaptureSearch').value.trim()).toLowerCase();

  return App.recaptureRecords.filter((record) => {
    const recordMonth = getMonthKey(record.contactFrom);
    const matchesMonth = recordMonth === month;
    const haystack = removeAccents([record.nombre, record.rut].join(' ')).toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesMonth && matchesQuery;
  });
}

function renderRecaptureList(records) {
  const list = document.getElementById('recaptureList');
  const pagination = document.getElementById('recapturePagination');
  list.innerHTML = '';
  if (pagination) {
    pagination.innerHTML = '';
  }

  if (!records.length) {
    list.innerHTML = '<p class="empty-state">No hay pacientes que requieran seguimiento activo para los filtros seleccionados.</p>';
    return;
  }

  const totalPages = Math.ceil(records.length / RECAPTURE_PAGE_SIZE);
  App.state.recapturePage = Math.min(Math.max(App.state.recapturePage, 1), totalPages);
  const startIndex = (App.state.recapturePage - 1) * RECAPTURE_PAGE_SIZE;
  const visibleRecords = records.slice(startIndex, startIndex + RECAPTURE_PAGE_SIZE);

  visibleRecords.forEach((record) => {
    const taskKey = getRecaptureTaskKey(record);
    const row = document.createElement('article');
    row.className = `recapture-row recapture-row-${record.status}`;

    const patient = document.createElement('div');
    patient.className = 'recapture-patient';

    const avatar = document.createElement('span');
    avatar.className = 'recapture-avatar';
    avatar.textContent = getInitials(record.nombre);

    const patientCopy = document.createElement('div');
    patientCopy.className = 'recapture-patient-copy';

    const title = document.createElement('h3');
    title.textContent = record.nombre || 'Paciente sin nombre';

    const rut = document.createElement('p');
    rut.textContent = `RUT: ${record.rut || 'Sin RUT'}`;

    patientCopy.append(title, rut);
    patient.append(avatar, patientCopy);

    const procedure = createRecaptureField('Procedimiento', record.procedimiento || 'Procedimiento', false, 'procedure');
    const treatmentDate = createRecaptureField('Fecha procedimiento', formatDateForDisplay(record.consentDate), true, 'treatment-date');
    const contactDate = createRecaptureField('Contactar desde', formatDateForDisplay(record.contactFrom), true, 'contact-date');

    const status = document.createElement('span');
    status.className = `recapture-status recapture-status-${record.status}`;
    status.textContent = RECAPTURE_STATUS[record.status] || 'Pendiente';

    const actions = document.createElement('div');
    actions.className = 'recapture-actions';

    const contactedButton = document.createElement('button');
    contactedButton.type = 'button';
    contactedButton.className = 'secondary recapture-action-button recapture-contact-button';
    contactedButton.textContent = 'Contactada';
    contactedButton.setAttribute('aria-pressed', record.status === 'contacted' ? 'true' : 'false');
    contactedButton.addEventListener('click', () => {
      updateRecaptureStatus(taskKey, record.status === 'contacted' ? 'pending' : 'contacted');
    });

    const scheduledButton = document.createElement('button');
    scheduledButton.type = 'button';
    scheduledButton.className = 'recapture-action-button recapture-scheduled-button';
    scheduledButton.textContent = 'Agendó cita';
    scheduledButton.addEventListener('click', () => confirmCompleteRecaptureTask(taskKey));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'recapture-delete-button';
    deleteButton.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M3 6h18"></path>
        <path d="M8 6V4h8v2"></path>
        <path d="M19 6l-1 14H6L5 6"></path>
        <path d="M10 11v5"></path>
        <path d="M14 11v5"></path>
      </svg>
    `;
    deleteButton.setAttribute('aria-label', `Eliminar seguimiento de ${record.nombre || 'paciente'}`);
    deleteButton.title = 'Eliminar de la lista';
    deleteButton.addEventListener('click', () => confirmDeleteRecaptureTask(taskKey));

    actions.append(contactedButton, scheduledButton, deleteButton);
    row.append(patient, procedure, treatmentDate, contactDate, status, actions);
    list.appendChild(row);
  });

  renderRecapturePagination(records.length, totalPages);
}

function renderRecapturePagination(totalRecords, totalPages) {
  const pagination = document.getElementById('recapturePagination');
  if (!pagination || totalPages <= 1) {
    return;
  }

  const page = App.state.recapturePage;
  const startRecord = (page - 1) * RECAPTURE_PAGE_SIZE + 1;
  const endRecord = Math.min(page * RECAPTURE_PAGE_SIZE, totalRecords);

  const summary = document.createElement('div');
  summary.className = 'history-pagination-summary';
  summary.innerHTML = `
    <p><strong>${endRecord - startRecord + 1}</strong> pacientes visibles &middot; <strong>${totalRecords}</strong> en total</p>
  `;

  const controls = document.createElement('div');
  controls.className = 'history-pagination-controls';

  const previousButton = document.createElement('button');
  previousButton.type = 'button';
  previousButton.className = 'secondary history-page-button';
  previousButton.innerHTML = '<span class="history-page-arrow history-page-arrow-prev" aria-hidden="true"></span>';
  previousButton.setAttribute('aria-label', 'Pagina anterior');
  previousButton.disabled = page === 1;
  previousButton.addEventListener('click', () => {
    App.state.recapturePage -= 1;
    renderRecaptureList(getFilteredRecaptureRecords());
  });

  const pageLabel = document.createElement('span');
  pageLabel.className = 'history-page-indicator';
  pageLabel.textContent = `${page} / ${totalPages}`;

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'secondary history-page-button';
  nextButton.innerHTML = '<span class="history-page-arrow history-page-arrow-next" aria-hidden="true"></span>';
  nextButton.setAttribute('aria-label', 'Pagina siguiente');
  nextButton.disabled = page === totalPages;
  nextButton.addEventListener('click', () => {
    App.state.recapturePage += 1;
    renderRecaptureList(getFilteredRecaptureRecords());
  });

  controls.append(previousButton, pageLabel, nextButton);
  pagination.append(summary, controls);
}

function createRecaptureField(label, value, withIcon = false, variant = '') {
  const item = document.createElement('div');
  item.className = [
    'recapture-field',
    withIcon ? 'recapture-field-date' : '',
    variant ? `recapture-field-${variant}` : ''
  ].filter(Boolean).join(' ');
  const labelElement = document.createElement('span');
  const valueElement = document.createElement('strong');
  labelElement.textContent = label;
  valueElement.textContent = value || '-';
  item.append(labelElement, valueElement);
  return item;
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return '--';
  }

  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

function getRecaptureTaskKey(record) {
  return [
    record.id || '',
    record.contactFrom || '',
    normalizeRecaptureIdentity(record.procedimiento)
  ].join('|');
}

function normalizeRecaptureIdentity(value) {
  return removeAccents(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findRecaptureRecordByTaskKey(taskKey) {
  return App.recaptureRecords.find((item) => getRecaptureTaskKey(item) === taskKey);
}

function updateRecaptureStatus(taskKey, status) {
  const record = findRecaptureRecordByTaskKey(taskKey);
  if (!record) {
    return;
  }

  record.status = status;
  if (status === 'contacted') {
    record.contactedAt = new Date().toISOString();
    record.contactedMonth = getMonthKey(record.contactFrom);
  } else {
    record.contactedAt = '';
    record.contactedMonth = '';
  }
  saveRecaptureRecords();
  renderRecaptureView();
}

function confirmCompleteRecaptureTask(taskKey) {
  showConfirmModal({
    eyebrow: 'Recaptacion',
    title: '¿Finalizar seguimiento?',
    message: 'Esta tarea desaparecerá de la bandeja de recaptación activa.',
    cancelLabel: 'Cancelar',
    confirmLabel: 'Sí, finalizar',
    onConfirm: () => completeRecaptureTask(taskKey)
  });
}

function confirmDeleteRecaptureTask(taskKey) {
  showConfirmModal({
    eyebrow: 'Recaptacion',
    title: '¿Eliminar seguimiento?',
    message: 'Esta tarea desaparecerá de la bandeja activa y no se registrará como cita agendada.',
    cancelLabel: 'Cancelar',
    confirmLabel: 'Sí, eliminar',
    onConfirm: () => deleteRecaptureTask(taskKey)
  });
}

function completeRecaptureTask(taskKey) {
  const record = findRecaptureRecordByTaskKey(taskKey);
  if (!record) {
    return;
  }

  const month = getMonthKey(record.contactFrom);
  App.recaptureStats[month] = App.recaptureStats[month] || {};
  App.recaptureStats[month].scheduled = Number(App.recaptureStats[month].scheduled || 0) + 1;
  App.recaptureStats.totalScheduled = Number(App.recaptureStats.totalScheduled || 0) + 1;
  App.recaptureRecords = App.recaptureRecords.filter((item) => getRecaptureTaskKey(item) !== taskKey);
  saveRecaptureStats();
  saveRecaptureRecords();
  renderRecaptureView();
}

function deleteRecaptureTask(taskKey) {
  App.recaptureRecords = App.recaptureRecords.filter((item) => getRecaptureTaskKey(item) !== taskKey);
  saveRecaptureRecords();
  renderRecaptureView();
}

function changeRecaptureMonth(direction) {
  const currentMonth = App.state.recaptureMonth || getMonthKey(new Date());
  const [year, month] = currentMonth.split('-').map(Number);
  const date = Number.isFinite(year) && Number.isFinite(month)
    ? new Date(year, month - 1 + direction, 1)
    : new Date();
  App.state.recaptureMonth = getMonthKey(date);
  App.state.recapturePage = 1;
  renderRecaptureView();
}

function addMonths(date, months) {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== day) {
    result.setDate(0);
  }
  return result;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthKey(value) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }

  return String(value || '').slice(0, 7);
}

function formatDateForDisplay(value) {
  if (!value) {
    return '';
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function removeAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function refreshHistory() {
  App.historyRecords = await ConsentStorage.getAllConsents();
  updateHistoryViewLabels();
  renderHistoryList(getFilteredHistoryRecords());
}

function updateHistoryViewLabels() {
  const isSkinLab = App.state.historyArea === 'skinLab';
  const title = document.getElementById('historyTitle');
  const search = document.getElementById('historySearch');
  const exportBackupButton = document.getElementById('btnExportBackup');
  const monthBlock = document.getElementById('historyMonthBlock');

  if (title) {
    title.textContent = isSkinLab ? 'SKIN LAB' : 'Documentacion Clinica';
  }

  if (search) {
    search.placeholder = isSkinLab ? 'Buscar paciente' : 'Buscar paciente, procedimiento o RUT';
  }

  if (exportBackupButton) {
    exportBackupButton.textContent = isSkinLab ? 'Exportar Skin Lab completo' : 'Exportar historial completo';
  }

  if (monthBlock) {
    monthBlock.classList.remove('hidden');
    monthBlock.hidden = false;
    monthBlock.setAttribute('aria-hidden', 'false');
  }
}

function renderHistoryList(records) {
  const list = document.getElementById('historyList');
  const pagination = document.getElementById('historyPagination');
  list.innerHTML = '';
  if (pagination) {
    pagination.innerHTML = '';
  }

  if (!records.length) {
    list.innerHTML = App.state.historyArea === 'skinLab'
      ? '<p>No hay documentos Skin Lab guardados.</p>'
      : '<p>No hay registros en el historial.</p>';
    return;
  }

  const totalPages = Math.ceil(records.length / HISTORY_PAGE_SIZE);
  App.state.historyPage = Math.min(Math.max(App.state.historyPage, 1), totalPages);
  const startIndex = (App.state.historyPage - 1) * HISTORY_PAGE_SIZE;
  const visibleRecords = records.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);

  visibleRecords.forEach((record) => {
    const card = document.createElement('article');
    card.className = 'history-card';
    const documentKind = record.tipo === 'AUTOEVALUACION' ? 'Autoevaluaci&oacute;n est&eacute;tica' : 'Consentimiento';
    if (record.tipo === 'AUTOEVALUACION' || record.tipo === 'SKIN LAB') {
      const title = record.tipo === 'SKIN LAB' ? 'Skin Lab &bull; OBJETIVOS DEL TRATAMIENTO' : 'Autoevaluaci&oacute;n &bull; EST&Eacute;TICA';
      card.innerHTML = `
        <h3>${record.nombre}</h3>
        <p class="history-consent">${title}</p>
        ${record.edad ? `<p><strong>Edad</strong> ${record.edad}</p>` : ''}
        <p><strong>Fecha de emisi&oacute;n</strong> ${formatHistoryDisplayDate(record)}</p>
        <div class="history-actions"></div>
      `;
    } else {
      card.innerHTML = `
        <h3>${record.nombre}</h3>
        <p class="history-consent">${documentKind} &bull; ${record.tipo}</p>
        <p><strong>Identificaci&oacute;n</strong> ${record.rut}</p>
        <p><strong>Fecha de emisi&oacute;n</strong> ${record.fecha}</p>
        <p><strong>Procedimiento</strong> ${record.tratamiento}</p>
        <p><strong>Documento</strong> ${record.archivo}</p>
        <div class="history-actions"></div>
      `;
    }
    const actions = card.querySelector('.history-actions');
    const btnPreview = document.createElement('button');
    btnPreview.textContent = 'Ver Documento';
    btnPreview.addEventListener('click', () => openDocumentPreview(record));
    actions.appendChild(btnPreview);

    const btnDownload = document.createElement('button');
    btnDownload.className = 'secondary';
    btnDownload.textContent = 'Descargar';
    btnDownload.addEventListener('click', async () => {
      const bytes = normalizePdfBytes(record.pdfBytes);
      await downloadBlob(new Blob([bytes], { type: 'application/pdf' }), record.archivo);
    });
    actions.appendChild(btnDownload);
    const btnDelete = document.createElement('button');
    btnDelete.className = 'danger subtle-danger';
    btnDelete.textContent = 'Eliminar';
    btnDelete.addEventListener('click', () => deleteHistoryRecord(record));
    actions.appendChild(btnDelete);
    list.appendChild(card);
  });

  renderHistoryPagination(records.length, totalPages);
}

function renderHistoryPagination(totalRecords, totalPages) {
  const pagination = document.getElementById('historyPagination');
  if (!pagination || totalPages <= 1) {
    return;
  }

  const page = App.state.historyPage;
  const startRecord = (page - 1) * HISTORY_PAGE_SIZE + 1;
  const endRecord = Math.min(page * HISTORY_PAGE_SIZE, totalRecords);

  const summary = document.createElement('div');
  summary.className = 'history-pagination-summary';
  summary.innerHTML = `
    <p><strong>${endRecord - startRecord + 1}</strong> documentos visibles &middot; <strong>${totalRecords}</strong> en total</p>
  `;

  const controls = document.createElement('div');
  controls.className = 'history-pagination-controls';

  const previousButton = document.createElement('button');
  previousButton.type = 'button';
  previousButton.className = 'secondary history-page-button';
  previousButton.innerHTML = '<span class="history-page-arrow history-page-arrow-prev" aria-hidden="true"></span>';
  previousButton.setAttribute('aria-label', 'Pagina anterior');
  previousButton.disabled = page === 1;
  previousButton.addEventListener('click', () => {
    App.state.historyPage -= 1;
    renderHistoryList(getFilteredHistoryRecords());
  });

  const pageLabel = document.createElement('span');
  pageLabel.className = 'history-page-indicator';
  pageLabel.textContent = `${page} / ${totalPages}`;

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'secondary history-page-button';
  nextButton.innerHTML = '<span class="history-page-arrow history-page-arrow-next" aria-hidden="true"></span>';
  nextButton.setAttribute('aria-label', 'Pagina siguiente');
  nextButton.disabled = page === totalPages;
  nextButton.addEventListener('click', () => {
    App.state.historyPage += 1;
    renderHistoryList(getFilteredHistoryRecords());
  });

  controls.append(previousButton, pageLabel, nextButton);
  pagination.append(summary, controls);
}

function getFilteredHistoryRecords() {
  const query = document.getElementById('historySearch').value.trim().toLowerCase();
  return getHistoryAreaRecords().filter((record) => {
    if (!query) {
      return true;
    }
    if (App.state.historyArea === 'skinLab') {
      return String(record.nombre || '').toLowerCase().includes(query);
    }
    return [record.nombre, record.rut, record.fecha, record.tipo, record.tratamiento]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

function getHistoryAreaRecords(records = App.historyRecords) {
  if (App.state.historyArea === 'skinLab') {
    return records.filter((record) => record.tipo === 'SKIN LAB');
  }

  return records.filter((record) => record.tipo !== 'SKIN LAB');
}

async function openDocumentPreview(record) {
  App.previewRecord = record;
  document.getElementById('documentPreviewTitle').textContent = record.archivo || 'Previsualizacion';
  document.getElementById('documentPreviewModal').classList.remove('hidden');

  const viewer = document.getElementById('historyPdfViewer');
  const bytes = normalizePdfBytes(record.pdfBytes);
  if (!bytes.length) {
    viewer.innerHTML = '<p class="pdf-render-status">Este registro no tiene un PDF guardado para previsualizar.</p>';
    return;
  }

  await renderPdfIntoViewer({ data: bytes }, viewer, {
    loadingText: 'Cargando documento firmado...',
    errorText: 'No se pudo previsualizar este documento.'
  });
}

function closeDocumentPreview() {
  App.previewRecord = null;
  document.getElementById('historyPdfViewer').innerHTML = '';
  document.getElementById('documentPreviewModal').classList.add('hidden');
}

async function downloadPreviewDocument() {
  if (!App.previewRecord) {
    return;
  }

  const bytes = normalizePdfBytes(App.previewRecord.pdfBytes);
  await downloadBlob(new Blob([bytes], { type: 'application/pdf' }), App.previewRecord.archivo);
}

function normalizePdfBytes(pdfBytes) {
  if (!pdfBytes) {
    return new Uint8Array();
  }

  if (pdfBytes instanceof Uint8Array) {
    return new Uint8Array(pdfBytes);
  }

  if (pdfBytes instanceof ArrayBuffer) {
    return new Uint8Array(pdfBytes.slice(0));
  }

  if (Array.isArray(pdfBytes)) {
    return new Uint8Array(pdfBytes);
  }

  if (typeof pdfBytes === 'string') {
    const base64 = pdfBytes.includes(',') ? pdfBytes.split(',').pop() : pdfBytes;
    try {
      return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    } catch (error) {
      console.error('PDF guardado con formato de texto no valido:', error);
      return new Uint8Array();
    }
  }

  if (typeof pdfBytes === 'object') {
    if (Array.isArray(pdfBytes.data)) {
      return new Uint8Array(pdfBytes.data);
    }

    if (pdfBytes.buffer instanceof ArrayBuffer) {
      const offset = pdfBytes.byteOffset || 0;
      const length = pdfBytes.byteLength || pdfBytes.buffer.byteLength;
      return new Uint8Array(pdfBytes.buffer.slice(offset, offset + length));
    }

    const numericKeys = Object.keys(pdfBytes)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b));
    if (numericKeys.length) {
      return new Uint8Array(numericKeys.map((key) => pdfBytes[key]));
    }
  }

  return new Uint8Array();
}

async function exportBackup() {
  const records = getHistoryAreaRecords(await ConsentStorage.getAllConsents());
  const prefix = App.state.historyArea === 'skinLab' ? 'skin_lab' : 'consentimientos';
  await exportRecords(records, `${prefix}_completo_${formatDateForFile(new Date())}.zip`, `${prefix}_completo`);
}

async function exportMonthBackup() {
  const month = document.getElementById('historyMonth').value;
  if (!month) {
    showMessage('Seleccione un mes', 'Debe seleccionar un mes para exportar registros.');
    return;
  }

  const records = getRecordsForSelectedMonth();
  if (!records.length) {
    showMessage('Sin registros', 'No hay registros para el mes seleccionado.');
    return;
  }

  const monthKey = month.replace('-', '');
  const prefix = App.state.historyArea === 'skinLab' ? 'skin_lab' : 'consentimientos';
  await exportRecords(records, `${prefix}_${monthKey}.zip`, `${prefix}_${monthKey}`);
}

async function exportRecords(records, fileName, folderName) {
  const zip = new JSZip();
  const consentFolder = zip.folder(folderName || 'consentimientos');

  records.forEach((record) => {
    const bytes = normalizePdfBytes(record.pdfBytes);
    if (bytes.length) {
      consentFolder.file(record.archivo, bytes);
    }
  });

  const content = await zip.generateAsync({ type: 'blob' });
  await downloadBlob(content, fileName);
}

async function deleteMonthRecords() {
  const records = getRecordsForSelectedMonth();
  const month = document.getElementById('historyMonth').value;

  if (!month) {
    showMessage('Seleccione un mes', 'Debe seleccionar un mes para eliminar registros.');
    return;
  }

  if (!records.length) {
    showMessage('Sin registros', 'No hay registros para el mes seleccionado.');
    return;
  }

  const confirmed = window.confirm(`Se eliminaran ${records.length} registro(s) del mes seleccionado. Esta accion no se puede deshacer.`);
  if (!confirmed) {
    return;
  }

  await ConsentStorage.deleteConsentsByIds(records.map((record) => record.id));
  await refreshHistory();
}

async function deleteHistoryRecord(record) {
  const confirmed = window.confirm(`Eliminar el documento "${record.archivo}" del historial? Esta accion no se puede deshacer.`);
  if (!confirmed) {
    return;
  }

  await ConsentStorage.deleteConsentById(record.id);
  await refreshHistory();
}

function getRecordsForSelectedMonth() {
  const month = document.getElementById('historyMonth').value;
  if (!month) {
    return [];
  }

  return getHistoryAreaRecords().filter((record) => getRecordMonthKey(record) === month);
}

function getRecordMonthKey(record) {
  if (record.createdAt) {
    return record.createdAt.slice(0, 7);
  }

  const match = String(record.fecha || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}` : '';
}

function formatHistoryDisplayDate(record) {
  let date = record.createdAt ? new Date(record.createdAt) : null;

  if (!date || Number.isNaN(date.getTime())) {
    const match = String(record.fecha || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    }
  }

  if (!date || Number.isNaN(date.getTime())) {
    return record.fecha || '';
  }

  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function formatDate(date) {
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateForFile(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}
