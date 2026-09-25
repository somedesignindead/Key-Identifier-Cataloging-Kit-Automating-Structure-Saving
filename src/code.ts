import {
  exportSelection,
} from './core/export';

import {
  isUiMessage,
} from './shared/messages';

import {
  previewRename,
  applyRename,
} from './edit/rename';

import {
  previewTextReplace,
  applyTextReplace,
} from './edit/text';

import {
  previewImageEdit,
  applyImageEdit,
} from './edit/images';

const HELPER_INSTALLED_KEY =
  'layer-export-helper-installed';

figma.showUI(
  __html__,
  {
    width: 621,
    height: 703,
    themeColors: true,
  },
);

type PendingAck = {
  index: number;
  resolve: () => void;
  reject: (
    error: Error,
  ) => void;
  timer:
    ReturnType<
      typeof setTimeout
    >;
};

let pendingAck:
  PendingAck |
  null =
    null;

let previewOriginalSelection:
  SceneNode[] |
  null =
    null;

let previewGeneration =
  0;

type PendingImageResize = {
  requestId: number;
  resolve: (
    bytes: Uint8Array,
  ) => void;
  reject: (
    error: Error,
  ) => void;
  timer:
    ReturnType<
      typeof setTimeout
    >;
};

let imageResizeSequence =
  0;

let pendingImageResize:
  PendingImageResize |
  null =
    null;

function requestImageResize(
  bytes: Uint8Array,
  targetWidth: number,
  targetHeight: number,
): Promise<Uint8Array> {
  if (
    pendingImageResize
  ) {
    return Promise.reject(
      new Error(
        'Предыдущая операция уменьшения изображения ещё не завершена.',
      ),
    );
  }

  const requestId =
    ++imageResizeSequence;

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const timer =
        setTimeout(
          () => {
            if (
              pendingImageResize
                ?.requestId !==
              requestId
            ) {
              return;
            }

            pendingImageResize =
              null;

            reject(
              new Error(
                'Таймаут уменьшения изображения.',
              ),
            );
          },
          120000,
        );

      pendingImageResize = {
        requestId,
        resolve,
        reject,
        timer,
      };

      figma.ui.postMessage({
        type:
          'resize-image-request',
        requestId,
        bytes,
        targetWidth,
        targetHeight,
      });
    },
  );
}

function handleImageResizeResponse(
  requestId: number,
  ok: boolean,
  bytes?: Uint8Array,
  message?: string,
): void {
  const pending =
    pendingImageResize;

  if (
    !pending ||
    pending.requestId !==
      requestId
  ) {
    return;
  }

  pendingImageResize =
    null;

  clearTimeout(
    pending.timer,
  );

  if (
    ok &&
    bytes
  ) {
    pending.resolve(
      bytes,
    );

    return;
  }

  pending.reject(
    new Error(
      message ||
      'Не удалось уменьшить изображение.',
    ),
  );
}

