import {
  isPluginMessage,
  type UiMessage,
  type ExportOptions,
  type ExportedFile,
} from './shared/messages';

import {
  initI18n,
} from './ui/i18n';

import {
  fileUrl,
  makeZip,
  makeMergedPdf,
} from './ui/download';

import {
  convertFile,
  toBase64,
  type Profile,
} from './ui/converter';

import {
  ensureConverter,
  downloadHelper,
} from './ui/helper';

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const outline = el<HTMLInputElement>('outline');

const printLayerEnabled =
  el<HTMLInputElement>('print-layer-enabled');

const printLayerName =
  el<HTMLInputElement>('print-layer-name');

const printSpotEnabled =
  el<HTMLInputElement>('print-spot-enabled');

const printSpotName =
  el<HTMLInputElement>('print-spot-name');

const printOverprint =
  el<HTMLInputElement>('print-overprint');

const printStrokeWidth =
  el<HTMLInputElement>('print-stroke-width');

const printMinDpi =
  el<HTMLInputElement>('print-min-dpi');

const printOptimizeImages =
  el<HTMLInputElement>('print-optimize-images');

const printFrameSizeEnabled =
  el<HTMLInputElement>('print-frame-size-enabled');

const printFinalSizeEnabled =
  el<HTMLInputElement>('print-final-size-enabled');

const printFinalWidth =
  el<HTMLInputElement>('print-final-width');

const printFinalHeight =
  el<HTMLInputElement>('print-final-height');

const printFinalLockRatio =
  el<HTMLInputElement>('print-final-lock-ratio');

const printScaleEnabled =
  el<HTMLInputElement>('print-scale-enabled');

const printScale =
  el<HTMLInputElement>('print-scale');

const profileFile = el<HTMLInputElement>('icc-file');

const profileSelect =
  el<HTMLSelectElement>(
    'icc-profile-select',
  );
const settings = el<HTMLFieldSetElement>('settings');
const exportButton = el<HTMLButtonElement>('export');
const status = el('status');
const downloads = el('downloads');

let count = 0;
let busy = false;
let profile: Profile | undefined;

let savedProfiles:
  Profile[] =
  [];
let converterToken = '';
let helperInstalled = false;
let urls: string[] = [];

let batchFiles:
  ExportedFile[] |
  null =
    [];

let batchBytes =
  0;

const MAX_BATCH_BYTES =
  100 *
  1024 *
  1024;

function radioValue<T extends string>(name: string): T {
  return (
    document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value || ''
  ) as T;
}

function setRadio(name: string, value: string): void {
  const input = document.querySelector<HTMLInputElement>(
    `input[name="${name}"][value="${value}"]`,
  );
  if (input) input.checked = true;
}

function send(message: UiMessage): void {
  parent.postMessage({ pluginMessage: message }, '*');
}

function options(): ExportOptions {
  return {
    format: radioValue<'SVG' | 'PDF'>('format'),
    colorMode: radioValue<'RGB' | 'CMYK'>('color'),
    outlineText: outline.checked,

    printLayerEnabled:
      printLayerEnabled.checked,

    printLayerName:
      printLayerName.value.trim() || 'rezka',

    printSpotEnabled:
      printSpotEnabled.checked,

    printSpotName:
      printSpotName.value.trim() || 'CutContour',

    printOverprint:
      printOverprint.checked,

    printStrokeWidth:
      Number(printStrokeWidth.value) || 0.25,

    printMinDpi:
      Number(printMinDpi.value) || 300,

    printOptimizeImages:
      printOptimizeImages.checked,

    printFrameSizeEnabled:
      printFrameSizeEnabled.checked,

    printFinalSizeEnabled:
      printFinalSizeEnabled.checked,

    printFinalWidth:
      Number(printFinalWidth.value) || 0,

    printFinalHeight:
      Number(printFinalHeight.value) || 0,

    printFinalLockRatio:
      printFinalLockRatio.checked,

    printScaleEnabled:
      printScaleEnabled.checked,

    printScale:
      Number(printScale.value) || 1,
  };
}

function profileMode(): 'default' | 'custom' {
  return profile
    ? 'custom'
    : 'default';
}

function needsConverter(value: ExportOptions): boolean {
  return (
    value.format === 'PDF' &&
    (
      value.colorMode === 'CMYK' ||
      !value.outlineText ||
      value.printLayerEnabled ||
      value.printSpotEnabled ||
      value.printFrameSizeEnabled ||
      value.printFinalSizeEnabled
    )
  );
}

function setStatus(text: string, error = false): void {
  status.textContent = text;
  status.classList.toggle('error', error);
}

function setBusy(value: boolean): void {
  busy = value;
  settings.disabled = value;
  exportButton.disabled = value || count === 0;
}

function clearDownloads(): void {
  urls.forEach(
    URL.revokeObjectURL,
  );

  urls = [];

  batchFiles =
    [];

  batchBytes =
    0;

  downloads.replaceChildren();

  const empty =
    document.getElementById(
      'downloads-empty',
    );

  if (empty) {
    empty.hidden =
      false;
  }
}

function formatDimension(
  value: number,
): string {
  const rounded =
    Math.round(
      value *
      100,
    ) /
    100;

  return String(
    rounded,
  );
}

function applyFrameSize(
  width: number,
  height: number,
): void {
  printFinalWidth.value =
    formatDimension(
      width,
    );

  printFinalHeight.value =
    formatDimension(
      height,
    );

  sync();
}

function sync(): void {
  const format = radioValue<'SVG' | 'PDF'>('format');

  if (format === 'SVG') {
    setRadio('color', 'RGB');
  }

  el<HTMLInputElement>('color-cmyk').disabled = format === 'SVG';

  const current = options();
  el('profile-panel').hidden = current.colorMode !== 'CMYK';
  el('print-panel').hidden = current.format !== 'PDF';
  el('converter-panel').hidden = !needsConverter(current);

  const printAvailable =
    current.format === 'PDF';

  printLayerEnabled.disabled =
    !printAvailable;

  printLayerName.disabled =
    !printAvailable ||
    !printLayerEnabled.checked;

  printSpotEnabled.disabled =
    !printAvailable ||
    !printLayerEnabled.checked;

  printSpotName.disabled =
    !printAvailable ||
    !printLayerEnabled.checked ||
    !printSpotEnabled.checked;

  printOverprint.disabled =
    !printAvailable ||
    !printLayerEnabled.checked ||
    !printSpotEnabled.checked;

  printStrokeWidth.disabled =
    !printAvailable ||
    !printLayerEnabled.checked;

  printMinDpi.disabled =
    !printAvailable;

  printOptimizeImages.disabled =
    !printAvailable;

  printFrameSizeEnabled.disabled =
    !printAvailable;

  printFinalSizeEnabled.disabled =
    !printAvailable;

  const finalSizeAvailable =
    printAvailable &&
    printFinalSizeEnabled.checked;

  const anySizeMode =
    printAvailable &&
    (
      printFrameSizeEnabled.checked ||
      printFinalSizeEnabled.checked
    );

  printFinalWidth.disabled =
    !finalSizeAvailable;

  printFinalHeight.disabled =
    !finalSizeAvailable;

  printFinalLockRatio.disabled =
    !finalSizeAvailable;

  printScaleEnabled.disabled =
    !anySizeMode;

  if (!anySizeMode) {
    printScaleEnabled.checked =
      false;
  }

  printScale.disabled =
    !anySizeMode ||
    !printScaleEnabled.checked;

  const textHint =
    outline.checked
      ? 'Буквы станут векторными контурами и сохранят внешний вид.'
      : current.format === 'PDF'
        ? 'Текст останется редактируемым. Визуальная основа PDF экспортируется нативно средствами Figma.'
        : 'Текст останется текстом.';

  el('text-hint').textContent =
    textHint;

  el(
    'outline-help',
  ).setAttribute(
    'data-tip',
    textHint,
  );
}

