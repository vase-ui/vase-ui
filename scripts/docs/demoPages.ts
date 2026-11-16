import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFamilyPages } from './familyPages.ts';

export interface DemoPage {
  /** The path of the page from the repository root, such as `docs/components/button.md`. */
  path: string;
  /** The family of the page, such as `button`, or `handbook-forms` for the Forms page. */
  family: string;
  text: string;
}

const IMPORT = /^import (\w+) from '\.\.\/demos\/([^']+)';$/gm;
const FRAME = /^<DemoFrame>\n([\s\S]*?)^<\/DemoFrame>\n/gm;
const FRAME_OPENING = /^[ \t]*<DemoFrame\b/gm;
const BOTH_VARIANTS =
  /^ {2}<(\w+) \/>\n {2}<template #tailwind>\n {4}<(\w+) \/>\n {2}<\/template>\n$/;
const CSS_MODULES_ONLY = /^ {2}<(\w+) \/>\n$/;
const TAILWIND_ONLY = /^ {2}<template #tailwind>\n {4}<(\w+) \/>\n {2}<\/template>\n$/;
const CODE_GROUP = '::: code-group\\n\\n((?:<<< \\S+\\n\\n)+):::\\n';
const SOURCE_BLOCKS = new RegExp(
  `^\\n<DemoSource variant="css-modules">\\n\\n${CODE_GROUP}\\n</DemoSource>\\n` +
    `\\n<DemoSource variant="tailwind">\\n\\n${CODE_GROUP}\\n</DemoSource>\\n`,
);
const BARE_CODE_GROUP = new RegExp(`^\\n${CODE_GROUP}`);
const MODEL_PAGE = 'docs/components/button.md';
const CSS_MODULES_DEMO = '/css-modules/index.vue';
const TAILWIND_DEMO = '/tailwind/index.vue';

function anotherForm(page: DemoPage): string {
  return `${page.path}: a <DemoFrame> has another form than the frames of ${MODEL_PAGE}.`;
}

