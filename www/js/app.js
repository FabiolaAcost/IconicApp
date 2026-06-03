const App = {
  config: null,
  state: {
    consentType: null,
    tratamiento: null,
    autorizacion: null,
    paciente: {},
    signatureDataUrl: null,
    historyAccessGranted: false
  },
  signaturePad: null,
  historyRecords: []
};
const HISTORY_PIN = '0000';
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

function bindEvents() {
  document.getElementById('btnGeneral').addEventListener('click', () => selectConsent('general'));
  document.getElementById('btnToxina').addEventListener('click', () => selectConsent('toxina'));
  document.getElementById('btnPdfContinue').addEventListener('click', () => showStep('form'));
  document.getElementById('btnPdfBack').addEventListener('click', () => showStep('select'));
  document.getElementById('readCheckbox').addEventListener('change', updateReadContinue);
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
  document.getElementById('btnHistoryBack').addEventListener('click', () => showStep('select'));
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
  if (stepId === 'history' && !App.state.historyAccessGranted) {
    requestHistoryAccess();
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
    return;
  }

  container.style.display = 'block';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Seleccione un procedimiento';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  App.config.general.forEach((treatment) => {
    const option = document.createElement('option');
    option.value = treatment;
    option.textContent = treatment;
    select.appendChild(option);
  });
}

function onFormContinue() {
  const nombre = document.getElementById('inputNombre').value.trim();
  const rut = document.getElementById('inputRut').value.trim();
  const nacimiento = document.getElementById('inputFechaNacimiento').value;
  const direccion = document.getElementById('inputDireccion').value.trim();
  const autorizacion = document.querySelector('input[name="autorizacion"]:checked');
  const treatment = App.state.consentType === 'toxina' ? 'Botox' : document.getElementById('selectTratamiento').value;

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
  openPinModal();
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
  App.state.historyAccessGranted = true;
  showStep('history');
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
