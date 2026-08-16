#!/usr/bin/env node
/**
 * Gera os ícones PWA a partir de código, para não versionar binário que
 * ninguém sabe reproduzir. Desenha o frontão do templo — pedimento, arquitrave,
 * quatro colunas e o estilóbata — em âmbar sobre o fundo do app.
 *
 * O PNG é escrito à mão (zlib é embutido no Node) para o app não ganhar uma
 * dependência de imagem só por causa de quatro arquivos estáticos.
 *
 *   npm run icons
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), "public");

const BG = [0x0d, 0x0f, 0x13];
const INK = [0xf0, 0xb4, 0x29];

/** Amostras por eixo dentro de cada pixel — é o que suaviza as diagonais. */
const SUBSAMPLES = 4;

// --- desenho -----------------------------------------------------------

/** Corpo do templo, em coordenadas 0..1 dentro da caixa do glifo. */
const BARS = [
  [0.1, 0.43, 0.9, 0.51], // arquitrave
  [0.14, 0.53, 0.26, 0.83], // colunas
  [0.34, 0.53, 0.46, 0.83],
  [0.54, 0.53, 0.66, 0.83],
  [0.74, 0.53, 0.86, 0.83],
  [0.06, 0.85, 0.94, 0.95], // estilóbata
];

const PEDIMENT = [0.5, 0.05, 0.03, 0.41, 0.97, 0.41];

function inTriangle(x, y, ax, ay, bx, by, cx, cy) {
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  const a = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
  const b = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
  return a >= 0 && b >= 0 && a + b <= 1;
}

function inGlyph(x, y) {
  if (inTriangle(x, y, ...PEDIMENT)) return true;
  for (const [x0, y0, x1, y1] of BARS) {
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true;
  }
  return false;
}

/**
 * `inset` é a fração da borda deixada livre. O ícone maskable precisa de
 * bastante: quem recorta pode comer os 20% externos.
 */
function render(size, inset) {
  const rgba = Buffer.alloc(size * size * 4);
  const box = size * (1 - 2 * inset);
  const origin = size * inset;
  const step = 1 / SUBSAMPLES;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SUBSAMPLES; sy++) {
        for (let sx = 0; sx < SUBSAMPLES; sx++) {
          const x = (px + (sx + 0.5) * step - origin) / box;
          const y = (py + (sy + 0.5) * step - origin) / box;
          if (x >= 0 && x <= 1 && y >= 0 && y <= 1 && inGlyph(x, y)) hits++;
        }
      }

      const cover = hits / (SUBSAMPLES * SUBSAMPLES);
      const i = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) {
        rgba[i + c] = Math.round(BG[c] + (INK[c] - BG[c]) * cover);
      }
      rgba[i + 3] = 255;
    }
  }

  return rgba;
}

// --- PNG ---------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    // Filtro 0 (None) em cada scanline: o deflate já resolve o tamanho aqui.
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- saída -------------------------------------------------------------

const ICONS = [
  ["pwa-192.png", 192, 0.16],
  ["pwa-512.png", 512, 0.16],
  ["pwa-512-maskable.png", 512, 0.26],
  ["apple-touch-icon.png", 180, 0.16],
];

mkdirSync(OUT_DIR, { recursive: true });

for (const [name, size, inset] of ICONS) {
  const png = encodePng(size, render(size, inset));
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`  ✅ ${name} — ${size}×${size}, ${(png.length / 1024).toFixed(1)} KB`);
}
