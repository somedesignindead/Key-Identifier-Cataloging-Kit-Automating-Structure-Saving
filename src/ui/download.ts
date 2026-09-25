import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import type { ExportedFile } from '../shared/messages';

const encoder = new TextEncoder();
const table = new Uint32Array(256);

for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  table[i] = c >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function makeZip(files: ExportedFile[]): Uint8Array {
  if (files.length > 65535) throw new Error('Слишком много файлов для ZIP.');

  const entries: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x800, true);
    localView.setUint16(12, 33, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, file.bytes.length, true);
    localView.setUint32(22, file.bytes.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x800, true);
    centralView.setUint16(14, 33, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.bytes.length, true);
    centralView.setUint32(24, file.bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);

    entries.push(local, file.bytes);
    directory.push(central);
    offset += local.length + file.bytes.length;
  }

  const directoryBytes = join(directory);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, directoryBytes.length, true);
  endView.setUint32(16, offset, true);

  return join([...entries, directoryBytes, end]);
}

export async function makeMergedPdf(files: ExportedFile[]): Promise<Uint8Array> {
  const pdfFiles = files.filter(file => file.mime === 'application/pdf');

  if (pdfFiles.length < 2) {
    throw new Error('Для общего PDF нужно минимум две PDF-страницы.');
  }

  const output = await PDFDocument.create();

  for (const file of pdfFiles) {
    const source = await PDFDocument.load(file.bytes);
    const pages = await output.copyPages(
      source,
      source.getPageIndices(),
    );

    for (const page of pages) {
      output.addPage(page);
    }
  }

  /*
   * copyPages() переносит ресурсы страниц,
   * включая ссылки Properties -> OCG,
   * но не переносит Catalog /OCProperties.
   *
   * Берём OCG из ресурсов первой подходящей
   * страницы и привязываем к ним все страницы.
   */
  let artworkOcg;
  let cutOcg;

  for (const page of output.getPages()) {
    const resources = page.node.Resources();

    if (!resources) continue;

    const properties = resources.lookupMaybe(
      PDFName.of('Properties'),
      PDFDict,
    );

    if (!properties) continue;

    if (!artworkOcg) {
      artworkOcg = properties.get(
        PDFName.of('Artwork'),
      );
    }

    if (!cutOcg) {
      cutOcg = properties.get(
        PDFName.of('LayerExportCut'),
      );
    }

    if (artworkOcg && cutOcg) break;
  }

  if (artworkOcg || cutOcg) {
    for (const page of output.getPages()) {
      const resources = page.node.Resources();

      if (!resources) continue;

      const properties = resources.lookupMaybe(
        PDFName.of('Properties'),
        PDFDict,
      );

      if (!properties) continue;

      if (artworkOcg) {
        properties.set(
          PDFName.of('Artwork'),
          artworkOcg,
        );
      }

      if (cutOcg) {
        properties.set(
          PDFName.of('LayerExportCut'),
          cutOcg,
        );
      }
    }

    const ocgs = output.context.obj([]);
    const order = output.context.obj([]);
    const enabled = output.context.obj([]);

    if (artworkOcg) {
      ocgs.push(artworkOcg);
      order.push(artworkOcg);
      enabled.push(artworkOcg);
    }

    if (cutOcg) {
      ocgs.push(cutOcg);
      order.push(cutOcg);
      enabled.push(cutOcg);
    }

    output.catalog.set(
      PDFName.of('OCProperties'),
      output.context.obj({
        OCGs: ocgs,
        D: {
          Order: order,
          ON: enabled,
        },
      }),
    );
  }

  return new Uint8Array(
    await output.save({
      useObjectStreams: false,
    }),
  );
}

export function fileUrl(bytes: Uint8Array, mime: string): string {
  return URL.createObjectURL(
    new Blob([new Uint8Array(bytes).buffer], { type: mime }),
  );
}
