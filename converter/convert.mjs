import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
} from 'node:fs/promises';

import {
  tmpdir,
} from 'node:os';

import {
  join,
} from 'node:path';

import {
  PDFDocument,
  PDFName,
  PDFString,
  PDFRawStream,
  PDFArray,
  PDFDict,
  PDFOperator,
  decodePDFRawStream,
} from 'pdf-lib';

import {
  run,
  ghostscriptPath,
  browserExecutablePath,
} from './runtime.mjs';

import {
  getProfile,
} from './profiles.mjs';

const MAX_BYTES =
  100 * 1024 * 1024;

function cleanText(
  value,
) {
  return Array.from(
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
}

function formatNumber(
  value,
) {
  const rounded =
    Math.round(
      value * 100000,
    ) / 100000;

  return String(
    Object.is(
      rounded,
      -0,
    )
      ? 0
      : rounded,
  );
}

function rgbToCmyk(
  r,
  g,
  b,
) {
  r =
    Math.max(
      0,
      Math.min(
        1,
        r,
      ),
    );

  g =
    Math.max(
      0,
      Math.min(
        1,
        g,
      ),
    );

  b =
    Math.max(
      0,
      Math.min(
        1,
        b,
      ),
    );

  const k =
    1 -
    Math.max(
      r,
      g,
      b,
    );

  if (
    k >= 0.999999
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

function convertColorOperatorsToCmyk(
  content,
) {
  let result =
    content.replace(
      /(^|\s)([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+(rg|RG)(?=\s|$)/gm,

      (
        _match,
        prefix,
        r,
        g,
        b,
        operator,
      ) => {
        const [
          c,
          m,
          y,
          k,
        ] =
          rgbToCmyk(
            Number(r),
            Number(g),
            Number(b),
          );

        return (
          `${prefix}` +
          `${formatNumber(c)} ` +
          `${formatNumber(m)} ` +
          `${formatNumber(y)} ` +
          `${formatNumber(k)} ` +
          `${operator === 'rg' ? 'k' : 'K'}`
        );
      },
    );

  result =
    result.replace(
      /(^|\s)([+-]?(?:\d+\.?\d*|\.\d+))\s+(g|G)(?=\s|$)/gm,

      (
        _match,
        prefix,
        gray,
        operator,
      ) => {
        const k =
          1 -
          Math.max(
            0,
            Math.min(
              1,
              Number(gray),
            ),
          );

        return (
          `${prefix}` +
          `0 0 0 ` +
          `${formatNumber(k)} ` +
          `${operator === 'g' ? 'k' : 'K'}`
        );
      },
    );

  return result;
}

async function convertTextPdfColorsToCmyk(
  bytes,
) {
  const document =
    await PDFDocument.load(
      bytes,
    );

  for (
    const page
    of document.getPages()
  ) {
    const contents =
      page.node.Contents();

    const convertStream =
      stream => {
        if (
          !(
            stream instanceof
            PDFRawStream
          )
        ) {
          return null;
        }

        const decoded =
          Buffer.from(
            decodePDFRawStream(
              stream,
            ).decode(),
          ).toString(
            'latin1',
          );

        const converted =
          convertColorOperatorsToCmyk(
            decoded,
          );

        return document
          .context
          .register(
            document
              .context
              .flateStream(
                Buffer.from(
                  converted,
                  'latin1',
                ),
              ),
          );
      };

    if (
      contents instanceof
      PDFRawStream
    ) {
      const ref =
        convertStream(
          contents,
        );

      if (ref) {
        page.node.set(
          PDFName.of(
            'Contents',
          ),

          ref,
        );
      }

      continue;
    }

    if (
      contents instanceof
      PDFArray
    ) {
      const refs =
        [];

      for (
        let index = 0;
        index <
          contents.size();
        index++
      ) {
        const stream =
          contents.lookup(
            index,
          );

        refs.push(
          convertStream(
            stream,
          ) ||
          contents.get(
            index,
          ),
        );
      }

      page.node.set(
        PDFName.of(
          'Contents',
        ),

        document
          .context
          .obj(
            refs,
          ),
      );
    }
  }

  return Buffer.from(
    await document.save({
      useObjectStreams:
        false,
    }),
  );
}

function splitLinesKeepEnding(
  value,
) {
  return (
    value.match(
      /[^\n]*\n|[^\n]+$/g,
    ) ||
    []
  );
}

function splitTopLevelBlocks(
  content,
) {
  const lines =
    splitLinesKeepEnding(
      content,
    );

  const result =
    [];

  let depth = 0;
  let block = [];
  let raw = [];

  const flushRaw =
    () => {
      if (
        !raw.length
      ) {
        return;
      }

      result.push({
        kind:
          'raw',

        text:
          raw.join(''),
      });

      raw = [];
    };

  for (
    const line
    of lines
  ) {
    const token =
      line.trim();

    if (
      token ===
      'q'
    ) {
      if (
        depth === 0
      ) {
        flushRaw();

        block = [
          line,
        ];
      } else {
        block.push(
          line,
        );
      }

      depth++;

      continue;
    }

    if (
      token ===
        'Q' &&
      depth > 0
    ) {
      block.push(
        line,
      );

      depth--;

      if (
        depth === 0
      ) {
        result.push({
          kind:
            'block',

          text:
            block.join(''),
        });

        block = [];
      }

      continue;
    }

    if (
      depth > 0
    ) {
      block.push(
        line,
      );
    } else {
      raw.push(
        line,
      );
    }
  }

  if (
    block.length
  ) {
    raw.push(
      ...block,
    );
  }

  flushRaw();

  return result;
}

function firstMatrix(
  block,
) {
  const lines =
    block
      .split('\n')
      .slice(
        0,
        14,
      );

  for (
    const line
    of lines
  ) {
    const match =
      line.match(
        /^\s*([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+cm\s*$/,
      );

    if (!match) {
      continue;
    }

    return match
      .slice(
        1,
      )
      .map(
        Number,
      );
  }

  return null;
}

function isTextMetadataBlock(
  block,
) {
  return (
    /(?:^|\n)\s*BT\s*(?:\n|$)/.test(
      block,
    ) &&
    /(?:^|\n)\s*ET\s*(?:\n|$)/.test(
      block,
    )
  );
}

function isVisualTextCandidate(
  block,
) {
  if (
    isTextMetadataBlock(
      block,
    )
  ) {
    return false;
  }

  if (
    /(?:^|\n)\s*\/[^\s]+\s+Do\s*(?:\n|$)/.test(
      block,
    )
  ) {
    return false;
  }

  const hasPath =
    /(?:^|\n)\s*[+-]?(?:\d+\.?\d*|\.\d+)\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+m\s*(?:\n|$)/.test(
      block,
    );

  const hasFill =
    /(?:^|\n)\s*(?:f|f\*|B|B\*|b|b\*)\s*(?:\n|$)/.test(
      block,
    );

  return (
    hasPath &&
    hasFill
  );
}

function matrixLinearDistance(
  a,
  b,
) {
  return (
    Math.abs(
      a[0] -
      b[0],
    ) +
    Math.abs(
      a[1] -
      b[1],
    ) +
    Math.abs(
      a[2] -
      b[2],
    ) +
    Math.abs(
      a[3] -
      b[3],
    )
  );
}

function stripFigmaTextGraphics(
  content,
) {
  const items =
    splitTopLevelBlocks(
      content,
    );

  const textBlocks =
    [];

  const visualBlocks =
    [];

  for (
    let index = 0;
    index <
      items.length;
    index++
  ) {
    const item =
      items[index];

    if (
      item.kind !==
      'block'
    ) {
      continue;
    }

    const matrix =
      firstMatrix(
        item.text,
      );

    if (!matrix) {
      continue;
    }

    if (
      isTextMetadataBlock(
        item.text,
      )
    ) {
      textBlocks.push({
        index,
        matrix,
      });

      continue;
    }

    if (
      isVisualTextCandidate(
        item.text,
      )
    ) {
      visualBlocks.push({
        index,
        matrix,
      });
    }
  }

  const remove =
    new Set();

  const usedVisual =
    new Set();

  for (
    const textBlock
    of textBlocks
  ) {
    remove.add(
      textBlock.index,
    );

    const [
      ta,
      tb,
      tc,
      td,
      tx,
      ty,
    ] =
      textBlock.matrix;

    let best =
      null;

    for (
      const visual
      of visualBlocks
    ) {
      if (
        usedVisual.has(
          visual.index,
        )
      ) {
        continue;
      }

      const [
        va,
        vb,
        vc,
        vd,
        vx,
        vy,
      ] =
        visual.matrix;

      const linearDistance =
        matrixLinearDistance(
          [
            ta,
            tb,
            tc,
            td,
          ],

          [
            va,
            vb,
            vc,
            vd,
          ],
        );

      const xDistance =
        Math.abs(
          tx -
          vx,
        );

      const yDistance =
        Math.abs(
          ty -
          vy,
        );

      if (
        linearDistance >
          0.08 ||
        xDistance >
          4 ||
        yDistance >
          120
      ) {
        continue;
      }

      const score =
        linearDistance *
          1000 +
        xDistance *
          100 +
        yDistance;

      if (
        !best ||
        score <
          best.score
      ) {
        best = {
          index:
            visual.index,

          score,
        };
      }
    }

    if (best) {
      usedVisual.add(
        best.index,
      );

      remove.add(
        best.index,
      );
    }
  }

  return items
    .filter(
      (
        _item,
        index,
      ) =>
        !remove.has(
          index,
        ),
    )
    .map(
      item =>
        item.text,
    )
    .join('');
}

function replacePdfStream(
  document,
  stream,
) {
  if (
    !(
      stream instanceof
      PDFRawStream
    )
  ) {
    return null;
  }

  const decoded =
    Buffer.from(
      decodePDFRawStream(
        stream,
      ).decode(),
    ).toString(
      'latin1',
    );

  const stripped =
    stripFigmaTextGraphics(
      decoded,
    );

  return document
    .context
    .register(
      document
        .context
        .flateStream(
          Buffer.from(
            stripped,
            'latin1',
          ),
        ),
    );
}

async function stripNativeFigmaText(
  bytes,
) {
  const document =
    await PDFDocument.load(
      bytes,
    );

  for (
    const page
    of document.getPages()
  ) {
    const contents =
      page.node.Contents();

    if (
      contents instanceof
      PDFRawStream
    ) {
      const ref =
        replacePdfStream(
          document,
          contents,
        );

      if (ref) {
        page.node.set(
          PDFName.of(
            'Contents',
          ),

          ref,
        );
      }

      continue;
    }

    if (
      contents instanceof
      PDFArray
    ) {
      const refs =
        [];

      for (
        let index = 0;
        index <
          contents.size();
        index++
      ) {
        const stream =
          contents.lookup(
            index,
          );

        refs.push(
          replacePdfStream(
            document,
            stream,
          ) ||
          contents.get(
            index,
          ),
        );
      }

      page.node.set(
        PDFName.of(
          'Contents',
        ),

        document
          .context
          .obj(
            refs,
          ),
      );
    }
  }

  return Buffer.from(
    await document.save({
      useObjectStreams:
        false,
    }),
  );
}

async function normalizeTextPdfPage(
  bytes,
  width,
  height,
) {
  const document =
    await PDFDocument.load(
      bytes,
    );

  const pages =
    document.getPages();

  if (!pages.length) {
    throw new Error(
      'Текстовый PDF не содержит страниц.',
    );
  }

  const page =
    pages[0];

  const scaleX =
    width /
    page.getWidth();

  const scaleY =
    height /
    page.getHeight();

  page.scaleContent(
    scaleX,
    scaleY,
  );

  page.setSize(
    width,
    height,
  );

  page.node.delete(
    PDFName.of(
      'Annots',
    ),
  );

  return Buffer.from(
    await document.save({
      useObjectStreams:
        false,
    }),
  );
}

let sharedBrowserPromise =
  null;

async function getSharedBrowser() {
  if (
    !sharedBrowserPromise
  ) {
    sharedBrowserPromise =
      (
        async () => {
          const {
            chromium,
          } =
            await import(
              'playwright'
            );

          const executablePath =
            await browserExecutablePath();

          const browser =
            await chromium.launch({
              headless:
                true,

              ...(
                executablePath
                  ? {
                      executablePath,
                    }
                  : {}
              ),
            });

          browser.on(
            'disconnected',
            () => {
              sharedBrowserPromise =
                null;
            },
          );

          return browser;
        }
      )().catch(
        error => {
          sharedBrowserPromise =
            null;

          throw error;
        },
      );
  }

  return sharedBrowserPromise;
}

async function renderTextLayer(
  svgBytes,
) {
  const source =
    svgBytes.toString(
      'utf8',
    );

  if (
    /<!DOCTYPE|<!ENTITY/i.test(
      source,
    )
  ) {
    throw new Error(
      'SVG с DTD или внешними сущностями не поддерживается.',
    );
  }

  let context;

  try {
    const browser =
      await getSharedBrowser();

    context =
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
              text-rendering: geometricPrecision;
            }
          </style>
        </head>

        <body></body>
      </html>
    `);

    const metadata =
      await page.evaluate(
        async source => {
          const clean =
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

          const dimension =
            name => {
              const raw =
                sourceRoot
                  .getAttribute(
                    name,
                  ) ||
                '';

              const match =
                raw.match(
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

          for (
            const text
            of root.querySelectorAll(
              'text',
            )
          ) {
            const walker =
              document.createTreeWalker(
                text,
                NodeFilter.SHOW_TEXT,
              );

            let node;

            while (
              (
                node =
                  walker.nextNode()
              )
            ) {
              node.nodeValue =
                clean(
                  node.nodeValue,
                );
            }
          }

          await document
            .fonts
            .ready;

          const rootRect =
            root.getBoundingClientRect();

          const links =
            [];

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
              anchor.getBoundingClientRect();

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

          const keep =
            new Set();

          for (
            const text
            of root.querySelectorAll(
              'text',
            )
          ) {
            keep.add(
              text,
            );

            for (
              const child
              of text.querySelectorAll(
                '*',
              )
            ) {
              keep.add(
                child,
              );
            }

            let parent =
              text.parentElement;

            while (parent) {
              keep.add(
                parent,
              );

              if (
                parent === root
              ) {
                break;
              }

              parent =
                parent.parentElement;
            }
          }

          for (
            const element
            of [
              ...root.querySelectorAll(
                '*',
              ),
            ].reverse()
          ) {
            if (
              element.closest(
                'defs',
              )
            ) {
              continue;
            }

            if (
              !keep.has(
                element,
              )
            ) {
              element.remove();
            }
          }

          for (
            const element
            of root.querySelectorAll(
              '[filter]',
            )
          ) {
            if (
              !element.closest(
                'defs',
              )
            ) {
              element.removeAttribute(
                'filter',
              );
            }
          }

          const printStyle =
            document.createElement(
              'style',
            );

          printStyle.textContent = `
            @page {
              size:
                ${width}px
                ${height}px;

              margin: 0;
            }

            html,
            body {
              width:
                ${width}px;

              height:
                ${height}px;
            }
          `;

          document.head.append(
            printStyle,
          );

          await document
            .fonts
            .ready;

          return {
            width,
            height,
            links,
          };
        },
        source,
      );

    await page.setViewportSize({
      width:
        Math.max(
          1,
          Math.ceil(
            metadata.width,
          ),
        ),

      height:
        Math.max(
          1,
          Math.ceil(
            metadata.height,
          ),
        ),
    });

    const browserPdf =
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

    const pdf =
      await normalizeTextPdfPage(
        browserPdf,
        metadata.width,
        metadata.height,
      );

    return {
      pdf,
      ...metadata,
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
    await context?.close();
  }
}

async function renderRezkaLayer(
  svgBytes,
  layerName,
  input,
) {
  const source =
    svgBytes.toString(
      'utf8',
    );

  if (
    /<!DOCTYPE|<!ENTITY/i.test(
      source,
    )
  ) {
    throw new Error(
      'SVG слоя rezka содержит DTD или внешние сущности.',
    );
  }

  const strokeWidth =
    Number(
      input.printStrokeWidth,
    );

  if (
    !Number.isFinite(
      strokeWidth,
    ) ||
    strokeWidth <= 0 ||
    strokeWidth > 20
  ) {
    throw new Error(
      'Некорректная толщина линии резки.',
    );
  }

  let targetWidth =
    null;

  let targetHeight =
    null;

  if (
    input.printFinalSizeEnabled
  ) {
    const widthMm =
      Number(
        input.printFinalWidth,
      );

    const heightMm =
      Number(
        input.printFinalHeight,
      );

    if (
      !Number.isFinite(
        widthMm,
      ) ||
      !Number.isFinite(
        heightMm,
      ) ||
      widthMm < 1 ||
      widthMm > 10000 ||
      heightMm < 1 ||
      heightMm > 10000
    ) {
      throw new Error(
        'Некорректный финальный размер PDF.',
      );
    }

    targetWidth =
      widthMm *
      72 /
      25.4;

    targetHeight =
      heightMm *
      72 /
      25.4;
  }

  let context;

  try {
    const browser =
      await getSharedBrowser();

    context =
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

    const metadata =
      await page.evaluate(
        ({
          source,
          layerName,
          targetWidth,
          targetHeight,
          strokeWidth,
          spotEnabled,
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
              'Некорректный SVG слоя rezka.',
            );
          }

          const sourceRoot =
            xml.documentElement;

          const dimension =
            name => {
              const raw =
                sourceRoot
                  .getAttribute(
                    name,
                  ) ||
                '';

              const match =
                raw.match(
                  /^(\d+(?:\.\d+)?)(?:px)?$/,
                );

              if (!match) {
                throw new Error(
                  `Не удалось определить размер SVG rezka: ${name}.`,
                );
              }

              return Number(
                match[1],
              );
            };

          const sourceWidth =
            dimension(
              'width',
            );

          const sourceHeight =
            dimension(
              'height',
            );

          const width =
            targetWidth ||
            sourceWidth;

          const height =
            targetHeight ||
            sourceHeight;

          const root =
            document.importNode(
              sourceRoot,
              true,
            );

          if (
            !root.getAttribute(
              'viewBox',
            )
          ) {
            root.setAttribute(
              'viewBox',
              `0 0 ${sourceWidth} ${sourceHeight}`,
            );
          }

          root.setAttribute(
            'width',
            String(
              width,
            ),
          );

          root.setAttribute(
            'height',
            String(
              height,
            ),
          );

          document.body.append(
            root,
          );

          const normalizeLayerId =
            value =>
              String(
                value || '',
              )
                .trim()
                .toLowerCase()
                .replace(
                  /[\s_-]+/g,
                  '_',
                );

          const wantedId =
            normalizeLayerId(
              layerName,
            );

          const targets =
            [
              ...root.querySelectorAll(
                '[id]',
              ),
            ].filter(
              element => {
                const candidate =
                  normalizeLayerId(
                    element.getAttribute(
                      'id',
                    ),
                  );

                if (
                  candidate ===
                  wantedId
                ) {
                  return true;
                }

                if (
                  !candidate.startsWith(
                    `${wantedId}_`,
                  )
                ) {
                  return false;
                }

                return /^\d+$/.test(
                  candidate.slice(
                    wantedId.length + 1,
                  ),
                );
              },
            );

          if (
            !targets.length
          ) {
            throw new Error(
              `В SVG не найден слой с именем ${layerName}.`,
            );
          }

          const keep =
            new Set([
              root,
            ]);

          for (
            const target
            of targets
          ) {
            keep.add(
              target,
            );

            for (
              const child
              of target.querySelectorAll(
                '*',
              )
            ) {
              keep.add(
                child,
              );
            }

            let parent =
              target.parentElement;

            while (
              parent
            ) {
              keep.add(
                parent,
              );

              if (
                parent ===
                root
              ) {
                break;
              }

              parent =
                parent.parentElement;
            }
          }

          for (
            const element
            of [
              ...root.querySelectorAll(
                '*',
              ),
            ].reverse()
          ) {
            if (
              element.localName ===
                'defs' ||
              element.closest(
                'defs',
              )
            ) {
              continue;
            }

            if (
              !keep.has(
                element,
              )
            ) {
              element.remove();
            }
          }

          const graphicsSelector =
            'path,rect,circle,ellipse,line,polyline,polygon,use';

          const graphics =
            new Set();

          for (
            const target
            of targets
          ) {
            if (
              target.matches(
                graphicsSelector,
              )
            ) {
              graphics.add(
                target,
              );
            }

            for (
              const element
              of target.querySelectorAll(
                graphicsSelector,
              )
            ) {
              graphics.add(
                element,
              );
            }
          }

          let strokeCount =
            0;

          for (
            const element
            of graphics
          ) {
            const computed =
              getComputedStyle(
                element,
              );

            const computedWidth =
              Number.parseFloat(
                computed.strokeWidth ||
                '0',
              );

            const computedOpacity =
              Number.parseFloat(
                computed.strokeOpacity ||
                '1',
              );

            if (
              computed.stroke ===
                'none' ||
              computedWidth <= 0 ||
              computedOpacity <= 0
            ) {
              continue;
            }

            strokeCount++;

            element.style.setProperty(
              'fill',
              'none',
              'important',
            );

            if (
              spotEnabled
            ) {
              element.style.setProperty(
                'stroke',
                '#ff00ff',
                'important',
              );
            }

            element.style.setProperty(
              'stroke-width',
              `${strokeWidth}px`,
              'important',
            );

            element.style.setProperty(
              'stroke-dasharray',
              'none',
              'important',
            );

            element.style.setProperty(
              'stroke-opacity',
              '1',
              'important',
            );

            element.style.setProperty(
              'vector-effect',
              'non-scaling-stroke',
              'important',
            );
          }

          if (
            !strokeCount
          ) {
            throw new Error(
              `Слой ${layerName} не содержит линий stroke для резки.`,
            );
          }

          const printStyle =
            document.createElement(
              'style',
            );

          printStyle.textContent = `
            @page {
              size:
                ${width}px
                ${height}px;

              margin: 0;
            }

            html,
            body {
              width:
                ${width}px;

              height:
                ${height}px;
            }
          `;

          document.head.append(
            printStyle,
          );

          return {
            width,
            height,
            strokeCount,
          };
        },
        {
          source,
          layerName,
          targetWidth,
          targetHeight,
          strokeWidth,
          spotEnabled:
            input.printSpotEnabled ===
              true,
        },
      );

    await page.setViewportSize({
      width:
        Math.max(
          1,
          Math.ceil(
            metadata.width,
          ),
        ),

      height:
        Math.max(
          1,
          Math.ceil(
            metadata.height,
          ),
        ),
    });

    const browserPdf =
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

    const pdf =
      await normalizeTextPdfPage(
        browserPdf,
        metadata.width,
        metadata.height,
      );

    return {
      pdf,
      ...metadata,
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
    await context?.close();
  }
}


async function applySpotCutStyle(
  bytes,
  spotName,
  overprint,
) {
  const document =
    await PDFDocument.load(
      bytes,
    );

  const spotResourceName =
    PDFName.of(
      'LayerExportSpot',
    );

  const overprintResourceName =
    PDFName.of(
      'LayerExportOverprint',
    );

  const tintFunctionRef =
    document.context.register(
      document.context.obj({
        FunctionType:
          2,

        Domain: [
          0,
          1,
        ],

        C0: [
          0,
          0,
          0,
          0,
        ],

        C1: [
          0,
          1,
          0,
          0,
        ],

        N:
          1,
      }),
    );

  const separationRef =
    document.context.register(
      document.context.obj([
        PDFName.of(
          'Separation',
        ),

        PDFName.of(
          spotName,
        ),

        PDFName.of(
          'DeviceCMYK',
        ),

        tintFunctionRef,
      ]),
    );

  const overprintRef =
    document.context.register(
      document.context.obj({
        Type:
          'ExtGState',

        OP:
          Boolean(
            overprint,
          ),

        op:
          Boolean(
            overprint,
          ),

        OPM:
          1,
      }),
    );

  let strokeOperators =
    0;

  const rewriteStream =
    stream => {
      if (
        !(
          stream instanceof
          PDFRawStream
        )
      ) {
        return null;
      }

      const decoded =
        Buffer.from(
          decodePDFRawStream(
            stream,
          ).decode(),
        ).toString(
          'latin1',
        );

      const rewritten =
        decoded.replace(
          /(^|\s)(B\*|b\*|S|s|B|b)(?=\s|$)/gm,

          (
            _match,
            prefix,
            operator,
          ) => {
            strokeOperators++;

            return (
              `${prefix}` +
              `/LayerExportSpot CS\n` +
              `1 SCN\n` +
              `/LayerExportOverprint gs\n` +
              `${operator}`
            );
          },
        );

      return document
        .context
        .register(
          document
            .context
            .flateStream(
              Buffer.from(
                rewritten,
                'latin1',
              ),
            ),
        );
    };

  for (
    const page
    of document.getPages()
  ) {
    const resources =
      page.node.Resources() ||
      document.context.obj({});

    page.node.set(
      PDFName.of(
        'Resources',
      ),
      resources,
    );

    let colorSpaces =
      resources.lookupMaybe(
        PDFName.of(
          'ColorSpace',
        ),
        PDFDict,
      );

    if (
      !colorSpaces
    ) {
      colorSpaces =
        document.context.obj({});

      resources.set(
        PDFName.of(
          'ColorSpace',
        ),
        colorSpaces,
      );
    }

    colorSpaces.set(
      spotResourceName,
      separationRef,
    );

    let extGState =
      resources.lookupMaybe(
        PDFName.of(
          'ExtGState',
        ),
        PDFDict,
      );

    if (
      !extGState
    ) {
      extGState =
        document.context.obj({});

      resources.set(
        PDFName.of(
          'ExtGState',
        ),
        extGState,
      );
    }

    extGState.set(
      overprintResourceName,
      overprintRef,
    );

    const contents =
      page.node.Contents();

    if (
      contents instanceof
      PDFRawStream
    ) {
      const ref =
        rewriteStream(
          contents,
        );

      if (ref) {
        page.node.set(
          PDFName.of(
            'Contents',
          ),
          ref,
        );
      }

      continue;
    }

    if (
      contents instanceof
      PDFArray
    ) {
      const refs =
        [];

      for (
        let index = 0;
        index <
          contents.size();
        index++
      ) {
        const stream =
          contents.lookup(
            index,
          );

        refs.push(
          rewriteStream(
            stream,
          ) ||
          contents.get(
            index,
          ),
        );
      }

      page.node.set(
        PDFName.of(
          'Contents',
        ),
        document.context.obj(
          refs,
        ),
      );
    }
  }

  if (
    !strokeOperators
  ) {
    throw new Error(
      'После рендеринга слоя резки не найден stroke-контур.',
    );
  }

  return Buffer.from(
    await document.save({
      useObjectStreams:
        false,
    }),
  );
}

function addOutputIntent(
  document,
  profile,
) {
  const icc =
    document.context.register(
      document.context.flateStream(
        profile.bytes,
        {
          N: 4,
        },
      ),
    );

  const intent =
    document.context.obj({
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

    document.context.obj([
      document.context.register(
        intent,
      ),
    ]),
  );
}

function replaceLinks(
  document,
  page,
  links,
  width,
  height,
) {
  page.node.delete(
    PDFName.of(
      'Annots',
    ),
  );

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
    width;

  const scaleY =
    page.getHeight() /
    height;

  const annotations =
    document.context.obj(
      [],
    );

  for (
    const link
    of links
  ) {
    if (
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
      document.context.obj({
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

    annotations.push(
      document.context.register(
        annotation,
      ),
    );
  }

  page.node.set(
    PDFName.of(
      'Annots',
    ),

    annotations,
  );
}

async function mergeTextLayer(
  baseBytes,
  textBytes,
  metadata,
  profile,
) {
  const base =
    await PDFDocument.load(
      baseBytes,
    );

  const text =
    await PDFDocument.load(
      textBytes,
    );

  const basePages =
    base.getPages();

  const textPages =
    text.getPages();

  if (
    basePages.length !==
    textPages.length
  ) {
    throw new Error(
      'Не совпадает количество страниц базового PDF и текстового слоя.',
    );
  }

  for (
    let index = 0;
    index <
      basePages.length;
    index++
  ) {
    const basePage =
      basePages[
        index
      ];

    const textPage =
      textPages[
        index
      ];

    const embedded =
      await base.embedPage(
        textPage,
      );

    basePage.drawPage(
      embedded,
      {
        x: 0,
        y: 0,

        width:
          basePage.getWidth(),

        height:
          basePage.getHeight(),
      },
    );

    replaceLinks(
      base,
      basePage,
      metadata.links,
      metadata.width,
      metadata.height,
    );
  }

  if (profile) {
    addOutputIntent(
      base,
      profile,
    );
  }

  return Buffer.from(
    await base.save({
      useObjectStreams:
        false,
    }),
  );
}

async function mergeRezkaLayer(
  baseBytes,
  rezkaBytes,
  layerName,
) {
  const base =
    await PDFDocument.load(
      baseBytes,
    );

  const rezka =
    await PDFDocument.load(
      rezkaBytes,
    );

  const basePages =
    base.getPages();

  const rezkaPages =
    rezka.getPages();

  if (
    basePages.length !==
    rezkaPages.length
  ) {
    throw new Error(
      'Не совпадает количество страниц PDF и слоя rezka.',
    );
  }

  const artworkOcg =
    base.context.obj({
      Type:
        'OCG',

      Name:
        PDFString.of(
          'Artwork',
        ),
    });

  const rezkaOcg =
    base.context.obj({
      Type:
        'OCG',

      Name:
        PDFString.of(
          layerName,
        ),
    });

  const artworkOcgRef =
    base.context.register(
      artworkOcg,
    );

  const rezkaOcgRef =
    base.context.register(
      rezkaOcg,
    );

  base.catalog.set(
    PDFName.of(
      'OCProperties',
    ),

    base.context.obj({
      OCGs: [
        artworkOcgRef,
        rezkaOcgRef,
      ],

      D: {
        Order: [
          artworkOcgRef,
          rezkaOcgRef,
        ],

        ON: [
          artworkOcgRef,
          rezkaOcgRef,
        ],
      },
    }),
  );

  const beginArtworkRef =
    base.context.register(
      PDFRawStream.of(
        base.context.obj({}),
        Buffer.from(
          '/OC /Artwork BDC\n',
        ),
      ),
    );

  const endMarkedRef =
    base.context.register(
      PDFRawStream.of(
        base.context.obj({}),
        Buffer.from(
          'EMC\n',
        ),
      ),
    );

  for (
    let index = 0;
    index <
      basePages.length;
    index++
  ) {
    const basePage =
      basePages[
        index
      ];

    const rezkaPage =
      rezkaPages[
        index
      ];

    const resources =
      basePage.node.Resources() ||
      base.context.obj({});

    basePage.node.set(
      PDFName.of(
        'Resources',
      ),
      resources,
    );

    let properties =
      resources.lookupMaybe(
        PDFName.of(
          'Properties',
        ),
        PDFDict,
      );

    if (
      !properties
    ) {
      properties =
        base.context.obj({});

      resources.set(
        PDFName.of(
          'Properties',
        ),
        properties,
      );
    }

    properties.set(
      PDFName.of(
        'Artwork',
      ),
      artworkOcgRef,
    );

    const cutLayerPropertyName =
      PDFName.of(
        'LayerExportCut',
      );

    properties.set(
      cutLayerPropertyName,
      rezkaOcgRef,
    );

    const originalContents =
      basePage.node.get(
        PDFName.of(
          'Contents',
        ),
      );

    if (
      !originalContents
    ) {
      throw new Error(
        'У страницы нет Contents для оборачивания в слой Artwork.',
      );
    }

    const resolvedContents =
      base.context.lookup(
        originalContents,
      );

    const wrappedContents =
      base.context.obj([]);

    wrappedContents.push(
      beginArtworkRef,
    );

    if (
      resolvedContents instanceof
      PDFArray
    ) {
      for (
        let itemIndex = 0;
        itemIndex <
          resolvedContents.size();
        itemIndex++
      ) {
        wrappedContents.push(
          resolvedContents.get(
            itemIndex,
          ),
        );
      }
    } else {
      wrappedContents.push(
        originalContents,
      );
    }

    wrappedContents.push(
      endMarkedRef,
    );

    basePage.node.set(
      PDFName.of(
        'Contents',
      ),
      wrappedContents,
    );

    const embedded =
      await base.embedPage(
        rezkaPage,
      );

    basePage.pushOperators(
      PDFOperator.of(
        'BDC',
        [
          PDFName.of(
            'OC',
          ),
          cutLayerPropertyName,
        ],
      ),
    );

    basePage.drawPage(
      embedded,
      {
        x: 0,
        y: 0,

        width:
          basePage.getWidth(),

        height:
          basePage.getHeight(),
      },
    );

    basePage.pushOperators(
      PDFOperator.of(
        'EMC',
      ),
    );
  }

  return Buffer.from(
    await base.save({
      useObjectStreams:
        false,
    }),
  );
}

async function applyFinalSize(
  bytes,
  input,
) {
  if (
    !input.printFinalSizeEnabled
  ) {
    return bytes;
  }

  const widthMm =
    Number(
      input.printFinalWidth,
    );

  const heightMm =
    Number(
      input.printFinalHeight,
    );

  if (
    !Number.isFinite(
      widthMm,
    ) ||
    !Number.isFinite(
      heightMm,
    ) ||
    widthMm < 1 ||
    widthMm > 10000 ||
    heightMm < 1 ||
    heightMm > 10000
  ) {
    throw new Error(
      'Некорректный финальный размер PDF.',
    );
  }

  const targetWidth =
    widthMm *
    72 /
    25.4;

  const targetHeight =
    heightMm *
    72 /
    25.4;

  const document =
    await PDFDocument.load(
      bytes,
    );

  for (
    const page
    of document.getPages()
  ) {
    const sourceWidth =
      page.getWidth();

    const sourceHeight =
      page.getHeight();

    if (
      sourceWidth <= 0 ||
      sourceHeight <= 0
    ) {
      throw new Error(
        'PDF содержит страницу с некорректным размером.',
      );
    }

    const scaleX =
      targetWidth /
      sourceWidth;

    const scaleY =
      targetHeight /
      sourceHeight;

    page.scaleContent(
      scaleX,
      scaleY,
    );

    if (
      typeof page.scaleAnnotations ===
      'function'
    ) {
      page.scaleAnnotations(
        scaleX,
        scaleY,
      );
    }

    page.setSize(
      targetWidth,
      targetHeight,
    );
  }

  return Buffer.from(
    await document.save({
      useObjectStreams:
        false,
    }),
  );
}

async function applyRezkaLayer(
  baseBytes,
  rezkaSvgBytes,
  colorMode,
  layerName,
  input,
) {
  let result =
    await applyFinalSize(
      baseBytes,
      input,
    );

  if (
    !rezkaSvgBytes
  ) {
    return result;
  }

  if (
    rezkaSvgBytes.length >
    MAX_BYTES
  ) {
    throw new Error(
      'SVG слоя резки слишком большой.',
    );
  }

  const rezkaLayer =
    await renderRezkaLayer(
      rezkaSvgBytes,
      layerName,
      input,
    );

  const spotName =
    typeof input.printSpotName ===
      'string' &&
    cleanText(
      input.printSpotName,
    ).trim()
      ? cleanText(
          input.printSpotName,
        )
          .trim()
          .slice(
            0,
            64,
          )
      : 'CutContour';

  let rezkaPdf =
    rezkaLayer.pdf;

  if (
    input.printSpotEnabled
  ) {
    rezkaPdf =
      await applySpotCutStyle(
        rezkaPdf,
        spotName,
        input.printOverprint ===
          true,
      );
  } else if (
    colorMode ===
      'CMYK'
  ) {
    rezkaPdf =
      await convertTextPdfColorsToCmyk(
        rezkaPdf,
      );
  }

  result =
    await mergeRezkaLayer(
      result,
      rezkaPdf,
      layerName,
    );

  return result;
}

async function convertBaseToCmyk(
  source,
  profile,
) {
  const gs =
    await ghostscriptPath();

  const dir =
    await mkdtemp(
      join(
        tmpdir(),
        'figma-native-cmyk-',
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

async function perfStep(
  name,
  fn,
) {
  const started =
    Date.now();

  try {
    return await fn();
  } finally {
    const elapsed =
      Date.now() -
      started;

    try {
      const {
        appendFile,
      } =
        await import(
          'node:fs/promises'
        );

      await appendFile(
        '/tmp/layer-export-perf.log',
        `${new Date().toISOString()} | ${name} | ${elapsed} ms\n`,
      );
    } catch {
      // Profiling must never break export.
    }
  }
}

export async function convert(
  input,
) {
  const convertStarted =
    Date.now();

  try {
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
    'image/svg+xml'
  ) {
    throw new Error(
      'SVG должен экспортироваться напрямую из Figma.',
    );
  }

  const textSvgBytes =
    typeof input.textSvgBase64 ===
      'string' &&
    input.textSvgBase64.length
      ? Buffer.from(
          input.textSvgBase64,
          'base64',
        )
      : null;

  const rezkaSvgBytes =
    typeof input.rezkaSvgBase64 ===
      'string' &&
    input.rezkaSvgBase64.length
      ? Buffer.from(
          input.rezkaSvgBase64,
          'base64',
        )
      : null;

  const printLayerName =
    typeof input.printLayerName ===
      'string' &&
    cleanText(
      input.printLayerName,
    ).trim()
      ? cleanText(
          input.printLayerName,
        )
          .trim()
          .slice(
            0,
            64,
          )
      : 'rezka';

  if (!textSvgBytes) {
    if (
      input.colorMode ===
      'RGB'
    ) {
      return {
        bytes:
          await applyRezkaLayer(
            bytes,
            rezkaSvgBytes,
            input.colorMode,
            printLayerName,
            input,
          ),

        profile:
          null,
      };
    }

    const profile =
      await getProfile(
        input.profile,
      );

    const converted =
      await perfStep(
        'ghostscript-cmyk-base',
        () =>
          convertBaseToCmyk(
            bytes,
            profile,
          ),
      );

    const document =
      await PDFDocument.load(
        converted,
      );

    addOutputIntent(
      document,
      profile,
    );

    const cmykBytes =
      Buffer.from(
        await document.save({
          useObjectStreams:
            false,
        }),
      );

    return {
      bytes:
        await applyRezkaLayer(
          cmykBytes,
          rezkaSvgBytes,
          input.colorMode,
            printLayerName,
            input,
        ),

      profile:
        profile.name,
    };
  }

  if (
    textSvgBytes.length >
    MAX_BYTES
  ) {
    throw new Error(
      'SVG-карта текста слишком большая.',
    );
  }

  const [
    nativeWithoutText,
    textLayer,
  ] =
    await Promise.all([
      perfStep(
        'strip-native-text',
        () =>
          stripNativeFigmaText(
            bytes,
          ),
      ),

      perfStep(
        'render-text-chromium',
        () =>
          renderTextLayer(
            textSvgBytes,
          ),
      ),
    ]);

  if (
    input.colorMode ===
    'RGB'
  ) {
    const rgbBytes =
      await mergeTextLayer(
        nativeWithoutText,
        textLayer.pdf,
        textLayer,
        null,
      );

    return {
      bytes:
        await applyRezkaLayer(
          rgbBytes,
          rezkaSvgBytes,
          input.colorMode,
            printLayerName,
            input,
        ),

      profile:
        null,
    };
  }

  const profile =
    await getProfile(
      input.profile,
    );

  const [
    cmykBase,
    cmykText,
  ] =
    await Promise.all([
      perfStep(
        'ghostscript-cmyk-base',
        () =>
          convertBaseToCmyk(
            nativeWithoutText,
            profile,
          ),
      ),

      perfStep(
        'cmyk-text',
        () =>
          convertTextPdfColorsToCmyk(
            textLayer.pdf,
          ),
      ),
    ]);

  const cmykBytes =
    await mergeTextLayer(
      cmykBase,
      cmykText,
      textLayer,
      profile,
    );

  return {
    bytes:
      await applyRezkaLayer(
        cmykBytes,
        rezkaSvgBytes,
        input.colorMode,
            printLayerName,
            input,
      ),

    profile:
      profile.name,
  };
  } finally {
    try {
      const {
        appendFile,
      } =
        await import(
          'node:fs/promises'
        );

      await appendFile(
        '/tmp/layer-export-perf.log',
        `${new Date().toISOString()} | TOTAL-CONVERT | ${Date.now() - convertStarted} ms\n---\n`,
      );
    } catch {
      // Profiling must never break export.
    }
  }

}