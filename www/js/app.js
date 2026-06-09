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
    signatureDataUrl: null,
    historyAccessGranted: false,
    protectedTarget: 'menu'
  },
  signaturePad: null,
  historyRecords: [],
  procedures: [],
  pdfRenderToken: 0,
  previewRecord: null,
  pendingFocusTarget: null
};
const HISTORY_PIN = '0000';
const PROCEDURES_STORAGE_KEY = 'iconicProcedimientos';
const DEFAULT_PROCEDURES = [
  'Toxina Botulínica',
  'Ácido hialurónico',
  'Sculptra',
  'Radiesse',
  'Stimulate',
  'Polinucleotidos',
  'Mallas PDO'
];
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

function getEnabledProcedures() {
  return App.procedures.filter((procedure) => procedure.enabled).map((procedure) => procedure.name);
}

function bindEvents() {
  document.getElementById('btnStartAssessment').addEventListener('click', startAssessment);
  document.getElementById('btnAssessmentBack').addEventListener('click', () => showStep('select'));
  document.getElementById('btnGenerateAssessment').addEventListener('click', createAssessmentPdf);
  document.getElementById('btnGeneral').addEventListener('click', () => selectConsent('general'));
  document.getElementById('btnToxina').addEventListener('click', () => selectConsent('toxina'));
  document.getElementById('btnPdfContinue').addEventListener('click', () => showStep('form'));
  document.getElementById('btnPdfBack').addEventListener('click', () => showStep('select'));
  document.getElementById('readCheckbox').addEventListener('change', updateReadContinue);
  document.getElementById('selectTratamiento').addEventListener('change', onTreatmentSelect);
  document.getElementById('inputRut').addEventListener('input', onRutInput);
  document.getElementById('inputRut').addEventListener('blur', onRutBlur);
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
  document.getElementById('btnMenuHistory').addEventListener('click', () => openProtectedStep('history'));
  document.getElementById('btnMenuProcedures').addEventListener('click', () => openProtectedStep('procedures'));
  document.getElementById('btnMenuBack').addEventListener('click', () => showStep('select'));
  document.getElementById('btnProceduresBack').addEventListener('click', () => openProtectedStep('menu'));
  document.getElementById('btnAddProcedure').addEventListener('click', addProcedure);
  document.getElementById('inputNewProcedure').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      addProcedure();
    }
  });
  document.getElementById('btnHistoryBack').addEventListener('click', () => openProtectedStep('menu'));
  document.getElementById('historySearch').addEventListener('input', refreshHistory);
  document.getElementById('historyMonth').addEventListener('change', refreshHistory);
  document.getElementById('btnExportBackup').addEventListener('click', exportBackup);
  document.getElementById('btnExportMonth').addEventListener('click', exportMonthBackup);
  document.getElementById('btnDeleteMonth').addEventListener('click', deleteMonthRecords);
  document.getElementById('btnPinCancel').addEventListener('click', closePinModal);
  document.getElementById('btnPinSubmit').addEventListener('click', submitHistoryPin);
  document.getElementById('pinInput').addEventListener('input', onPinInput);
  document.getElementById('pinInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      submitHistoryPin();
    }
  });
  document.getElementById('btnMessageOk').addEventListener('click', closeMessageModal);
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

    const loadingTask = window.pdfjsLib.getDocument(source);
    const pdf = await loadingTask.promise;

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
    viewer.innerHTML = `<p class="pdf-render-status">${options.errorText || 'No se pudo visualizar el PDF.'}</p>`;
  }
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
  App.state.historyAccessGranted = false;

  if (stepId === 'form') {
    populateTreatmentOptions();
  }

  if (stepId === 'assessment') {
    renderAssessmentQuestions();
  }

  if (stepId === 'history') {
    refreshHistory();
  }

  if (stepId === 'procedures') {
    renderProcedureManager();
  }

  if (stepId === 'signature') {
    setTimeout(() => App.signaturePad.resize(), 0);
  }
}

