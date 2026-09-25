import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, extname, basename } from 'node:path';
import {
  PDFDocument,
  PDFName,
  PDFString,
  rgb,
  cmyk,
  beginText,
  endText,
  setFontAndSize,
  setCharacterSpacing,
  setFillingColor,
  rotateAndSkewTextDegreesAndTranslate,
  showText,
  pushGraphicsState,
  popGraphicsState,
  setGraphicsState,
} from 'pdf-lib';

import fontkit from '@pdf-lib/fontkit';

import {
  run,
  ghostscriptPath,
} from './runtime.mjs';

import {
  getProfile,
} from './profiles.mjs';

const MAX_BYTES =
  100 * 1024 * 1024;

const BACKGROUND_RENDER_SCALE = 4;

const FONT_DIRS = [
  '/System/Library/Fonts',
  '/System/Library/Fonts/Supplemental',
  '/Library/Fonts',
  join(
    homedir(),
    'Library',
    'Fonts',
  ),
];

let fontFilesPromise = null;

function normalizeFontName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(
      /[^a-zа-яё0-9]+/gi,
      '',
    );
}

function primaryFontFamily(value) {
  return String(value || '')
    .split(',')[0]
    .trim()
    .replace(
      /^["']|["']$/g,
      '',
    );
}

function cleanPdfText(value) {
  return Array.from(
    String(value || ''),
  )
    .filter(char => {
      const cp =
        char.codePointAt(0);

      if (
        cp <= 0x1f ||
        cp === 0x7f
      ) {
        return false;
      }

      if (
        cp === 0x00ad ||
        cp === 0x061c ||
        cp === 0x180e ||
        (
          cp >= 0x200b &&
          cp <= 0x200f
        ) ||
        cp === 0x2028 ||
        cp === 0x2029 ||
        (
          cp >= 0x202a &&
          cp <= 0x202e
        ) ||
        (
          cp >= 0x2060 &&
          cp <= 0x206f
        ) ||
        cp === 0xfeff ||
        cp === 0xfffc
      ) {
        return false;
      }

      return true;
    })
    .join('');
}

async function collectFonts(
  directory,
  result,
) {
  let entries;

  try {
    entries =
      await readdir(
        directory,
        {
          withFileTypes:
            true,
        },
      );
  } catch {
    return;
  }

  for (
    const entry
    of entries
  ) {
    const path =
      join(
        directory,
        entry.name,
      );

    if (
      entry.isDirectory()
    ) {
      await collectFonts(
        path,
        result,
      );

      continue;
    }

    if (
      !entry.isFile()
    ) {
      continue;
    }

    const extension =
      extname(
        entry.name,
      ).toLowerCase();

    if (
      extension === '.ttf' ||
      extension === '.otf'
    ) {
      result.push(
        path,
      );
    }
  }
}

async function fontFiles() {
  if (
    !fontFilesPromise
  ) {
    fontFilesPromise =
      (async () => {
        const result = [];

        for (
          const directory
          of FONT_DIRS
        ) {
          await collectFonts(
            directory,
            result,
          );
        }

        return result;
      })();
  }

  return fontFilesPromise;
}

function fontScore(
  path,
  family,
  weight,
  style,
) {
  const file =
    normalizeFontName(
      basename(
        path,
        extname(path),
      ),
    );

  const familyName =
    normalizeFontName(
      family,
    );

  if (
    !familyName ||
    !file.includes(
      familyName,
    )
  ) {
    return -1;
  }

  let score = 100;

  const lower =
    basename(
      path,
    ).toLowerCase();

  const numericWeight =
    Number.parseInt(
      weight,
      10,
    ) || 400;

  const italic =
    /italic|oblique/i.test(
      style,
    );

  if (italic) {
    score +=
      /italic|oblique/.test(
        lower,
      )
        ? 40
        : -20;
  } else if (
    /italic|oblique/.test(
      lower,
    )
  ) {
    score -= 30;
  }

  const weights = [
    {
      min: 800,
      words: [
        'black',
        'heavy',
        'extrabold',
      ],
    },
    {
      min: 700,
      words: [
        'bold',
      ],
    },
    {
      min: 600,
      words: [
        'semibold',
        'demibold',
      ],
    },
    {
      min: 500,
      words: [
        'medium',
      ],
    },
    {
      min: 350,
      words: [
        'regular',
        'normal',
        'book',
      ],
    },
    {
      min: 0,
      words: [
        'light',
        'thin',
      ],
    },
  ];

  const group =
    weights.find(
      item =>
        numericWeight >=
        item.min,
    );

  if (
    group &&
    group.words.some(
      word =>
        lower.includes(
          word,
        ),
    )
  ) {
    score += 30;
  }

  return score;
}

async function resolveFontFile(
  family,
  weight,
  style,
) {
  const files =
    await fontFiles();

  const normalizedFamily =
    normalizeFontName(
      family,
    );

  const italic =
    /italic|oblique/i.test(
      style,
    );

  if (
    normalizedFamily ===
    'inter'
  ) {
    const wanted =
      italic
        ? 'intervariable-italic.ttf'
        : 'intervariable.ttf';

    const exact =
      files.find(
        path =>
          basename(
            path,
          ).toLowerCase() ===
          wanted,
      );

    if (exact) {
      return exact;
    }
  }

  let best = null;
  let bestScore = -1;

  for (
    const path
    of files
  ) {
    let score =
      fontScore(
        path,
        family,
        weight,
        style,
      );

    if (
      score < 0
    ) {
      continue;
    }

    const extension =
      extname(
        path,
      ).toLowerCase();

    if (
      extension ===
      '.ttf'
    ) {
      score += 100;
    }

    if (
      extension ===
      '.otf'
    ) {
      score -= 20;
    }

    if (
      score >
      bestScore
    ) {
      bestScore =
        score;

      best =
        path;
    }
  }

  if (!best) {
    throw new Error(
      `Шрифт "${family}" не найден на компьютере.`,
    );
  }

  return best;
}

function parseRgbColor(
  value,
) {
  const text =
    String(
      value || '',
    ).trim();

  if (
    text ===
    'black'
  ) {
    return [
      0,
      0,
      0,
    ];
  }

  if (
    text ===
    'white'
  ) {
    return [
      1,
      1,
      1,
    ];
  }

  let match =
    text.match(
      /^#([0-9a-f]{6})$/i,
    );

  if (match) {
    return [
      parseInt(
        match[1].slice(
          0,
          2,
        ),
        16,
      ) / 255,

      parseInt(
        match[1].slice(
          2,
          4,
        ),
        16,
      ) / 255,

      parseInt(
        match[1].slice(
          4,
          6,
        ),
        16,
      ) / 255,
    ];
  }

  match =
    text.match(
      /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i,
    );

  if (match) {
    return [
      Number(
        match[1],
      ) / 255,

      Number(
        match[2],
      ) / 255,

      Number(
        match[3],
      ) / 255,
    ].map(
      value =>
        Math.max(
          0,
          Math.min(
            1,
            value,
          ),
        ),
    );
  }

  return [
    0,
    0,
    0,
  ];
}

function rgbToCmyk(
  r,
  g,
  b,
) {
  const k =
    1 -
    Math.max(
      r,
      g,
      b,
    );

  if (
    k >=
    0.999999
  ) {
    return [
      0,
      0,
      0,
      1,
    ];
  }

  const denominator =
    1 - k;

  return [
    (1 - r - k) /
      denominator,

    (1 - g - k) /
      denominator,

    (1 - b - k) /
      denominator,

    k,
  ].map(
    value =>
      Math.max(
        0,
        Math.min(
          1,
          value,
        ),
      ),
  );
}

async function normalizePrintedPdf(
  bytes,
  renderScale,
) {
  if (
    renderScale ===
    1
  ) {
    return Buffer.from(
      bytes,
    );
  }

  const source =
    await PDFDocument.load(
      bytes,
    );

  const result =
    await PDFDocument.create();

  for (
    const sourcePage
    of source.getPages()
  ) {
    const width =
      sourcePage.getWidth() /
      renderScale;

    const height =
      sourcePage.getHeight() /
      renderScale;

    const page =
      result.addPage([
        width,
        height,
      ]);

    const embedded =
      await result.embedPage(
        sourcePage,
      );

    page.drawPage(
      embedded,
      {
        x: 0,
        y: 0,
        width,
        height,
      },
    );
  }

  return Buffer.from(
    await result.save({
      useObjectStreams:
        false,
    }),
  );
}

async function prepareSvg(
  bytes,
) {
  const svg =
    bytes.toString(
      'utf8',
    );

  if (
    /<!DOCTYPE|<!ENTITY/i.test(
      svg,
    )
  ) {
    throw new Error(
      'SVG с DTD или внешними сущностями не поддерживается.',
    );
  }

  const {
    chromium,
  } =
    await import(
      'playwright'
    );

  let browser;

  try {
    browser =
      await chromium.launch({
        headless:
          true,
      });

    const context =
      await browser.newContext({
        javaScriptEnabled:
          false,

        serviceWorkers:
          'block',
      });

    await context.route(
      '**/*',
      route => {
        const url =
          route
            .request()
            .url();

        if (
          url.startsWith(
            'data:',
          ) ||
          url.startsWith(
            'about:',
          )
        ) {
          return route.continue();
        }

        return route.abort();
      },
    );

    const page =
      await context.newPage();

    await page.setContent(`
      <!doctype html>

      <html>
        <head>
          <meta charset="utf-8">

          <style>
            html,
            body {
              margin: 0;
              padding: 0;
              overflow: hidden;
              background: transparent;
            }

            svg {
              display: block;
            }
          </style>
        </head>

        <body></body>
      </html>
    `);

    const layout =
      await page.evaluate(
        async ({
          source,
          renderScale,
        }) => {
          const xml =
            new DOMParser()
              .parseFromString(
                source,
                'image/svg+xml',
              );

          if (
            xml.querySelector(
              'parsererror',
            ) ||
            xml.documentElement
              .localName !==
              'svg'
          ) {
            throw new Error(
              'Некорректный SVG.',
            );
          }

          const sourceRoot =
            xml.documentElement;

          const forbidden =
            new Set([
              'script',
              'foreignObject',
              'iframe',
              'object',
              'embed',
              'audio',
              'video',
              'animate',
              'animateTransform',
              'set',
            ]);

          for (
            const element
            of [
              sourceRoot,
              ...sourceRoot
                .querySelectorAll(
                  '*',
                ),
            ]
          ) {
            if (
              forbidden.has(
                element.localName,
              )
            ) {
              throw new Error(
                `SVG содержит неподдерживаемый элемент: ${element.localName}`,
              );
            }

            for (
              const attr
              of [
                ...element
                  .attributes,
              ]
            ) {
              if (
                /^on/i.test(
                  attr.name,
                )
              ) {
                throw new Error(
                  'Обработчики событий в SVG запрещены.',
                );
              }

              if (
                attr.localName !==
                'href'
              ) {
                continue;
              }

              const hrefValue =
                String(
                  attr.value || '',
                ).trim();

              const tagName =
                String(
                  element.localName ||
                  '',
                ).toLowerCase();

              if (
                tagName ===
                'image'
              ) {
                const embedded =
                  /^data:image\/[^,]+,/i.test(
                    hrefValue,
                  );

                if (
                  !embedded
                ) {
                  throw new Error(
                    `В SVG найдено внешнее изображение: ${hrefValue.slice(0, 160)}`,
                  );
                }
              }

              if (
                tagName ===
                  'use' &&
                !hrefValue.startsWith(
                  '#',
                )
              ) {
                throw new Error(
                  `В SVG найдена внешняя ссылка use: ${hrefValue.slice(0, 160)}`,
                );
              }
            }
          }

          const dimension =
            name => {
              const value =
                sourceRoot
                  .getAttribute(
                    name,
                  ) || '';

              const match =
                value.match(
                  /^(\d+(?:\.\d+)?)(?:px)?$/,
                );

              if (!match) {
                throw new Error(
                  `Не удалось определить размер SVG: ${name}.`,
                );
              }

              return Number(
                match[1],
              );
            };

          const width =
            dimension(
              'width',
            );

          const height =
            dimension(
              'height',
            );

          if (
            width <= 0 ||
            height <= 0 ||
            width > 14400 ||
            height > 14400
          ) {
            throw new Error(
              'Некорректный размер документа.',
            );
          }

          const root =
            document.importNode(
              sourceRoot,
              true,
            );

          root.setAttribute(
            'width',
            String(width),
          );

          root.setAttribute(
            'height',
            String(height),
          );

          document.body.append(
            root,
          );

          await document
            .fonts
            .ready;

          const rootRect =
            root
              .getBoundingClientRect();

          const links = [];

          for (
            const anchor
            of root.querySelectorAll(
              'a',
            )
          ) {
            const href =
              anchor.getAttribute(
                'href',
              ) ||
              anchor.getAttribute(
                'xlink:href',
              ) ||
              '';

            if (
              !/^https?:\/\//i.test(
                href,
              )
            ) {
              continue;
            }

            const rect =
              anchor
                .getBoundingClientRect();

            if (
              rect.width <= 0 ||
              rect.height <= 0
            ) {
              continue;
            }

            links.push({
              href,

              x:
                rect.left -
                rootRect.left,

              y:
                rect.top -
                rootRect.top,

              width:
                rect.width,

              height:
                rect.height,
            });
          }

          const blocks = [];

          const textElements =
            [
              ...root
                .querySelectorAll(
                  'text',
                ),
            ];

          const filterIdFromValue =
            value => {
              const match =
                String(
                  value || '',
                ).match(
                  /^url\(\s*["']?#([^"')]+)["']?\s*\)$/,
                );

              return match
                ? match[1]
                : null;
            };

          const findFilterOwner =
            textElement => {
              let node =
                textElement;

              while (node) {
                if (
                  node.getAttribute
                ) {
                  const id =
                    filterIdFromValue(
                      node.getAttribute(
                        'filter',
                      ),
                    );

                  if (id) {
                    return {
                      owner:
                        node,

                      id,
                    };
                  }
                }

                if (
                  node ===
                  root
                ) {
                  break;
                }

                node =
                  node.parentElement;
              }

              return null;
            };

          const containsOnlyTextGraphics =
            owner => {
              if (
                owner.localName ===
                'text'
              ) {
                return true;
              }

              return !owner
                .querySelector(
                  [
                    'path',
                    'rect',
                    'circle',
                    'ellipse',
                    'line',
                    'polyline',
                    'polygon',
                    'image',
                    'use',
                  ].join(','),
                );
            };

          let filterCounter =
            0;

          const makeShadowOnlyFilter =
            original => {
              const clone =
                original.cloneNode(
                  true,
                );

              clone.id =
                `${
                  original.id ||
                  'filter'
                }__pdf_shadow_${
                  filterCounter++
                }`;

              /*
               * Берём только результаты эффектов shadow.
               * SourceGraphic в финальный результат
               * вообще не попадает.
               */
              const shadowResults =
                [
                  ...clone.children,
                ]
                  .map(
                    primitive =>
                      primitive.getAttribute(
                        'result',
                      ) || '',
                  )
                  .filter(
                    result =>
                      /shadow/i.test(
                        result,
                      ),
                  );

              const uniqueResults =
                [
                  ...new Set(
                    shadowResults,
                  ),
                ];

              if (
                !uniqueResults.length
              ) {
                return null;
              }

              const merge =
                document.createElementNS(
                  'http://www.w3.org/2000/svg',
                  'feMerge',
                );

              for (
                const result
                of uniqueResults
              ) {
                const node =
                  document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'feMergeNode',
                  );

                node.setAttribute(
                  'in',
                  result,
                );

                merge.append(
                  node,
                );
              }

              /*
               * Последний primitive определяет,
               * что реально будет нарисовано.
               * Теперь это ТОЛЬКО тени.
               */
              clone.append(
                merge,
              );

              return clone;
            };

          /*
           * Для каждого объекта с drop-shadow:
           *
           * EFFECT LAYER:
           * отдельная копия только с тенью.
           *
           * SOURCE LAYER:
           * исходный объект без filter,
           * поэтому rect/path/svg остаются векторными.
           */
          const filterOwners =
            [
              ...root.querySelectorAll(
                '[filter]',
              ),
            ].filter(
              owner =>
                !owner.closest(
                  'defs',
                ),
            );

          for (
            const owner
            of filterOwners
          ) {
            const filterId =
              filterIdFromValue(
                owner.getAttribute(
                  'filter',
                ),
              );

            if (!filterId) {
              continue;
            }

            const original =
              [
                ...root.querySelectorAll(
                  'filter',
                ),
              ].find(
                filter =>
                  filter.id ===
                  filterId,
              );

            if (!original) {
              continue;
            }

            const shadowOnly =
              makeShadowOnlyFilter(
                original,
              );

            /*
             * Если это не обычный shadow-filter
             * (например layer blur),
             * его пока не трогаем.
             */
            if (!shadowOnly) {
              continue;
            }

            let defs =
              root.querySelector(
                'defs',
              );

            if (!defs) {
              defs =
                document.createElementNS(
                  'http://www.w3.org/2000/svg',
                  'defs',
                );

              root.prepend(
                defs,
              );
            }

            defs.append(
              shadowOnly,
            );

            const effectLayer =
              owner.cloneNode(
                true,
              );

            /*
             * У копии не должно быть того же
             * корневого SVG id.
             */
            effectLayer.removeAttribute(
              'id',
            );

            effectLayer.setAttribute(
              'filter',
              `url(#${shadowOnly.id})`,
            );

            effectLayer.setAttribute(
              'data-pdf-effect-layer',
              '1',
            );

            /*
             * Главное:
             * с настоящего объекта filter снимаем.
             *
             * Поэтому кнопка, иконка и SVG-графика
             * больше не обязаны превращаться
             * целиком в bitmap.
             */
            owner.removeAttribute(
              'filter',
            );

            if (
              owner.parentNode
            ) {
              owner.parentNode.insertBefore(
                effectLayer,
                owner,
              );
            }
          }

          const cleanText =
            value =>
              Array.from(
                String(
                  value || '',
                ),
              )
                .filter(
                  char => {
                    const cp =
                      char.codePointAt(
                        0,
                      );

                    if (
                      cp <= 0x1f ||
                      cp === 0x7f
                    ) {
                      return false;
                    }

                    if (
                      cp === 0x00ad ||
                      cp === 0x061c ||
                      cp === 0x180e ||
                      (
                        cp >= 0x200b &&
                        cp <= 0x200f
                      ) ||
                      cp === 0x2028 ||
                      cp === 0x2029 ||
                      (
                        cp >= 0x202a &&
                        cp <= 0x202e
                      ) ||
                      (
                        cp >= 0x2060 &&
                        cp <= 0x206f
                      ) ||
                      cp === 0xfeff ||
                      cp === 0xfffc
                    ) {
                      return false;
                    }

                    return true;
                  },
                )
                .join('');

          for (
            const textElement
            of textElements
          ) {
            const block = {
              segments: [],
            };

            const tspans =
              [
                ...textElement
                  .querySelectorAll(
                    'tspan',
                  ),
              ];

            const pieces =
              tspans.length
                ? tspans
                : [
                    textElement,
                  ];

            for (
              const piece
              of pieces
            ) {
              const rawText =
                piece.textContent ||
                '';

              const text =
                cleanText(
                  rawText,
                );

              if (!text) {
                continue;
              }

              let start;

              try {
                start =
                  piece
                    .getStartPositionOfChar(
                      0,
                    );
              } catch {
                continue;
              }

              const matrix =
                piece.getCTM();

              if (!matrix) {
                continue;
              }

              const style =
                getComputedStyle(
                  piece,
                );

              const scaleX =
                Math.hypot(
                  matrix.a,
                  matrix.b,
                );

              const scaleY =
                Math.hypot(
                  matrix.c,
                  matrix.d,
                );

              const x =
                matrix.a *
                  start.x +
                matrix.c *
                  start.y +
                matrix.e;

              const y =
                matrix.b *
                  start.x +
                matrix.d *
                  start.y +
                matrix.f;

              const fontSize =
                (
                  parseFloat(
                    style.fontSize,
                  ) ||
                  12
                ) *
                scaleY;

              const parsedLetterSpacing =
                parseFloat(
                  style.letterSpacing,
                );

              const letterSpacing =
                Number.isFinite(
                  parsedLetterSpacing,
                )
                  ? parsedLetterSpacing *
                    scaleX
                  : 0;

              const rotation =
                Math.atan2(
                  matrix.b,
                  matrix.a,
                ) *
                180 /
                Math.PI;

              const opacity =
                (
                  Number(
                    style.opacity ||
                    1,
                  ) ||
                  1
                ) *
                (
                  Number(
                    style.fillOpacity ||
                    1,
                  ) ||
                  1
                );

              let renderedLength =
                0;

              try {
                renderedLength =
                  piece
                    .getComputedTextLength() *
                  scaleX;
              } catch {
                renderedLength =
                  0;
              }

              block
                .segments
                .push({
                  text,

                  x,
                  y,

                  fontFamily:
                    style.fontFamily,

                  fontSize,

                  fontWeight:
                    style.fontWeight,

                  fontStyle:
                    style.fontStyle,

                  letterSpacing,

                  rotation,

                  fill:
                    style.fill,

                  opacity,

                  renderedLength,
                });
            }

            if (
              block
                .segments
                .length
            ) {
              blocks.push(
                block,
              );
            }

            /*
             * Исходный SVG-текст из background
             * удаляем ВСЕГДА.
             *
             * В PDF он будет добавлен потом
             * только один раз как editable text.
             *
             * Тень уже существует отдельно
             * в effectLayer.
             */
            textElement.remove();
          }

          root.style
            .transformOrigin =
            '0 0';

          root.style.transform =
            `scale(${renderScale})`;

          const printStyle =
            document
              .createElement(
                'style',
              );

          printStyle.textContent = `
            @page {
              size:
                ${width * renderScale}px
                ${height * renderScale}px;

              margin: 0;
            }

            html,
            body {
              width:
                ${width * renderScale}px;

              height:
                ${height * renderScale}px;
            }
          `;

          document.head.append(
            printStyle,
          );

          return {
            width,
            height,
            blocks,
            links,
          };
        },
        {
          source:
            svg,

          renderScale:
            BACKGROUND_RENDER_SCALE,
        },
      );

    await page.setViewportSize({
      width:
        Math.max(
          1,
          Math.ceil(
            layout.width *
            BACKGROUND_RENDER_SCALE,
          ),
        ),

      height:
        Math.max(
          1,
          Math.ceil(
            layout.height *
            BACKGROUND_RENDER_SCALE,
          ),
        ),
    });

    const highResBackground =
      await page.pdf({
        printBackground:
          true,

        preferCSSPageSize:
          true,

        margin: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
      });

    await context.close();

    const background =
      await normalizePrintedPdf(
        highResBackground,
        BACKGROUND_RENDER_SCALE,
      );

    return {
      background,
      layout,
    };
  } catch (error) {
    if (
      /Executable doesn't exist/i.test(
        String(error),
      )
    ) {
      throw new Error(
        'Установите модуль PDF: npm run setup:browser',
      );
    }

    throw error;
  } finally {
    await browser?.close();
  }
}