for (const control of Array.from(
  document.querySelectorAll<HTMLInputElement>(
    'input[name="format"], input[name="color"], input[name="profile"], #outline, #print-layer-enabled, #print-spot-enabled, #print-overprint, #print-scale-enabled',
  ),
)) {
  control.addEventListener('change', sync);
}


printFrameSizeEnabled.addEventListener(
  'change',
  sync,
);

printFinalSizeEnabled.addEventListener(
  'change',
  sync,
);


function updateStrokeDisplay(): void {
  const value =
    Math.max(
      0.01,
      Math.min(
        10,
        Number(
          printStrokeWidth
            .value,
        ) ||
        0.25,
      ),
    );

  printStrokeWidth.value =
    String(
      Math.round(
        value *
        100,
      ) /
      100,
    );

  el(
    'stroke-value',
  ).textContent =
    Number(
      printStrokeWidth
        .value,
    )
      .toFixed(
        2,
      )
      .replace(
        '.',
        ',',
      );
}


el<HTMLButtonElement>(
  'stroke-plus',
).addEventListener(
  'click',
  () => {
    printStrokeWidth.value =
      String(
        Math.min(
          10,
          (
            Number(
              printStrokeWidth
                .value,
            ) ||
            0.25
          ) +
          0.05,
        ),
      );

    updateStrokeDisplay();
  },
);


el<HTMLButtonElement>(
  'stroke-minus',
).addEventListener(
  'click',
  () => {
    printStrokeWidth.value =
      String(
        Math.max(
          0.01,
          (
            Number(
              printStrokeWidth
                .value,
            ) ||
            0.25
          ) -
          0.05,
        ),
      );

    updateStrokeDisplay();
  },
);


document
  .querySelectorAll<HTMLButtonElement>(
    '[data-scale]',
  )
  .forEach(
    button => {
      button.addEventListener(
        'click',
        () => {
          const value =
            Number(
              button.dataset
                .scale,
            );

          if (
            !Number.isFinite(
              value,
            ) ||
            value <= 0
          ) {
            return;
          }

          printScaleEnabled.checked =
            true;

          printScale.value =
            String(
              value,
            );

          sync();
        },
      );
    },
  );


updateStrokeDisplay();


function requestHelperInstall(
  reinstall = false,
): Promise<void> {
  const modal =
    el(
      'install-helper-modal',
    );

  const title =
    el(
      'install-helper-title',
    );

  const confirm =
    el<HTMLButtonElement>(
      'install-helper-confirm',
    );

  const cancel =
    el<HTMLButtonElement>(
      'install-helper-cancel',
    );

  title.textContent =
    reinstall
      ? 'Переустановка Layer Export Helper'
      : 'Установка Layer Export Helper';

  const windows =
    /Windows/i.test(
      navigator.userAgent,
    ) ||
    /Win/i.test(
      navigator.platform ||
        '',
    );

  confirm.textContent =
    reinstall
      ? 'Скачать заново'
      : windows
        ? 'Скачать Setup.exe'
        : 'Скачать ZIP';

  modal.hidden =
    false;

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const cleanup =
        () => {
          confirm.onclick =
            null;

          cancel.onclick =
            null;

          modal.hidden =
            true;
        };

      confirm.onclick =
        () => {
          cleanup();
          resolve();
        };

      cancel.onclick =
        () => {
          cleanup();

          reject(
            new Error(
              'Установка Helper отменена.',
            ),
          );
        };
    },
  );
}

function populateProfileSelect(
  preferredName?: string,
): void {
  const currentName =
    preferredName ||
    profile?.name ||
    '';

  profileSelect.replaceChildren();

  const defaultOption =
    document.createElement(
      'option',
    );

  defaultOption.value =
    'default';

  defaultOption.textContent =
    'Добавить';

  profileSelect.append(
    defaultOption,
  );

  savedProfiles.forEach(
    (
      item,
      index,
    ) => {
      const option =
        document.createElement(
          'option',
        );

      option.value =
        `saved:${index}`;

      option.textContent =
        item.name;

      profileSelect.append(
        option,
      );

      if (
        item.name ===
        currentName
      ) {
        option.selected =
          true;

        profile =
          item;
      }
    },
  );

  const addOption =
    document.createElement(
      'option',
    );

  addOption.value =
    '__add__';

  addOption.textContent =
    '+ Добавить…';

  profileSelect.append(
    addOption,
  );
}


profileSelect.addEventListener(
  'change',
  () => {
    const value =
      profileSelect.value;

    if (
      value ===
      '__add__'
    ) {
      const fallback =
        profile
          ? savedProfiles
              .findIndex(
                item =>
                  item.name ===
                  profile?.name,
              )
          : -1;

      profileSelect.value =
        fallback >= 0
          ? `saved:${fallback}`
          : 'default';

      profileFile.click();

      return;
    }

    if (
      value.startsWith(
        'saved:',
      )
    ) {
      const index =
        Number(
          value.slice(
            6,
          ),
        );

      profile =
        savedProfiles[
          index
        ];

      return;
    }

    profile =
      undefined;
  },
);


window.addEventListener(
  'message',
  event => {
    const message =
      event.data
        ?.pluginMessage as
        {
          type?: string;
          profiles?: Profile[];
        } |
        undefined;

    if (
      message?.type !==
        'profiles-state' ||
      !Array.isArray(
        message.profiles,
      )
    ) {
      return;
    }

    savedProfiles =
      message.profiles
        .filter(
          item =>
            item &&
            typeof item.name ===
              'string' &&
            typeof item.base64 ===
              'string',
        )
        .slice(
          0,
          8,
        );

    populateProfileSelect();
  },
);


profileFile.addEventListener(
  'change',
  async () => {
    const file =
      profileFile.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.size >
      4 *
      1024 *
      1024
    ) {
      setStatus(
        'ICC-профиль должен быть не больше 4 МБ.',
        true,
      );

      profileFile.value =
        '';

      return;
    }

    const bytes =
      new Uint8Array(
        await file.arrayBuffer(),
      );

    if (
      new TextDecoder()
        .decode(
          bytes.subarray(
            16,
            20,
          ),
        ) !==
      'CMYK'
    ) {
      setStatus(
        'Выберите CMYK ICC-профиль.',
        true,
      );

      profileFile.value =
        '';

      return;
    }

    const added:
      Profile = {
        name:
          file.name,

        base64:
          toBase64(
            bytes,
          ),
      };

    profile =
      added;

    savedProfiles =
      [
        added,
        ...savedProfiles
          .filter(
            item =>
              item.name !==
              added.name,
          ),
      ].slice(
        0,
        8,
      );

    populateProfileSelect(
      added.name,
    );

    send({
      type:
        'profiles-save',

      profiles:
        savedProfiles,
    });

    profileFile.value =
      '';

    setStatus(
      `ICC-профиль сохранён: ${added.name}`,
    );
  },
);


exportButton.addEventListener('click', async () => {
  if (busy) return;

  /*
   * Уже экспортированные файлы остаются доступными,
   * пока открыто окно плагина.
   *
   * Для нового запуска сбрасываем только batch,
   * чтобы ZIP / общий PDF формировались исключительно
   * из файлов текущего экспорта.
   */
  batchFiles =
    [];

  batchBytes =
    0;

  setBusy(true);
  setStatus('Подготовка экспорта…');

  try {
    const current = options();

    if (needsConverter(current)) {
      const connection = await ensureConverter({
        helperInstalled,

        markHelperInstalled: () => {
          if (helperInstalled) return;

          helperInstalled = true;

          send({
            type: 'helper-installed',
          });
        },

        setStatus: text => setStatus(text),

        requestInstall:
          () =>
            requestHelperInstall(
              false,
            ),
      });

      converterToken = connection.token;
      const ready = connection.health;

      if (ready.version !== 3) {
        throw new Error(
          'Версия локального конвертера несовместима. Пересоберите Helper.',
        );
      }

      if (current.colorMode === 'CMYK' && !ready.ghostscript) {
        throw new Error(
          'Ghostscript не установлен. Выполните npm run setup:gs.',
        );
      }

      if (!current.outlineText && !ready.browser) {
        throw new Error(
          'Модуль PDF с редактируемым текстом не установлен. Выполните npm run setup:browser.',
        );
      }

      if (
        current.colorMode === 'CMYK' &&
        profileMode() === 'custom' &&
        !profile
      ) {
        throw new Error('Выберите ICC-профиль типографии.');
      }

      if (
        current.colorMode === 'CMYK' &&
        profileMode() === 'default' &&
        !ready.profile
      ) {
        throw new Error('Базовый ICC-профиль не найден.');
      }
    }

    send({ type: 'export', options: current });
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Ошибка подготовки.',
      true,
    );
    setBusy(false);
  }
});

