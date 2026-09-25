export type ExportOptions = {
  format: 'SVG' | 'PDF';
  colorMode: 'RGB' | 'CMYK';
  outlineText: boolean;

  printLayerEnabled: boolean;
  printLayerName: string;

  printSpotEnabled: boolean;
  printSpotName: string;

  printOverprint: boolean;
  printStrokeWidth: number;
  printMinDpi: number;

  printOptimizeImages: boolean;

  printFrameSizeEnabled: boolean;

  printFinalSizeEnabled: boolean;
  printFinalWidth: number;
  printFinalHeight: number;
  printFinalLockRatio: boolean;

  printScaleEnabled: boolean;
  printScale: number;
};


export type RenameOptions = {
  mode:
    | 'replace'
    | 'prefix-suffix'
    | 'set'
    | 'number'
    | 'template'
    | 'by-layer';

  includeDescendants: boolean;

  find: string;
  replace: string;
  regex: boolean;
  caseSensitive: boolean;

  prefix: string;
  suffix: string;
  fullName: string;

  numberBase: string;
  numberStart: number;
  numberPad: number;

  template: string;

  sourceLayerName: string;
  sourceDepth: 'first' | 'any';
  missingSource: 'skip' | 'keep';

  folderEnabled: boolean;
  folderLayerName: string;

  trim: boolean;
  collapseSpaces: boolean;

  spaceMode:
    | 'keep'
    | 'dash'
    | 'underscore'
    | 'remove';

  slashMode:
    | 'keep'
    | 'dash'
    | 'underscore'
    | 'remove';

  removeCharacters: string;

  finalPrefix: string;
  finalSuffix: string;

  caseMode:
    | 'keep'
    | 'lower'
    | 'upper'
    | 'capitalize';
};


export type TextReplaceOptions = {
  scope:
    | 'selection'
    | 'page'
    | 'document';

  find: string;
  replace: string;

  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  exactLayer: boolean;

  includeHidden: boolean;

  layerNameInclude: string;
  layerNameExclude: string;
};


export type ImageEditOptions = {
  includeDescendants: boolean;

  mode:
    | 'KEEP'
    | 'FIT'
    | 'FILL'
    | 'CROP'
    | 'TILE';

  anchorX: 0 | 0.5 | 1;
  anchorY: 0 | 0.5 | 1;

  optimize: boolean;
  optimizeScale: 1 | 2;
};


export type UiMessage =
  | { type: 'profiles-load' }
  | {
      type: 'profiles-save';
      profiles: Array<{
        name: string;
        base64: string;
      }>;
    }
  | { type: 'refresh' }
  | { type: 'edit-rename-preview'; options: RenameOptions }
  | { type: 'edit-rename-apply'; options: RenameOptions }
  | { type: 'edit-text-preview'; options: TextReplaceOptions }
  | { type: 'edit-text-apply'; options: TextReplaceOptions }
  | { type: 'edit-images-preview'; options: ImageEditOptions }
  | { type: 'edit-images-apply'; options: ImageEditOptions }
  | { type: 'close' }
  | { type: 'open-helper' }
  | { type: 'helper-installed' }
  | { type: 'preview-node'; id: string }
  | { type: 'remove-selection-node'; id: string }
  | { type: 'preview-node-end' }
  | {
      type: 'resize-image-response';
      requestId: number;
      ok: boolean;
      bytes?: Uint8Array;
      message?: string;
    }
  | { type: 'export'; options: ExportOptions }
  | {
      type: 'export-file-ack';
      index: number;
      ok: boolean;
      message?: string;
    };

export type ExportedFile = {
  name: string;
  bytes: Uint8Array;
  mime: 'image/svg+xml' | 'application/pdf';
  textSvgBytes?: Uint8Array;
  rezkaSvgBytes?: Uint8Array;

  warning?: string;

  sourceWidth?: number;
  sourceHeight?: number;
};

export type PluginMessage =
  | {
      type: 'selection';
      count: number;
      names: string[];
      ids: string[];
      frameWidth: number | null;
      frameHeight: number | null;
    }
  | {
      type: 'resize-image-request';
      requestId: number;
      bytes: Uint8Array;
      targetWidth: number;
      targetHeight: number;
    }
  | {
      type: 'progress';
      completed: number;
      total: number;
    }
  | {
      type: 'exported-file';
      file: ExportedFile;
      index: number;
      total: number;
      options: ExportOptions;
    }
  | {
      type: 'export-complete';
      total: number;
      options: ExportOptions;
    }
  | {
      type: 'helper-state';
      installed: boolean;
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'warning';
      message: string;
    };

