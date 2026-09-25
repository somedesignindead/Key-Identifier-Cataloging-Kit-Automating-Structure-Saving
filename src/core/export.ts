import type { ExportedFile, ExportOptions } from '../shared/messages';

export function selectionRoots(
  selection: readonly SceneNode[],
): SceneNode[] {
  const ids = new Set(
    selection.map(node => node.id),
  );

  return selection.filter(node => {
    let parent = node.parent;

    while (parent) {
      if (ids.has(parent.id)) {
        return false;
      }

      parent = parent.parent;
    }

    return true;
  });
}

export function uniqueName(
  name: string,
  extension: string,
  used: Set<string>,
): string {
  const stem =
    name
      .replace(
        /[<>:"/\\|?*\x00-\x1f]/g,
        '_',
      )
      .replace(/[. ]+$/g, '')
      .trim()
      .slice(0, 100) ||
    'layer';

  const safe =
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(
      stem,
    )
      ? `_${stem}`
      : stem;

  let candidate =
    `${safe}.${extension}`;

  let suffix = 2;

  while (
    used.has(
      candidate.toLowerCase(),
    )
  ) {
    candidate =
      `${safe}-${suffix++}.${extension}`;
  }

  used.add(
    candidate.toLowerCase(),
  );

  return candidate;
}

function decodeXmlEntities(
  value: string,
): string {
  return value
    .replace(
      /&#x([0-9a-f]+);/gi,
      (
        _match,
        hex: string,
      ) => {
        const code =
          parseInt(
            hex,
            16,
          );

        return String.fromCharCode(
          code,
        );
      },
    )
    .replace(
      /&#([0-9]+);/g,
      (
        _match,
        dec: string,
      ) => {
        const code =
          parseInt(
            dec,
            10,
          );

        return String.fromCharCode(
          code,
        );
      },
    )
    .replace(
      /&quot;/g,
      '"',
    )
    .replace(
      /&apos;/g,
      "'",
    )
    .replace(
      /&lt;/g,
      '<',
    )
    .replace(
      /&gt;/g,
      '>',
    )
    .replace(
      /&amp;/g,
      '&',
    );
}

function decodeUtf8Mojibake(
  value: string,
): string {
  const bytes: number[] = [];

  let hasUtf8LeadByte =
    false;

  for (
    let i = 0;
    i < value.length;
    i++
  ) {
    const code =
      value.charCodeAt(i);

    if (code > 255) {
      return value;
    }

    if (
      code >= 0xc2 &&
      code <= 0xf4
    ) {
      hasUtf8LeadByte =
        true;
    }

    bytes.push(code);
  }

  if (!hasUtf8LeadByte) {
    return value;
  }

  let result = '';

  for (
    let i = 0;
    i < bytes.length;
  ) {
    const b1 = bytes[i];

    if (b1 <= 0x7f) {
      result +=
        String.fromCharCode(
          b1,
        );

      i++;

      continue;
    }

    if (
      b1 >= 0xc2 &&
      b1 <= 0xdf &&
      i + 1 <
        bytes.length
    ) {
      const b2 =
        bytes[i + 1];

      if (
        (b2 & 0xc0) !==
        0x80
      ) {
        return value;
      }

      const code =
        ((b1 & 0x1f) << 6) |
        (b2 & 0x3f);

      result +=
        String.fromCharCode(
          code,
        );

      i += 2;

      continue;
    }

    if (
      b1 >= 0xe0 &&
      b1 <= 0xef &&
      i + 2 <
        bytes.length
    ) {
      const b2 =
        bytes[i + 1];

      const b3 =
        bytes[i + 2];

      if (
        (b2 & 0xc0) !==
          0x80 ||
        (b3 & 0xc0) !==
          0x80
      ) {
        return value;
      }

      const code =
        ((b1 & 0x0f) <<
          12) |
        ((b2 & 0x3f) <<
          6) |
        (b3 & 0x3f);

      result +=
        String.fromCharCode(
          code,
        );

      i += 3;

      continue;
    }

    if (
      b1 >= 0xf0 &&
      b1 <= 0xf4 &&
      i + 3 <
        bytes.length
    ) {
      const b2 =
        bytes[i + 1];

      const b3 =
        bytes[i + 2];

      const b4 =
        bytes[i + 3];

      if (
        (b2 & 0xc0) !==
          0x80 ||
        (b3 & 0xc0) !==
          0x80 ||
        (b4 & 0xc0) !==
          0x80
      ) {
        return value;
      }

      let code =
        ((b1 & 0x07) <<
          18) |
        ((b2 & 0x3f) <<
          12) |
        ((b3 & 0x3f) <<
          6) |
        (b4 & 0x3f);

      code -= 0x10000;

      result +=
        String.fromCharCode(
          0xd800 +
            (code >> 10),
          0xdc00 +
            (code & 0x3ff),
        );

      i += 4;

      continue;
    }

    return value;
  }

  return result;
}

function encodeXmlAttribute(
  value: string,
): string {
  let result = '';

  for (
    let i = 0;
    i < value.length;
    i++
  ) {
    let code =
      value.charCodeAt(i);

    if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      i + 1 <
        value.length
    ) {
      const next =
        value.charCodeAt(
          i + 1,
        );

      if (
        next >= 0xdc00 &&
        next <= 0xdfff
      ) {
        code =
          0x10000 +
          ((code - 0xd800) <<
            10) +
          (next - 0xdc00);

        i++;
      }
    }

    if (code === 38) {
      result += '&amp;';
    } else if (
      code === 34
    ) {
      result += '&quot;';
    } else if (
      code === 60
    ) {
      result += '&lt;';
    } else if (
      code === 62
    ) {
      result += '&gt;';
    } else if (
      code <= 0x7f
    ) {
      result +=
        String.fromCharCode(
          code,
        );
    } else {
      result +=
        `&#${code};`;
    }
  }

  return result;
}

