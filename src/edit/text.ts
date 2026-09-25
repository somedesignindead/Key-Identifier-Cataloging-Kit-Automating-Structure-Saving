import type {
  TextReplaceOptions,
} from '../shared/messages';


export type TextReplaceExample = {
  layer: string;
  before: string;
  after: string;
};


export type TextReplaceResult = {
  textLayers: number;
  matchedLayers: number;
  matches: number;
  changedLayers: number;
  skippedLayers: number;
  examples: TextReplaceExample[];
};


type TextEdit = {
  start: number;
  end: number;
  replacement: string;
};


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


function normalizeNewlines(
  value: string,
): string {
  return value
    .replace(
      /\r\n/g,
      '\n',
    )
    .replace(
      /\r/g,
      '\n',
    );
}


function displaySpecialCharacters(
  value: string,
): string {
  return normalizeNewlines(
    value,
  )
    .replace(
      /\n/g,
      '↵',
    )
    .replace(
      /\t/g,
      '⇥',
    );
}


function replacementValue(
  value: string,
): string {
  return normalizeNewlines(
    value,
  )
    .replace(
      /↵/g,
      '\n',
    )
    .replace(
      /⇥/g,
      '\t',
    );
}


function escapeRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
}


function literalPattern(
  value: string,
): string {
  const normalized =
    normalizeNewlines(
      value,
    );

  const parts =
    normalized
      .split('↵')
      .map(
        part =>
          part
            .split('⇥')
            .map(
              escapeRegex,
            )
            .join(
              '\\t',
            ),
      );

  return parts.join(
    '(?:\\r\\n|\\n|\\r)',
  );
}


function regexPattern(
  value: string,
): string {
  return value
    .replace(
      /↵/g,
      '(?:\\r\\n|\\n|\\r)',
    )
    .replace(
      /⇥/g,
      '\\t',
    );
}


function isWordCharacter(
  value:
    | string
    | undefined,
): boolean {
  return Boolean(
    value &&
    /[A-Za-zА-Яа-яЁё0-9_]/.test(
      value,
    ),
  );
}


function isWholeWord(
  input: string,
  start: number,
  end: number,
): boolean {
  return (
    !isWordCharacter(
      input[start - 1],
    ) &&
    !isWordCharacter(
      input[end],
    )
  );
}


function expandRegexReplacement(
  template: string,
  match:
    RegExpExecArray,
): string {
  return template.replace(
    /\$(\$|&|`|'|[1-9][0-9]?|<[^>]+>)/g,
    (
      token,
      key: string,
    ) => {
      if (
        key === '$'
      ) {
        return '$';
      }

      if (
        key === '&'
      ) {
        return match[0];
      }

      if (
        key === '`'
      ) {
        return match.input
          .slice(
            0,
            match.index,
          );
      }

      if (
        key === "'"
      ) {
        return match.input
          .slice(
            match.index +
            match[0].length,
          );
      }

      if (
        key.startsWith(
          '<',
        ) &&
        key.endsWith(
          '>',
        )
      ) {
        const name =
          key.slice(
            1,
            -1,
          );

        return (
          match.groups?.[name] ??
          ''
        );
      }

      const index =
        Number(key);

      if (
        Number.isSafeInteger(
          index,
        ) &&
        index > 0
      ) {
        return (
          match[index] ??
          ''
        );
      }

      return token;
    },
  );
}