export function isExportOptions(
  value: unknown,
): value is ExportOptions {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false;
  }

  const v =
    value as Partial<ExportOptions>;

  return (
    (
      v.format === 'SVG' ||
      v.format === 'PDF'
    ) &&
    (
      v.colorMode === 'RGB' ||
      v.colorMode === 'CMYK'
    ) &&
    typeof v.outlineText ===
      'boolean' &&

    typeof v.printLayerEnabled ===
      'boolean' &&
    typeof v.printLayerName ===
      'string' &&
    v.printLayerName.length <= 64 &&

    typeof v.printSpotEnabled ===
      'boolean' &&
    typeof v.printSpotName ===
      'string' &&
    v.printSpotName.length <= 64 &&

    typeof v.printOverprint ===
      'boolean' &&

    typeof v.printStrokeWidth ===
      'number' &&
    Number.isFinite(
      v.printStrokeWidth,
    ) &&
    v.printStrokeWidth >= 0.01 &&
    v.printStrokeWidth <= 10 &&

    typeof v.printMinDpi ===
      'number' &&
    Number.isFinite(
      v.printMinDpi,
    ) &&
    v.printMinDpi >= 72 &&
    v.printMinDpi <= 2400 &&

    typeof v.printOptimizeImages ===
      'boolean' &&

    typeof v.printFrameSizeEnabled ===
      'boolean' &&

    typeof v.printFinalSizeEnabled ===
      'boolean' &&
    typeof v.printFinalWidth ===
      'number' &&
    Number.isFinite(
      v.printFinalWidth,
    ) &&
    typeof v.printFinalHeight ===
      'number' &&
    Number.isFinite(
      v.printFinalHeight,
    ) &&
    typeof v.printFinalLockRatio ===
      'boolean' &&

    typeof v.printScaleEnabled ===
      'boolean' &&
    typeof v.printScale ===
      'number' &&
    Number.isFinite(
      v.printScale,
    ) &&
    (
      !v.printScaleEnabled ||
      (
        v.printScale >= 0.01 &&
        v.printScale <= 100
      )
    ) &&

    !(
      v.printFrameSizeEnabled &&
      v.printFinalSizeEnabled
    ) &&

    (
      !v.printScaleEnabled ||
      v.printFrameSizeEnabled ||
      v.printFinalSizeEnabled
    ) &&

    (
      !v.printFinalSizeEnabled ||
      (
        v.printFinalWidth >= 1 &&
        v.printFinalWidth <= 10000 &&
        v.printFinalHeight >= 1 &&
        v.printFinalHeight <= 10000
      )
    ) &&

    (
      !v.printLayerEnabled ||
      v.printLayerName
        .trim()
        .length > 0
    ) &&

    (
      !v.printSpotEnabled ||
      v.printSpotName
        .trim()
        .length > 0
    )
  );
}

function isExportedFile(
  value: unknown,
): value is ExportedFile {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false;
  }

  const file =
    value as Partial<ExportedFile>;

  return (
    typeof file.name === 'string' &&
    file.bytes instanceof
      Uint8Array &&
    (
      file.mime ===
        'image/svg+xml' ||
      file.mime ===
        'application/pdf'
    ) &&
    (
      file.textSvgBytes ===
        undefined ||
      file.textSvgBytes instanceof
        Uint8Array
    ) &&
    (
      file.rezkaSvgBytes ===
        undefined ||
      file.rezkaSvgBytes instanceof
        Uint8Array
    )
    &&
    (
      file.warning ===
        undefined ||
      (
        typeof file.warning ===
          'string' &&
        file.warning.length <=
          500
      )
    )
 &&
    (
      file.sourceWidth ===
        undefined ||
      (
        typeof file.sourceWidth ===
          'number' &&
        Number.isFinite(
          file.sourceWidth,
        ) &&
        file.sourceWidth > 0
      )
    ) &&
    (
      file.sourceHeight ===
        undefined ||
      (
        typeof file.sourceHeight ===
          'number' &&
        Number.isFinite(
          file.sourceHeight,
        ) &&
        file.sourceHeight > 0
      )
    )
  );
}


function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value === 'object',
  );
}


function isShortString(
  value: unknown,
  max = 5000,
): value is string {
  return (
    typeof value === 'string' &&
    value.length <= max
  );
}


