'use strict';

class LocalSignaturePad {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.drawing = false;
    this.lastPoint = null;
    this.pendingDataUrl = '';
    this.resizeObserver = null;
    this.resize();
    this.bind();
  }

  bind() {
    window.addEventListener('resize', () => this.resize());
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
    }
    this.canvas.addEventListener('pointerdown', (event) => this.start(event));
    this.canvas.addEventListener('pointermove', (event) => this.move(event));
    window.addEventListener('pointerup', () => this.stop());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const image = this.pendingDataUrl || this.canvas.toDataURL('image/png');
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (this.canvas.width === width && this.canvas.height === height) {
      if (this.pendingDataUrl) this.fromDataUrl(this.pendingDataUrl);
      return true;
    }
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
    this.context.lineWidth = 2.4;
    this.context.strokeStyle = '#17202a';
    if (image && !this.isBlankDataUrl(image)) this.fromDataUrl(image);
    return true;
  }

  start(event) {
    event.preventDefault();
    this.drawing = true;
    this.lastPoint = this.point(event);
  }

  move(event) {
    if (!this.drawing) return;
    event.preventDefault();
    const point = this.point(event);
    this.context.beginPath();
    this.context.moveTo(this.lastPoint.x, this.lastPoint.y);
    this.context.lineTo(point.x, point.y);
    this.context.stroke();
    this.lastPoint = point;
  }

  stop() {
    this.drawing = false;
    this.lastPoint = null;
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  toDataUrl() {
    return this.canvas.toDataURL('image/png');
  }

  fromDataUrl(dataUrl) {
    this.pendingDataUrl = dataUrl || '';
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const image = new Image();
    image.onload = () => {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.context.drawImage(image, 0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
      this.pendingDataUrl = '';
    };
    image.src = dataUrl;
  }

  point(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  isBlankDataUrl(dataUrl) {
    return dataUrl === 'data:,';
  }
}

window.LocalSignaturePad = LocalSignaturePad;