function findEdits(
  input: string,
  options:
    TextReplaceOptions,
): TextEdit[] {
  if (
    !options.find
  ) {
    return [];
  }

  const pattern =
    options.regex
      ? regexPattern(
          options.find,
        )
      : literalPattern(
          options.find,
        );

  if (
    !pattern
  ) {
    return [];
  }

  const flags =
    options.caseSensitive
      ? 'g'
      : 'gi';

  const expression =
    new RegExp(
      pattern,
      flags,
    );

  const rawReplacement =
    replacementValue(
      options.replace,
    );

  const edits:
    TextEdit[] =
    [];

  let match:
    RegExpExecArray |
    null;

  while (
    (
      match =
        expression.exec(
          input,
        )
    )
  ) {
    const start =
      match.index;

    const end =
      start +
      match[0].length;

    if (
      !options.wholeWord ||
      isWholeWord(
        input,
        start,
        end,
      )
    ) {
      edits.push({
        start,

        end,

        replacement:
          options.regex
            ? expandRegexReplacement(
                rawReplacement,
                match,
              )
            : rawReplacement,
      });
    }

    if (
      match[0].length ===
      0
    ) {
      expression.lastIndex++;
    }
  }

  if (
    !options.exactLayer
  ) {
    return edits;
  }

  if (
    edits.length !== 1
  ) {
    return [];
  }

  const edit =
    edits[0];

  if (
    edit.start !== 0 ||
    edit.end !==
      input.length
  ) {
    return [];
  }

  return edits;
}


function applyEditsToString(
  input: string,
  edits:
    readonly TextEdit[],
): string {
  let result =
    input;

  const sorted =
    [
      ...edits,
    ].sort(
      (
        a,
        b,
      ) =>
        b.start -
        a.start,
    );

  for (
    const edit
    of sorted
  ) {
    result =
      result.slice(
        0,
        edit.start,
      ) +
      edit.replacement +
      result.slice(
        edit.end,
      );
  }

  return result;
}


function normalizedLayerFilter(
  value: string,
): string {
  return value
    .trim()
    .toLocaleLowerCase();
}


function layerAllowed(
  node: TextNode,
  options:
    TextReplaceOptions,
): boolean {
  if (
    !options.includeHidden &&
    node.visible ===
      false
  ) {
    return false;
  }

  const include =
    normalizedLayerFilter(
      options.layerNameInclude,
    );

  const exclude =
    normalizedLayerFilter(
      options.layerNameExclude,
    );

  const name =
    node.name
      .trim()
      .toLocaleLowerCase();

  if (
    include &&
    name !== include
  ) {
    return false;
  }

  if (
    exclude &&
    name === exclude
  ) {
    return false;
  }

  return true;
}


function collectTextNodes(
  node: SceneNode,
  options:
    TextReplaceOptions,
  output:
    TextNode[],
): void {
  if (
    !options.includeHidden &&
    node.visible === false
  ) {
    return;
  }

  if (
    node.type === 'TEXT'
  ) {
    if (
      layerAllowed(
        node,
        options,
      )
    ) {
      output.push(
        node,
      );
    }

    return;
  }

  if (
    'children' in node
  ) {
    for (
      const child
      of node.children
    ) {
      collectTextNodes(
        child,
        options,
        output,
      );
    }
  }
}


async function textTargets(
  options:
    TextReplaceOptions,
): Promise<TextNode[]> {
  const result:
    TextNode[] =
    [];

  const seen =
    new Set<string>();

  const addRoot =
    (
      root:
        SceneNode,
    ) => {
      const local:
        TextNode[] =
        [];

      collectTextNodes(
        root,
        options,
        local,
      );

      for (
        const node
        of local
      ) {
        if (
          seen.has(
            node.id,
          )
        ) {
          continue;
        }

        seen.add(
          node.id,
        );

        result.push(
          node,
        );
      }
    };


  if (
    options.scope ===
    'selection'
  ) {
    for (
      const root
      of rootSelection()
    ) {
      addRoot(
        root,
      );
    }

    return result;
  }


  if (
    options.scope ===
    'page'
  ) {
    for (
      const child
      of figma
        .currentPage
        .children
    ) {
      addRoot(
        child,
      );
    }

    return result;
  }


  await figma
    .loadAllPagesAsync();

  for (
    const page
    of figma.root.children
  ) {
    for (
      const child
      of page.children
    ) {
      addRoot(
        child,
      );
    }
  }

  return result;
}