function rootSelection(
  selection:
    readonly SceneNode[],
): SceneNode[] {
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
        parent.type !==
          'PAGE' &&
        parent.type !==
          'DOCUMENT'
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

function renderedNodeSize(
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
    Number(node.width) *
    scaleX;

  const height =
    Number(node.height) *
    scaleY;

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
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

async function optimizeImageFills(
  root: SceneNode,
  cache: Map<
    string,
    string
  >,
): Promise<number> {
  let changed =
    0;

  const visit =
    async (
      node: SceneNode,
    ): Promise<void> => {
      if (
        'fills' in node
      ) {
        const fillNode =
          node as unknown as {
            fills:
              readonly Paint[] |
              symbol;
          };

        if (
          Array.isArray(
            fillNode.fills,
          )
        ) {
          const rendered =
            renderedNodeSize(
              node,
            );

          if (rendered) {
            let nextFills:
              Paint[] |
              null =
                null;

            for (
              let index = 0;
              index <
                fillNode.fills.length;
              index++
            ) {
              const paint =
                fillNode.fills[
                  index
                ];

              if (
                paint.type !==
                  'IMAGE' ||
                !paint.imageHash ||
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

              const size =
                await image
                  .getSizeAsync();

              if (
                size.width <= 0 ||
                size.height <= 0
              ) {
                continue;
              }

              /*
               * Сохраняем исходное соотношение сторон.
               * max() даёт достаточно пикселей для FILL/CROP,
               * но не делает изображение больше исходника.
               */
              const scale =
                Math.min(
                  1,
                  Math.max(
                    rendered.width /
                      size.width,
                    rendered.height /
                      size.height,
                  ),
                );

              if (
                scale >= 0.90
              ) {
                continue;
              }

              const targetWidth =
                Math.max(
                  1,
                  Math.ceil(
                    size.width *
                      scale,
                  ),
                );

              const targetHeight =
                Math.max(
                  1,
                  Math.ceil(
                    size.height *
                      scale,
                  ),
                );

              const cacheKey =
                [
                  paint.imageHash,
                  targetWidth,
                  targetHeight,
                ].join(
                  ':',
                );

              let newHash =
                cache.get(
                  cacheKey,
                );

              if (!newHash) {
                const bytes =
                  await image
                    .getBytesAsync();

                const resized =
                  await requestImageResize(
                    bytes,
                    targetWidth,
                    targetHeight,
                  );

                if (
                  resized === bytes
                ) {
                  continue;
                }

                newHash =
                  figma.createImage(
                    resized,
                  ).hash;

                cache.set(
                  cacheKey,
                  newHash,
                );
              }

              if (!nextFills) {
                nextFills =
                  [
                    ...fillNode.fills,
                  ];
              }

              nextFills[
                index
              ] = {
                ...paint,
                imageHash:
                  newHash,
              };

              changed++;
            }

            if (
              nextFills
            ) {
              try {
                (
                  node as unknown as {
                    fills:
                      Paint[];
                  }
                ).fills =
                  nextFills;
              } catch {
                /*
                 * Некоторые внутренние слои instance могут
                 * быть недоступны для override. Их просто
                 * оставляем без изменения.
                 */
              }
            }
          }
        }
      }

      if (
        'children' in node
      ) {
        for (
          const child
          of node.children
        ) {
          await visit(
            child,
          );
        }
      }
    };

  await visit(
    root,
  );

  return changed;
}

async function makeOptimizedCopies(
  selection:
    readonly SceneNode[],
): Promise<SceneNode[]> {
  const roots =
    rootSelection(
      selection,
    );

  const copies:
    SceneNode[] =
      [];

  const cache =
    new Map<
      string,
      string
    >();

  try {
    for (
      let index = 0;
      index <
        roots.length;
      index++
    ) {
      const node =
        roots[index];

      if (
        !(
          'clone' in node
        ) ||
        typeof node.clone !==
          'function'
      ) {
        throw new Error(
          `Слой "${node.name}" нельзя временно клонировать для оптимизации изображений.`,
        );
      }

      const copy =
        (
          node as SceneNode & {
            clone():
              SceneNode;
          }
        ).clone();

      /*
       * Убираем рабочую копию далеко за пределы видимого canvas.
       * Положение корня не влияет на экспорт содержимого фрейма.
       */
      figma.currentPage
        .appendChild(
          copy,
        );

      if (
        'x' in copy &&
        'y' in copy
      ) {
        copy.x =
          -100000 -
          index *
            1000;

        copy.y =
          -100000;
      }

      copies.push(
        copy,
      );

      await optimizeImageFills(
        copy,
        cache,
      );
    }

    return copies;
  } catch (
    error
  ) {
    for (
      const copy
      of copies
    ) {
      if (
        !copy.removed
      ) {
        copy.remove();
      }
    }

    throw error;
  }
}

function sendSelection(): void {
  const selection =
    figma.currentPage.selection;

  const firstFrame =
    selection.find(
      (
        node,
      ): node is FrameNode =>
        node.type ===
        'FRAME',
    );

  figma.ui.postMessage({
    type:
      'selection',

    count:
      selection.length,

    names:
      selection.map(
        node => node.name,
      ),

    ids:
      selection.map(
        node => node.id,
      ),

    frameWidth:
      firstFrame
        ? firstFrame.width
        : null,

    frameHeight:
      firstFrame
        ? firstFrame.height
        : null,
  });
}

function waitForAck(
  index: number,
): Promise<void> {
  if (
    pendingAck
  ) {
    return Promise.reject(
      new Error(
        'Нарушена последовательность потокового экспорта.',
      ),
    );
  }

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const timer =
        setTimeout(
          () => {
            if (
              pendingAck?.index !==
              index
            ) {
              return;
            }

            pendingAck =
              null;

            reject(
              new Error(
                `UI не подтвердил обработку файла ${index}.`,
              ),
            );
          },

          240000,
        );

      pendingAck = {
        index,
        resolve,
        reject,
        timer,
      };
    },
  );
}

function handleAck(
  index: number,
  ok: boolean,
  message?: string,
): void {
  const pending =
    pendingAck;

  if (
    !pending ||
    pending.index !==
      index
  ) {
    return;
  }

  pendingAck =
    null;

  clearTimeout(
    pending.timer,
  );

  if (ok) {
    pending.resolve();
    return;
  }

  pending.reject(
    new Error(
      message ||
      `Не удалось обработать файл ${index}.`,
    ),
  );
}

figma.on(
  'selectionchange',
  () => {
    if (
      previewOriginalSelection
    ) {
      return;
    }

    sendSelection();
  },
);

figma.ui.onmessage =
  async message => {
    if (
      !isUiMessage(
        message,
      )
    ) {
      figma.ui.postMessage({
        type:
          'error',

        message:
          'Некорректные параметры экспорта: сообщение UI не прошло валидацию.',
      });

      return;
    }

    switch (
      message.type
    ) {
      case 'refresh':
        sendSelection();

        figma.ui.postMessage({
          type:
            'helper-state',

          installed:
            (
              await figma
                .clientStorage
                .getAsync(
                  HELPER_INSTALLED_KEY,
                )
            ) === true,
        });

        return;

      case 'close':
        figma.closePlugin();
        return;

      case 'open-helper':
        figma.notify(
          'DEBUG: open-helper получен',
        );

        figma.openExternal(
          'layerexport://start',
        );

        return;

      case 'helper-installed':
        await figma
          .clientStorage
          .setAsync(
            HELPER_INSTALLED_KEY,
            true,
          );

        return;

      case 'remove-selection-node': {
        ++previewGeneration;

        const originalSelection =
          previewOriginalSelection
            ? [
                ...previewOriginalSelection,
              ]
            : [
                ...figma
                  .currentPage
                  .selection,
              ];

        previewOriginalSelection =
          null;

        figma.currentPage.selection =
          originalSelection.filter(
            node =>
              !node.removed &&
              node.id !==
                message.id,
          );

        sendSelection();

        return;
      }


      case 'preview-node': {
        const generation =
          ++previewGeneration;

        if (
          !previewOriginalSelection
        ) {
          previewOriginalSelection =
            [
              ...figma
                .currentPage
                .selection,
            ];
        }

        const node =
          await figma
            .getNodeByIdAsync(
              message.id,
            );

        if (
          generation !==
            previewGeneration ||
          !node ||
          node.type ===
            'DOCUMENT' ||
          node.type ===
            'PAGE'
        ) {
          return;
        }

        const sceneNode =
          node as SceneNode;

        figma.currentPage.selection =
          [
            sceneNode,
          ];

        figma.viewport
          .scrollAndZoomIntoView(
            [
              sceneNode,
            ],
          );

        return;
      }

      case 'preview-node-end': {
        ++previewGeneration;

        const original =
          previewOriginalSelection;

        previewOriginalSelection =
          null;

        if (original) {
          figma.currentPage.selection =
            original.filter(
              node =>
                !node.removed,
            );
        }

        sendSelection();

        return;
      }

      case 'edit-rename-preview':
        try {
          figma.ui.postMessage({
            type:
              'edit-rename-preview-result',

            result:
              previewRename(
                message.options,
              ),
          });
        } catch (error) {
          figma.ui.postMessage({
            type:
              'edit-preview-error',

            target:
              'rename',

            message:
              error instanceof Error
                ? error.message
                : 'Ошибка предпросмотра переименования.',
          });
        }

        return;


      case 'edit-rename-apply':
        try {
          const result =
            applyRename(
              message.options,
            );

          sendSelection();

          figma.ui.postMessage({
            type:
              'edit-action-result',

            target:
              'rename',

            result,
          });
        } catch (error) {
          figma.ui.postMessage({
            type:
              'edit-action-error',

            target:
              'rename',

            message:
              error instanceof Error
                ? error.message
                : 'Ошибка переименования.',
          });
        }

        return;


      case 'edit-text-preview':
        try {
          figma.ui.postMessage({
            type:
              'edit-text-preview-result',

            result:
              await previewTextReplace(
                message.options,
              ),
          });
        } catch (error) {
          figma.ui.postMessage({
            type:
              'edit-preview-error',

            target:
              'text',

            message:
              error instanceof Error
                ? error.message
                : 'Ошибка предпросмотра замены текста.',
          });
        }

        return;


      case 'edit-text-apply':
        try {
          figma.ui.postMessage({
            type:
              'edit-action-result',

            target:
              'text',

            result:
              await applyTextReplace(
                message.options,
              ),
          });
        } catch (error) {
          figma.ui.postMessage({
            type:
              'edit-action-error',

            target:
              'text',

            message:
              error instanceof Error
                ? error.message
                : 'Ошибка замены текста.',
          });
        }

        return;


      case 'edit-images-preview':
        try {
          figma.ui.postMessage({
            type:
              'edit-images-preview-result',

            result:
              await previewImageEdit(
                message.options,
              ),
          });
        } catch (error) {
          figma.ui.postMessage({
            type:
              'edit-preview-error',

            target:
              'images',

            message:
              error instanceof Error
                ? error.message
                : 'Ошибка предпросмотра изображений.',
          });
        }

        return;


      case 'edit-images-apply':
        try {
          figma.ui.postMessage({
            type:
              'edit-action-result',

            target:
              'images',

            result:
              await applyImageEdit(
                message.options,
                requestImageResize,
              ),
          });
        } catch (error) {
          figma.ui.postMessage({
            type:
              'edit-action-error',

            target:
              'images',

            message:
              error instanceof Error
                ? error.message
                : 'Ошибка обработки изображений.',
          });
        }

        return;


      case 'profiles-load': {
        const raw =
          await figma
            .clientStorage
            .getAsync(
              'layer-export-icc-profiles-v1',
            );

        const profiles =
          Array.isArray(raw)
            ? raw
                .filter(
                  item =>
                    item &&
                    typeof item ===
                      'object' &&
                    typeof (
                      item as {
                        name?: unknown;
                      }
                    ).name ===
                      'string' &&
                    typeof (
                      item as {
                        base64?: unknown;
                      }
                    ).base64 ===
                      'string',
                )
                .slice(
                  0,
                  8,
                )
            : [];

        figma.ui.postMessage({
          type:
            'profiles-state',
          profiles,
        });

        return;
      }


      case 'profiles-save': {
        const profiles =
          message.profiles
            .slice(
              0,
              8,
            );

        await figma
          .clientStorage
          .setAsync(
            'layer-export-icc-profiles-v1',
            profiles,
          );

        figma.ui.postMessage({
          type:
            'profiles-state',
          profiles,
        });

        return;
      }


      case 'resize-image-response':
        handleImageResizeResponse(
          message.requestId,
          message.ok,
          message.bytes,
          message.message,
        );

        return;

      case 'export-file-ack':
        handleAck(
          message.index,
          message.ok,
          message.message,
        );

        return;

      case 'export':
        try {
          const selection =
            [
              ...figma
                .currentPage
                .selection,
            ];

          let temporarySelection:
            SceneNode[] |
            null =
              null;

          try {
            if (
              message.options
                .printOptimizeImages
            ) {
              temporarySelection =
                await makeOptimizedCopies(
                  selection,
                );
            }

            const exportNodes =
              temporarySelection ||
              selection;

            const total =
              await exportSelection(
                exportNodes,
              message.options,

              (
                completed,
                total,
              ) => {
                figma.ui.postMessage({
                  type:
                    'progress',

                  completed,
                  total,
                });
              },

              async (
                file,
                index,
                total,
              ) => {
                figma.ui.postMessage({
                  type:
                    'exported-file',

                  file,
                  index,
                  total,

                  options:
                    message.options,
                });

                await waitForAck(
                  index,
                );
              },
            );

            figma.ui.postMessage({
              type:
                'export-complete',

              total,

              options:
                message.options,
            });
          } finally {
            if (
              temporarySelection
            ) {
              for (
                const node
                of temporarySelection
              ) {
                if (
                  !node.removed
                ) {
                  node.remove();
                }
              }
            }
          }
        } catch (
          error
        ) {
          figma.ui.postMessage({
            type:
              'error',

            message:
              error instanceof
                Error
                ? error.message
                : 'Ошибка экспорта.',
          });
        }

        return;
    }
  };

sendSelection();