/** The files of a code group, by their paths from `docs/demos`. */
function shownFiles(group: string): string[] {
  return group
    .split('\n')
    .filter((line) => line.startsWith('<<< '))
    .map((line) => line.slice('<<< '.length).replace(/^\.\.\/demos\//, ''));
}

interface Frame {
  page: DemoPage;
  /** The imports of the page by the name of the import, with the paths from `docs/demos`. */
  imports: Map<string, string>;
  body: string;
  /** The text of the page from the end of the frame. */
  after: string;
}

interface FrameCheck {
  problems: string[];
  /** The Tailwind demo that the frame shows, by its path from `docs/demos`, when the frame shows it correctly. */
  tailwind?: string;
}

function checkBothVariants(
  { page, imports, after }: Frame,
  cssName: string,
  tailwindName: string,
): FrameCheck {
  const cssModules = imports.get(cssName);
  if (!cssModules?.endsWith(CSS_MODULES_DEMO)) {
    return {
      problems: [
        `${page.path}: the frame of ${cssName} must show a CSS-module demo in its default slot.`,
      ],
    };
  }
  const folder = cssModules.slice(0, -CSS_MODULES_DEMO.length);
  const tailwind = `${folder}${TAILWIND_DEMO}`;
  if (tailwindName !== `${cssName}Tailwind` || imports.get(tailwindName) !== tailwind) {
    return {
      problems: [
        `${page.path}: the #tailwind slot of the frame of ${cssName} must show ${cssName}Tailwind, the import of ../demos/${tailwind}.`,
      ],
    };
  }
  const sources = SOURCE_BLOCKS.exec(after);
  if (sources === null) {
    return {
      tailwind,
      problems: [
        `${page.path}: the frame of ${cssName} needs <DemoSource variant="css-modules"> and then <DemoSource variant="tailwind"> directly after it, each with one code group. ${MODEL_PAGE} is the model.`,
      ],
    };
  }
  const problems: string[] = [];
  const family = `${folder.slice(0, folder.indexOf('/'))}/`;
  for (const [variant, group, first, otherVariant] of [
    ['CSS-module', sources[1], cssModules, '/tailwind/'],
    ['Tailwind', sources[2], tailwind, '/css-modules/'],
  ] as const) {
    const files = shownFiles(group);
    if (files[0] !== first) {
      problems.push(
        `${page.path}: the ${variant} source of ${cssName} must start with ../demos/${first}.`,
      );
    }
    for (const file of files) {
      if (!file.startsWith(family) || file.includes(otherVariant)) {
        problems.push(
          `${page.path}: the ${variant} source of ${cssName} shows ../demos/${file}, a file of another family or of the other variant.`,
        );
      }
    }
  }
  return { tailwind, problems };
}

function checkTailwindOnly(
  { page, imports, after }: Frame,
  name: string,
  demoFiles: ReadonlySet<string>,
): FrameCheck {
  const tailwind = imports.get(name);
  if (!tailwind?.endsWith(TAILWIND_DEMO)) {
    return {
      problems: [
        `${page.path}: the #tailwind slot of the frame of ${name} must show a Tailwind demo.`,
      ],
    };
  }
  const problems: string[] = [];
  if (demoFiles.has(`${tailwind.slice(0, -TAILWIND_DEMO.length)}${CSS_MODULES_DEMO}`)) {
    problems.push(`${page.path}: the frame of ${name} must also show the CSS-module demo.`);
  }
  const group = BARE_CODE_GROUP.exec(after);
  if (group === null || shownFiles(group[1])[0] !== tailwind) {
    problems.push(
      `${page.path}: the frame of ${name} needs a code group directly after it that starts with ../demos/${tailwind}.`,
    );
  }
  return { tailwind, problems };
}

function checkFrame(frame: Frame, demoFiles: ReadonlySet<string>): FrameCheck {
  const both = BOTH_VARIANTS.exec(frame.body);
  if (both !== null) {
    return checkBothVariants(frame, both[1], both[2]);
  }
  const tailwindOnly = TAILWIND_ONLY.exec(frame.body);
  if (tailwindOnly !== null) {
    return checkTailwindOnly(frame, tailwindOnly[1], demoFiles);
  }
  return { problems: CSS_MODULES_ONLY.test(frame.body) ? [] : [anotherForm(frame.page)] };
}

/**
 * Checks the frames of the pages. Each frame has a form of the frames of `docs/components/button.md`.
 * Each Tailwind demo is in the `#tailwind` slot of one frame, on the page of its family, and the
 * sources of the two variants follow the frame. `demoFiles` holds the path of each file under
 * `docs/demos`, from that folder.
 */
export function checkDemoPages(pages: DemoPage[], demoFiles: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const framedOn = new Map<string, DemoPage[]>();
  for (const page of pages) {
    const imports = new Map([...page.text.matchAll(IMPORT)].map(([, name, path]) => [name, path]));
    const frames = [...page.text.matchAll(FRAME)];
    for (const match of frames) {
      const frame: Frame = {
        page,
        imports,
        body: match[1],
        after: page.text.slice(match.index + match[0].length),
      };
      const check = checkFrame(frame, demoFiles);
      problems.push(...check.problems);
      if (check.tailwind !== undefined) {
        framedOn.set(check.tailwind, [...(framedOn.get(check.tailwind) ?? []), page]);
      }
    }
    const starts = new Set(frames.map(({ index }) => index));
    for (const { index } of page.text.matchAll(FRAME_OPENING)) {
      if (!starts.has(index)) {
        problems.push(anotherForm(page));
      }
    }
  }
  const tailwindDemos = [...demoFiles]
    .filter((file) => /^[^/]+\/[^/]+\/tailwind\/index\.vue$/.test(file))
    .toSorted();
  for (const file of tailwindDemos) {
    const family = file.slice(0, file.indexOf('/'));
    const framed = framedOn.get(file) ?? [];
    if (framed.length !== 1) {
      const pages = [...new Set(framed.map(({ path }) => path))].join(', ');
      const where = framed.length > 0 ? ` (${pages})` : '';
      const frame = demoFiles.has(`${file.slice(0, -TAILWIND_DEMO.length)}${CSS_MODULES_DEMO}`)
        ? 'the frame of its CSS-module demo'
        : 'a frame on the page of its family';
      problems.push(
        `docs/demos/${file} is in the #tailwind slot of ${framed.length} frames${where}. Show it one time, in ${frame}.`,
      );
    } else if (framed[0].family !== family) {
      problems.push(
        `${framed[0].path} shows docs/demos/${file}, a demo of ${family}. Show a demo on the page of its family.`,
      );
    }
  }
  return problems;
}

/** The pages of the components, the utilities and the handbook. */
export function loadDemoPages(root: string): DemoPage[] {
  const docs = join(root, 'docs');
  const handbook = existsSync(join(docs, 'handbook'))
    ? readdirSync(join(docs, 'handbook'))
        .filter((name) => name.endsWith('.md'))
        .toSorted()
        .map((name) => ({
          path: `handbook/${name}`,
          family: `handbook-${name.slice(0, -'.md'.length)}`,
        }))
    : [];
  return [...listFamilyPages(docs), ...handbook].map(({ path, family }) => ({
    path: `docs/${path}`,
    family,
    text: readFileSync(join(docs, path), 'utf8'),
  }));
}

/** The path of each file under `docs/demos`, from that folder. */
export function listDemoFiles(root: string): Set<string> {
  const demos = join(root, 'docs/demos');
  return new Set(
    readdirSync(demos, { recursive: true, withFileTypes: true })
      .filter((item) => item.isFile())
      .map((item) => join(item.parentPath, item.name).slice(demos.length + 1)),
  );
}
