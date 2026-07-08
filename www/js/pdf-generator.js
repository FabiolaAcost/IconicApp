const PdfGenerator = (() => {
  const PAGE1 = {
    general: {
      fecha: { x: 118, y: 652, width: 70, cover: { x: 116, y: 647.5, width: 83, height: 12 }, line: { x: 118, y: 648.6, width: 78 } },
      nombrePaciente: { x: 220, y: 635, width: 160 },
      fechaNacimiento: { x: 186, y: 620.8, width: 70, cover: { x: 184, y: 616.3, width: 75, height: 12 } },
      rut: { x: 296, y: 619.2, width: 95 },
      direccion: { x: 134, y: 603.6, width: 374 },
      dra1: { x: 264, y: 565.6, width: 120 },
      procedimiento: { x: 224, y: 547.4, width: 265 },
      dra2: { x: 224, y: 420.2, width: 160 },
      autorizacionSi: { x: 255, y: 293 },
      autorizacionNo: { x: 304, y: 293 },
      firmaPacientePagina1: { x: 165, y: 88, width: 290, height: 34 }
    },
    toxina: {
      fecha: { x: 118, y: 651.6, width: 70, cover: { x: 116, y: 647.1, width: 83, height: 12 }, line: { x: 118, y: 648.2, width: 78 } },
      nombrePaciente: { x: 220, y: 634.5, width: 160 },
      fechaNacimiento: { x: 180, y: 620.4, width: 70, cover: { x: 178, y: 615.9, width: 75, height: 12 } },
      rut: { x: 286, y: 618.8, width: 95 },
      direccion: { x: 129, y: 603.1, width: 379 },
      dra1: { x: 264, y: 565, width: 120 },
      procedimiento: { x: 224, y: 546.8, width: 255 },
      dra2: { x: 126, y: 436.8, width: 160 },
      autorizacionSi: { x: 244, y: 308.6 },
      autorizacionNo: { x: 292, y: 308.6 },
      firmaPacientePagina1: { x: 165, y: 104, width: 290, height: 34 }
    }
  };

  const PAGE2 = {
    general: {
      firmaPaciente: { x: 82, y: 296, width: 216, height: 42 },
      rutPaciente: { x: 120, y: 344 },
      firmaDra: { x: 300, y: 300, width: 250, height: 92 }
    },
    toxina: {
      firmaPaciente: { x: 82, y: 170, width: 216, height: 42 },
      rutPaciente: { x: 120, y: 212 },
      firmaDra: { x: 300, y: 174, width: 250, height: 92 }
    }
  };
  const DOCTOR_SIGNATURE_SCALE = 0.82;
  const ASSESSMENT_MARKS = [
    { id: 'piel', page: 0, y: 535.4 },
    { id: 'arrugas', page: 0, y: 436.1 },
    { id: 'grasa', page: 0, y: 336.8 },
    { id: 'volumen', page: 0, y: 237.6 },
    { id: 'flacidez', page: 0, y: 138.3 },
    { id: 'labios', page: 1, y: 706.7 },
    { id: 'mirada', page: 1, y: 607.4 },
    { id: 'textura', page: 1, y: 508.1 },
    { id: 'manchas', page: 1, y: 408.9 },
    { id: 'hidratacion', page: 1, y: 309.6 }
  ];
  const ASSESSMENT_VALUE_X = [107.6, 147.3, 186.9, 226.6, 266.3, 306, 345.7, 385.4, 425.1, 464.7, 504.4];
  const SKIN_LAB_FIELDS = {
    fecha: {
      day: { x: 468, y: 31.8, width: 16 },
      month: { x: 506, y: 31.8, width: 16 },
      year: { x: 535, y: 31.8, width: 32 }
    },
    nombre: { x: 162, y: 642.2, width: 344 },
    edad: { x: 162, y: 624.2, width: 90 },
    goals: { x: 78, y: 558, width: 460, maxLines: 4, lineHeight: 13 },
    concern: { x: 78, y: 452, width: 460, maxLines: 7, lineHeight: 13 },
    considerations: { x: 78, y: 271, width: 460, maxLines: 7, lineHeight: 13 }
  };

  async function fetchArrayBuffer(url) {
    const embeddedAsset = getEmbeddedAsset(url);
    if (embeddedAsset) {
      return base64ToArrayBuffer(embeddedAsset);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.arrayBuffer();
      }
    } catch (error) {
      return await fetchArrayBufferWithXhr(url);
    }

    return await fetchArrayBufferWithXhr(url);
  }

  function getEmbeddedAsset(url) {
    const assets = window.PdfEmbeddedAssets;
    if (!assets) {
      return null;
    }

    const normalizedUrl = url.replace(/^\.\//, '');
    return assets[url] || assets[normalizedUrl] || assets[`./${normalizedUrl}`] || null;
  }

  function base64ToArrayBuffer(base64) {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
      bytes[i] = raw.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function fetchArrayBufferWithXhr(url) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('GET', url, true);
      request.responseType = 'arraybuffer';
      request.onload = () => {
        if (request.status === 200 || request.status === 0) {
          resolve(request.response);
        } else {
          reject(new Error(`No se pudo cargar ${url}`));
        }
      };
      request.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
      request.send();
    });
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
      bytes[i] = raw.charCodeAt(i);
    }
    return bytes;
  }

  function loadImageAsPngBytes(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth || image.width;
          canvas.height = image.naturalHeight || image.height;

          const context = canvas.getContext('2d');
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0);
          resolve(dataUrlToBytes(canvas.toDataURL('image/png')));
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
      image.src = url;
    });
  }

  async function embedDoctorSignature(pdfDoc) {
    const signatureFiles = ['assets/firmaPaty.png', './assets/firmaPaty.png'];
    let lastError = null;

    for (const file of signatureFiles) {
      try {
        const bytes = await fetchArrayBuffer(file);
        return await pdfDoc.embedPng(bytes);
      } catch (error) {
        lastError = error;
      }

      try {
        const bytes = await loadImageAsPngBytes(file);
        return await pdfDoc.embedPng(bytes);
      } catch (error) {
        lastError = error;
      }
    }

    console.warn('No se pudo cargar la firma de la Dra. Paty. El PDF se generara sin esa imagen.', lastError);
    return null;
  }

  function drawImageInBox(page, image, box, scaleFactor = 1) {
    const imageScale = Math.min(box.width / image.width, box.height / image.height) * scaleFactor;
    const dims = image.scale(imageScale);
    page.drawImage(image, {
      x: box.x + (box.width - dims.width) / 2,
      y: box.y + (box.height - dims.height) / 2,
      width: dims.width,
      height: dims.height
    });
  }

  function drawTextFitWidth(page, text, x, y, options) {
    const { font, size, maxWidth, minSize = 7, ellipsis = true } = options;
    if (!text) {
      return;
    }

    let currentSize = size;
    while (maxWidth && currentSize >= minSize && font.widthOfTextAtSize(text, currentSize) > maxWidth) {
      currentSize -= 0.5;
    }

    let finalText = text;
    if (maxWidth && font.widthOfTextAtSize(finalText, currentSize) > maxWidth) {
      let length = Math.floor((text.length * maxWidth) / font.widthOfTextAtSize(text, currentSize));
      if (ellipsis) {
        length = Math.max(0, length - 3);
        finalText = `${text.slice(0, length)}...`;
      } else {
        finalText = text.slice(0, length);
      }
    }

    page.drawText(finalText, { x, y, size: currentSize, font });
  }

  function drawPage1Field(page, text, coord, options) {
    const fieldOptions = Object.assign({}, options, {
      maxWidth: coord.width || options.maxWidth
    });
    drawTextFitWidth(page, text, coord.x, coord.y, fieldOptions);
  }

  function drawPage1Date(page, value, coord, options) {
    const text = formatDateForDisplay(value);
    if (!text) {
      return;
    }

    if (coord.cover) {
      page.drawRectangle({
        x: coord.cover.x,
        y: coord.cover.y,
        width: coord.cover.width,
        height: coord.cover.height,
        color: PDFLib.rgb(1, 1, 1)
      });
    }

    if (coord.line) {
      page.drawLine({
        start: { x: coord.line.x, y: coord.line.y },
        end: { x: coord.line.x + coord.line.width, y: coord.line.y },
        thickness: 0.5,
        color: PDFLib.rgb(0, 0, 0)
      });
    }

    drawPage1Field(page, text, coord, options);
  }

  async function generateConsentPdf(options) {
    const sourceFile = options.consentType === 'general' ? 'assets/consentimiento_general.pdf' : 'assets/consentimiento_toxina.pdf';
    const existingPdfBytes = await fetchArrayBuffer(sourceFile);
    const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const page1 = pages[0];
    const page2 = pages.length > 1 ? pages[1] : null;
    const fontSize = 9;

    const page1Coords = PAGE1[options.consentType] || PAGE1.general;
    const formattedFecha = options.fecha || formatDate(new Date());
    const formattedNacimiento = options.paciente.nacimiento || '';
    drawPage1Field(page1, options.paciente.nombre, page1Coords.nombrePaciente, { font, size: fontSize, maxWidth: 205 });
    drawPage1Date(page1, formattedFecha, page1Coords.fecha, { font, size: fontSize, maxWidth: 70 });
    drawPage1Date(page1, formattedNacimiento, page1Coords.fechaNacimiento, { font, size: fontSize, maxWidth: 70 });
    drawPage1Field(page1, options.paciente.rut, page1Coords.rut, { font, size: fontSize, maxWidth: 100 });
    drawPage1Field(page1, options.paciente.direccion || '', page1Coords.direccion, { font, size: 8.5, maxWidth: 377, minSize: 7, ellipsis: false });
    drawPage1Field(page1, options.doctora, page1Coords.dra1, { font, size: fontSize, maxWidth: 160 });
    drawPage1Field(page1, options.tratamiento, page1Coords.procedimiento, { font, size: fontSize, maxWidth: 320 });
    drawPage1Field(page1, options.doctora, page1Coords.dra2, { font, size: fontSize, maxWidth: 190 });

    if (options.autorizacion !== 'No') {
      page1.drawText('X', { x: page1Coords.autorizacionSi.x, y: page1Coords.autorizacionSi.y, size: 14, font });
    } else {
      page1.drawText('X', { x: page1Coords.autorizacionNo.x, y: page1Coords.autorizacionNo.y, size: 14, font });
    }

    if (options.signatureDataUrl) {
      const signatureBytes = dataUrlToBytes(options.signatureDataUrl);
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      const signatureBox = page1Coords.firmaPacientePagina1;
      const signatureScale = Math.min(signatureBox.width / signatureImage.width, signatureBox.height / signatureImage.height) * 0.96;
      const signatureDims = signatureImage.scale(signatureScale);
      page1.drawImage(signatureImage, {
        x: signatureBox.x + (signatureBox.width - signatureDims.width) / 2,
        y: signatureBox.y + (signatureBox.height - signatureDims.height) / 2,
        width: signatureDims.width,
        height: signatureDims.height
      });
      if (page2) {
        const page2Coords = PAGE2[options.consentType] || PAGE2.general;
        const signatureBox2 = page2Coords.firmaPaciente;
        const signatureScale2 = Math.min(signatureBox2.width / signatureImage.width, signatureBox2.height / signatureImage.height) * 0.98;
        const signatureDims2 = signatureImage.scale(signatureScale2);
        page2.drawImage(signatureImage, {
          x: signatureBox2.x + (signatureBox2.width - signatureDims2.width) / 2,
          y: signatureBox2.y + (signatureBox2.height - signatureDims2.height) / 2,
          width: signatureDims2.width,
          height: signatureDims2.height
        });
      }
    }

    if (page2) {
      const page2Coords = PAGE2[options.consentType] || PAGE2.general;
      page2.drawText(options.paciente.rut, { x: page2Coords.rutPaciente.x, y: page2Coords.rutPaciente.y, size: fontSize, font, maxWidth: 180 });
      const doctorSignatureImage = await embedDoctorSignature(pdfDoc);
      if (doctorSignatureImage) {
        drawImageInBox(page2, doctorSignatureImage, page2Coords.firmaDra, DOCTOR_SIGNATURE_SCALE);
      }
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = buildFileName(options);
    return { pdfBytes, fileName };
  }

  async function generateAssessmentPdf(options) {
    const existingPdfBytes = await fetchArrayBuffer('assets/autoevaluacion.pdf');
    const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const page1 = pages[0];
    const paciente = options.paciente || {};
    const respuestas = options.respuestas || {};

    page1.drawText(paciente.nombre || '', {
      x: 166,
      y: 608.4,
      size: 11,
      font,
      maxWidth: 380
    });

    ASSESSMENT_MARKS.forEach((mark) => {
      const value = clampScore(respuestas[mark.id]);
      const page = pages[mark.page];
      const x = ASSESSMENT_VALUE_X[value];

      drawCheckMark(page, x, mark.y - 27);
    });

    const pdfBytes = await pdfDoc.save();
    return { pdfBytes, fileName: buildAssessmentFileName(options) };
  }

  async function generateSkinLabPdf(options) {
    const existingPdfBytes = await fetchArrayBuffer('assets/skin_lab.pdf');
    const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const page = pdfDoc.getPage(0);
    const ink = PDFLib.rgb(0.16, 0.13, 0.11);
    const muted = PDFLib.rgb(0.46, 0.42, 0.38);
    const patient = options.paciente || {};
    const dateParts = getDateParts(options.fecha || formatDate(new Date()));

    function drawTextBlock(text, field, fontToUse = font, size = 10, color = ink) {
      const lines = wrapText(text || '', field.width, fontToUse, size, field.maxLines);
      lines.forEach((line, index) => {
        page.drawText(line, {
          x: field.x,
          y: field.y - (index * field.lineHeight),
          size,
          font: fontToUse,
          color
        });
      });
    }

    drawTextFitWidth(page, dateParts.day, SKIN_LAB_FIELDS.fecha.day.x, SKIN_LAB_FIELDS.fecha.day.y, {
      font,
      size: 10,
      maxWidth: SKIN_LAB_FIELDS.fecha.day.width,
      minSize: 8,
      ellipsis: false
    });
    drawTextFitWidth(page, dateParts.month, SKIN_LAB_FIELDS.fecha.month.x, SKIN_LAB_FIELDS.fecha.month.y, {
      font,
      size: 10,
      maxWidth: SKIN_LAB_FIELDS.fecha.month.width,
      minSize: 8,
      ellipsis: false
    });
    drawTextFitWidth(page, dateParts.year, SKIN_LAB_FIELDS.fecha.year.x, SKIN_LAB_FIELDS.fecha.year.y, {
      font,
      size: 10,
      maxWidth: SKIN_LAB_FIELDS.fecha.year.width,
      minSize: 8,
      ellipsis: false
    });
    drawTextFitWidth(page, patient.nombre || '', SKIN_LAB_FIELDS.nombre.x, SKIN_LAB_FIELDS.nombre.y, {
      font: boldFont,
      size: 10.5,
      maxWidth: SKIN_LAB_FIELDS.nombre.width,
      minSize: 8
    });
    drawTextFitWidth(page, `${patient.edad || ''} años`, SKIN_LAB_FIELDS.edad.x, SKIN_LAB_FIELDS.edad.y, {
      font: boldFont,
      size: 10.5,
      maxWidth: SKIN_LAB_FIELDS.edad.width,
      minSize: 8
    });

    drawTextBlock((options.goals || []).join(' - '), SKIN_LAB_FIELDS.goals, font, 10, muted);
    drawTextBlock(options.concern || 'Sin informacion registrada.', SKIN_LAB_FIELDS.concern, font, 10, ink);
    drawTextBlock(options.considerations || 'Sin consideraciones adicionales registradas.', SKIN_LAB_FIELDS.considerations, font, 10, ink);

    const pdfBytes = await pdfDoc.save();
    return { pdfBytes, fileName: buildSkinLabFileName(options) };
  }

  function wrapText(text, maxWidth, font, size, maxLines = Infinity) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (!words.length) {
      return [];
    }

    const lines = [];
    let line = '';
    words.forEach((word) => {
      if (lines.length >= maxLines) {
        return;
      }

      const testLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
        line = testLine;
        return;
      }

      if (line) {
        lines.push(line);
        if (lines.length >= maxLines) {
          line = '';
          return;
        }
      }
      line = word;
    });

    if (line && lines.length < maxLines) {
      lines.push(line);
    }

    return lines;
  }

  function clampScore(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 5;
    }

    return Math.min(10, Math.max(0, Math.round(number)));
  }

  function drawCheckMark(page, x, y) {
    const color = PDFLib.rgb(0.23, 0.18, 0.14);
    page.drawLine({
      start: { x: x - 5.8, y: y - 0.8 },
      end: { x: x - 1.7, y: y - 5.2 },
      thickness: 2,
      color
    });
    page.drawLine({
      start: { x: x - 1.7, y: y - 5.2 },
      end: { x: x + 6.2, y: y + 5.6 },
      thickness: 2,
      color
    });
  }

  function buildFileName(options) {
    const paciente = options.paciente.nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    const timestamp = formatDateForFile(new Date());
    return `${paciente}-${timestamp}.pdf`;
  }

  function buildAssessmentFileName(options) {
    const paciente = (options.paciente?.nombre || 'paciente')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    const timestamp = formatDateForFile(new Date());
    return `autoevaluacion-${paciente}-${timestamp}.pdf`;
  }

  function buildSkinLabFileName(options) {
    const firstName = String(options.paciente?.nombre || 'paciente').trim().split(/\s+/)[0] || 'paciente';
    const paciente = firstName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    const timestamp = formatDateForFile(new Date());
    return `skin-lab-${paciente}-${timestamp}.pdf`;
  }

  function formatDate(date) {
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateForDisplay(value) {
    if (!value) {
      return '';
    }

    if (value instanceof Date) {
      return formatDateForDisplay(formatDate(value));
    }

    const match = String(value).trim().replace(/\s+/g, '').match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
    if (!match) {
      return String(value).trim().replace(/-/g, '/');
    }

    const first = match[1];
    const second = match[2];
    const third = match[3];
    const isYearFirst = first.length === 4;
    const day = isYearFirst ? third : first;
    const month = second;
    const year = isYearFirst ? first : third;

    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year.padStart(4, '0')}`;
  }

  function getDateParts(value) {
    const formatted = formatDateForDisplay(value);
    const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
      return { day: '', month: '', year: '' };
    }

    return {
      day: match[1],
      month: match[2],
      year: match[3]
    };
  }

  function formatDateForFile(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return {
    generateConsentPdf,
    generateAssessmentPdf,
    generateSkinLabPdf,
    buildFileName
  };
})();
