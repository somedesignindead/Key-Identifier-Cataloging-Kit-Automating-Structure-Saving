import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './runtime.mjs';

export function validateProfile(bytes) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (bytes.length < 132 || bytes.length > 4 * 1024 * 1024 ||
      bytes.toString('ascii', 36, 40) !== 'acsp' || bytes.toString('ascii', 16, 20) !== 'CMYK' ||
      bytes.readUInt32BE(0) !== bytes.length) {
    throw new Error('Нужен корректный CMYK ICC-профиль размером до 4 МБ.');
  }
  const count = bytes.readUInt32BE(128);
  if (132 + count * 12 > bytes.length) throw new Error('Повреждена таблица ICC-профиля.');
  for (let i = 0; i < count; i++) {
    const pos = 132 + i * 12;
    const offset = bytes.readUInt32BE(pos + 4), length = bytes.readUInt32BE(pos + 8);
    if (offset + length > bytes.length) throw new Error('Повреждены данные ICC-профиля.');
  }
  if (!['prtr', 'mntr', 'scnr', 'spac'].includes(bytes.toString('ascii', 12, 16))) {
    throw new Error('DeviceLink и абстрактные профили не поддерживаются. Нужен обычный CMYK-профиль.');
  }
  return bytes;
}
export async function getProfile(upload) {
  if (upload) {
    if (typeof upload.base64 !== 'string' || typeof upload.name !== 'string' || upload.base64.length > 5600000) {
      throw new Error('Некорректный ICC-профиль.');
    }
    return { bytes: validateProfile(Buffer.from(upload.base64, 'base64')), name: upload.name.slice(0, 160) };
  }
  const candidates = [
    process.env.CMYK_PROFILE,
    join(ROOT, '.runtime/profiles/default_cmyk.icc'),
    '/System/Library/ColorSync/Profiles/Generic CMYK Profile.icc',
  ].filter(Boolean);
  for (const path of candidates) {
    try { return { bytes: validateProfile(await readFile(path)), name: 'Базовый CMYK — замените профилем типографии' }; }
    catch { /* Try the next locally installed profile. */ }
  }
  throw new Error('Выберите ICC-профиль типографии: базовый CMYK-профиль не найден.');
}
