function initSignature(canvas, onChange) {
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let signed = false;
  let lastPoint = null;
  let resizeFrame = null;

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    const currentImage = signed ? canvas.toDataURL('image/png') : null;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (currentImage) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height);
      image.src = currentImage;
    }
  }

  function scheduleResize() {
    if (resizeFrame) {
      cancelAnimationFrame(resizeFrame);
    }
    resizeFrame = requestAnimationFrame(resizeCanvas);
  }

  function getCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const source = event.touches ? event.touches[0] : event.changedTouches ? event.changedTouches[0] : event;
    const x = source.clientX - rect.left;
    const y = source.clientY - rect.top;
    return { x, y };
  }

  function startDrawing(event) {
    event.preventDefault();
    resizeCanvas();
    drawing = true;
    lastPoint = getCoords(event);
    try {
      if (event.pointerId !== undefined && canvas.setPointerCapture) {
        canvas.setPointerCapture(event.pointerId);
      }
    } catch (error) {
      // Pointer capture is optional in older Android WebViews.
    }
  }

  function draw(event) {
    if (!drawing) return;
    event.preventDefault();
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

  function endDrawing(event) {
    if (event) {
      event.preventDefault();
    }
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

  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', endDrawing);
    canvas.addEventListener('pointercancel', endDrawing);
    canvas.addEventListener('pointerleave', endDrawing);
  } else {
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDrawing, { passive: false });
    canvas.addEventListener('touchcancel', endDrawing, { passive: false });
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', endDrawing);
  }
  window.addEventListener('resize', scheduleResize);
  scheduleResize();

  return {
    clear,
    resize: resizeCanvas,
    isEmpty: () => !signed,
    toDataURL: () => canvas.toDataURL('image/png')
  };
}
