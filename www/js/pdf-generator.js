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
      firmaPacientePagina1: { x: 180, y: 80, width: 260, height: 28 }
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
      firmaPacientePagina1: { x: 180, y: 96, width: 260, height: 28 }
    }
  };

  const PAGE2 = {
    general: {
      firmaPaciente: { x: 100, y: 292, width: 180, height: 36 },
      rutPaciente: { x: 120, y: 330 },
      firmaDra: { x: 340, y: 296, width: 220, height: 28 }
    },
    toxina: {
      firmaPaciente: { x: 100, y: 166, width: 180, height: 36 },
      rutPaciente: { x: 120, y: 198 },
      firmaDra: { x: 340, y: 170, width: 220, height: 28 }
    }
  };

  async function fetchArrayBuffer(url) {
    const embeddedAsset = window.PdfEmbeddedAssets && window.PdfEmbeddedAssets[url];
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

  async function embedDoctorSignature(pdfDoc) {
    try {
      const bytes = await fetchArrayBuffer('assets/firma.png');
      return await pdfDoc.embedPng(bytes);
    } catch (error) {
      return null;
    }
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
      const signatureScale = Math.min(signatureBox.width / signatureImage.width, signatureBox.height / signatureImage.height) * 0.92;
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
        const signatureScale2 = Math.min(signatureBox2.width / signatureImage.width, signatureBox2.height / signatureImage.height) * 0.9;
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
        const signatureScale = Math.min(page2Coords.firmaDra.width / doctorSignatureImage.width, page2Coords.firmaDra.height / doctorSignatureImage.height);
        const doctorDims = doctorSignatureImage.scale(signatureScale);
        page2.drawImage(doctorSignatureImage, {
          x: page2Coords.firmaDra.x + (page2Coords.firmaDra.width - doctorDims.width) / 2,
          y: page2Coords.firmaDra.y + (page2Coords.firmaDra.height - doctorDims.height) / 2,
          width: doctorDims.width,
          height: doctorDims.height
        });
      } else {
        page2.drawText(options.doctora, { x: page2Coords.firmaDra.x, y: page2Coords.firmaDra.y + 8, size: 10, font });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = buildFileName(options);
    return { pdfBytes, fileName };
  }

  function buildFileName(options) {
    const date = formatDateForFile(new Date());
    const rut = options.paciente.rut.replace(/\s+/g, '_');
    const tratamiento = options.tratamiento
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
    return `${date}_${rut}_${tratamiento}.pdf`;
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

  function formatDateForFile(date) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }

  return {
    generateConsentPdf,
    buildFileName
  };
})();