function fixSvgIds(
  svg: string,
): string {
  return svg.replace(
    /\bid="([^"]*)"/g,
    (
      _match,
      rawValue: string,
    ) => {
      const decodedEntities =
        decodeXmlEntities(
          rawValue,
        );

      const decodedUtf8 =
        decodeUtf8Mojibake(
          decodedEntities,
        );

      const encoded =
        encodeXmlAttribute(
          decodedUtf8,
        );

      return `id="${encoded}"`;
    },
  );
}

function utf8Encode(
  value: string,
): Uint8Array {
  const bytes: number[] = [];

  for (
    let i = 0;
    i < value.length;
    i++
  ) {
    let code =
      value.charCodeAt(i);

    if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      i + 1 <
        value.length
    ) {
      const next =
        value.charCodeAt(
          i + 1,
        );

      if (
        next >= 0xdc00 &&
        next <= 0xdfff
      ) {
        code =
          0x10000 +
          ((code - 0xd800) <<
            10) +
          (next - 0xdc00);

        i++;
      }
    }

    if (code <= 0x7f) {
      bytes.push(code);
    } else if (
      code <= 0x7ff
    ) {
      bytes.push(
        0xc0 |
          (code >> 6),
        0x80 |
          (code & 0x3f),
      );
    } else if (
      code <= 0xffff
    ) {
      bytes.push(
        0xe0 |
          (code >> 12),

        0x80 |
          (
            (code >> 6) &
            0x3f
          ),

        0x80 |
          (code & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 |
          (code >> 18),

        0x80 |
          (
            (code >> 12) &
            0x3f
          ),

        0x80 |
          (
            (code >> 6) &
            0x3f
          ),

        0x80 |
          (code & 0x3f),
      );
    }
  }

  return new Uint8Array(
    bytes,
  );
}

function sceneChildren(
  node: SceneNode,
): readonly SceneNode[] {
  return 'children' in node
    ? (
        node.children as
          readonly SceneNode[]
      )
    : [];
}

function isPrintLayer(
  node: SceneNode,
  layerName: string,
): boolean {
  return (
    node.name
      .trim()
      .toLowerCase() ===
    layerName
      .trim()
      .toLowerCase()
  );
}

function hasPrintLayerDescendant(
  node: SceneNode,
  layerName: string,
): boolean {
  for (
    const child
    of sceneChildren(
      node,
    )
  ) {
    if (
      isPrintLayer(
        child,
        layerName,
      ) ||
      hasPrintLayerDescendant(
        child,
        layerName,
      )
    ) {
      return true;
    }
  }

  return false;
}

function hidePrintLayerDescendants(
  node: SceneNode,
  layerName: string,
): void {
  for (
    const child
    of sceneChildren(
      node,
    )
  ) {
    if (
      isPrintLayer(
        child,
        layerName,
      )
    ) {
      child.visible =
        false;

      continue;
    }

    hidePrintLayerDescendants(
      child,
      layerName,
    );
  }
}

async function exportRezkaSvg(
  node: SceneNode,
  layerName: string,
): Promise<
  Uint8Array |
  undefined
> {
  if (
    !hasPrintLayerDescendant(
      node,
      layerName,
    )
  ) {
    return undefined;
  }

  const svg =
    await node.exportAsync({
      format:
        'SVG_STRING',

      svgOutlineText:
        true,

      svgIdAttribute:
        true,

      colorProfile:
        'SRGB',

      contentsOnly:
        true,
    });

  return utf8Encode(
    fixSvgIds(
      svg,
    ),
  );
}

