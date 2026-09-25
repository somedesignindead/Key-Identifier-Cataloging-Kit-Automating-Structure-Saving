import type {
  ImageEditOptions,
} from '../shared/messages';


export type ImagePreviewExample = {
  layer: string;

  beforeWidth: number;
  beforeHeight: number;

  afterWidth: number;
  afterHeight: number;
};


export type ImagePreviewResult = {
  nodes: number;
  images: number;
  optimizable: number;

  examples:
    ImagePreviewExample[];
};


export type ImageApplyResult = {
  nodes: number;
  modeChanges: number;
  optimized: number;
  skipped: number;
};


export type ResizeImageCallback = (
  bytes: Uint8Array,
  targetWidth: number,
  targetHeight: number,
) => Promise<Uint8Array>;


function rootSelection(): SceneNode[] {
  const selection =
    figma.currentPage.selection;

  const selectedIds =
    new Set(
      selection.map(
        node => node.id,
      ),
    );

  return selection.filter(
    node => {
      let parent =
        node.parent;

      while (
        parent &&
        parent.type !== 'PAGE' &&
        parent.type !== 'DOCUMENT'
      ) {
        if (
          selectedIds.has(
            parent.id,
          )
        ) {
          return false;
        }

        parent =
          parent.parent;
      }

      return true;
    },
  );
}


function collectNodes(
  includeDescendants: boolean,
): SceneNode[] {
  const roots =
    rootSelection();

  if (
    !includeDescendants
  ) {
    return roots;
  }

  const result:
    SceneNode[] =
    [];

  const seen =
    new Set<string>();

  const visit =
    (
      node: SceneNode,
    ) => {
      if (
        seen.has(
          node.id,
        )
      ) {
        return;
      }

      seen.add(
        node.id,
      );

      result.push(
        node,
      );

      if (
        'children' in node
      ) {
        for (
          const child
          of node.children
        ) {
          visit(
            child,
          );
        }
      }
    };

  for (
    const root
    of roots
  ) {
    visit(root);
  }

  return result;
}


function imageNodes(
  options:
    ImageEditOptions,
): SceneNode[] {
  return collectNodes(
    options.includeDescendants,
  ).filter(
    node => {
      if (
        !('fills' in node)
      ) {
        return false;
      }

      const fills =
        (
          node as unknown as {
            fills:
              readonly Paint[] |
              symbol;
          }
        ).fills;

      return (
        Array.isArray(
          fills,
        ) &&
        fills.some(
          paint =>
            paint.type ===
              'IMAGE' &&
            Boolean(
              paint.imageHash,
            ),
        )
      );
    },
  );
}