function updateDownloadsEmpty(): void {
  const empty =
    document.getElementById(
      'downloads-empty',
    );

  if (!empty) {
    return;
  }

  empty.hidden =
    downloads.children.length > 0;
}

function addLink(
  name: string,
  bytes: Uint8Array,
  mime: string,
  sourceFile?: ExportedFile,
): void {
  const empty =
    document.getElementById(
      'downloads-empty',
    );

  if (empty) {
    empty.hidden =
      true;
  }

  const url =
    fileUrl(
      bytes,
      mime,
    );

  urls.push(
    url,
  );

  const row =
    document.createElement(
      'div',
    );

  row.className =
    'download-row';

  const link =
    document.createElement(
      'a',
    );

  link.href =
    url;

  link.download =
    name;

  link.textContent =
    name;

  link.title =
    name;

  link.className =
    'download';

  const remove =
    document.createElement(
      'button',
    );

  remove.type =
    'button';

  remove.className =
    'download-delete';

  remove.textContent =
    '×';

  remove.title =
    `Удалить ${name}`;

  remove.setAttribute(
    'aria-label',
    `Удалить ${name}`,
  );

  remove.addEventListener(
    'click',
    () => {
      URL.revokeObjectURL(
        url,
      );

      urls =
        urls.filter(
          item =>
            item !== url,
        );

      row.remove();

      if (
        sourceFile &&
        batchFiles
      ) {
        const index =
          batchFiles.indexOf(
            sourceFile,
          );

        if (
          index >= 0
        ) {
          batchBytes =
            Math.max(
              0,
              batchBytes -
                sourceFile.bytes.length,
            );

          batchFiles.splice(
            index,
            1,
          );
        }

        /*
         * Старый ZIP / общий PDF после удаления
         * страницы уже не соответствует набору.
         */
        for (
          const aggregate
          of Array.from(
            downloads.querySelectorAll<HTMLElement>(
              '.aggregate-download',
            ),
          )
        ) {
          aggregate.remove();
        }

        for (
          const merge
          of Array.from(
            downloads.querySelectorAll<HTMLElement>(
              '.merge',
            ),
          )
        ) {
          merge.remove();
        }
      }

      updateDownloadsEmpty();
    },
  );

  row.append(
    link,
    remove,
  );

  downloads.append(
    row,
  );
}

function addMergeButton(
  files: ExportedFile[],
  colorMode: 'RGB' | 'CMYK',
): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'merge';
  button.textContent = 'Сформировать общий PDF';

  button.addEventListener('click', async () => {
    button.disabled = true;
    setStatus('Формирование общего PDF…');

    try {
      const bytes = await makeMergedPdf(files);
      addLink(
        `pages-${colorMode.toLowerCase()}.pdf`,
        bytes,
        'application/pdf',
      );

      downloads.lastElementChild?.classList.add(
        'aggregate-download',
      );
      button.remove();
      setStatus(`Общий PDF сформирован: ${files.length} стр.`);
    } catch (error) {
      button.disabled = false;
      setStatus(
        error instanceof Error
          ? error.message
          : 'Не удалось сформировать общий PDF.',
        true,
      );
    }
  });

  button.classList.add(
    'aggregate-download',
  );

  downloads.append(button);
}

async function handleExportedFile(
  file: ExportedFile,
  index: number,
  total: number,
  current: ExportOptions,
): Promise<void> {
  try {
    let ready:
      ExportedFile;

    if (
      needsConverter(
        current,
      )
    ) {
      setStatus(
        `Преобразование ${index} из ${total}…`,
      );

      ready =
        await convertFile(
          file,
          current,
          converterToken,
          profileMode() ===
            'custom'
            ? profile
            : undefined,
        );
    } else {
      ready =
        file;
    }

    /*
     * Сразу создаём Blob URL.
     * После ACK исходные Uint8Array
     * текущего фрейма могут быть
     * освобождены сборщиком мусора.
     */
    addLink(
      ready.name,
      ready.bytes,
      ready.mime,
      ready,
    );

    /*
     * Для ZIP/общего PDF держим
     * в JS-памяти максимум 100 МБ
     * ГОТОВЫХ файлов.
     *
     * Большие пакеты при этом
     * продолжают экспортироваться
     * поштучно без общего лимита.
     */
    if (
      batchFiles !==
      null
    ) {
      const nextBytes =
        batchBytes +
        ready.bytes
          .byteLength;

      if (
        nextBytes <=
        MAX_BATCH_BYTES
      ) {
        batchFiles.push(
          ready,
        );

        batchBytes =
          nextBytes;
      } else {
        batchFiles =
          null;

        batchBytes =
          0;
      }
    }

    send({
      type:
        'export-file-ack',

      index,
      ok:
        true,
    });
  } catch (
    error
  ) {
    const message =
      error instanceof
        Error
        ? error.message
        : 'Ошибка конвертации.';

    setStatus(
      message,
      true,
    );

    send({
      type:
        'export-file-ack',

      index,
      ok:
        false,

      message,
    });
  }
}

function finishStreaming(
  total: number,
  current: ExportOptions,
): void {
  const batch =
    batchFiles;

  if (
    batch &&
    batch.length ===
      total
  ) {
    const pdfFiles =
      batch.filter(
        file =>
          file.mime ===
          'application/pdf',
      );

    if (
      pdfFiles.length > 1 &&
      pdfFiles.length ===
        batch.length
    ) {
      addMergeButton(
        pdfFiles,
        current.colorMode,
      );
    }

    if (
      batch.length > 1
    ) {
      addLink(
        `layers-${current.colorMode.toLowerCase()}.zip`,
        makeZip(
          batch,
        ),
        'application/zip',
      );

      downloads.lastElementChild?.classList.add(
        'aggregate-download',
      );
    }
  }

  if (
    batch ===
    null
  ) {
    setStatus(
      `Готово: ${total} файл(ов), ${current.colorMode}. Большой пакет выгружен потоково.`,
    );
  } else {
    setStatus(
      `Готово: ${total} файл(ов), ${current.colorMode}.`,
    );
  }

  setBusy(
    false,
  );
}

async function resizeImageForPlugin(
  bytes: Uint8Array,
  targetWidth: number,
  targetHeight: number,
): Promise<Uint8Array> {
  const inputBuffer =
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset +
        bytes.byteLength,
    ) as ArrayBuffer;

  const blob =
    new Blob(
      [
        inputBuffer,
      ],
    );

  const bitmap =
    await createImageBitmap(
      blob,
    );

  try {
    const sourceWidth =
      bitmap.width;

    const sourceHeight =
      bitmap.height;

    if (
      sourceWidth <= 0 ||
      sourceHeight <= 0
    ) {
      throw new Error(
        'Некорректный размер изображения.',
      );
    }

    const scale =
      Math.min(
        1,
        targetWidth /
          sourceWidth,
        targetHeight /
          sourceHeight,
      );

    if (
      scale >= 0.98
    ) {
      return bytes;
    }

    const width =
      Math.max(
        1,
        Math.round(
          sourceWidth *
            scale,
        ),
      );

    const height =
      Math.max(
        1,
        Math.round(
          sourceHeight *
            scale,
        ),
      );

    const canvas =
      document.createElement(
        'canvas',
      );

    canvas.width =
      width;

    canvas.height =
      height;

    const context =
      canvas.getContext(
        '2d',
        {
          alpha:
            true,
        },
      );

    if (!context) {
      throw new Error(
        'Canvas 2D недоступен.',
      );
    }

    context.imageSmoothingEnabled =
      true;

    context.imageSmoothingQuality =
      'high';

    context.drawImage(
      bitmap,
      0,
      0,
      width,
      height,
    );

    const outputBlob =
      await new Promise<Blob>(
        (
          resolve,
          reject,
        ) => {
          canvas.toBlob(
            result => {
              if (result) {
                resolve(
                  result,
                );
              } else {
                reject(
                  new Error(
                    'Не удалось создать уменьшенное изображение.',
                  ),
                );
              }
            },
            'image/png',
          );
        },
      );

    return new Uint8Array(
      await outputBlob
        .arrayBuffer(),
    );
  } finally {
    bitmap.close();
  }
}