function isRenameOptions(
  value: unknown,
): value is RenameOptions {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    (
      value.mode === 'replace' ||
      value.mode === 'prefix-suffix' ||
      value.mode === 'set' ||
      value.mode === 'number' ||
      value.mode === 'template' ||
      value.mode === 'by-layer'
    ) &&

    typeof value.includeDescendants === 'boolean' &&

    isShortString(value.find) &&
    isShortString(value.replace) &&
    typeof value.regex === 'boolean' &&
    typeof value.caseSensitive === 'boolean' &&

    isShortString(value.prefix, 1000) &&
    isShortString(value.suffix, 1000) &&
    isShortString(value.fullName) &&

    isShortString(value.numberBase, 1000) &&
    Number.isSafeInteger(value.numberStart) &&
    Number(value.numberStart) >= -1000000 &&
    Number(value.numberStart) <= 1000000 &&
    Number.isSafeInteger(value.numberPad) &&
    Number(value.numberPad) >= 1 &&
    Number(value.numberPad) <= 12 &&

    isShortString(value.template) &&

    isShortString(value.sourceLayerName, 500) &&
    (
      value.sourceDepth === 'first' ||
      value.sourceDepth === 'any'
    ) &&
    (
      value.missingSource === 'skip' ||
      value.missingSource === 'keep'
    ) &&

    typeof value.folderEnabled === 'boolean' &&
    isShortString(value.folderLayerName, 500) &&

    typeof value.trim === 'boolean' &&
    typeof value.collapseSpaces === 'boolean' &&

    (
      value.spaceMode === 'keep' ||
      value.spaceMode === 'dash' ||
      value.spaceMode === 'underscore' ||
      value.spaceMode === 'remove'
    ) &&

    (
      value.slashMode === 'keep' ||
      value.slashMode === 'dash' ||
      value.slashMode === 'underscore' ||
      value.slashMode === 'remove'
    ) &&

    isShortString(value.removeCharacters, 1000) &&
    isShortString(value.finalPrefix, 1000) &&
    isShortString(value.finalSuffix, 1000) &&

    (
      value.caseMode === 'keep' ||
      value.caseMode === 'lower' ||
      value.caseMode === 'upper' ||
      value.caseMode === 'capitalize'
    )
  );
}


function isTextReplaceOptions(
  value: unknown,
): value is TextReplaceOptions {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    (
      value.scope === 'selection' ||
      value.scope === 'page' ||
      value.scope === 'document'
    ) &&

    isShortString(value.find) &&
    isShortString(value.replace) &&

    typeof value.regex === 'boolean' &&
    typeof value.caseSensitive === 'boolean' &&
    typeof value.wholeWord === 'boolean' &&
    typeof value.exactLayer === 'boolean' &&
    typeof value.includeHidden === 'boolean' &&

    isShortString(value.layerNameInclude, 500) &&
    isShortString(value.layerNameExclude, 500)
  );
}


function isImageEditOptions(
  value: unknown,
): value is ImageEditOptions {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.includeDescendants === 'boolean' &&

    (
      value.mode === 'KEEP' ||
      value.mode === 'FIT' ||
      value.mode === 'FILL' ||
      value.mode === 'CROP' ||
      value.mode === 'TILE'
    ) &&

    (
      value.anchorX === 0 ||
      value.anchorX === 0.5 ||
      value.anchorX === 1
    ) &&

    (
      value.anchorY === 0 ||
      value.anchorY === 0.5 ||
      value.anchorY === 1
    ) &&

    typeof value.optimize === 'boolean' &&

    (
      value.optimizeScale === 1 ||
      value.optimizeScale === 2
    )
  );
}