async function convertBackgroundToCmyk(
  source,
  profile,
) {
  const gs =
    await ghostscriptPath();

  const dir =
    await mkdtemp(
      join(
        tmpdir(),
        'figma-cmyk-',
      ),
    );

  try {
    const sourcePath =
      join(
        dir,
        'source.pdf',
      );

    const profilePath =
      join(
        dir,
        'output.icc',
      );

    const resultPath =
      join(
        dir,
        'cmyk.pdf',
      );

    await Promise.all([
      writeFile(
        sourcePath,
        source,
      ),

      writeFile(
        profilePath,
        profile.bytes,
      ),
    ]);

    await run(
      gs,
      [
        '-dSAFER',
        '-dBATCH',
        '-dNOPAUSE',

        `--permit-file-read=${profilePath}`,

        '-sDEVICE=pdfwrite',

        '-dCompatibilityLevel=1.7',

        '-sColorConversionStrategy=CMYK',

        '-sProcessColorModel=DeviceCMYK',

        `-sDefaultCMYKProfile=${profilePath}`,

        `-sOutputICCProfile=${profilePath}`,

        '-dRenderIntent=1',

        '-dBlackPtComp=1',

        '-dPreserveSeparation=false',

        '-dDownsampleColorImages=false',

        '-dDownsampleGrayImages=false',

        '-dDownsampleMonoImages=false',

        '-dAutoRotatePages=/None',

        `-sOutputFile=${resultPath}`,

        sourcePath,
      ],
      {
        timeout:
          120000,

        maxBuffer:
          4 *
          1024 *
          1024,
      },
    );

    return await readFile(
      resultPath,
    );
  } finally {
    await rm(
      dir,
      {
        recursive:
          true,

        force:
          true,
      },
    );
  }
}

