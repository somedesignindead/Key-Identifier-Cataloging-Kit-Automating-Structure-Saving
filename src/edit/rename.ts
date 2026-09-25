import type {
  RenameOptions,
} from '../shared/messages';


export type RenameExample = {
  before: string;
  after: string;
};


export type RenameResult = {
  total: number;
  changed: number;
  skipped: number;
  examples: RenameExample[];
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


function collectTargets(
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
    visit(
      root,
    );
  }

  return result;
}


function findNamedChild(
  root: SceneNode,
  name: string,
  depth:
    | 'first'
    | 'any',
): SceneNode | null {
  const wanted =
    name.trim();

  if (
    !wanted ||
    !('children' in root)
  ) {
    return null;
  }

  for (
    const child
    of root.children
  ) {
    if (
      child.name ===
      wanted
    ) {
      return child;
    }
  }

  if (
    depth === 'first'
  ) {
    return null;
  }

  for (
    const child
    of root.children
  ) {
    const found =
      findNamedChild(
        child,
        wanted,
        depth,
      );

    if (found) {
      return found;
    }
  }

  return null;
}


function valueFromNamedLayer(
  root: SceneNode,
  layerName: string,
  depth:
    | 'first'
    | 'any',
): string | null {
  const source =
    findNamedChild(
      root,
      layerName,
      depth,
    );

  if (!source) {
    return null;
  }

  if (
    source.type === 'TEXT'
  ) {
    return source.characters;
  }

  return source.name;
}


function escapeRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
}


function literalReplace(
  source: string,
  find: string,
  replacement: string,
  caseSensitive: boolean,
): string {
  if (!find) {
    return source;
  }

  if (
    caseSensitive
  ) {
    return source
      .split(find)
      .join(
        replacement,
      );
  }

  return source.replace(
    new RegExp(
      escapeRegex(find),
      'gi',
    ),
    () => replacement,
  );
}


function compactNumber(
  value: number,
): string {
  return String(
    Math.round(
      value * 100,
    ) / 100,
  );
}


function applyCase(
  value: string,
  mode:
    RenameOptions['caseMode'],
): string {
  switch (mode) {
    case 'lower':
      return value
        .toLocaleLowerCase();

    case 'upper':
      return value
        .toLocaleUpperCase();

    case 'capitalize':
      return value.replace(
        /(^|[\s/_-]+)([^\s/_-])/g,
        (
          _match,
          separator:
            string,
          letter:
            string,
        ) =>
          separator +
          letter
            .toLocaleUpperCase(),
      );

    default:
      return value;
  }
}


function removeCharacters(
  value: string,
  characters: string,
): string {
  if (
    !characters
  ) {
    return value;
  }

  const remove =
    new Set(
      Array.from(
        characters,
      ),
    );

  return Array.from(
    value,
  )
    .filter(
      character =>
        !remove.has(
          character,
        ),
    )
    .join('');
}


function processFinalName(
  raw: string,
  options: RenameOptions,
): string {
  let value =
    raw;

  if (
    options.trim
  ) {
    value =
      value.trim();
  }

  if (
    options.collapseSpaces
  ) {
    value =
      value.replace(
        /[ \t]+/g,
        ' ',
      );
  }

  switch (
    options.spaceMode
  ) {
    case 'dash':
      value =
        value.replace(
          /[ \t]+/g,
          '-',
        );
      break;

    case 'underscore':
      value =
        value.replace(
          /[ \t]+/g,
          '_',
        );
      break;

    case 'remove':
      value =
        value.replace(
          /[ \t]+/g,
          '',
        );
      break;
  }

  switch (
    options.slashMode
  ) {
    case 'dash':
      value =
        value.replace(
          /\//g,
          '-',
        );
      break;

    case 'underscore':
      value =
        value.replace(
          /\//g,
          '_',
        );
      break;

    case 'remove':
      value =
        value.replace(
          /\//g,
          '',
        );
      break;
  }

  value =
    removeCharacters(
      value,
      options.removeCharacters,
    );

  value =
    options.finalPrefix +
    value +
    options.finalSuffix;

  return applyCase(
    value,
    options.caseMode,
  );
}



type RenameDependencyRule = {
  layerName: string;
  separator: string;
};


function renameDependencyRules(
  options: RenameOptions,
): RenameDependencyRule[] {

  if (
    !options.folderEnabled
  ) {
    return [];
  }


  const raw =
    options.folderLayerName
      .trim();


  if (!raw) {
    return [];
  }


  /*
   * Новый UI передаёт JSON-массив через старое поле,
   * чтобы не ломать message schema и совместимость.
   */
  if (
    raw.startsWith(
      '[',
    )
  ) {
    try {
      const parsed =
        JSON.parse(
          raw,
        ) as
          unknown;


      if (
        Array.isArray(
          parsed,
        )
      ) {
        return parsed
          .map(
            item => {

              if (
                !item ||
                typeof item !==
                  'object'
              ) {
                return null;
              }


              const candidate =
                item as {
                  layerName?:
                    unknown;
                  separator?:
                    unknown;
                };


              if (
                typeof candidate
                  .layerName !==
                'string'
              ) {
                return null;
              }


              const layerName =
                candidate
                  .layerName
                  .trim();


              if (!layerName) {
                return null;
              }


              return {
                layerName,

                separator:
                  typeof candidate
                    .separator ===
                  'string'
                    ? candidate
                        .separator
                    : '/',
              };
            },
          )
          .filter(
            (
              item,
            ): item is
              RenameDependencyRule =>
                item !==
                null,
          );
      }
    } catch {
      // Старый формат обрабатывается ниже.
    }
  }


  /*
   * Обратная совместимость:
   * старый folderLayerName = один слой + "/".
   */
  return [
    {
      layerName:
        raw,

      separator:
        '/',
    },
  ];
}


