const App = {
  config: null,
  state: {
    consentType: null,
    tratamiento: null,
    autorizacion: null,
    paciente: {},
    signatureDataUrl: null
  },
  signaturePad: null,
  historyRecords: []
};

window.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  App.signaturePad = initSignature(document.getElementById('signatureCanvas'), () => {
    document.getElementById('btnSignatureContinue').disabled = App.signaturePad.isEmpty();
  });
  document.getElementById('btnSignatureContinue').disabled = true;
  App.config = await loadConfig();
  bindEvents();
  showStep('select');
  await refreshHistory();
}

async function loadConfig() {
  try {
    const response = await fetch('config/tratamientos.json');
    return await response.json();
  } catch (error) {
    console.error('Error cargando configuración:', error);
    return { doctora: 'Patricia Navarrete', general: [], toxina: ['Botox'] };
  }
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
  document.getElementById('btnGenerateDummy').addEventListener('click', generateDummyConsent);
  document.getElementById('btnNewConsent').addEventListener('click', () => showStep('select'));
  document.getElementById('btnGoHistory').addEventListener('click', () => showStep('history'));
  document.getElementById('btnShowHistory').addEventListener('click', () => showStep('history'));
  document.getElementById('btnHistoryBack').addEventListener('click', () => showStep('select'));
  document.getElementById('historySearch').addEventListener('input', refreshHistory);
  document.getElementById('btnExportBackup').addEventListener('click', exportBackup);
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
  document.querySelectorAll('.step').forEach((section) => section.classList.add('hidden'));
  document.getElementById(`step${capitalize(stepId)}`).classList.remove('hidden');

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

  if (!nombre || !rut || !nacimiento || !direccion || !autorizacion) {
    alert('Complete todos los campos obligatorios.');
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

function onSignatureContinue() {
  if (App.signaturePad.isEmpty()) {
    alert('Debe firmar antes de continuar.');
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

    downloadBlob(new Blob([result.pdfBytes], { type: 'application/pdf' }), result.fileName);
    await refreshHistory();
    showStep('done');
  } catch (error) {
    console.error(error);
    alert('Error generando el PDF. Reintente nuevamente.');
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

async function generateDummyConsent() {
  const button = document.getElementById('btnGenerateDummy');
  button.disabled = true;
  try {
    const dummyPaciente = {
      nombre: 'Roswel Flores',
      rut: '276754139-0',
      nacimiento: '02/06/2026',
      direccion: 'Calle siempre viva 1234, Comuna Ejemplo, Santiago'
    };
    const dummyConsent = {
      consentType: 'general',
      paciente: dummyPaciente,
      tratamiento: App.config?.general?.[0] || 'Bioestimuladores',
      autorizacion: 'Sí',
      signatureDataUrl: null,
      doctora: App.config?.doctora || 'Patricia Navarrete',
      fecha: formatDate(new Date())
    };
    const result = await PdfGenerator.generateConsentPdf(dummyConsent);
    downloadBlob(new Blob([result.pdfBytes], { type: 'application/pdf' }), result.fileName);
  } catch (error) {
    console.error(error);
    alert('Error generando el PDF dummy. Reintente.');
  } finally {
    button.disabled = false;
  }
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
