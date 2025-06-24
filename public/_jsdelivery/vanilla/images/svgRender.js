/*
   ------------------------------------------------------------------------------
   Copyright (c) 2024 JW Limited. All rights reserved.
   
   Project: JWLimited.Images
   Module: SVGRenderer
   File: SVGRenderer.js
   Company: JW Limited (licensed)
   Version: 0.0.2
   Author: Joe Valentino Lengefeld (CEO)
   
   Enhanced version with additional rendering capabilities and blob URL support
   ------------------------------------------------------------------------------
*/

class SVGRenderer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.pixels = new Uint8ClampedArray(width * height * 4);
        this.transformMatrix = [1, 0, 0, 1, 0, 0]; 
        this.clipRegion = null;
        this.patterns = new Map();
    }

    setPixel(x, y, color) {
        const [tx, ty] = this.transform([x, y]);
        x = Math.round(tx);
        y = Math.round(ty);

        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        
        if (this.clipRegion && !this.clipRegion(x, y)) return;

        const index = (y * this.width + x) * 4;
        if (color instanceof Pattern) {
            const patternX = x % color.width;
            const patternY = y % color.height;
            const patternIndex = (patternY * color.width + patternX) * 4;
            this.pixels.set(color.data.slice(patternIndex, patternIndex + 4), index);
        } else {
            this.pixels.set(color, index);
        }
    }

    hexToRGB(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) : 255;
        return [r, g, b, a];
    }

    parseColor(color, opacity = 1) {
        if (typeof color === 'string') {
            if (color.startsWith('#')) {
                return this.hexToRGB(color);
            }
            if (color.startsWith('rgb')) {
                const matches = color.match(/\d+/g);
                return [...matches.map(Number), Math.round(opacity * 255)];
            }
            if (color.startsWith('hsl')) {
                return this.hslToRGB(color, opacity);
            }
        }
        if (color instanceof Pattern) {
            return color;
        }
        return [0, 0, 0, 255];
    }

    createPattern(width, height, drawCallback) {
        const pattern = new Pattern(width, height);
        drawCallback(pattern);
        const id = `pattern_${this.patterns.size}`;
        this.patterns.set(id, pattern);
        return id;
    }

    setTransform(a, b, c, d, e, f) {
        this.transformMatrix = [a, b, c, d, e, f];
    }

    interpolateColors(color1, color2, progress) {
        return [
            Math.round(color1[0] + (color2[0] - color1[0]) * progress),
            Math.round(color1[1] + (color2[1] - color1[1]) * progress),
            Math.round(color1[2] + (color2[2] - color1[2]) * progress),
            Math.round(color1[3] + (color2[3] - color1[3]) * progress)
        ];
    }

    transform(point) {
        const [a, b, c, d, e, f] = this.transformMatrix;
        const [x, y] = point;
        return [
            a * x + c * y + e,
            b * x + d * y + f
        ];
    }
    fillRect(x, y, width, height, color) {
        const [r, g, b, a] = this.parseColor(color);
        for (let i = x; i < x + width; i++) {
            for (let j = y; j < y + height; j++) {
                this.setPixel(i, j, [r, g, b, a]);
            }
        }
    }

    drawCircle(x, y, radius, color, options = {}) {
        const [r, g, b, a] = this.parseColor(color, options.opacity || 1);
        const thickness = options.thickness || 1;
        
        for (let i = -radius; i <= radius; i++) {
            for (let j = -radius; j <= radius; j++) {
                const dist = Math.sqrt(i * i + j * j);
                if (options.fill) {
                    if (dist <= radius) {
                        this.setPixel(x + i, y + j, [r, g, b, a]);
                    }
                } else {
                    if (Math.abs(dist - radius) < thickness) {
                        this.setPixel(x + i, y + j, [r, g, b, a]);
                    }
                }
            }
        }
    }

    drawBezierCurve(x0, y0, x1, y1, x2, y2, x3, y3, color, thickness = 1) {
        const [r, g, b, a] = this.parseColor(color);
        const steps = Math.max(Math.abs(x3 - x0), Math.abs(y3 - y0)) * 2;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const mt = 1 - t;
            
            const px = mt*mt*mt*x0 + 3*mt*mt*t*x1 + 3*mt*t*t*x2 + t*t*t*x3;
            const py = mt*mt*mt*y0 + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y3;
            
            for (let dx = -thickness; dx <= thickness; dx++) {
                for (let dy = -thickness; dy <= thickness; dy++) {
                    if (dx*dx + dy*dy <= thickness*thickness) {
                        this.setPixel(Math.round(px + dx), Math.round(py + dy), [r, g, b, a]);
                    }
                }
            }
        }
    }

    fillGradientRect(x, y, width, height, colorStops) {
        for (let i = x; i < x + width; i++) {
            for (let j = y; j < y + height; j++) {
                const progress = (i - x) / width;
                const color = this.interpolateColorStops(colorStops, progress);
                this.setPixel(i, j, color);
            }
        }
    }

    interpolateColorStops(colorStops, progress) {
        let start = 0;
        let end = 1;
        let startColor, endColor;

        for (let i = 0; i < colorStops.length - 1; i++) {
            if (progress >= colorStops[i].offset && progress <= colorStops[i + 1].offset) {
                start = colorStops[i].offset;
                end = colorStops[i + 1].offset;
                startColor = this.parseColor(colorStops[i].color);
                endColor = this.parseColor(colorStops[i + 1].color);
                break;
            }
        }

        const localProgress = (progress - start) / (end - start);
        return this.interpolateColors(startColor, endColor, localProgress);
    }

    drawText(text, x, y, options = {}) {
        const {
            fontSize = 24,
            fontFamily = 'sans-serif',
            color = '#000000',
            opacity = 1,
            weight = 'normal',
            style = 'normal',
            align = 'left'
        } = options;

        const [r, g, b, a] = this.parseColor(color, opacity);
        const scale = fontSize / 24;
        const charWidth = Math.round(12 * scale);
        const charHeight = Math.round(16 * scale);

        let startX = x;
        if (align === 'center') {
            startX = x - (text.length * charWidth) / 2;
        } else if (align === 'right') {
            startX = x - (text.length * charWidth);
        }

        for (let i = 0; i < text.length; i++) {
            const cx = startX + i * charWidth;
            if (weight === 'bold') {
                this.fillRect(cx, y - charHeight, charWidth, charHeight, `rgba(${r},${g},${b},${a / 255})`);
                this.fillRect(cx + 1, y - charHeight, charWidth, charHeight, `rgba(${r},${g},${b},${a / 255})`);
            } else {
                this.fillRect(cx, y - charHeight, charWidth - 1, charHeight, `rgba(${r},${g},${b},${a / 255})`);
            }
        }
    }

    toBlobURL() {
        const pngData = this.toPNG();
        const blob = new Blob([pngData], { type: 'image/png' });
        return URL.createObjectURL(blob);
    }

    dispose() {
        this.patterns.clear();
        if (this._blobUrl) {
            URL.revokeObjectURL(this._blobUrl);
            this._blobUrl = null;
        }
    }

    toPNG() {
        const header = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

        const IHDR = new Uint8Array(13);
        const dv = new DataView(IHDR.buffer);
        dv.setUint32(0, this.width);
        dv.setUint32(4, this.height);
        IHDR[8] = 8;
        IHDR[9] = 6;
        IHDR[10] = 0;
        IHDR[11] = 0;
        IHDR[12] = 0;

        const scanlines = [];
        for (let y = 0; y < this.height; y++) {
            scanlines.push(0);
            for (let x = 0; x < this.width; x++) {
                const i = (y * this.width + x) * 4;
                scanlines.push(...this.pixels.slice(i, i + 4));
            }
        }
        const compressed = this.deflateSync(new Uint8Array(scanlines));

        const chunks = [
            this.createChunk('IHDR', IHDR),
            this.createChunk('IDAT', compressed),
            this.createChunk('IEND', new Uint8Array(0))
        ];

        const totalSize = header.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const png = new Uint8Array(totalSize);
        let offset = 0;

        png.set(header, offset);
        offset += header.length;

        for (const chunk of chunks) {
            png.set(chunk, offset);
            offset += chunk.length;
        }

        return png;
    }

    createChunk(type, data) {
        const typeBytes = new TextEncoder().encode(type);
        const chunk = new Uint8Array(data.length + 12);
        const dv = new DataView(chunk.buffer);
        dv.setUint32(0, data.length);
        chunk.set(typeBytes, 4);
        chunk.set(data, 8);
        const crc = this.calculateCRC32(chunk.slice(4, data.length + 8));
        dv.setUint32(data.length + 8, crc);
        return chunk;
    }

    calculateCRC32(data) {
        let crc = ~0;
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
            }
        }
        return ~crc;
    }

    deflateSync(data) {
        const output = new Uint8Array(data.length + 6);
        output[0] = 0x78;
        output[1] = 0x9C;
        output.set(data, 2);
        const adler = this.calculateAdler32(data);
        const dv = new DataView(output.buffer);
        dv.setUint32(output.length - 4, adler);
        return output;
    }

    calculateAdler32(data) {
        let a = 1, b = 0;
        for (let i = 0; i < data.length; i++) {
            a = (a + data[i]) % 65521;
            b = (b + a) % 65521;
        }
        return (b << 16) | a;
    }
}

const Pattern = class Pattern {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
    }

    setPixel(x, y, color) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const index = (y * this.width + x) * 4;
        this.data.set(color, index);
    }
}
