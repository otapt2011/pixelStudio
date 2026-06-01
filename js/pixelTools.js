// ============================================================
// pixelTools.js – Standalone, framework‑agnostic image tools
// Works with any HTML page that includes a canvas.
// Includes: Adjustment, Filter, Geometry, Crop (rectangular),
// CircularCrop, Resize, Text, Compression.
// ============================================================
(function(global) {
    // ---------- Utilities ----------
    const Utils = {
        getJPEGBlob: function(source, quality, callback) {
            const canvas = document.createElement('canvas');
            if (source instanceof HTMLImageElement) {
                canvas.width = source.naturalWidth;
                canvas.height = source.naturalHeight;
                canvas.getContext('2d').drawImage(source, 0, 0);
            } else if (source instanceof HTMLCanvasElement) {
                canvas.width = source.width;
                canvas.height = source.height;
                canvas.getContext('2d').drawImage(source, 0, 0);
            } else {
                callback(null);
                return;
            }
            canvas.toBlob(callback, 'image/jpeg', quality / 100);
        },
        getImageSizeKB: function(image, callback) {
            this.getJPEGBlob(image, 90, blob => callback(blob ? blob.size / 1024 : 0));
        }
    };
    global.PixelStudioUtils = Utils;

    // ---------- AdjustmentTool ----------
    class AdjustmentTool {
        apply(source, adjustments, callback) {
            const canvas = document.createElement('canvas');
            canvas.width = source.width;
            canvas.height = source.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(source, 0, 0);
            const imgData = ctx.getImageData(0, 0, source.width, source.height);
            const data = imgData.data;
            let b = adjustments.brightness / 100;
            let c = adjustments.contrast / 100;
            let s = adjustments.saturation / 100;
            let factor = (259 * (c + 255)) / (255 * (259 - c));
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i], g = data[i+1], bv = data[i+2];
                r = r + b * 255; g = g + b * 255; bv = bv + b * 255;
                r = factor * (r - 128) + 128;
                g = factor * (g - 128) + 128;
                bv = factor * (bv - 128) + 128;
                let gray = 0.2989 * r + 0.5870 * g + 0.1140 * bv;
                r = gray + (r - gray) * (1 + s);
                g = gray + (g - gray) * (1 + s);
                bv = gray + (bv - gray) * (1 + s);
                data[i] = Math.min(255, Math.max(0, r));
                data[i+1] = Math.min(255, Math.max(0, g));
                data[i+2] = Math.min(255, Math.max(0, bv));
            }
            ctx.putImageData(imgData, 0, 0);
            const result = new Image();
            result.onload = () => callback(result);
            result.src = canvas.toDataURL();
        }
    }
    global.AdjustmentTool = AdjustmentTool;

    // ---------- FilterTool ----------
    class FilterTool {
        applyFilter(source, filterType, callback) {
            const canvas = document.createElement('canvas');
            canvas.width = source.width;
            canvas.height = source.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(source, 0, 0);
            const imgData = ctx.getImageData(0, 0, source.width, source.height);
            let d = imgData.data;
            switch (filterType) {
                case 'grayscale':
                    for (let i = 0; i < d.length; i += 4) {
                        let avg = (d[i] + d[i+1] + d[i+2]) / 3;
                        d[i] = d[i+1] = d[i+2] = avg;
                    }
                    break;
                case 'sepia':
                    for (let i = 0; i < d.length; i += 4) {
                        let r = d[i], g = d[i+1], b = d[i+2];
                        d[i] = Math.min(255, r*0.393 + g*0.769 + b*0.189);
                        d[i+1] = Math.min(255, r*0.349 + g*0.686 + b*0.168);
                        d[i+2] = Math.min(255, r*0.272 + g*0.534 + b*0.131);
                    }
                    break;
                case 'invert':
                    for (let i = 0; i < d.length; i += 4) {
                        d[i] = 255 - d[i];
                        d[i+1] = 255 - d[i+1];
                        d[i+2] = 255 - d[i+2];
                    }
                    break;
                case 'blur': {
                    let w = source.width, h = source.height;
                    let kernel = [1,2,1,2,4,2,1,2,1], factor = 16;
                    let output = ctx.createImageData(w, h);
                    for (let y = 1; y < h-1; y++) {
                        for (let x = 1; x < w-1; x++) {
                            let r = 0, g = 0, b = 0;
                            for (let ky = -1; ky <= 1; ky++) {
                                for (let kx = -1; kx <= 1; kx++) {
                                    let idx = ((y+ky)*w + (x+kx)) * 4;
                                    let k = kernel[(ky+1)*3 + (kx+1)];
                                    r += d[idx] * k;
                                    g += d[idx+1] * k;
                                    b += d[idx+2] * k;
                                }
                            }
                            let idxOut = (y*w + x) * 4;
                            output.data[idxOut] = r / factor;
                            output.data[idxOut+1] = g / factor;
                            output.data[idxOut+2] = b / factor;
                            output.data[idxOut+3] = 255;
                        }
                    }
                    ctx.putImageData(output, 0, 0);
                    break;
                }
                case 'sharpen': {
                    let w2 = source.width, h2 = source.height;
                    let kernel2 = [0,-1,0,-1,5,-1,0,-1,0];
                    let output2 = ctx.createImageData(w2, h2);
                    for (let y = 1; y < h2-1; y++) {
                        for (let x = 1; x < w2-1; x++) {
                            let r = 0, g = 0, b = 0;
                            for (let ky = -1; ky <= 1; ky++) {
                                for (let kx = -1; kx <= 1; kx++) {
                                    let idx = ((y+ky)*w2 + (x+kx)) * 4;
                                    let k = kernel2[(ky+1)*3 + (kx+1)];
                                    r += d[idx] * k;
                                    g += d[idx+1] * k;
                                    b += d[idx+2] * k;
                                }
                            }
                            let idxOut = (y*w2 + x) * 4;
                            output2.data[idxOut] = Math.min(255, Math.max(0, r));
                            output2.data[idxOut+1] = Math.min(255, Math.max(0, g));
                            output2.data[idxOut+2] = Math.min(255, Math.max(0, b));
                            output2.data[idxOut+3] = 255;
                        }
                    }
                    ctx.putImageData(output2, 0, 0);
                    break;
                }
                case 'vintage':
                    for (let i = 0; i < d.length; i += 4) {
                        d[i] = Math.min(255, d[i] * 1.2);
                        d[i+1] = Math.min(255, d[i+1] * 0.9);
                        d[i+2] = Math.min(255, d[i+2] * 0.8);
                    }
                    break;
                default: break;
            }
            if (filterType !== 'blur' && filterType !== 'sharpen') {
                ctx.putImageData(imgData, 0, 0);
            }
            const result = new Image();
            result.onload = () => callback(result);
            result.src = canvas.toDataURL();
        }
    }
    global.FilterTool = FilterTool;

    // ---------- GeometryTool ----------
    class GeometryTool {
        rotateLeft(source, callback) {
            this._transform(source, (canvas, ctx) => {
                let tmp = document.createElement('canvas');
                tmp.width = canvas.height;
                tmp.height = canvas.width;
                let tmpCtx = tmp.getContext('2d');
                tmpCtx.translate(tmp.width/2, tmp.height/2);
                tmpCtx.rotate(-Math.PI/2);
                tmpCtx.drawImage(canvas, -canvas.width/2, -canvas.height/2);
                canvas.width = tmp.width;
                canvas.height = tmp.height;
                ctx.drawImage(tmp, 0, 0);
            }, callback);
        }
        rotateRight(source, callback) {
            this._transform(source, (canvas, ctx) => {
                let tmp = document.createElement('canvas');
                tmp.width = canvas.height;
                tmp.height = canvas.width;
                let tmpCtx = tmp.getContext('2d');
                tmpCtx.translate(tmp.width/2, tmp.height/2);
                tmpCtx.rotate(Math.PI/2);
                tmpCtx.drawImage(canvas, -canvas.width/2, -canvas.height/2);
                canvas.width = tmp.width;
                canvas.height = tmp.height;
                ctx.drawImage(tmp, 0, 0);
            }, callback);
        }
        flipHorizontal(source, callback) {
            this._transform(source, (canvas, ctx) => {
                ctx.scale(-1, 1);
                ctx.drawImage(canvas, -canvas.width, 0);
            }, callback);
        }
        flipVertical(source, callback) {
            this._transform(source, (canvas, ctx) => {
                ctx.scale(1, -1);
                ctx.drawImage(canvas, 0, -canvas.height);
            }, callback);
        }
        _transform(source, transformFn, callback) {
            const canvas = document.createElement('canvas');
            canvas.width = source.width;
            canvas.height = source.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(source, 0, 0);
            transformFn(canvas, ctx);
            const result = new Image();
            result.onload = () => callback(result);
            result.src = canvas.toDataURL();
        }
    }
    global.GeometryTool = GeometryTool;

    // ---------- CropTool (Rectangular) – Full Fix ----------
    class CropTool {
        constructor() {
            this.active = false;
            this.start = { x: 0, y: 0 };
            this.rect = { x: 0, y: 0, w: 0, h: 0 };
            this.dragging = false;
            this.overlay = null;
            this.canvas = null;
            this.onComplete = null;
        }
        attach(canvasElement, onComplete) {
            this.canvas = canvasElement;
            this.onComplete = onComplete;
            this._setupEvents();
        }
        enable() {
            if (!this.canvas) return;
            this.active = true;
            this.canvas.style.cursor = 'crosshair';
            this.canvas.style.pointerEvents = 'auto';
            this.canvas.style.userSelect = 'none';
            this._createOverlay();
        }
        disable() {
            this.active = false;
            this.canvas.style.cursor = 'default';
            this.canvas.style.pointerEvents = '';
            this.canvas.style.userSelect = '';
            if (this.overlay) this.overlay.remove();
            this.overlay = null;
            this.rect = { x: 0, y: 0, w: 0, h: 0 };
        }
        _setupEvents() {
            this.canvas.addEventListener('mousedown', (e) => this._start(e));
            window.addEventListener('mousemove', (e) => this._drag(e));
            window.addEventListener('mouseup', () => this._end());
        }
        _start(e) {
            if (!this.active) return;
            e.stopPropagation();
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            let mouseX = (e.clientX - rect.left) * scaleX;
            let mouseY = (e.clientY - rect.top) * scaleY;
            if (mouseX < 0 || mouseY < 0 || mouseX > this.canvas.width || mouseY > this.canvas.height) return;
            this.dragging = true;
            this.start = { x: mouseX, y: mouseY };
            this.rect = { x: mouseX, y: mouseY, w: 0, h: 0 };
            this._showOverlay();
            this._updateOverlay();
        }
        _drag(e) {
            if (!this.dragging || !this.active) return;
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            let currX = (e.clientX - rect.left) * scaleX;
            let currY = (e.clientY - rect.top) * scaleY;
            let x = Math.min(this.start.x, currX);
            let y = Math.min(this.start.y, currY);
            let w = Math.abs(currX - this.start.x);
            let h = Math.abs(currY - this.start.y);
            this.rect = { x, y, w, h };
            this._updateOverlay();
        }
        _end() {
            if (this.dragging && this.active && this.rect.w > 5 && this.rect.h > 5) {
                this._performCrop();
            } else {
                this.disable();
            }
            this.dragging = false;
            this._hideOverlay();
        }
        _createOverlay() {
            this.overlay = document.createElement('div');
            this.overlay.classList.add('crop-overlay');
            const wrapper = document.querySelector('.canvas-wrapper') || document.getElementById('canvasWrapper');
            if (wrapper) wrapper.appendChild(this.overlay);
            else document.body.appendChild(this.overlay);
        }
        _showOverlay() { if (this.overlay) this.overlay.style.display = 'block'; }
        _hideOverlay() { if (this.overlay) this.overlay.style.display = 'none'; }
        _updateOverlay() {
            if (!this.overlay) return;
            const rect = this.canvas.getBoundingClientRect();
            const wrapper = document.querySelector('.canvas-wrapper') || document.getElementById('canvasWrapper');
            const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : rect;
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const left = (this.rect.x / scaleX) + (rect.left - wrapperRect.left);
            const top = (this.rect.y / scaleY) + (rect.top - wrapperRect.top);
            this.overlay.style.left = left + 'px';
            this.overlay.style.top = top + 'px';
            this.overlay.style.width = (this.rect.w / scaleX) + 'px';
            this.overlay.style.height = (this.rect.h / scaleY) + 'px';
        }
        _performCrop() {
            const source = this.canvas;
            const sx = this.rect.x;
            const sy = this.rect.y;
            const sw = this.rect.w;
            const sh = this.rect.h;
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = sw;
            cropCanvas.height = sh;
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
            const result = new Image();
            result.onload = () => {
                this.disable();
                if (this.onComplete) this.onComplete(result);
            };
            result.src = cropCanvas.toDataURL();
        }
    }
    global.CropTool = CropTool;

    // ---------- CircularCropTool – Full Fix ----------
    class CircularCropTool {
        constructor() {
            this.active = false;
            this.center = { x: 0, y: 0 };
            this.radius = 0;
            this.dragging = false;
            this.overlay = null;
            this.canvas = null;
            this.onComplete = null;
            this.startPoint = { x: 0, y: 0 };
        }
        attach(canvasElement, onComplete) {
            this.canvas = canvasElement;
            this.onComplete = onComplete;
            this._setupEvents();
        }
        enable() {
            if (!this.canvas) return;
            this.active = true;
            this.canvas.style.cursor = 'crosshair';
            this.canvas.style.pointerEvents = 'auto';
            this.canvas.style.userSelect = 'none';
            this._createOverlay();
        }
        disable() {
            this.active = false;
            this.canvas.style.cursor = 'default';
            this.canvas.style.pointerEvents = '';
            this.canvas.style.userSelect = '';
            if (this.overlay) this.overlay.remove();
            this.overlay = null;
            this.center = { x: 0, y: 0 };
            this.radius = 0;
        }
        _setupEvents() {
            this.canvas.addEventListener('mousedown', (e) => this._start(e));
            window.addEventListener('mousemove', (e) => this._drag(e));
            window.addEventListener('mouseup', () => this._end());
        }
        _start(e) {
            if (!this.active) return;
            e.stopPropagation();
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            let mouseX = (e.clientX - rect.left) * scaleX;
            let mouseY = (e.clientY - rect.top) * scaleY;
            if (mouseX < 0 || mouseY < 0 || mouseX > this.canvas.width || mouseY > this.canvas.height) return;
            this.dragging = true;
            this.startPoint = { x: mouseX, y: mouseY };
            this.center = { x: mouseX, y: mouseY };
            this.radius = 0;
            this._showOverlay();
            this._updateOverlay();
        }
        _drag(e) {
            if (!this.dragging || !this.active) return;
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            let currX = (e.clientX - rect.left) * scaleX;
            let currY = (e.clientY - rect.top) * scaleY;
            const dx = currX - this.startPoint.x;
            const dy = currY - this.startPoint.y;
            this.radius = Math.sqrt(dx*dx + dy*dy);
            this._updateOverlay();
        }
        _end() {
            if (this.dragging && this.active && this.radius > 10) {
                this._performCircularCrop();
            } else {
                this.disable();
            }
            this.dragging = false;
            this._hideOverlay();
        }
        _createOverlay() {
            this.overlay = document.createElement('div');
            this.overlay.classList.add('crop-overlay');
            this.overlay.style.borderRadius = '50%';
            this.overlay.style.border = '2px solid #3b82f6';
            this.overlay.style.background = 'rgba(59,130,246,0.15)';
            const wrapper = document.querySelector('.canvas-wrapper') || document.getElementById('canvasWrapper');
            if (wrapper) wrapper.appendChild(this.overlay);
            else document.body.appendChild(this.overlay);
        }
        _showOverlay() { if (this.overlay) this.overlay.style.display = 'block'; }
        _hideOverlay() { if (this.overlay) this.overlay.style.display = 'none'; }
        _updateOverlay() {
            if (!this.overlay) return;
            const rect = this.canvas.getBoundingClientRect();
            const wrapper = document.querySelector('.canvas-wrapper') || document.getElementById('canvasWrapper');
            const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : rect;
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const left = (this.center.x - this.radius) / scaleX + (rect.left - wrapperRect.left);
            const top = (this.center.y - this.radius) / scaleY + (rect.top - wrapperRect.top);
            const diameter = (this.radius * 2) / scaleX;
            this.overlay.style.left = left + 'px';
            this.overlay.style.top = top + 'px';
            this.overlay.style.width = diameter + 'px';
            this.overlay.style.height = diameter + 'px';
        }
        _performCircularCrop() {
            const source = this.canvas;
            const diameter = this.radius * 2;
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = diameter;
            cropCanvas.height = diameter;
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.beginPath();
            cropCtx.arc(this.radius, this.radius, this.radius, 0, Math.PI * 2);
            cropCtx.clip();
            const sx = this.center.x - this.radius;
            const sy = this.center.y - this.radius;
            cropCtx.drawImage(source, sx, sy, diameter, diameter, 0, 0, diameter, diameter);
            const result = new Image();
            result.onload = () => {
                this.disable();
                if (this.onComplete) this.onComplete(result);
            };
            result.src = cropCanvas.toDataURL('image/png');
        }
    }
    global.CircularCropTool = CircularCropTool;

    // ---------- ResizeTool ----------
    class ResizeTool {
        resize(source, width, height, callback) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(source, 0, 0, width, height);
            const result = new Image();
            result.onload = () => callback(result);
            result.src = canvas.toDataURL();
        }
    }
    global.ResizeTool = ResizeTool;

    // ---------- TextTool – Fixed ----------
    class TextTool {
        addText(source, text, callback) {
            const canvas = document.createElement('canvas');
            canvas.width = source.width;
            canvas.height = source.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(source, 0, 0);
            const fontSize = Math.max(24, source.width * 0.05);
            ctx.font = `bold ${fontSize}px 'Inter', system-ui, sans-serif`;
            ctx.fillStyle = 'white';
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'black';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, source.width / 2, source.height / 2);
            const result = new Image();
            result.onload = () => callback(result);
            result.src = canvas.toDataURL();
        }
    }
    global.TextTool = TextTool;

    // ---------- CompressionTool ----------
    class CompressionTool {
        compressByQuality(source, quality, callback) {
            global.PixelStudioUtils.getJPEGBlob(source, quality, (blob) => {
                if (!blob) { callback(null, 0); return; }
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    callback(img, blob.size / 1024);
                };
                img.src = url;
            });
        }
        compressToTargetSize(source, targetKB, callback, maxQuality = 100, minQuality = 1) {
            let low = minQuality, high = maxQuality;
            let bestBlob = null;
            const fallback = () => this.compressByQuality(source, minQuality, callback);
            const attempt = (quality) => {
                global.PixelStudioUtils.getJPEGBlob(source, quality, (blob) => {
                    if (!blob) { if (bestBlob) this._finalize(bestBlob, callback); else fallback(); return; }
                    const sizeKB = blob.size / 1024;
                    if (sizeKB <= targetKB) {
                        bestBlob = blob;
                        if (quality >= high - 0.5 || quality >= maxQuality) {
                            this._finalize(bestBlob, callback);
                            return;
                        }
                        low = quality;
                        attempt(Math.min(maxQuality, Math.floor((low + high) / 2) + 1));
                    } else {
                        high = quality;
                        if (high - low <= 1) {
                            if (bestBlob) this._finalize(bestBlob, callback);
                            else fallback();
                        } else {
                            attempt(Math.floor((low + high) / 2));
                        }
                    }
                });
            };
            attempt(Math.floor((low + high) / 2));
        }
        _finalize(blob, callback) {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                callback(img, blob.size / 1024);
            };
            img.src = url;
        }
    }
    global.CompressionTool = CompressionTool;

})(window);