function isProtectedStep(stepId) {
  return ['menu', 'history', 'procedures'].includes(stepId);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function populateTreatmentOptions() {
  const container = document.getElementById('treatmentContainer');
  const select = document.getElementById('selectTratamiento');
  select.innerHTML = '';

  container.style.display = 'block';
  const enabledProcedures = getEnabledProcedures();
  const enabledProcedureSet = new Set(enabledProcedures);
  App.state.tratamientos = App.state.tratamientos.filter((treatment) => enabledProcedureSet.has(treatment));
  App.state.tratamiento = getSelectedTreatmentText();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = enabledProcedures.length ? 'Seleccione un procedimiento' : 'No hay procedimientos habilitados';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  enabledProcedures.forEach((treatment) => {
    const option = document.createElement('option');
    option.value = treatment;
    option.textContent = treatment;
    select.appendChild(option);
  });
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
  renderSelectedTreatments();
}

function removeTreatment(treatment) {
  App.state.tratamientos = App.state.tratamientos.filter((selected) => selected !== treatment);
  App.state.tratamiento = getSelectedTreatmentText();
  renderSelectedTreatments();
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
    slider.addEventListener('input', () => {
      const value = Number(slider.value);
      App.state.assessment.respuestas[item.id] = value;
      App.state.assessment.touched[item.id] = true;
      questionCard.querySelector(`#assessmentScore${item.number}`).textContent = String(value);
      updateAssessmentProgress();
    });

    container.appendChild(questionCard);
  });

  updateAssessmentProgress();
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
  const nacimiento = document.getElementById('inputFechaNacimiento').value;
  const direccion = document.getElementById('inputDireccion').value.trim();
  const autorizacion = document.querySelector('input[name="autorizacion"]:checked');
  const treatment = getSelectedTreatmentText();

  if (!nombre || !rut || !nacimiento || !direccion || !treatment || !autorizacion) {
    showMessage('Datos incompletos', 'Complete todos los campos obligatorios antes de continuar.', 'Atencion', 'Volver a completar');
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
    input.max = getTodayInputValue();
  }
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

async function refreshHistory() {
  App.historyRecords = await ConsentStorage.getAllConsents();
  const query = document.getElementById('historySearch').value.trim().toLowerCase();
  const selectedMonth = document.getElementById('historyMonth').value;
  const filtered = App.historyRecords.filter((record) => {
    const matchesSearch = [record.nombre, record.rut, record.fecha, record.tipo, record.tratamiento]
      .join(' ')
      .toLowerCase()
      .includes(query);
    const matchesMonth = !selectedMonth || getRecordMonthKey(record) === selectedMonth;
    return matchesSearch && matchesMonth;
  });
  renderHistoryList(filtered);
}

function renderHistoryList(records) {
  const list = document.getElementById('historyList');
  list.innerHTML = '';

  if (!records.length) {
    list.innerHTML = '<p>No hay registros en el historial.</p>';
    return;
  }

  records.forEach((record) => {
    const card = document.createElement('article');
    card.className = 'history-card';
    const documentKind = record.tipo === 'AUTOEVALUACION' ? 'Autoevaluaci&oacute;n est&eacute;tica' : 'Consentimiento';
    if (record.tipo === 'AUTOEVALUACION') {
      card.innerHTML = `
        <h3>${record.nombre}</h3>
        <p class="history-consent">Autoevaluaci&oacute;n &bull; EST&Eacute;TICA</p>
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
      await downloadBlob(new Blob([record.pdfBytes], { type: 'application/pdf' }), record.archivo);
    });
    actions.appendChild(btnDownload);
    const btnDelete = document.createElement('button');
    btnDelete.className = 'danger subtle-danger';
    btnDelete.textContent = 'Eliminar';
    btnDelete.addEventListener('click', () => deleteHistoryRecord(record));
    actions.appendChild(btnDelete);
    list.appendChild(card);
  });
}

async function openDocumentPreview(record) {
  App.previewRecord = record;
  document.getElementById('documentPreviewTitle').textContent = record.archivo || 'Previsualizacion';
  document.getElementById('documentPreviewModal').classList.remove('hidden');

  const viewer = document.getElementById('historyPdfViewer');
  const bytes = normalizePdfBytes(record.pdfBytes);
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

  await downloadBlob(new Blob([App.previewRecord.pdfBytes], { type: 'application/pdf' }), App.previewRecord.archivo);
}

function normalizePdfBytes(pdfBytes) {
  if (pdfBytes instanceof Uint8Array) {
    return new Uint8Array(pdfBytes);
  }

  if (pdfBytes instanceof ArrayBuffer) {
    return new Uint8Array(pdfBytes.slice(0));
  }

  return new Uint8Array(pdfBytes);
}

async function exportBackup() {
  const records = await ConsentStorage.getAllConsents();
  await exportRecords(records, `consentimientos_completo_${formatDateForFile(new Date())}.zip`, 'consentimientos_completo');
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
  await exportRecords(records, `consentimientos_${monthKey}.zip`, `consentimientos_${monthKey}`);
}

async function exportRecords(records, fileName, folderName) {
  const zip = new JSZip();
  const consentFolder = zip.folder(folderName || 'consentimientos');

  records.forEach((record) => {
    consentFolder.file(record.archivo, record.pdfBytes);
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

  return App.historyRecords.filter((record) => getRecordMonthKey(record) === month);
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