function addOutputIntent(
  document,
  profile,
) {
  const icc =
    document
      .context
      .register(
        document
          .context
          .flateStream(
            profile.bytes,
            {
              N: 4,
            },
          ),
      );

  const intent =
    document
      .context
      .obj({
        Type:
          'OutputIntent',

        S:
          'GTS_PDFX',

        OutputConditionIdentifier:
          PDFString.of(
            'Custom CMYK',
          ),

        Info:
          PDFString.of(
            'CMYK conversion profile',
          ),

        DestOutputProfile:
          icc,
      });

  document.catalog.set(
    PDFName.of(
      'OutputIntents',
    ),

    document
      .context
      .obj([
        document
          .context
          .register(
            intent,
          ),
      ]),
  );
}

function addLinksToPage(
  document,
  page,
  links,
  layout,
) {
  if (
    !Array.isArray(
      links,
    ) ||
    !links.length
  ) {
    return;
  }

  const scaleX =
    page.getWidth() /
    layout.width;

  const scaleY =
    page.getHeight() /
    layout.height;

  const refs = [];

  for (
    const link
    of links
  ) {
    if (
      !link ||
      !/^https?:\/\//i.test(
        link.href ||
        '',
      )
    ) {
      continue;
    }

    const x1 =
      link.x *
      scaleX;

    const x2 =
      (
        link.x +
        link.width
      ) *
      scaleX;

    const y2 =
      page.getHeight() -
      link.y *
      scaleY;

    const y1 =
      page.getHeight() -
      (
        link.y +
        link.height
      ) *
      scaleY;

    const annotation =
      document
        .context
        .obj({
          Type:
            'Annot',

          Subtype:
            'Link',

          Rect: [
            x1,
            y1,
            x2,
            y2,
          ],

          Border: [
            0,
            0,
            0,
          ],

          A: {
            S:
              'URI',

            URI:
              PDFString.of(
                link.href,
              ),
          },
        });

    refs.push(
      document
        .context
        .register(
          annotation,
        ),
    );
  }

  if (
    !refs.length
  ) {
    return;
  }

  const annots =
    document
      .context
      .obj([]);

  for (
    const ref
    of refs
  ) {
    annots.push(
      ref,
    );
  }

  page.node.set(
    PDFName.of(
      'Annots',
    ),

    annots,
  );
}

