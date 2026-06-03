function initSignature(canvas, onChange) {
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let signed = false;
  let lastPoint = null;

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
    if (!signed) {
      ctx.clearRect(0, 0, rect.width, rect.height);
    }
  }

  function getCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y };
  }

  function startDrawing(event) {
    drawing = true;
    lastPoint = getCoords(event);
  }

  function draw(event) {
    if (!drawing) return;
    const currentPoint = getCoords(event);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();
    lastPoint = currentPoint;
    signed = true;
    if (onChange) {
      onChange(signed);
    }
  }

  function endDrawing() {
    drawing = false;
  }

  function clear() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    signed = false;
    if (onChange) {
      onChange(signed);
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    startDrawing(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    event.preventDefault();
    draw(event);
  });
  canvas.addEventListener('pointerup', endDrawing);
  canvas.addEventListener('pointerleave', endDrawing);
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  return {
    clear,
    isEmpty: () => !signed,
    toDataURL: () => canvas.toDataURL('image/png')
  };
}
