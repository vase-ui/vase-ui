import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const DOCS_ROOT = join(import.meta.dirname, '..', '..', 'docs');
const STYLE_SHEET = join(DOCS_ROOT, 'demos', 'tailwind.css');

interface Tailwind {
  compile(
    css: string,
    options: {
      base: string;
      loadStylesheet(
        id: string,
        base: string,
      ): Promise<{ path: string; base: string; content: string }>;
    },
  ): Promise<{ build(names: string[]): string }>;
}

/**
 * The class names of the Tailwind demos that add no rule to `docs/demos/tailwind.css` and are
 * correct. A class string of a ported demo is that of Base UI, so each name stays. A demo of a
 * component of Vase UI's own has no name here other than a marker, because its class strings can
 * change.
 */
export const CLASS_NAMES_WITHOUT_RULE: ReadonlySet<string> = new Set([
  // Markers of Tailwind. The `group-*` and `peer-*` variants of another class name the marker.
  'group',
  'group/popup',
  'group/item',
  'peer',
  // A marker of the demo. The class `has-[.combobox-clear]` of another element names it.
  'combobox-clear',
  // A marker of the demo. The leave of the drawer popup adds it, and the class `has-[>.leaving]` of
  // the viewport names it.
  'leaving',
  // The theme of the Base UI docs has no red other than `red-400` and `red-700`, so the item has no
  // red text there. The CSS-module demo has no red text on that item either.
  'text-red-600',
  // Base UI has the name, and Tailwind has no such utility. The look equals the CSS-module demo.
  'font-inherit',
  // Base UI has the name, and Tailwind 4 has no utility `blur-0`. The look equals the CSS-module demo.
  'min-[700px]:blur-0',
]);

/**
 * The names of `names` that add no CSS to `docs/demos/tailwind.css`, in the sequence of `names`. It
 * uses `compile` of the `tailwindcss` package of `docs`, as the build of the site does.
 */
export async function classNamesWithoutRule(names: string[]): Promise<string[]> {
  // The root package does not depend on Tailwind CSS, so the check loads it from the docs package.
  const docsRequire = createRequire(join(DOCS_ROOT, 'package.json'));
  const tailwind: Tailwind = docsRequire('tailwindcss');
  const compiler = await tailwind.compile(readFileSync(STYLE_SHEET, 'utf8'), {
    base: dirname(STYLE_SHEET),
    // The style sheet imports only files of the package `tailwindcss`.
    loadStylesheet: (id) => {
      const path = docsRequire.resolve(id);
      return Promise.resolve({
        path,
        base: dirname(path),
        content: readFileSync(path, 'utf8'),
      });
    },
  });
  // `build` keeps each name that it got, so a name that adds no rule leaves the output as it was.
  let output = compiler.build([]);
  return names.filter((name) => {
    const next = compiler.build([name]);
    const addsNoRule = next === output;
    output = next;
    return addsNoRule;
  });
}