async function exportTextSvg(
  node: SceneNode,
): Promise<Uint8Array> {
  const svg =
    await node.exportAsync({
      format:
        'SVG_STRING',

      svgOutlineText:
        false,

      svgIdAttribute:
        true,

      colorProfile:
        'SRGB',

      contentsOnly:
        true,
    });

  return utf8Encode(
    fixSvgIds(
      svg,
    ),
  );
}

export async function exportSelection(
  selection:
    readonly SceneNode[],

  options:
    ExportOptions,

  progress: (
    completed: number,
    total: number,
  ) => void,

  emit: (
    file: ExportedFile,
    index: number,
    total: number,
  ) =>
    Promise<void> |
    void,
): Promise<number> {
  if (
    !selection.length
  ) {
    throw new Error(
      'Выберите хотя бы один слой или фрейм.',
    );
  }

  if (
    options.format ===
      'SVG' &&
    options.colorMode ===
      'CMYK'
  ) {
    throw new Error(
      'Для CMYK выберите PDF. SVG экспортируется в RGB.',
    );
  }

  const roots =
    selectionRoots(
      selection,
    );

  const names =
    new Set<string>();

  const maxItemBytes =
    100 *
    1024 *
    1024;

  const ensureItemSize =
    (
      size: number,
      node: SceneNode,
    ) => {
      if (
        size <=
        maxItemBytes
      ) {
        return;
      }

      throw new Error(
        `Фрейм "${node.name}" превышает 100 МБ промежуточных данных.`,
      );
    };

  progress(
    0,
    roots.length,
  );

  for (
    let rootIndex = 0;
    rootIndex <
      roots.length;
    rootIndex++
  ) {
    const node =
      roots[
        rootIndex
      ];

    if (
      node.removed
    ) {
      throw new Error(
        'Один из выбранных слоёв удалён. Повторите экспорт.',
      );
    }

    let file:
      ExportedFile;

    if (
      options.format ===
      'SVG'
    ) {
      const svg =
        await node.exportAsync({
          format:
            'SVG_STRING',

          svgOutlineText:
            options.outlineText,

          svgIdAttribute:
            true,

          colorProfile:
            'SRGB',

          contentsOnly:
            true,
        });

      const bytes =
        utf8Encode(
          fixSvgIds(
            svg,
          ),
        );

      ensureItemSize(
        bytes.byteLength,
        node,
      );

      file = {
        name:
          uniqueName(
            node.name,
            'svg',
            names,
          ),

        bytes,

        mime:
          'image/svg+xml',
      };
    } else {
      const rezkaSvgBytes =
        options.printLayerEnabled
          ? await exportRezkaSvg(
              node,
              options.printLayerName,
            )
          : undefined;

      let pdfSource:
        SceneNode =
          node;

      let baseClone:
        SceneNode |
        undefined;

      if (
        rezkaSvgBytes
      ) {
        baseClone =
          node.clone();

        hidePrintLayerDescendants(
          baseClone,
          options.printLayerName,
        );

        pdfSource =
          baseClone;
      }

      let pdfBytes:
        Uint8Array;

      let textSvgBytes:
        Uint8Array |
        undefined;

      try {
        pdfBytes =
          await pdfSource
            .exportAsync({
              format:
                'PDF',

              colorProfile:
                'SRGB',

              contentsOnly:
                true,
            });

        if (
          !options.outlineText
        ) {
          textSvgBytes =
            await exportTextSvg(
              pdfSource,
            );
        }
      } finally {
        if (
          baseClone &&
          !baseClone.removed
        ) {
          baseClone.remove();
        }
      }

      const itemBytes =
        pdfBytes.byteLength +
        (
          textSvgBytes
            ?.byteLength ||
          0
        ) +
        (
          rezkaSvgBytes
            ?.byteLength ||
          0
        );

      ensureItemSize(
        itemBytes,
        node,
      );

      file = {
        name:
          uniqueName(
            node.name,
            'pdf',
            names,
          ),

        bytes:
          pdfBytes,

        mime:
          'application/pdf',

        sourceWidth:
          node.width,

        sourceHeight:
          node.height,

        ...(
          textSvgBytes
            ? {
                textSvgBytes,
              }
            : {}
        ),

        ...(
          rezkaSvgBytes
            ? {
                rezkaSvgBytes,
              }
            : {}
        ),
      };
    }

    /*
     * ВАЖНО:
     * следующий фрейм не экспортируется,
     * пока UI не закончит обработку
     * текущего и не пришлёт ACK.
     */
    await emit(
      file,
      rootIndex + 1,
      roots.length,
    );

    progress(
      rootIndex + 1,
      roots.length,
    );
  }

  return roots.length;
}