window.addEventListener(
  'message',
  (
    event:
      MessageEvent,
  ) => {
    const message:
      unknown =
        event.data
          ?.pluginMessage;

    if (
      !isPluginMessage(
        message,
      )
    ) {
      return;
    }

    switch (
      message.type
    ) {
      case 'resize-image-request':
        void resizeImageForPlugin(
          message.bytes,
          message.targetWidth,
          message.targetHeight,
        )
          .then(
            bytes => {
              send({
                type:
                  'resize-image-response',
                requestId:
                  message.requestId,
                ok:
                  true,
                bytes,
              });
            },
          )
          .catch(
            error => {
              send({
                type:
                  'resize-image-response',
                requestId:
                  message.requestId,
                ok:
                  false,
                message:
                  error instanceof
                    Error
                    ? error.message
                    : String(
                        error,
                      ),
              });
            },
          );

        break;

      case 'helper-state':
        helperInstalled =
          message.installed;

        break;

      case 'selection':
        count =
          message.count;

        el(
          'selection',
        ).textContent =
          `Выбрано слоев: ${count}`;

        const selectionList =
          el(
            'selection-list',
          );

        selectionList.replaceChildren();

        if (
          message.names.length
        ) {
          message.names.forEach(
            (
              name,
              index,
            ) => {
              const id =
                message.ids[
                  index
                ];

              const item =
                document.createElement(
                  'div',
                );

              item.className =
                'selection-item';

              const nameElement =
                document.createElement(
                  'button',
                );

              nameElement.type =
                'button';

              nameElement.className =
                'selection-name';

              nameElement.textContent =
                name;

              nameElement.title =
                name;

              const remove =
                document.createElement(
                  'button',
                );

              remove.type =
                'button';

              remove.className =
                'selection-remove';

              remove.textContent =
                '×';

              remove.title =
                `Убрать «${name}» из выбранных`;

              remove.setAttribute(
                'aria-label',
                `Убрать «${name}» из выбранных`,
              );

              item.addEventListener(
                'mouseenter',
                () => {
                  send({
                    type:
                      'preview-node',
                    id,
                  });
                },
              );

              item.addEventListener(
                'mouseleave',
                () => {
                  send({
                    type:
                      'preview-node-end',
                  });
                },
              );

              remove.addEventListener(
                'click',
                event => {
                  event.stopPropagation();

                  send({
                    type:
                      'remove-selection-node',
                    id,
                  });
                },
              );

              item.append(
                nameElement,
                remove,
              );

              selectionList.append(
                item,
              );
            },
          );
        } else {
          const empty =
            document.createElement(
              'span',
            );

          empty.className =
            'muted';

          empty.textContent =
            'Ничего не выбрано';

          selectionList.append(
            empty,
          );
        }

        exportButton.disabled =
          busy ||
          count === 0;

        if (
          !busy &&
          message.frameWidth !==
            null &&
          message.frameHeight !==
            null
        ) {
          applyFrameSize(
            message.frameWidth,
            message.frameHeight,
          );
        }

        break;

      case 'progress':
        setStatus(
          `Экспорт из Figma: ${message.completed} из ${message.total}…`,
        );

        break;

      case 'error':
        setStatus(
          message.message,
          true,
        );

        setBusy(
          false,
        );

        break;

      case 'exported-file':
        void handleExportedFile(
          message.file,
          message.index,
          message.total,
          message.options,
        );

        break;

      case 'export-complete':
        finishStreaming(
          message.total,
          message.options,
        );

        break;
    }
  },
);


el(
  'clear-downloads',
).addEventListener(
  'click',
  () => {
    clearDownloads();

    setStatus(
      'Готовые файлы очищены.',
    );
  },
);


el(
  'converter-reinstall',
).addEventListener(
  'click',
  async () => {
    try {
      await requestHelperInstall(
        true,
      );

      downloadHelper();

      setStatus(
        'Новая версия Helper скачана. Установите её поверх текущей.',
      );
    } catch {
      // User cancelled.
    }
  },
);

el(
  'converter-remove',
).addEventListener(
  'click',
  () => {
    el(
      'remove-helper-modal',
    ).hidden =
      false;
  },
);

el(
  'remove-helper-close',
).addEventListener(
  'click',
  () => {
    el(
      'remove-helper-modal',
    ).hidden =
      true;
  },
);

el('close').addEventListener('click', () => send({ type: 'close' }));
window.addEventListener('unload', clearDownloads);


const refTooltip =
  document.createElement(
    'div',
  );

refTooltip.id =
  'ref-floating-tooltip';

refTooltip.hidden =
  true;

document.body.append(
  refTooltip,
);


function hideRefTooltip(): void {
  refTooltip.hidden =
    true;
}


function showRefTooltip(
  target: HTMLElement,
): void {
  const tooltipText =
    target.dataset
      .tip;

  if (!tooltipText) {
    return;
  }

  refTooltip.textContent =
    tooltipText;

  refTooltip.hidden =
    false;

  refTooltip.style.left =
    '0px';

  refTooltip.style.top =
    '0px';

  const targetRect =
    target
      .getBoundingClientRect();

  const tooltipRect =
    refTooltip
      .getBoundingClientRect();

  const edge =
    8;

  const gap =
    7;

  /*
   * Основная позиция:
   * строго по центру над знаком ?.
   */
  let x =
    targetRect.left +
    targetRect.width /
      2 -
    tooltipRect.width /
      2;

  let y =
    targetRect.top -
    tooltipRect.height -
    gap;

  /*
   * Если сверху места нет —
   * показываем строго под иконкой.
   */
  if (
    y <
    edge
  ) {
    y =
      targetRect.bottom +
      gap;
  }

  /*
   * Никогда не выходим
   * за левый / правый край окна.
   */
  x =
    Math.max(
      edge,
      Math.min(
        x,
        window.innerWidth -
          tooltipRect.width -
          edge,
      ),
    );

  /*
   * И за нижний край тоже.
   */
  y =
    Math.max(
      edge,
      Math.min(
        y,
        window.innerHeight -
          tooltipRect.height -
          edge,
      ),
    );

  refTooltip.style.left =
    `${Math.round(x)}px`;

  refTooltip.style.top =
    `${Math.round(y)}px`;
}


document.addEventListener(
  'pointerover',
  event => {
    const target =
      (
        event.target as
          HTMLElement |
          null
      )?.closest<HTMLElement>(
        '.help[data-tip]',
      );

    if (!target) {
      return;
    }

    showRefTooltip(
      target,
    );
  },
);


document.addEventListener(
  'pointerout',
  event => {
    const target =
      (
        event.target as
          HTMLElement |
          null
      )?.closest<HTMLElement>(
        '.help[data-tip]',
      );

    if (!target) {
      return;
    }

    hideRefTooltip();
  },
);


document.addEventListener(
  'focusin',
  event => {
    const target =
      (
        event.target as
          HTMLElement |
          null
      )?.closest<HTMLElement>(
        '.help[data-tip]',
      );

    if (
      target
    ) {
      showRefTooltip(
        target,
      );
    }
  },
);