async function loadFonts(
  node: TextNode,
): Promise<void> {
  const length =
    node.characters.length;

  if (
    length === 0
  ) {
    if (
      node.fontName !==
      figma.mixed
    ) {
      await figma
        .loadFontAsync(
          node.fontName,
        );
    }

    return;
  }

  const fonts =
    node.getRangeAllFontNames(
      0,
      length,
    );

  const loaded =
    new Set<string>();

  for (
    const font
    of fonts
  ) {
    const variation =
      'variationSettings' in font
        ? JSON.stringify(
            font.variationSettings,
          )
        : '';

    const key =
      [
        font.family,
        font.style,
        variation,
      ].join('\0');

    if (
      loaded.has(
        key,
      )
    ) {
      continue;
    }

    loaded.add(
      key,
    );

    await figma
      .loadFontAsync(
        font,
      );
  }
}


function applyStyledEdits(
  node: TextNode,
  edits:
    readonly TextEdit[],
): void {
  const sorted =
    [
      ...edits,
    ].sort(
      (
        a,
        b,
      ) =>
        b.start -
        a.start,
    );

  for (
    const edit
    of sorted
  ) {
    if (
      edit.replacement
        .length === 0
    ) {
      node.deleteCharacters(
        edit.start,
        edit.end,
      );

      continue;
    }

    /*
     * Сначала вставляем новый текст ПЕРЕД старым диапазоном.
     *
     * AFTER копирует стиль символа, который находился
     * в начале заменяемого диапазона.
     *
     * Затем удаляем старый диапазон уже со сдвигом
     * на длину вставленного текста.
     */
    node.insertCharacters(
      edit.start,
      edit.replacement,
      'AFTER',
    );

    node.deleteCharacters(
      edit.start +
        edit.replacement.length,

      edit.end +
        edit.replacement.length,
    );
  }
}


export async function previewTextReplace(
  options:
    TextReplaceOptions,
): Promise<TextReplaceResult> {
  const targets =
    await textTargets(
      options,
    );

  let matchedLayers =
    0;

  let matches =
    0;

  const examples:
    TextReplaceExample[] =
    [];

  for (
    const node
    of targets
  ) {
    const edits =
      findEdits(
        node.characters,
        options,
      );

    if (
      edits.length === 0
    ) {
      continue;
    }

    matchedLayers++;

    matches +=
      edits.length;

    if (
      examples.length < 3
    ) {
      examples.push({
        layer:
          node.name,

        before:
          displaySpecialCharacters(
            node.characters,
          ),

        after:
          displaySpecialCharacters(
            applyEditsToString(
              node.characters,
              edits,
            ),
          ),
      });
    }
  }

  return {
    textLayers:
      targets.length,

    matchedLayers,

    matches,

    changedLayers:
      0,

    skippedLayers:
      0,

    examples,
  };
}


export async function applyTextReplace(
  options:
    TextReplaceOptions,
): Promise<TextReplaceResult> {
  const targets =
    await textTargets(
      options,
    );

  let matchedLayers =
    0;

  let matches =
    0;

  let changedLayers =
    0;

  let skippedLayers =
    0;

  const examples:
    TextReplaceExample[] =
    [];

  for (
    const node
    of targets
  ) {
    const original =
      node.characters;

    const edits =
      findEdits(
        original,
        options,
      );

    if (
      edits.length === 0
    ) {
      continue;
    }

    matchedLayers++;

    matches +=
      edits.length;

    const after =
      applyEditsToString(
        original,
        edits,
      );

    if (
      examples.length < 3
    ) {
      examples.push({
        layer:
          node.name,

        before:
          displaySpecialCharacters(
            original,
          ),

        after:
          displaySpecialCharacters(
            after,
          ),
      });
    }

    if (
      after === original
    ) {
      continue;
    }

    try {
      if (
        node.hasMissingFont
      ) {
        skippedLayers++;
        continue;
      }

      await loadFonts(
        node,
      );

      applyStyledEdits(
        node,
        edits,
      );

      changedLayers++;
    } catch {
      skippedLayers++;
    }
  }

  return {
    textLayers:
      targets.length,

    matchedLayers,

    matches,

    changedLayers,

    skippedLayers,

    examples,
  };
}