export function isUiMessage(
  value: unknown,
): value is UiMessage {
  if (
    !value ||
    typeof value !== 'object' ||
    !('type' in value)
  ) {
    return false;
  }

  const v =
    value as Record<string, unknown>;

  if (
    v.type === 'refresh' ||
    v.type === 'profiles-load' ||
    v.type === 'close' ||
    v.type === 'open-helper' ||
    v.type === 'helper-installed' ||
    v.type === 'preview-node-end'
  ) {
    return true;
  }

  if (
    v.type === 'edit-rename-preview' ||
    v.type === 'edit-rename-apply'
  ) {
    return (
      'options' in v &&
      isRenameOptions(v.options)
    );
  }


  if (
    v.type === 'edit-text-preview' ||
    v.type === 'edit-text-apply'
  ) {
    return (
      'options' in v &&
      isTextReplaceOptions(v.options)
    );
  }


  if (
    v.type === 'edit-images-preview' ||
    v.type === 'edit-images-apply'
  ) {
    return (
      'options' in v &&
      isImageEditOptions(v.options)
    );
  }


  if (
    v.type ===
      'profiles-save'
  ) {
    return (
      Array.isArray(
        v.profiles,
      ) &&
      v.profiles.length <=
        8 &&
      v.profiles.every(
        item => {
          if (
            !item ||
            typeof item !==
              'object'
          ) {
            return false;
          }

          const profile =
            item as Record<
              string,
              unknown
            >;

          return (
            typeof profile.name ===
              'string' &&
            profile.name.length >=
              1 &&
            profile.name.length <=
              255 &&
            typeof profile.base64 ===
              'string' &&
            profile.base64.length <=
              6000000
          );
        },
      )
    );
  }


  if (
    v.type ===
      'resize-image-response'
  ) {
    return (
      Number.isSafeInteger(
        v.requestId,
      ) &&
      Number(v.requestId) >= 1 &&
      typeof v.ok ===
        'boolean' &&
      (
        v.bytes === undefined ||
        v.bytes instanceof
          Uint8Array
      ) &&
      (
        v.message === undefined ||
        typeof v.message ===
          'string'
      ) &&
      (
        v.ok === false ||
        v.bytes instanceof
          Uint8Array
      )
    );
  }

  if (
    v.type ===
      'preview-node' ||
    v.type ===
      'remove-selection-node'
  ) {
    return (
      typeof v.id ===
        'string' &&
      v.id.length > 0 &&
      v.id.length <= 500
    );
  }

  if (
    v.type ===
      'export-file-ack'
  ) {
    return (
      Number.isSafeInteger(
        v.index,
      ) &&
      Number(v.index) >= 1 &&
      typeof v.ok === 'boolean' &&
      (
        v.message === undefined ||
        typeof v.message ===
          'string'
      )
    );
  }

  return (
    v.type === 'export' &&
    'options' in v &&
    isExportOptions(
      v.options,
    )
  );
}

export function isPluginMessage(
  value: unknown,
): value is PluginMessage {
  if (
    !value ||
    typeof value !== 'object' ||
    !('type' in value)
  ) {
    return false;
  }

  const v =
    value as Record<string, unknown>;

  if (
    v.type === 'selection'
  ) {
    const validSize =
      (
        v.frameWidth === null ||
        (
          typeof v.frameWidth ===
            'number' &&
          Number.isFinite(
            v.frameWidth,
          ) &&
          v.frameWidth > 0
        )
      ) &&
      (
        v.frameHeight === null ||
        (
          typeof v.frameHeight ===
            'number' &&
          Number.isFinite(
            v.frameHeight,
          ) &&
          v.frameHeight > 0
        )
      );

    return (
      Number.isSafeInteger(
        v.count,
      ) &&
      Number(v.count) >= 0 &&
      Array.isArray(
        v.names,
      ) &&
      v.names.every(
        name =>
          typeof name ===
            'string' &&
          name.length <=
            500,
      ) &&
      Array.isArray(
        v.ids,
      ) &&
      v.ids.length ===
        v.names.length &&
      v.ids.every(
        id =>
          typeof id ===
            'string' &&
          id.length > 0 &&
          id.length <= 500,
      ) &&
      validSize
    );
  }

  if (
    v.type ===
      'resize-image-request'
  ) {
    return (
      Number.isSafeInteger(
        v.requestId,
      ) &&
      Number(v.requestId) >= 1 &&
      v.bytes instanceof
        Uint8Array &&
      typeof v.targetWidth ===
        'number' &&
      Number.isFinite(
        v.targetWidth,
      ) &&
      v.targetWidth >= 1 &&
      v.targetWidth <= 32768 &&
      typeof v.targetHeight ===
        'number' &&
      Number.isFinite(
        v.targetHeight,
      ) &&
      v.targetHeight >= 1 &&
      v.targetHeight <= 32768
    );
  }

  if (
    v.type === 'progress'
  ) {
    return (
      Number.isSafeInteger(
        v.completed,
      ) &&
      Number.isSafeInteger(
        v.total,
      )
    );
  }

  if (
    v.type === 'helper-state'
  ) {
    return typeof v.installed ===
      'boolean';
  }

  if (
    v.type === 'error'
  ) {
    return typeof v.message ===
      'string';
  }


  if (
    v.type === 'warning'
  ) {
    return (
      typeof v.message ===
        'string' &&
      v.message.length <=
        1000
    );
  }

  if (
    v.type === 'exported-file'
  ) {
    return (
      isExportOptions(
        v.options,
      ) &&
      isExportedFile(
        v.file,
      ) &&
      Number.isSafeInteger(
        v.index,
      ) &&
      Number(v.index) >= 1 &&
      Number.isSafeInteger(
        v.total,
      ) &&
      Number(v.total) >=
        Number(v.index)
    );
  }

  if (
    v.type === 'export-complete'
  ) {
    return (
      isExportOptions(
        v.options,
      ) &&
      Number.isSafeInteger(
        v.total,
      ) &&
      Number(v.total) >= 0
    );
  }

  return false;
}