document.addEventListener(
  'focusout',
  event => {
    if (
      (
        event.target as
          HTMLElement |
          null
      )?.closest(
        '.help[data-tip]',
      )
    ) {
      hideRefTooltip();
    }
  },
);


sync();
send({ type: 'refresh' });
send({ type: 'profiles-load' });


/* ==========================================================
   Edit tabs: Text / Layers / Images
   ========================================================== */

type EditMainTab =
  | 'export'
  | 'text'
  | 'layers'
  | 'images';


type EditTarget =
  | 'rename'
  | 'text'
  | 'images';


type RenamePreviewResult = {
  total: number;
  changed: number;
  skipped: number;

  examples:
    Array<{
      before: string;
      after: string;
    }>;
};


type TextPreviewResult = {
  textLayers: number;
  matchedLayers: number;
  matches: number;
  changedLayers: number;
  skippedLayers: number;

  examples:
    Array<{
      layer: string;
      before: string;
      after: string;
    }>;
};


type ImagePreviewResult = {
  nodes: number;
  images: number;
  optimizable: number;

  examples:
    Array<{
      layer: string;
      beforeWidth: number;
      beforeHeight: number;
      afterWidth: number;
      afterHeight: number;
    }>;
};


type RenameApplyResult = {
  total: number;
  changed: number;
  skipped: number;
};


type TextApplyResult = {
  textLayers: number;
  matchedLayers: number;
  matches: number;
  changedLayers: number;
  skippedLayers: number;
};


type ImageApplyResult = {
  nodes: number;
  modeChanges: number;
  optimized: number;
  skipped: number;
};


let editActiveTab:
  EditMainTab =
  'export';

let editSelectionCount =
  count;

let editAnchorX:
  0 | 0.5 | 1 =
  0.5;

let editAnchorY:
  0 | 0.5 | 1 =
  0.5;

let editRenameTimer:
  number |
  undefined;

let editTextTimer:
  number |
  undefined;

let editImagesTimer:
  number |
  undefined;

let editPendingTarget:
  EditTarget |
  null =
  null;


function editPanel(
  tab: EditMainTab,
): HTMLElement {
  return el<HTMLElement>(
    `tab-${tab}`,
  );
}


function editTabButton(
  tab: EditMainTab,
): HTMLButtonElement {
  return el<HTMLButtonElement>(
    `tab-button-${tab}`,
  );
}


function setEditButtonBusy(
  target: EditTarget,
  value: boolean,
): void {
  const ids:
    Record<
      EditTarget,
      string
    > = {
      rename:
        'rename-apply',

      text:
        'text-apply',

      images:
        'image-apply',
    };

  el<HTMLButtonElement>(
    ids[target],
  ).disabled =
    value;
}


function syncEditApplyButtons(): void {
  const rename =
    el<HTMLButtonElement>(
      'rename-apply',
    );

  const text =
    el<HTMLButtonElement>(
      'text-apply',
    );

  const images =
    el<HTMLButtonElement>(
      'image-apply',
    );

  if (
    editPendingTarget !==
    'rename'
  ) {
    rename.disabled =
      editSelectionCount ===
      0;
  }

  if (
    editPendingTarget !==
    'images'
  ) {
    images.disabled =
      editSelectionCount ===
      0;
  }

  if (
    editPendingTarget !==
    'text'
  ) {
    const scope =
      el<HTMLSelectElement>(
        'text-scope',
      ).value;

    text.disabled =
      scope === 'selection' &&
      editSelectionCount === 0;
  }
}


function setMainTab(
  tab: EditMainTab,
): void {
  editActiveTab =
    tab;

  for (
    const value
    of [
      'export',
      'text',
      'layers',
      'images',
    ] as const
  ) {
    editPanel(
      value,
    ).hidden =
      value !== tab;

    editTabButton(
      value,
    ).classList.toggle(
      'active',
      value === tab,
    );
  }

  document
    .querySelector<HTMLElement>(
      '.app',
    )
    ?.classList.toggle(
      'edit-mode',
      tab !== 'export',
    );

  syncEditApplyButtons();

  if (
    tab === 'text'
  ) {
    scheduleTextPreview();
  }

  if (
    tab === 'layers'
  ) {
    scheduleRenamePreview();
  }

  if (
    tab === 'images'
  ) {
    scheduleImagesPreview();
  }
}


function syncRenameMode(): void {
  const mode =
    el<HTMLSelectElement>(
      'rename-mode',
    ).value;

  document
    .querySelectorAll<HTMLElement>(
      '[data-rename-group]',
    )
    .forEach(
      group => {
        group.hidden =
          group.dataset
            .renameGroup !== mode;
      },
    );

  el<HTMLElement>(
    'rename-folder-settings',
  ).hidden =
    !el<HTMLInputElement>(
      'rename-folder-enabled',
    ).checked;
}


function syncImageControls(): void {
  const mode =
    el<HTMLSelectElement>(
      'image-mode',
    ).value;

  el<HTMLElement>(
    'image-anchor-section',
  ).hidden =
    mode !== 'FILL' &&
    mode !== 'CROP';

  el<HTMLElement>(
    'image-optimize-settings',
  ).hidden =
    !el<HTMLInputElement>(
      'image-optimize',
    ).checked;
}


function editInteger(
  id: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value =
    Math.round(
      Number(
        el<HTMLInputElement>(
          id,
        ).value,
      ),
    );

  if (
    !Number.isFinite(
      value,
    )
  ) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}



type RenameDependencyUi = {
  layerName: string;
  separator: string;
};


function renameDependencies():
  RenameDependencyUi[] {

  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-rename-dependency]',
    ),
  )
    .map(
      row => ({
        layerName:
          (
            row.querySelector(
              '[data-dependency-layer]',
            ) as
              HTMLInputElement |
              null
          )
            ?.value
            .trim() ??
          '',

        separator:
          (
            row.querySelector(
              '[data-dependency-separator]',
            ) as
              HTMLInputElement |
              null
          )
            ?.value ??
          '/',
      }),
    )
    .filter(
      dependency =>
        dependency
          .layerName
          .length >
        0,
    );
}


function createRenameDependencyRow(
  layerName = '',
  separator = '/',
): HTMLElement {

  const row =
    document.createElement(
      'div',
    );

  row.className =
    'rename-dependency-row';

  row.setAttribute(
    'data-rename-dependency',
    '',
  );


  const layer =
    document.createElement(
      'input',
    );

  layer.type =
    'text';

  layer.value =
    layerName;

  layer.placeholder =
    'Type';

  layer.setAttribute(
    'data-dependency-layer',
    '',
  );


  const separatorInput =
    document.createElement(
      'input',
    );

  separatorInput.type =
    'text';

  separatorInput.value =
    separator;

  separatorInput.maxLength =
    8;

  separatorInput.setAttribute(
    'data-dependency-separator',
    '',
  );


  const remove =
    document.createElement(
      'button',
    );

  remove.type =
    'button';

  remove.className =
    'rename-dependency-remove';

  remove.textContent =
    '×';

  remove.setAttribute(
    'data-dependency-remove',
    '',
  );


  row.append(
    layer,
    separatorInput,
    remove,
  );


  return row;
}


function initRenameDependencies():
  void {

  const container =
    document.getElementById(
      'rename-dependencies',
    );

  const add =
    document.getElementById(
      'rename-add-dependency',
    );


  if (
    !container ||
    !add
  ) {
    return;
  }


  if (
    add.dataset.bound ===
    'true'
  ) {
    return;
  }


  add.dataset.bound =
    'true';


  add.addEventListener(
    'click',
    () => {
      container.append(
        createRenameDependencyRow(),
      );

      scheduleRenamePreview();
    },
  );


  container.addEventListener(
    'click',
    event => {

      const target =
        event.target;

      if (
        !(
          target instanceof
          HTMLElement
        )
      ) {
        return;
      }


      const remove =
        target.closest(
          '[data-dependency-remove]',
        );

      if (!remove) {
        return;
      }


      remove.closest(
        '[data-rename-dependency]',
      )
        ?.remove();


      scheduleRenamePreview();
    },
  );


  container.addEventListener(
    'input',
    () => {
      scheduleRenamePreview();
    },
  );


  container.addEventListener(
    'change',
    () => {
      scheduleRenamePreview();
    },
  );
}


