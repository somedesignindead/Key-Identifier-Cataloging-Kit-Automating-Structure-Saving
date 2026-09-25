import type {
  ExportedFile,
  ExportOptions,
} from '../shared/messages';

const URL_BASE = 'http://localhost:47831';

export type Profile = {
  name: string;
  base64: string;
};

export type Health = {
  version: number;
  ghostscript: boolean;
  browser: boolean;
  profile: string | null;
};

export type PairResult = {
  version: number;
  token: string;
};

export function toBase64(bytes: Uint8Array): string {
  let out = '';

  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(
      ...bytes.subarray(i, i + 0x8000),
    );
  }

  return btoa(out);
}

function fromBase64(value: string): Uint8Array {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }

  return bytes;
}

async function fetchJson<T>(
  path: string,
  options: RequestInit = {},
  timeout = 5000,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${URL_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `Ошибка конвертера (${response.status}).`,
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Локальный конвертер не ответил вовремя.');
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function pairWithConverter(): Promise<PairResult> {
  return fetchJson<PairResult>(
    '/pair',
    { method: 'GET' },
    2500,
  );
}

export async function checkConnection(token: string): Promise<Health> {
  if (!token) {
    throw new Error('Нет токена.');
  }

  return fetchJson<Health>(
    '/health',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    15000,
  );
}

export async function convertFile(
  file: ExportedFile,
  options: ExportOptions,
  token: string,
  profile?: Profile,
): Promise<ExportedFile> {
  const useFrameSize =
    options.printFrameSizeEnabled;

  if (
    useFrameSize &&
    (
      !Number.isFinite(
        file.sourceWidth,
      ) ||
      !Number.isFinite(
        file.sourceHeight,
      ) ||
      Number(file.sourceWidth) <= 0 ||
      Number(file.sourceHeight) <= 0
    )
  ) {
    throw new Error(
      'Не удалось определить размер экспортируемого фрейма.',
    );
  }

  const sizeEnabled =
    useFrameSize ||
    options.printFinalSizeEnabled;

  const scale =
    options.printScaleEnabled
      ? options.printScale
      : 1;

  const finalWidth =
    (
      useFrameSize
        ? Number(file.sourceWidth)
        : options.printFinalWidth
    ) *
    scale;

  const finalHeight =
    (
      useFrameSize
        ? Number(file.sourceHeight)
        : options.printFinalHeight
    ) *
    scale;

  if (
    sizeEnabled &&
    (
      !Number.isFinite(finalWidth) ||
      !Number.isFinite(finalHeight) ||
      finalWidth < 1 ||
      finalWidth > 10000 ||
      finalHeight < 1 ||
      finalHeight > 10000
    )
  ) {
    throw new Error(
      'Итоговый размер после масштаба должен быть от 1 до 10000 мм.',
    );
  }

  const data = await fetchJson<{
    base64: string;
    profile: string | null;
  }>(
    '/convert',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64: toBase64(file.bytes),
        mime: file.mime,
        colorMode: options.colorMode,
        profile,

        printLayerEnabled:
          options.printLayerEnabled,

        printLayerName:
          options.printLayerName,

        printSpotEnabled:
          options.printSpotEnabled,

        printSpotName:
          options.printSpotName,

        printOverprint:
          options.printOverprint,

        printStrokeWidth:
          options.printStrokeWidth,

        printMinDpi:
          options.printMinDpi,

        printFinalSizeEnabled:
          sizeEnabled,

        printFinalWidth:
          finalWidth,

        printFinalHeight:
          finalHeight,

        printFinalLockRatio:
          options.printFinalLockRatio,

        textSvgBase64: file.textSvgBytes
          ? toBase64(file.textSvgBytes)
          : undefined,
        rezkaSvgBase64: file.rezkaSvgBytes
          ? toBase64(file.rezkaSvgBytes)
          : undefined,
      }),
    },
    170000,
  );

  const bytes = fromBase64(data.base64);

  if (
    new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-'
  ) {
    throw new Error('Конвертер вернул некорректный PDF.');
  }

  return {
    name: file.name,
    bytes,
    mime: 'application/pdf',
  };
}