async function addEditableText(
  backgroundBytes,
  layout,
  colorMode,
  profile,
) {
  const document =
    await PDFDocument.load(
      backgroundBytes,
    );

  document.registerFontkit(
    fontkit,
  );

  const pages =
    document.getPages();

  if (
    !pages.length
  ) {
    throw new Error(
      'PDF не содержит страниц.',
    );
  }

  const page =
    pages[0];

  const scaleX =
    page.getWidth() /
    layout.width;

  const scaleY =
    page.getHeight() /
    layout.height;

  const fonts =
    new Map();

  async function getFont(
    segment,
  ) {
    const family =
      primaryFontFamily(
        segment.fontFamily,
      );

    const key = [
      family,
      segment.fontWeight,
      segment.fontStyle,
    ].join('|');

    let font =
      fonts.get(
        key,
      );

    if (font) {
      return font;
    }

    const path =
      await resolveFontFile(
        family,
        segment.fontWeight,
        segment.fontStyle,
      );

    const fontBytes =
      await readFile(
        path,
      );

    try {
      font =
        await document.embedFont(
          fontBytes,
          {
            subset:
              true,
          },
        );
    } catch (error) {
      throw new Error(
        `Не удалось встроить шрифт "${family}" из "${basename(path)}": ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }

    fonts.set(
      key,
      font,
    );

    return font;
  }

  for (
    const block
    of layout.blocks ||
    []
  ) {
    if (
      !block
        .segments
        .length
    ) {
      continue;
    }

    const operators = [
      pushGraphicsState(),
      beginText(),
    ];

    for (
      const segment
      of block.segments
    ) {
      const text =
        cleanPdfText(
          segment.text,
        );

      if (!text) {
        continue;
      }

      const font =
        await getFont(
          segment,
        );

      const {
        newFontKey,
      } =
        page
          .setOrEmbedFont(
            font,
          );

      const [
        r,
        g,
        b,
      ] =
        parseRgbColor(
          segment.fill,
        );

      const color =
        colorMode ===
        'CMYK'
          ? (() => {
              const [
                c,
                m,
                y,
                k,
              ] =
                rgbToCmyk(
                  r,
                  g,
                  b,
                );

              return cmyk(
                c,
                m,
                y,
                k,
              );
            })()
          : rgb(
              r,
              g,
              b,
            );

      const x =
        segment.x *
        scaleX;

      const y =
        page.getHeight() -
        segment.y *
        scaleY;

      const size =
        segment.fontSize *
        scaleY;

      const rotation =
        -segment.rotation;

      let letterSpacing =
        segment
          .letterSpacing *
        scaleX;

      const chars =
        Array.from(
          text,
        );

      if (
        segment
          .renderedLength >
          0 &&
        chars.length >
          1
      ) {
        const targetWidth =
          segment
            .renderedLength *
          scaleX;

        const naturalWidth =
          font
            .widthOfTextAtSize(
              text,
              size,
            );

        const calibrated =
          (
            targetWidth -
            naturalWidth
          ) /
          (
            chars.length -
            1
          );

        if (
          Number.isFinite(
            calibrated,
          )
        ) {
          letterSpacing =
            calibrated;
        }
      }

      const opacity =
        Math.max(
          0,
          Math.min(
            1,
            segment.opacity,
          ),
        );

      const graphicsStateKey =
        page
          .maybeEmbedGraphicsState({
            opacity,
          });

      if (
        graphicsStateKey
      ) {
        operators.push(
          setGraphicsState(
            graphicsStateKey,
          ),
        );
      }

      operators.push(
        setFillingColor(
          color,
        ),

        setFontAndSize(
          newFontKey,
          size,
        ),

        setCharacterSpacing(
          letterSpacing,
        ),

        rotateAndSkewTextDegreesAndTranslate(
          rotation,
          0,
          0,
          x,
          y,
        ),

        showText(
          font.encodeText(
            text,
          ),
        ),
      );
    }

    operators.push(
      endText(),
      popGraphicsState(),
    );

    page
      .getContentStream()
      .push(
        ...operators,
      );
  }

  addLinksToPage(
    document,
    page,
    layout.links,
    layout,
  );

  if (
    colorMode ===
      'CMYK' &&
    profile
  ) {
    addOutputIntent(
      document,
      profile,
    );
  }

  return Buffer.from(
    await document.save({
      useObjectStreams:
        false,
    }),
  );
}

export async function convert(
  input,
) {
  if (
    !input ||
    ![
      'RGB',
      'CMYK',
    ].includes(
      input.colorMode,
    ) ||
    ![
      'application/pdf',
      'image/svg+xml',
    ].includes(
      input.mime,
    ) ||
    typeof input.base64 !==
      'string' ||
    input.base64.length >
      MAX_BYTES *
      1.34
  ) {
    throw new Error(
      'Некорректный запрос конвертации.',
    );
  }

  const bytes =
    Buffer.from(
      input.base64,
      'base64',
    );

  if (
    !bytes.length ||
    bytes.length >
      MAX_BYTES
  ) {
    throw new Error(
      'Допустимый размер одного файла: до 100 МБ.',
    );
  }

  if (
    input.mime ===
      'application/pdf' &&
    !bytes
      .subarray(
        0,
        5,
      )
      .equals(
        Buffer.from(
          '%PDF-',
        ),
      )
  ) {
    throw new Error(
      'Не найден заголовок PDF.',
    );
  }

  if (
    input.mime ===
    'application/pdf'
  ) {
    if (
      input.colorMode ===
      'RGB'
    ) {
      return {
        bytes,

        profile:
          null,
      };
    }

    const profile =
      await getProfile(
        input.profile,
      );

    const converted =
      await convertBackgroundToCmyk(
        bytes,
        profile,
      );

    const document =
      await PDFDocument.load(
        converted,
      );

    addOutputIntent(
      document,
      profile,
    );

    return {
      bytes:
        Buffer.from(
          await document.save({
            useObjectStreams:
              false,
          }),
        ),

      profile:
        profile.name,
    };
  }

  const {
    background,
    layout,
  } =
    await prepareSvg(
      bytes,
    );

  if (
    input.colorMode ===
    'RGB'
  ) {
    const result =
      await addEditableText(
        background,
        layout,
        'RGB',
        null,
      );

    return {
      bytes:
        result,

      profile:
        null,
    };
  }

  const profile =
    await getProfile(
      input.profile,
    );

  const cmykBackground =
    await convertBackgroundToCmyk(
      background,
      profile,
    );

  const result =
    await addEditableText(
      cmykBackground,
      layout,
      'CMYK',
      profile,
    );

  return {
    bytes:
      result,

    profile:
      profile.name,
  };
}