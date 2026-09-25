import {
  HELPER_ZIP_BASE64,
  HELPER_WINDOWS_SETUP_BASE64,
} from './helper-package.generated';

import {
  checkConnection,
  pairWithConverter,
  type Health,
} from './converter';

const LAUNCHER_URL =
  'http://localhost:47830';

let tokenCache = '';

const delay = (ms: number) =>
  new Promise<void>(
    resolve =>
      window.setTimeout(
        resolve,
        ms,
      ),
  );

function saveToken(
  token: string,
): void {
  tokenCache =
    token;
}

function storedToken(): string {
  return tokenCache;
}

async function tryConnect(): Promise<{
  token: string;
  health: Health;
}> {
  const saved =
    storedToken();

  if (saved) {
    try {
      const health =
        await checkConnection(
          saved,
        );

      return {
        token:
          saved,
        health,
      };
    } catch {
      // Pair again below.
    }
  }

  const pair =
    await pairWithConverter();

  saveToken(
    pair.token,
  );

  const health =
    await checkConnection(
      pair.token,
    );

  return {
    token:
      pair.token,
    health,
  };
}

async function waitForConverter(
  timeout: number,
): Promise<{
  token: string;
  health: Health;
}> {
  const started =
    Date.now();

  let lastError:
    unknown;

  while (
    Date.now() -
      started <
    timeout
  ) {
    try {
      return await tryConnect();
    } catch (
      error
    ) {
      lastError =
        error;
    }

    await delay(
      350,
    );
  }

  throw (
    lastError ||
    new Error(
      'Конвертер не запустился.',
    )
  );
}

async function startLauncher(): Promise<void> {
  const controller =
    new AbortController();

  const timer =
    window.setTimeout(
      () =>
        controller.abort(),
      2500,
    );

  try {
    const response =
      await fetch(
        `${LAUNCHER_URL}/start`,
        {
          method:
            'GET',

          cache:
            'no-store',

          signal:
            controller.signal,
        },
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Launcher вернул HTTP ${response.status}`,
      );
    }
  } finally {
    window.clearTimeout(
      timer,
    );
  }
}

function isWindows(): boolean {
  return (
    /Windows/i.test(
      navigator.userAgent,
    ) ||
    /Win/i.test(
      navigator.platform ||
        '',
    )
  );
}

function helperBytes(
  base64: string,
): Uint8Array {
  const raw =
    atob(
      base64,
    );

  const bytes =
    new Uint8Array(
      raw.length,
    );

  for (
    let i = 0;
    i <
      raw.length;
    i++
  ) {
    bytes[i] =
      raw.charCodeAt(
        i,
      );
  }

  return bytes;
}

export function downloadHelper(): void {
  const windows =
    isWindows();

  const base64 =
    windows
      ? HELPER_WINDOWS_SETUP_BASE64
      : HELPER_ZIP_BASE64;

  if (!base64) {
    throw new Error(
      windows
        ? 'Windows Setup Helper не встроен в сборку.'
        : 'Mac Helper не встроен в сборку.',
    );
  }

  const bytes =
    helperBytes(
      base64,
    );

  const arrayBuffer =
    new ArrayBuffer(
      bytes.byteLength,
    );

  new Uint8Array(
    arrayBuffer,
  ).set(
    bytes,
  );

  const url =
    URL.createObjectURL(
      new Blob(
        [
          arrayBuffer,
        ],
        {
          type:
            windows
              ? 'application/vnd.microsoft.portable-executable'
              : 'application/zip',
        },
      ),
    );

  const link =
    document.createElement(
      'a',
    );

  link.href =
    url;

  link.download =
    windows
      ? 'Layer Export Helper Setup.exe'
      : 'Layer Export Helper.zip';

  link.style.display =
    'none';

  document.body.append(
    link,
  );

  link.click();
  link.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url,
      ),
    10000,
  );
}

export async function ensureConverter({
  setStatus,
  helperInstalled,
  markHelperInstalled,
  requestInstall,
}: {
  setStatus:
    (text: string) =>
      void;

  helperInstalled:
    boolean;

  markHelperInstalled:
    () => void;

  requestInstall:
    () =>
      Promise<void>;
}): Promise<{
  token: string;
  health: Health;
}> {
  const remember =
    (
      connection: {
        token: string;
        health: Health;
      },
    ) => {
      markHelperInstalled();

      return connection;
    };

  /*
   * Конвертер уже работает.
   */
  try {
    return remember(
      await tryConnect(),
    );
  } catch {
    // Start launcher below.
  }

  setStatus(
    helperInstalled
      ? 'Запускаю локальный конвертер…'
      : 'Проверяю локальный конвертер…',
  );

  /*
   * Launcher установлен, но
   * converter сейчас выключен.
   */
  try {
    await startLauncher();

    return remember(
      await waitForConverter(
        10000,
      ),
    );
  } catch {
    // Launcher is missing/broken.
  }

  /*
   * НИЧЕГО не скачиваем,
   * пока пользователь не увидел
   * объяснение и не подтвердил.
   */
  await requestInstall();

  downloadHelper();

  setStatus(
    isWindows()
      ? 'Setup.exe скачан. Запустите установщик — экспорт продолжится автоматически.'
      : 'Helper скачан. Установите его по инструкции в ZIP — экспорт продолжится автоматически.',
  );

  try {
    return remember(
      await waitForConverter(
        120000,
      ),
    );
  } catch (
    error
  ) {
    const message =
      error instanceof
        Error
        ? error.message
        : String(
            error,
          );

    throw new Error(
      `Helper не запустился после установки: ${message}`,
    );
  }
}