function renameOptions() {
  const dependencies =
    renameDependencies();

  return {
    mode:
      el<HTMLSelectElement>(
        'rename-mode',
      ).value as
        | 'replace'
        | 'prefix-suffix'
        | 'set'
        | 'number'
        | 'template'
        | 'by-layer',

    includeDescendants:
      el<HTMLInputElement>(
        'rename-include-descendants',
      ).checked,

    find:
      el<HTMLInputElement>(
        'rename-find',
      ).value,

    replace:
      el<HTMLInputElement>(
        'rename-replace',
      ).value,

    regex:
      el<HTMLInputElement>(
        'rename-regex',
      ).checked,

    caseSensitive:
      el<HTMLInputElement>(
        'rename-case-sensitive',
      ).checked,

    prefix:
      el<HTMLInputElement>(
        'rename-prefix',
      ).value,

    suffix:
      el<HTMLInputElement>(
        'rename-suffix',
      ).value,

    fullName:
      el<HTMLInputElement>(
        'rename-full-name',
      ).value,

    numberBase:
      el<HTMLInputElement>(
        'rename-number-base',
      ).value,

    numberStart:
      editInteger(
        'rename-number-start',
        1,
        -1000000,
        1000000,
      ),

    numberPad:
      editInteger(
        'rename-number-pad',
        2,
        1,
        12,
      ),

    template:
      el<HTMLInputElement>(
        'rename-template',
      ).value,

    sourceLayerName:
      el<HTMLInputElement>(
        'rename-source-layer-name',
      ).value,

    sourceDepth:
      el<HTMLSelectElement>(
        'rename-source-depth',
      ).value as
        | 'first'
        | 'any',

    missingSource:
      el<HTMLSelectElement>(
        'rename-missing-source',
      ).value as
        | 'skip'
        | 'keep',

    folderEnabled:
      dependencies.length >
      0,

    folderLayerName:
      JSON.stringify(
        dependencies,
      ),

    trim:
      el<HTMLInputElement>(
        'rename-trim',
      ).checked,

    collapseSpaces:
      el<HTMLInputElement>(
        'rename-collapse-spaces',
      ).checked,

    spaceMode:
      el<HTMLSelectElement>(
        'rename-space-mode',
      ).value as
        | 'keep'
        | 'dash'
        | 'underscore'
        | 'remove',

    slashMode:
      el<HTMLSelectElement>(
        'rename-slash-mode',
      ).value as
        | 'keep'
        | 'dash'
        | 'underscore'
        | 'remove',

    removeCharacters:
      el<HTMLInputElement>(
        'rename-remove-characters',
      ).value,

    finalPrefix:
      el<HTMLInputElement>(
        'rename-final-prefix',
      ).value,

    finalSuffix:
      el<HTMLInputElement>(
        'rename-final-suffix',
      ).value,

    caseMode:
      el<HTMLSelectElement>(
        'rename-case-mode',
      ).value as
        | 'keep'
        | 'lower'
        | 'upper'
        | 'capitalize',
  };
}


function textOptions() {
  return {
    scope:
      el<HTMLSelectElement>(
        'text-scope',
      ).value as
        | 'selection'
        | 'page'
        | 'document',

    find:
      el<HTMLTextAreaElement>(
        'text-find',
      ).value,

    replace:
      el<HTMLTextAreaElement>(
        'text-replace',
      ).value,

    regex:
      el<HTMLInputElement>(
        'text-regex',
      ).checked,

    caseSensitive:
      el<HTMLInputElement>(
        'text-case-sensitive',
      ).checked,

    wholeWord:
      el<HTMLInputElement>(
        'text-whole-word',
      ).checked,

    exactLayer:
      el<HTMLInputElement>(
        'text-exact-layer',
      ).checked,

    includeHidden:
      el<HTMLInputElement>(
        'text-include-hidden',
      ).checked,

    layerNameInclude:
      el<HTMLInputElement>(
        'text-layer-name-include',
      ).value,

    layerNameExclude:
      el<HTMLInputElement>(
        'text-layer-name-exclude',
      ).value,
  };
}


function imageOptions() {
  return {
    includeDescendants:
      el<HTMLInputElement>(
        'image-include-descendants',
      ).checked,

    mode:
      el<HTMLSelectElement>(
        'image-mode',
      ).value as
        | 'KEEP'
        | 'FIT'
        | 'FILL'
        | 'CROP'
        | 'TILE',

    anchorX:
      editAnchorX,

    anchorY:
      editAnchorY,

    optimize:
      el<HTMLInputElement>(
        'image-optimize',
      ).checked,

    optimizeScale:
      Number(
        el<HTMLSelectElement>(
          'image-optimize-scale',
        ).value,
      ) === 2
        ? 2 as const
        : 1 as const,
  };
}


function clearEditPreview(
  id: string,
  message: string,
): void {
  const target =
    el<HTMLElement>(
      id,
    );

  target.replaceChildren();

  const line =
    document.createElement(
      'div',
    );

  line.textContent =
    message;

  target.append(
    line,
  );
}


function addEditPreviewLine(
  target: HTMLElement,
  text: string,
  strong = false,
): void {
  const line =
    document.createElement(
      'div',
    );

  if (strong) {
    const element =
      document.createElement(
        'strong',
      );

    element.textContent =
      text;

    line.append(
      element,
    );
  } else {
    line.textContent =
      text;
  }

  target.append(
    line,
  );
}


function addEditExample(
  target: HTMLElement,
  before: string,
  after: string,
  label = '',
): void {
  const box =
    document.createElement(
      'div',
    );

  box.className =
    'edit-preview-example';

  if (label) {
    const title =
      document.createElement(
        'strong',
      );

    title.textContent =
      label;

    box.append(
      title,
    );

    box.append(
      document.createElement(
        'br',
      ),
    );
  }

  const beforeLine =
    document.createElement(
      'div',
    );

  beforeLine.textContent =
    `До: ${before}`;

  const afterLine =
    document.createElement(
      'div',
    );

  afterLine.textContent =
    `После: ${after}`;

  box.append(
    beforeLine,
    afterLine,
  );

  target.append(
    box,
  );
}


function renderRenamePreview(
  result:
    RenamePreviewResult,
): void {
  const target =
    el<HTMLElement>(
      'rename-preview',
    );

  target.replaceChildren();

  addEditPreviewLine(
    target,
    `Будет изменено: ${result.changed} из ${result.total}`,
    true,
  );

  if (
    result.skipped > 0
  ) {
    addEditPreviewLine(
      target,
      `Пропущено: ${result.skipped}`,
    );
  }

  for (
    const example
    of result.examples
  ) {
    addEditExample(
      target,
      example.before,
      example.after,
    );
  }

  if (
    result.changed === 0 &&
    result.skipped === 0
  ) {
    addEditPreviewLine(
      target,
      'Изменений нет.',
    );
  }
}


function renderTextPreview(
  result:
    TextPreviewResult,
): void {
  const target =
    el<HTMLElement>(
      'text-preview',
    );

  target.replaceChildren();

  addEditPreviewLine(
    target,
    `Совпадений: ${result.matches} · слоёв: ${result.matchedLayers} из ${result.textLayers}`,
    true,
  );

  for (
    const example
    of result.examples
  ) {
    addEditExample(
      target,
      example.before,
      example.after,
      example.layer,
    );
  }

  if (
    result.matches === 0
  ) {
    addEditPreviewLine(
      target,
      'Совпадений не найдено.',
    );
  }
}


