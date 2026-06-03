const App = {
  config: null,
  state: {
    consentType: null,
    tratamiento: null,
    tratamientos: [],
    autorizacion: null,
    paciente: {},
    signatureDataUrl: null,
    historyAccessGranted: false,
    protectedTarget: 'menu'
  },
  signaturePad: null,
  historyRecords: [],
  procedures: []
};
const HISTORY_PIN = '0000';
const PROCEDURES_STORAGE_KEY = 'iconicProcedimientos';
const DEFAULT_CONFIG = {
  doctora: 'Patricia Navarrete',
  general: ['Ácido Hialurónico', 'Bioestimuladores', 'Mesoterapia', 'PRP', 'Skin Booster', 'Exosomas'],
  toxina: ['Botox']
};

window.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
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

    const procedures = stored
      .filter((procedure) => procedure && typeof procedure.name === 'string' && procedure.name.trim())
      .map((procedure) => ({
        name: procedure.name.trim(),
        enabled: procedure.enabled !== false
      }));
    const existingNames = new Set(procedures.map((procedure) => normalizeProcedureName(procedure.name)));

    baseProcedures.forEach((procedure) => {
      if (!existingNames.has(normalizeProcedureName(procedure.name))) {
        procedures.push(procedure);
      }
    });

    return procedures.length ? procedures : baseProcedures;
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
  document.getElementById('btnGeneral').addEventListener('click', () => selectConsent('general'));
  document.getElementById('btnToxina').addEventListener('click', () => selectConsent('toxina'));
  document.getElementById('btnPdfContinue').addEventListener('click', () => showStep('form'));
  document.getElementById('btnPdfBack').addEventListener('click', () => showStep('select'));
  document.getElementById('readCheckbox').addEventListener('change', updateReadContinue);
  document.getElementById('selectTratamiento').addEventListener('change', onTreatmentSelect);
  document.getElementById('btnFormContinue').addEventListener('click', onFormContinue);
  document.getElementById('btnFormBack').addEventListener('click', () => showStep('pdf'));
  document.getElementById('btnClearSignature').addEventListener('click', () => {
    App.signaturePad.clear();
    document.getElementById('btnSignatureContinue').disabled = true;
  });
  document.getElementById('btnSignatureContinue').addEventListener('click', onSignatureContinue);
  document.getElementById('btnSummaryBack').addEventListener('click', () => showStep('signature'));
  document.getElementById('btnGeneratePdf').addEventListener('click', createConsentPdf);
  document.getElementById('btnNewConsent').addEventListener('click', () => showStep('select'));
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
  document.getElementById('btnExportBackup').addEventListener('click', exportBackup);
  document.getElementById('btnPinCancel').addEventListener('click', closePinModal);
  document.getElementById('btnPinSubmit').addEventListener('click', submitHistoryPin);
  document.getElementById('pinInput').addEventListener('input', onPinInput);
  document.getElementById('pinInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      submitHistoryPin();
    }
  });
  document.getElementById('btnMessageOk').addEventListener('click', closeMessageModal);
}