function localNodeSize(
  node: SceneNode,
): {
  width: number;
  height: number;
} | null {
  if (
    !('width' in node) ||
    !('height' in node)
  ) {
    return null;
  }

  const width =
    Number(
      node.width,
    );

  const height =
    Number(
      node.height,
    );

  if (
    !Number.isFinite(
      width,
    ) ||
    !Number.isFinite(
      height,
    ) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return {
    width,
    height,
  };
}


function renderedNodeSize(
  node: SceneNode,
): {
  width: number;
  height: number;
} | null {
  const local =
    localNodeSize(
      node,
    );

  if (!local) {
    return null;
  }

  const transform =
    node.absoluteTransform;

  const scaleX =
    Math.hypot(
      transform[0][0],
      transform[1][0],
    );

  const scaleY =
    Math.hypot(
      transform[0][1],
      transform[1][1],
    );

  const width =
    local.width *
    scaleX;

  const height =
    local.height *
    scaleY;

  if (
    !Number.isFinite(
      width,
    ) ||
    !Number.isFinite(
      height,
    ) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return {
    width,
    height,
  };
}


function removeImageTransform(
  paint: ImagePaint,
): ImagePaint {
  const result:
    Record<
      string,
      unknown
    > = {
      ...paint,
    };

  delete result
    .imageTransform;

  return (
    result as unknown as
      ImagePaint
  );
}


function cropTransform(
  node: SceneNode,
  imageWidth: number,
  imageHeight: number,
  anchorX: 0 | 0.5 | 1,
  anchorY: 0 | 0.5 | 1,
): Transform | null {
  const frame =
    localNodeSize(
      node,
    );

  if (
    !frame ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return null;
  }

  /*
   * Сначала считаем обычный COVER:
   * картинка полностью закрывает объект.
   */
  const coverScale =
    Math.max(
      frame.width /
        imageWidth,

      frame.height /
        imageHeight,
    );

  const displayedWidth =
    imageWidth *
    coverScale;

  const displayedHeight =
    imageHeight *
    coverScale;

  /*
   * Какая доля итоговой картинки остаётся видимой.
   */
  const visibleX =
    Math.min(
      1,
      frame.width /
        displayedWidth,
    );

  const visibleY =
    Math.min(
      1,
      frame.height /
        displayedHeight,
    );

  /*
   * 0   = начало изображения
   * .5  = центр
   * 1   = конец изображения
   *
   * Для CROP Figma imageTransform задаёт
   * отображаемый участок нормализованной картинки.
   */
  const offsetX =
    (
      1 -
      visibleX
    ) *
    anchorX;

  const offsetY =
    (
      1 -
      visibleY
    ) *
    anchorY;

  return [
    [
      visibleX,
      0,
      offsetX,
    ],

    [
      0,
      visibleY,
      offsetY,
    ],
  ];
}


async function imagePaintForMode(
  node: SceneNode,
  paint: ImagePaint,
  options:
    ImageEditOptions,
): Promise<ImagePaint> {
  if (
    options.mode ===
    'KEEP'
  ) {
    return paint;
  }


  if (
    options.mode ===
    'FIT'
  ) {
    return {
      ...removeImageTransform(
        paint,
      ),

      scaleMode:
        'FIT',
    };
  }


  if (
    options.mode ===
    'TILE'
  ) {
    return {
      ...removeImageTransform(
        paint,
      ),

      scaleMode:
        'TILE',
    };
  }


  /*
   * Обычный Cover по центру лучше оставить
   * нативным FILL — это максимально близко
   * к стандартному поведению Figma.
   */
  if (
    options.mode ===
      'FILL' &&
    options.anchorX ===
      0.5 &&
    options.anchorY ===
      0.5
  ) {
    return {
      ...removeImageTransform(
        paint,
      ),

      scaleMode:
        'FILL',
    };
  }


  if (
    !paint.imageHash
  ) {
    return paint;
  }

  const image =
    figma.getImageByHash(
      paint.imageHash,
    );

  if (!image) {
    return paint;
  }

  const size =
    await image
      .getSizeAsync();

  const transform =
    cropTransform(
      node,
      size.width,
      size.height,
      options.anchorX,
      options.anchorY,
    );

  if (!transform) {
    return paint;
  }

  /*
   * Figma не имеет отдельного anchor для FILL.
   * Поэтому Cover с нецентральным якорем
   * выражаем как эквивалентный CROP.
   *
   * Crop тоже получает тот же 3×3 anchor.
   */
  return {
    ...paint,

    scaleMode:
      'CROP',

    imageTransform:
      transform,
  };
}


async function changeMode(
  node: SceneNode,
  options:
    ImageEditOptions,
): Promise<{
  changed: number;
  skipped: number;
}> {
  if (
    options.mode ===
      'KEEP' ||
    !('fills' in node)
  ) {
    return {
      changed:
        0,

      skipped:
        0,
    };
  }

  const target =
    node as unknown as {
      fills:
        readonly Paint[] |
        symbol;
    };

  if (
    !Array.isArray(
      target.fills,
    )
  ) {
    return {
      changed:
        0,

      skipped:
        0,
    };
  }

  const next =
    [
      ...target.fills,
    ];

  let changed =
    0;

  for (
    let index = 0;
    index < next.length;
    index++
  ) {
    const paint =
      next[index];

    if (
      paint.type !==
        'IMAGE' ||
      !paint.imageHash
    ) {
      continue;
    }

    next[index] =
      await imagePaintForMode(
        node,
        paint,
        options,
      );

    changed++;
  }

  if (
    changed === 0
  ) {
    return {
      changed:
        0,

      skipped:
        0,
    };
  }

  try {
    (
      node as unknown as {
        fills: Paint[];
      }
    ).fills =
      next;

    return {
      changed,

      skipped:
        0,
    };
  } catch {
    return {
      changed:
        0,

      skipped:
        changed,
    };
  }
}


function targetBitmapScale(
  paint: ImagePaint,
  rendered: {
    width: number;
    height: number;
  },
  source: {
    width: number;
    height: number;
  },
  multiplier:
    1 | 2,
): number {
  const targetWidth =
    rendered.width *
    multiplier;

  const targetHeight =
    rendered.height *
    multiplier;

  const widthScale =
    targetWidth /
    source.width;

  const heightScale =
    targetHeight /
    source.height;

  /*
   * FIT:
   * достаточно вписать bitmap внутрь объекта.
   *
   * FILL/CROP:
   * bitmap обязан закрывать объект целиком,
   * поэтому берём max().
   *
   * TILE отдельно вообще не оптимизируем.
   */
  if (
    paint.scaleMode ===
    'FIT'
  ) {
    return Math.min(
      1,
      Math.min(
        widthScale,
        heightScale,
      ),
    );
  }

  return Math.min(
    1,
    Math.max(
      widthScale,
      heightScale,
    ),
  );
}


function targetBitmapSize(
  paint: ImagePaint,
  rendered: {
    width: number;
    height: number;
  },
  source: {
    width: number;
    height: number;
  },
  multiplier:
    1 | 2,
): {
  width: number;
  height: number;
  scale: number;
} {
  const scale =
    targetBitmapScale(
      paint,
      rendered,
      source,
      multiplier,
    );

  return {
    scale,

    width:
      Math.max(
        1,
        Math.ceil(
          source.width *
          scale,
        ),
      ),

    height:
      Math.max(
        1,
        Math.ceil(
          source.height *
          scale,
        ),
      ),
  };
}


async function optimizeNode(
  node: SceneNode,
  options:
    ImageEditOptions,
  resizeImage:
    ResizeImageCallback,
  cache:
    Map<string, string>,
): Promise<{
  changed: number;
  skipped: number;
}> {
  if (
    !options.optimize ||
    !('fills' in node)
  ) {
    return {
      changed:
        0,

      skipped:
        0,
    };
  }

  const target =
    node as unknown as {
      fills:
        readonly Paint[] |
        symbol;
    };

  if (
    !Array.isArray(
      target.fills,
    )
  ) {
    return {
      changed:
        0,

      skipped:
        0,
    };
  }

  const rendered =
    renderedNodeSize(
      node,
    );

  if (!rendered) {
    return {
      changed:
        0,

      skipped:
        0,
    };
  }

  let next:
    Paint[] |
    null =
      null;

  let changed =
    0;

  let skipped =
    0;

  for (
    let index = 0;
    index < target.fills.length;
    index++
  ) {
    const paint =
      target.fills[index];

    if (
      paint.type !==
        'IMAGE' ||
      !paint.imageHash
    ) {
      continue;
    }

    if (
      paint.scaleMode ===
      'TILE'
    ) {
      skipped++;
      continue;
    }

    const image =
      figma.getImageByHash(
        paint.imageHash,
      );

    if (!image) {
      skipped++;
      continue;
    }

    const sourceSize =
      await image
        .getSizeAsync();

    if (
      sourceSize.width <= 0 ||
      sourceSize.height <= 0
    ) {
      skipped++;
      continue;
    }

    const targetSize =
      targetBitmapSize(
        paint,
        rendered,
        sourceSize,
        options.optimizeScale,
      );

    /*
     * Тот же безопасный порог, что уже
     * используется в Export-оптимизации:
     * меньше чем на 10% не трогаем.
     *
     * Апскейл невозможен, scale <= 1.
     */
    if (
      targetSize.scale >=
      0.90
    ) {
      continue;
    }

    const cacheKey =
      [
        paint.imageHash,
        targetSize.width,
        targetSize.height,
      ].join(':');

    let newHash =
      cache.get(
        cacheKey,
      );

    if (!newHash) {
      const sourceBytes =
        await image
          .getBytesAsync();

      const resizedBytes =
        await resizeImage(
          sourceBytes,
          targetSize.width,
          targetSize.height,
        );

      newHash =
        figma.createImage(
          resizedBytes,
        ).hash;

      cache.set(
        cacheKey,
        newHash,
      );
    }

    if (!next) {
      next =
        [
          ...target.fills,
        ];
    }

    /*
     * Меняем только imageHash.
     * Crop/filters/opacity/blend mode и прочие
     * свойства конкретной IMAGE-заливки сохраняются.
     */
    next[index] = {
      ...paint,

      imageHash:
        newHash,
    };

    changed++;
  }

  if (!next) {
    return {
      changed,
      skipped,
    };
  }

  try {
    (
      node as unknown as {
        fills: Paint[];
      }
    ).fills =
      next;
  } catch {
    skipped +=
      changed;

    changed =
      0;
  }

  return {
    changed,
    skipped,
  };
}


export async function previewImageEdit(
  options:
    ImageEditOptions,
): Promise<ImagePreviewResult> {
  const targets =
    imageNodes(
      options,
    );

  let images =
    0;

  let optimizable =
    0;

  const examples:
    ImagePreviewExample[] =
    [];

  for (
    const node
    of targets
  ) {
    if (
      !('fills' in node)
    ) {
      continue;
    }

    const fills =
      (
        node as unknown as {
          fills:
            readonly Paint[] |
            symbol;
        }
      ).fills;

    if (
      !Array.isArray(
        fills,
      )
    ) {
      continue;
    }

    const rendered =
      renderedNodeSize(
        node,
      );

    for (
      const paint
      of fills
    ) {
      if (
        paint.type !==
          'IMAGE' ||
        !paint.imageHash
      ) {
        continue;
      }

      images++;

      if (
        !options.optimize ||
        !rendered ||
        paint.scaleMode ===
          'TILE'
      ) {
        continue;
      }

      const image =
        figma.getImageByHash(
          paint.imageHash,
        );

      if (!image) {
        continue;
      }

      const sourceSize =
        await image
          .getSizeAsync();

      const targetSize =
        targetBitmapSize(
          paint,
          rendered,
          sourceSize,
          options.optimizeScale,
        );

      if (
        targetSize.scale >=
        0.90
      ) {
        continue;
      }

      optimizable++;

      if (
        examples.length < 3
      ) {
        examples.push({
          layer:
            node.name,

          beforeWidth:
            sourceSize.width,

          beforeHeight:
            sourceSize.height,

          afterWidth:
            targetSize.width,

          afterHeight:
            targetSize.height,
        });
      }
    }
  }

  return {
    nodes:
      targets.length,

    images,

    optimizable,

    examples,
  };
}


export async function applyImageEdit(
  options:
    ImageEditOptions,
  resizeImage:
    ResizeImageCallback,
): Promise<ImageApplyResult> {
  const targets =
    imageNodes(
      options,
    );

  const cache =
    new Map<
      string,
      string
    >();

  let modeChanges =
    0;

  let optimized =
    0;

  let skipped =
    0;

  for (
    const node
    of targets
  ) {
    const modeResult =
      await changeMode(
        node,
        options,
      );

    modeChanges +=
      modeResult.changed;

    skipped +=
      modeResult.skipped;

    const optimizeResult =
      await optimizeNode(
        node,
        options,
        resizeImage,
        cache,
      );

    optimized +=
      optimizeResult.changed;

    skipped +=
      optimizeResult.skipped;
  }

  return {
    nodes:
      targets.length,

    modeChanges,

    optimized,

    skipped,
  };
}