function renderImagesPreview(
  result:
    ImagePreviewResult,
): void {
  const target =
    el<HTMLElement>(
      'image-preview',
    );

  target.replaceChildren();

  addEditPreviewLine(
    target,
    `IMAGE-заливок: ${result.images} · слоёв: ${result.nodes}`,
    true,
  );

  if (
    el<HTMLInputElement>(
      'image-optimize',
    ).checked
  ) {
    addEditPreviewLine(
      target,
      `Можно уменьшить bitmap: ${result.optimizable}`,
    );
  }

  for (
    const example
    of result.examples
  ) {
    addEditExample(
      target,

      `${example.beforeWidth}×${example.beforeHeight}px`,

      `${example.afterWidth}×${example.afterHeight}px`,

      example.layer,
    );
  }

  if (
    result.images === 0
  ) {
    addEditPreviewLine(
      target,
      'В выбранной области IMAGE-заливки не найдены.',
    );
  }
}


function requestRenamePreview(): void {
  if (
    editSelectionCount === 0
  ) {
    clearEditPreview(
      'rename-preview',
      'Выберите слой или несколько слоёв.',
    );

    return;
  }

  send({
    type:
      'edit-rename-preview',

    options:
      renameOptions(),
  });
}


function requestTextPreview(): void {
  const options =
    textOptions();

  if (
    options.scope ===
      'selection' &&
    editSelectionCount ===
      0
  ) {
    clearEditPreview(
      'text-preview',
      'Выберите слой или смените область поиска.',
    );

    return;
  }

  if (
    options.find.length ===
    0
  ) {
    clearEditPreview(
      'text-preview',
      'Введите текст для поиска.',
    );

    return;
  }

  send({
    type:
      'edit-text-preview',

    options,
  });
}


function requestImagesPreview(): void {
  if (
    editSelectionCount === 0
  ) {
    clearEditPreview(
      'image-preview',
      'Выберите слой с IMAGE-заливкой или фрейм.',
    );

    return;
  }

  send({
    type:
      'edit-images-preview',

    options:
      imageOptions(),
  });
}


function scheduleRenamePreview(): void {
  if (
    editRenameTimer !==
    undefined
  ) {
    window.clearTimeout(
      editRenameTimer,
    );
  }

  editRenameTimer =
    window.setTimeout(
      () => {
        editRenameTimer =
          undefined;

        if (
          editActiveTab ===
          'layers'
        ) {
          requestRenamePreview();
        }
      },
      180,
    );
}


function scheduleTextPreview(): void {
  if (
    editTextTimer !==
    undefined
  ) {
    window.clearTimeout(
      editTextTimer,
    );
  }

  editTextTimer =
    window.setTimeout(
      () => {
        editTextTimer =
          undefined;

        if (
          editActiveTab ===
          'text'
        ) {
          requestTextPreview();
        }
      },
      180,
    );
}


function scheduleImagesPreview(): void {
  if (
    editImagesTimer !==
    undefined
  ) {
    window.clearTimeout(
      editImagesTimer,
    );
  }

  editImagesTimer =
    window.setTimeout(
      () => {
        editImagesTimer =
          undefined;

        if (
          editActiveTab ===
          'images'
        ) {
          requestImagesPreview();
        }
      },
      180,
    );
}


for (
  const tab
  of [
    'export',
    'text',
    'layers',
    'images',
  ] as const
) {
  editTabButton(
    tab,
  ).addEventListener(
    'click',
    () => {
      setMainTab(
        tab,
      );
    },
  );
}


el<HTMLSelectElement>(
  'rename-mode',
).addEventListener(
  'change',
  () => {
    syncRenameMode();
    scheduleRenamePreview();
  },
);


el<HTMLInputElement>(
  'rename-folder-enabled',
).addEventListener(
  'change',
  () => {
    syncRenameMode();
    scheduleRenamePreview();
  },
);


document
  .querySelectorAll<
    HTMLInputElement |
    HTMLSelectElement
  >(
    '#tab-layers [id^="rename-"]',
  )
  .forEach(
    control => {
      if (
        control.id ===
          'rename-mode' ||
        control.id ===
          'rename-folder-enabled' ||
        control.id ===
          'rename-apply'
      ) {
        return;
      }

      control.addEventListener(
        'input',
        scheduleRenamePreview,
      );

      control.addEventListener(
        'change',
        scheduleRenamePreview,
      );
    },
  );


document
  .querySelectorAll<
    HTMLInputElement |
    HTMLSelectElement |
    HTMLTextAreaElement
  >(
    '#tab-text [id^="text-"]',
  )
  .forEach(
    control => {
      if (
        control.id ===
        'text-apply'
      ) {
        return;
      }

      control.addEventListener(
        'input',
        () => {
          syncEditApplyButtons();
          scheduleTextPreview();
        },
      );

      control.addEventListener(
        'change',
        () => {
          syncEditApplyButtons();
          scheduleTextPreview();
        },
      );
    },
  );


document
  .querySelectorAll<HTMLButtonElement>(
    '[data-token-target]',
  )
  .forEach(
    button => {
      button.addEventListener(
        'click',
        () => {
          const targetId =
            button.dataset
              .tokenTarget;

          const token =
            button.dataset
              .token ??
            '';

          if (!targetId) {
            return;
          }

          const target =
            el<HTMLTextAreaElement>(
              targetId,
            );

          const start =
            target.selectionStart ??
            target.value.length;

          const end =
            target.selectionEnd ??
            start;

          target.value =
            target.value.slice(
              0,
              start,
            ) +
            token +
            target.value.slice(
              end,
            );

          const cursor =
            start +
            token.length;

          target.focus();

          target.setSelectionRange(
            cursor,
            cursor,
          );

          target.dispatchEvent(
            new Event(
              'input',
              {
                bubbles:
                  true,
              },
            ),
          );
        },
      );
    },
  );


el<HTMLSelectElement>(
  'image-mode',
).addEventListener(
  'change',
  () => {
    syncImageControls();
    scheduleImagesPreview();
  },
);


el<HTMLInputElement>(
  'image-optimize',
).addEventListener(
  'change',
  () => {
    syncImageControls();
    scheduleImagesPreview();
  },
);


document
  .querySelectorAll<
    HTMLInputElement |
    HTMLSelectElement
  >(
    '#tab-images [id^="image-"]',
  )
  .forEach(
    control => {
      if (
        control.id ===
          'image-mode' ||
        control.id ===
          'image-optimize' ||
        control.id ===
          'image-apply'
      ) {
        return;
      }

      control.addEventListener(
        'input',
        scheduleImagesPreview,
      );

      control.addEventListener(
        'change',
        scheduleImagesPreview,
      );
    },
  );


document
  .querySelectorAll<HTMLButtonElement>(
    '.anchor-button',
  )
  .forEach(
    button => {
      button.addEventListener(
        'click',
        () => {
          const x =
            Number(
              button.dataset
                .anchorX,
            );

          const y =
            Number(
              button.dataset
                .anchorY,
            );

          if (
            x !== 0 &&
            x !== 0.5 &&
            x !== 1
          ) {
            return;
          }

          if (
            y !== 0 &&
            y !== 0.5 &&
            y !== 1
          ) {
            return;
          }

          editAnchorX =
            x;

          editAnchorY =
            y;

          document
            .querySelectorAll<HTMLButtonElement>(
              '.anchor-button',
            )
            .forEach(
              item => {
                item.classList.toggle(
                  'active',
                  item === button,
                );
              },
            );

          scheduleImagesPreview();
        },
      );
    },
  );


el<HTMLButtonElement>(
  'rename-apply',
).addEventListener(
  'click',
  () => {
    if (
      editSelectionCount ===
      0
    ) {
      return;
    }

    editPendingTarget =
      'rename';

    setEditButtonBusy(
      'rename',
      true,
    );

    send({
      type:
        'edit-rename-apply',

      options:
        renameOptions(),
    });
  },
);


el<HTMLButtonElement>(
  'text-apply',
).addEventListener(
  'click',
  () => {
    const options =
      textOptions();

    if (
      !options.find
    ) {
      clearEditPreview(
        'text-preview',
        'Введите текст для поиска.',
      );

      return;
    }

    if (
      options.scope ===
        'selection' &&
      editSelectionCount ===
        0
    ) {
      return;
    }

    editPendingTarget =
      'text';

    setEditButtonBusy(
      'text',
      true,
    );

    send({
      type:
        'edit-text-apply',

      options,
    });
  },
);