function selectConsent(type) {
  App.state.consentType = type;
  App.state.tratamiento = type === 'toxina' ? 'Botox' : null;
  App.state.tratamientos = type === 'toxina' ? ['Botox'] : [];
  App.state.autorizacion = null;
  App.state.paciente = {};
  App.state.signatureDataUrl = null;
  App.signaturePad.clear();
  document.getElementById('readCheckbox').checked = false;
  updateReadContinue();
  const asset = type === 'general' ? 'assets/consentimiento_general.pdf' : 'assets/consentimiento_toxina.pdf';
  document.getElementById('pdfViewer').src = asset;
  showStep('pdf');
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

  if (stepId === 'history') {
    refreshHistory();
  }

  if (stepId === 'procedures') {
    renderProcedureManager();
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

  if (App.state.consentType === 'toxina') {
    container.style.display = 'none';
    App.state.tratamiento = 'Botox';
    App.state.tratamientos = ['Botox'];
    return;
  }

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
  if (App.state.consentType === 'toxina') {
    return 'Botox';
  }

  return App.state.tratamientos.join(', ');
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

    const status = document.createElement('span');
    status.textContent = procedure.enabled ? 'Habilitado' : 'Deshabilitado';

    toggle.append(checkbox, status);
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
  const rut = document.getElementById('inputRut').value.trim();
  const nacimiento = document.getElementById('inputFechaNacimiento').value;
  const direccion = document.getElementById('inputDireccion').value.trim();
  const autorizacion = document.querySelector('input[name="autorizacion"]:checked');
  const treatment = getSelectedTreatmentText();

  if (!nombre || !rut || !nacimiento || !direccion || !treatment || !autorizacion) {
    showMessage('Datos incompletos', 'Complete todos los campos obligatorios antes de continuar.', 'Atención', 'Volver a completar');
    return;
  }

  if (isFutureDateInput(nacimiento)) {
    showMessage('Fecha no válida', 'La fecha de nacimiento no puede ser posterior al día de hoy.');
    return;
  }

  App.state.paciente = {
    nombre,
    rut,
    nacimiento: formatDateInput(nacimiento),
    direccion
  };
  App.state.tratamiento = treatment;
  App.state.autorizacion = autorizacion.value;
  App.signaturePad.clear();
  document.getElementById('btnSignatureContinue').disabled = true;
  showStep('signature');
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

function showMessage(title, message, eyebrow = 'Atención', actionLabel = 'Entendido') {
  document.getElementById('messageModalEyebrow').textContent = eyebrow;
  document.getElementById('messageModalTitle').textContent = title;
  document.getElementById('messageModalText').textContent = message;
  document.getElementById('btnMessageOk').textContent = actionLabel;
  document.getElementById('messageModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('btnMessageOk').focus(), 0);
}

function closeMessageModal() {
  document.getElementById('messageModal').classList.add('hidden');
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
    downloadBlob(new Blob([result.pdfBytes], { type: 'application/pdf' }), result.fileName);

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

    showStep('done');
  } catch (error) {
    console.error(error);
    showMessage('No se pudo generar el PDF', error?.message || 'Revise los datos e intente nuevamente.');
  } finally {
    document.getElementById('btnGeneratePdf').disabled = false;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function refreshHistory() {
  App.historyRecords = await ConsentStorage.getAllConsents();
  const query = document.getElementById('historySearch').value.trim().toLowerCase();
  const filtered = App.historyRecords.filter((record) => {
    return [record.nombre, record.rut, record.fecha, record.tipo, record.tratamiento]
      .join(' ')
      .toLowerCase()
      .includes(query);
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
    card.innerHTML = `
      <strong>${record.nombre} • ${record.tipo}</strong>
      <p><strong>RUT:</strong> ${record.rut}</p>
      <p><strong>Fecha:</strong> ${record.fecha}</p>
      <p><strong>Tratamiento:</strong> ${record.tratamiento}</p>
      <p><strong>Archivo:</strong> ${record.archivo}</p>
      <div class="history-actions"></div>
    `;
    const actions = card.querySelector('.history-actions');
    const btnDownload = document.createElement('button');
    btnDownload.textContent = 'Descargar PDF';
    btnDownload.addEventListener('click', () => {
      downloadBlob(new Blob([record.pdfBytes], { type: 'application/pdf' }), record.archivo);
    });
    actions.appendChild(btnDownload);
    list.appendChild(card);
  });
}

async function exportBackup() {
  const records = await ConsentStorage.getAllConsents();
  const zip = new JSZip();
  const metadata = records.map((record) => ({
    id: record.id,
    fecha: record.fecha,
    nombre: record.nombre,
    rut: record.rut,
    tipo: record.tipo,
    tratamiento: record.tratamiento,
    autorizacion: record.autorizacion,
    archivo: record.archivo,
    createdAt: record.createdAt
  }));

  zip.file('BaseDatos.json', JSON.stringify(metadata, null, 2));
  zip.file('Configuracion.json', JSON.stringify(App.config, null, 2));

  records.forEach((record) => {
    zip.file(`Consentimientos/${record.archivo}`, record.pdfBytes);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  const fileName = `respaldo_${formatDateForFile(new Date())}.zip`;
  downloadBlob(content, fileName);
}

function formatDate(date) {
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateForFile(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}