function rawName(
  node: SceneNode,
  index: number,
  options: RenameOptions,
): string | null {
  switch (
    options.mode
  ) {
    case 'replace': {
      if (
        options.regex
      ) {
        if (
          !options.find
        ) {
          return node.name;
        }

        const expression =
          new RegExp(
            options.find,
            options.caseSensitive
              ? 'g'
              : 'gi',
          );

        return node.name
          .replace(
            expression,
            options.replace,
          );
      }

      return literalReplace(
        node.name,
        options.find,
        options.replace,
        options.caseSensitive,
      );
    }


    case 'prefix-suffix':
      return (
        options.prefix +
        node.name +
        options.suffix
      );


    case 'set':
      return options.fullName;


    case 'number': {
      const number =
        options.numberStart +
        index;

      return (
        options.numberBase +
        String(
          number,
        ).padStart(
          options.numberPad,
          '0',
        )
      );
    }


    case 'template': {
      let width =
        '';

      let height =
        '';

      if (
        'width' in node &&
        typeof node.width ===
          'number'
      ) {
        width =
          compactNumber(
            node.width,
          );
      }

      if (
        'height' in node &&
        typeof node.height ===
          'number'
      ) {
        height =
          compactNumber(
            node.height,
          );
      }

      const values:
        Record<
          string,
          string
        > = {
          name:
            node.name,

          index:
            String(
              options.numberStart +
              index,
            ).padStart(
              options.numberPad,
              '0',
            ),

          width,
          height,

          type:
            node.type,
        };

      return options.template
        .replace(
          /\{(name|index|width|height|type)\}/g,
          (
            _match,
            key: string,
          ) =>
            values[key] ??
            '',
        );
    }


    case 'by-layer': {
      let value =
        valueFromNamedLayer(
          node,
          options.sourceLayerName,
          options.sourceDepth,
        );

      if (
        value === null
      ) {
        if (
          options.missingSource ===
          'skip'
        ) {
          return null;
        }

        value =
          node.name;
      }

      const dependencies =
        renameDependencyRules(
          options,
        );


      if (
        dependencies.length
      ) {
        let prefix =
          '';


        for (
          const dependency
          of dependencies
        ) {
          const dependencyValue =
            valueFromNamedLayer(
              node,
              dependency.layerName,
              options.sourceDepth,
            );


          if (
            !dependencyValue ||
            !dependencyValue
              .trim()
          ) {
            continue;
          }


          prefix +=
            dependencyValue
              .trim() +
            dependency.separator;
        }


        value =
          prefix +
          value;
      }

      return value;
    }
  }
}


function nextName(
  node: SceneNode,
  index: number,
  options: RenameOptions,
): string | null {
  const raw =
    rawName(
      node,
      index,
      options,
    );

  if (
    raw === null
  ) {
    return null;
  }

  return processFinalName(
    raw,
    options,
  );
}


export function previewRename(
  options: RenameOptions,
): RenameResult {
  const targets =
    collectTargets(
      options.includeDescendants,
    );

  let changed =
    0;

  let skipped =
    0;

  const examples:
    RenameExample[] =
    [];

  for (
    let index = 0;
    index < targets.length;
    index++
  ) {
    const node =
      targets[index];

    const next =
      nextName(
        node,
        index,
        options,
      );

    if (
      next === null ||
      next.length === 0
    ) {
      skipped++;
      continue;
    }

    if (
      next !== node.name
    ) {
      changed++;

      if (
        examples.length < 3
      ) {
        examples.push({
          before:
            node.name,

          after:
            next,
        });
      }
    }
  }

  return {
    total:
      targets.length,

    changed,

    skipped,

    examples,
  };
}


export function applyRename(
  options: RenameOptions,
): RenameResult {
  const targets =
    collectTargets(
      options.includeDescendants,
    );

  let changed =
    0;

  let skipped =
    0;

  const examples:
    RenameExample[] =
    [];

  for (
    let index = 0;
    index < targets.length;
    index++
  ) {
    const node =
      targets[index];

    const next =
      nextName(
        node,
        index,
        options,
      );

    if (
      next === null ||
      next.length === 0
    ) {
      skipped++;
      continue;
    }

    if (
      next === node.name
    ) {
      continue;
    }

    if (
      examples.length < 3
    ) {
      examples.push({
        before:
          node.name,

        after:
          next,
      });
    }

    try {
      node.name =
        next;

      changed++;
    } catch {
      skipped++;
    }
  }

  return {
    total:
      targets.length,

    changed,

    skipped,

    examples,
  };
}