el<HTMLButtonElement>(
  'image-apply',
).addEventListener(
  'click',
  () => {
    if (
      editSelectionCount ===
      0
    ) {
      return;
    }

    editPendingTarget =
      'images';

    setEditButtonBusy(
      'images',
      true,
    );

    send({
      type:
        'edit-images-apply',

      options:
        imageOptions(),
    });
  },
);


window.addEventListener(
  'message',
  (
    event:
      MessageEvent<unknown>,
  ) => {
    if (
      !event.data ||
      typeof event.data !==
        'object'
    ) {
      return;
    }

    const envelope =
      event.data as {
        pluginMessage?:
          unknown;
      };

    if (
      !envelope.pluginMessage ||
      typeof envelope.pluginMessage !==
        'object'
    ) {
      return;
    }

    const message =
      envelope.pluginMessage as {
        type?:
          unknown;

        target?:
          unknown;

        message?:
          unknown;

        result?:
          unknown;

        count?:
          unknown;
      };

    if (
      typeof message.type !==
      'string'
    ) {
      return;
    }


    if (
      message.type ===
      'selection'
    ) {
      if (
        typeof message.count ===
        'number'
      ) {
        editSelectionCount =
          message.count;

        syncEditApplyButtons();

        if (
          editActiveTab ===
          'text'
        ) {
          scheduleTextPreview();
        }

        if (
          editActiveTab ===
          'layers'
        ) {
          scheduleRenamePreview();
        }

        if (
          editActiveTab ===
          'images'
        ) {
          scheduleImagesPreview();
        }
      }

      return;
    }


    if (
      message.type ===
      'edit-rename-preview-result'
    ) {
      renderRenamePreview(
        message.result as
          RenamePreviewResult,
      );

      return;
    }


    if (
      message.type ===
      'edit-text-preview-result'
    ) {
      renderTextPreview(
        message.result as
          TextPreviewResult,
      );

      return;
    }


    if (
      message.type ===
      'edit-images-preview-result'
    ) {
      renderImagesPreview(
        message.result as
          ImagePreviewResult,
      );

      return;
    }


    if (
      message.type ===
        'edit-preview-error'
    ) {
      const text =
        typeof message.message ===
          'string'
          ? message.message
          : 'Ошибка предпросмотра.';

      if (
        message.target ===
        'rename'
      ) {
        clearEditPreview(
          'rename-preview',
          text,
        );
      }

      if (
        message.target ===
        'text'
      ) {
        clearEditPreview(
          'text-preview',
          text,
        );
      }

      if (
        message.target ===
        'images'
      ) {
        clearEditPreview(
          'image-preview',
          text,
        );
      }

      return;
    }


    if (
      message.type ===
      'edit-action-error'
    ) {
      const target =
        message.target;

      if (
        target === 'rename' ||
        target === 'text' ||
        target === 'images'
      ) {
        editPendingTarget =
          null;

        setEditButtonBusy(
          target,
          false,
        );

        syncEditApplyButtons();

        const text =
          typeof message.message ===
            'string'
            ? message.message
            : 'Ошибка операции.';

        if (
          target === 'rename'
        ) {
          clearEditPreview(
            'rename-preview',
            text,
          );
        }

        if (
          target === 'text'
        ) {
          clearEditPreview(
            'text-preview',
            text,
          );
        }

        if (
          target === 'images'
        ) {
          clearEditPreview(
            'image-preview',
            text,
          );
        }
      }

      return;
    }


    if (
      message.type ===
      'edit-action-result'
    ) {
      const target =
        message.target;

      if (
        target !== 'rename' &&
        target !== 'text' &&
        target !== 'images'
      ) {
        return;
      }

      editPendingTarget =
        null;

      setEditButtonBusy(
        target,
        false,
      );

      syncEditApplyButtons();


      if (
        target === 'rename'
      ) {
        const result =
          message.result as
            RenameApplyResult;

        clearEditPreview(
          'rename-preview',
          `Готово. Переименовано: ${result.changed}. Пропущено: ${result.skipped}.`,
        );

        window.setTimeout(
          scheduleRenamePreview,
          120,
        );

        return;
      }


      if (
        target === 'text'
      ) {
        const result =
          message.result as
            TextApplyResult;

        clearEditPreview(
          'text-preview',
          `Готово. Изменено текстовых слоёв: ${result.changedLayers}. Замен: ${result.matches}. Пропущено: ${result.skippedLayers}.`,
        );

        window.setTimeout(
          scheduleTextPreview,
          120,
        );

        return;
      }


      const result =
        message.result as
          ImageApplyResult;

      clearEditPreview(
        'image-preview',
        `Готово. Режим изменён у IMAGE-заливок: ${result.modeChanges}. Bitmap уменьшено: ${result.optimized}. Пропущено: ${result.skipped}.`,
      );

      window.setTimeout(
        scheduleImagesPreview,
        120,
      );
    }
  },
);


syncRenameMode();
syncImageControls();
syncEditApplyButtons();
setMainTab(
  'export',
);


initI18n();


initRenameDependencies();


function initSupportDonationMenu():
  void {

  const button =
    document.getElementById(
      'thanks-button',
    );

  const modal =
    document.getElementById(
      'thanks-modal',
    );

  const close =
    document.getElementById(
      'thanks-close',
    );

  const copy =
    document.getElementById(
      'thanks-ton-copy',
    ) as
      HTMLButtonElement |
      null;


  if (
    !button ||
    !modal ||
    !close
  ) {
    return;
  }


  if (
    button.dataset
      .supportMenuBound ===
    'true'
  ) {
    return;
  }


  button.dataset
    .supportMenuBound =
    'true';


  const openModal =
    () => {
      modal.hidden =
        false;
    };


  const closeModal =
    () => {
      modal.hidden =
        true;
    };


  button.addEventListener(
    'click',
    openModal,
  );


  close.addEventListener(
    'click',
    closeModal,
  );


  modal.addEventListener(
    'click',
    event => {

      if (
        event.target ===
        modal
      ) {
        closeModal();
      }
    },
  );


  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key ===
          'Escape' &&
        !modal.hidden
      ) {
        closeModal();
      }
    },
  );


  if (copy) {

    copy.addEventListener(
      'click',
      async () => {

        const address =
          'UQAIHIGV_89kVbDBvN5RRjWi8qAhmAFUZHgtCykVApLagldZ';


        let copied =
          false;


        try {

          if (
            navigator.clipboard &&
            navigator.clipboard
              .writeText
          ) {

            await navigator
              .clipboard
              .writeText(
                address,
              );


            copied =
              true;
          }

        } catch {
          // Use fallback below.
        }


        if (!copied) {

          const textarea =
            document.createElement(
              'textarea',
            );


          textarea.value =
            address;


          textarea.style.position =
            'fixed';

          textarea.style.left =
            '-9999px';

          textarea.style.top =
            '0';


          document.body.append(
            textarea,
          );


          textarea.focus();
          textarea.select();


          try {
            copied =
              document.execCommand(
                'copy',
              );
          } catch {
            copied =
              false;
          }


          textarea.remove();
        }


        if (!copied) {
          return;
        }


        const currentLanguage =
          document
            .documentElement
            .lang;


        copy.textContent =
          currentLanguage ===
            'en'
            ? 'Copied'
            : 'Скопировано';


        window.setTimeout(
          () => {

            copy.textContent =
              document
                .documentElement
                .lang ===
                'en'
                ? 'Copy'
                : 'Скопировать';

          },
          1400,
        );
      },
    );
  }
}


/* === SUPPORT MENU INIT START === */

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      initSupportDonationMenu();
    },
    {
      once:
        true,
    },
  );
} else {
  initSupportDonationMenu();
}

/* === SUPPORT MENU INIT END === */

