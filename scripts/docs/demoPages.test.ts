import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import { checkDemoPages, listDemoFiles, loadDemoPages } from './demoPages.ts';
import type { DemoPage } from './demoPages.ts';

const PATH = 'docs/components/button.md';
const MODEL = 'docs/components/button.md';
const CSS_MODULES = 'button/hero/css-modules/index.vue';
const TAILWIND = 'button/hero/tailwind/index.vue';
const DEMO_FILES: ReadonlySet<string> = new Set([
  CSS_MODULES,
  'button/hero/css-modules/index.module.css',
  TAILWIND,
]);

const importLine = (name: string, path: string): string =>
  `import ${name} from '../demos/${path}';`;

const IMPORTS = [
  importLine('DemoButtonHero', CSS_MODULES),
  importLine('DemoButtonHeroTailwind', TAILWIND),
].join('\n');

const FRAME = [
  '<DemoFrame>',
  '  <DemoButtonHero />',
  '  <template #tailwind>',
  '    <DemoButtonHeroTailwind />',
  '  </template>',
  '</DemoFrame>',
  '',
].join('\n');

function sourceBlock(variant: string, files: string[]): string {
  return [
    `<DemoSource variant="${variant}">`,
    '',
    '::: code-group',
    '',
    ...files.flatMap((file) => [`<<< ../demos/${file}`, '']),
    ':::',
    '',
    '</DemoSource>',
    '',
  ].join('\n');
}

const CSS_SOURCE = sourceBlock('css-modules', [
  CSS_MODULES,
  'button/hero/css-modules/index.module.css',
]);
const TAILWIND_SOURCE = sourceBlock('tailwind', [TAILWIND]);

function makePage({
  imports = IMPORTS,
  frame = FRAME,
  sources = `\n${CSS_SOURCE}\n${TAILWIND_SOURCE}`,
  path = PATH,
  family = 'button',
}: {
  imports?: string;
  frame?: string;
  sources?: string;
  path?: string;
  family?: string;
} = {}): DemoPage {
  const text = `<script setup lang="ts">\n${imports}\n</script>\n\n# Button\n\n${frame}${sources}\n## Usage\n`;
  return { path, family, text };
}

const problemsOf = (pages: DemoPage[], demoFiles: ReadonlySet<string> = DEMO_FILES): string[] =>
  checkDemoPages(pages, demoFiles);

test('a page whose frame has the two variants and the two sources has no problem', () => {
  assert.deepEqual(problemsOf([makePage()]), []);
});

test('a source block may show a file of the demo outside the variant folder and a file at the root of the family', () => {
  const page = makePage({
    sources: `\n${sourceBlock('css-modules', [CSS_MODULES, 'button/hero/data.ts', 'button/_index.module.css'])}\n${sourceBlock('tailwind', [TAILWIND, 'button/hero/data.ts', 'button/icons-tw.ts'])}`,
  });
  assert.deepEqual(problemsOf([page]), []);
});

test('a Tailwind demo that no frame shows is a problem that names the demo', () => {
  const page = makePage({ imports: '', frame: '', sources: '' });
  assert.deepEqual(problemsOf([page]), [
    `docs/demos/${TAILWIND} is in the #tailwind slot of 0 frames. Show it one time, in the frame of its CSS-module demo.`,
  ]);
});

test('a Tailwind demo that two frames show is a problem that names the pages', () => {
  const pages = [makePage(), makePage({ path: 'docs/utils/button.md' })];
  assert.deepEqual(problemsOf(pages), [
    `docs/demos/${TAILWIND} is in the #tailwind slot of 2 frames (${PATH}, docs/utils/button.md). Show it one time, in the frame of its CSS-module demo.`,
  ]);
});

test('a Tailwind demo on the page of another family is a problem that names the page and the family', () => {
  const page = makePage({ path: 'docs/components/slider.md', family: 'slider' });
  assert.deepEqual(problemsOf([page]), [
    `docs/components/slider.md shows docs/demos/${TAILWIND}, a demo of button. Show a demo on the page of its family.`,
  ]);
});

test('a Tailwind demo on a handbook page of its family has no problem', () => {
  const page = makePage({ path: 'docs/handbook/button.md', family: 'handbook-button' });
  const files = new Set([...DEMO_FILES].map((file) => file.replace('button/', 'handbook-button/')));
  const handbook = {
    ...page,
    text: page.text.replaceAll('../demos/button/', '../demos/handbook-button/'),
  };
  assert.deepEqual(problemsOf([handbook], files), []);
});

const FRAME_FAILURES: { name: string; page: DemoPage; problems: string[] }[] = [
  {
    name: 'a #tailwind slot that shows the Tailwind demo of another demo',
    page: makePage({
      imports: `${IMPORTS}\n${importLine('DemoButtonLoadingTailwind', 'button/loading/tailwind/index.vue')}`,
      frame: FRAME.replace('DemoButtonHeroTailwind', 'DemoButtonLoadingTailwind'),
    }),
    problems: [
      `${PATH}: the #tailwind slot of the frame of DemoButtonHero must show DemoButtonHeroTailwind, the import of ../demos/${TAILWIND}.`,
      `docs/demos/${TAILWIND} is in the #tailwind slot of 0 frames. Show it one time, in the frame of its CSS-module demo.`,
    ],
  },
  {
    name: 'a #tailwind slot with the right import name and the import of the Tailwind demo of another demo',
    page: makePage({ imports: IMPORTS.replace(TAILWIND, 'button/loading/tailwind/index.vue') }),
    problems: [
      `${PATH}: the #tailwind slot of the frame of DemoButtonHero must show DemoButtonHeroTailwind, the import of ../demos/${TAILWIND}.`,
      `docs/demos/${TAILWIND} is in the #tailwind slot of 0 frames. Show it one time, in the frame of its CSS-module demo.`,
    ],
  },
  {
    name: 'an import name of the Tailwind demo that is not the name of the CSS-module import and Tailwind',
    page: makePage({
      imports: IMPORTS.replace('DemoButtonHeroTailwind', 'DemoButtonTailwindHero'),
      frame: FRAME.replace('DemoButtonHeroTailwind', 'DemoButtonTailwindHero'),
    }),
    problems: [
      `${PATH}: the #tailwind slot of the frame of DemoButtonHero must show DemoButtonHeroTailwind, the import of ../demos/${TAILWIND}.`,
      `docs/demos/${TAILWIND} is in the #tailwind slot of 0 frames. Show it one time, in the frame of its CSS-module demo.`,
    ],
  },
  {
    name: 'a default slot that shows a demo that is not a CSS-module demo',
    page: makePage({
      imports: IMPORTS.replace(CSS_MODULES, 'button/hero/other/index.vue'),
    }),
    problems: [
      `${PATH}: the frame of DemoButtonHero must show a CSS-module demo in its default slot.`,
      `docs/demos/${TAILWIND} is in the #tailwind slot of 0 frames. Show it one time, in the frame of its CSS-module demo.`,
    ],
  },
];

for (const { name, page, problems } of FRAME_FAILURES) {
  test(`the check reports ${name}`, () => {
    assert.deepEqual(problemsOf([page]), problems);
  });
}

const SOURCES_PROBLEM = `${PATH}: the frame of DemoButtonHero needs <DemoSource variant="css-modules"> and then <DemoSource variant="tailwind"> directly after it, each with one code group. ${MODEL} is the model.`;

const SOURCE_FAILURES: { name: string; sources: string; problems: string[] }[] = [
  {
    name: 'a frame with no source block after it',
    sources: '',
    problems: [SOURCES_PROBLEM],
  },
  {
    name: 'a frame with the Tailwind source block before the CSS-module block',
    sources: `\n${TAILWIND_SOURCE}\n${CSS_SOURCE}`,
    problems: [SOURCES_PROBLEM],
  },
  {
    name: 'a frame with a text between the frame and the source blocks',
    sources: `\nThe two forms.\n\n${CSS_SOURCE}\n${TAILWIND_SOURCE}`,
    problems: [SOURCES_PROBLEM],
  },
  {
    name: 'a CSS-module source that starts with another file than the CSS-module demo',
    sources: `\n${sourceBlock('css-modules', ['button/hero/css-modules/index.module.css', CSS_MODULES])}\n${TAILWIND_SOURCE}`,
    problems: [
      `${PATH}: the CSS-module source of DemoButtonHero must start with ../demos/${CSS_MODULES}.`,
    ],
  },
  {
    name: 'a Tailwind source that starts with another file than the Tailwind demo',
    sources: `\n${CSS_SOURCE}\n${sourceBlock('tailwind', ['button/hero/data.ts', TAILWIND])}`,
    problems: [
      `${PATH}: the Tailwind source of DemoButtonHero must start with ../demos/${TAILWIND}.`,
    ],
  },
  {
    name: 'a Tailwind source that shows a file of the CSS-module variant',
    sources: `\n${CSS_SOURCE}\n${sourceBlock('tailwind', [TAILWIND, 'button/hero/css-modules/index.module.css'])}`,
    problems: [
      `${PATH}: the Tailwind source of DemoButtonHero shows ../demos/button/hero/css-modules/index.module.css, a file of another family or of the other variant.`,
    ],
  },
  {
    name: 'a CSS-module source that shows a file of the Tailwind variant',
    sources: `\n${sourceBlock('css-modules', [CSS_MODULES, 'button/hero/tailwind/extra.ts'])}\n${TAILWIND_SOURCE}`,
    problems: [
      `${PATH}: the CSS-module source of DemoButtonHero shows ../demos/button/hero/tailwind/extra.ts, a file of another family or of the other variant.`,
    ],
  },
  {
    name: 'a source that shows a file of another family',
    sources: `\n${CSS_SOURCE}\n${sourceBlock('tailwind', [TAILWIND, 'checkbox/hero/tailwind/index.vue'])}`,
    problems: [
      `${PATH}: the Tailwind source of DemoButtonHero shows ../demos/checkbox/hero/tailwind/index.vue, a file of another family or of the other variant.`,
    ],
  },
];

for (const { name, sources, problems } of SOURCE_FAILURES) {
  test(`the check reports ${name}`, () => {
    assert.deepEqual(problemsOf([makePage({ sources })]), problems);
  });
}

const FORMS_FILES: ReadonlySet<string> = new Set([
  'handbook-forms/hero/tailwind/index.vue',
  'handbook-forms/hero/tailwind/ExampleForm.vue',
]);

function makeFormsPage(group: string[] | undefined): DemoPage {
  const text = [
    '<script setup lang="ts">',
    importLine('DemoFormsHero', 'handbook-forms/hero/tailwind/index.vue'),
    '</script>',
    '',
    '<DemoFrame>',
    '  <template #tailwind>',
    '    <DemoFormsHero />',
    '  </template>',
    '</DemoFrame>',
    '',
    ...(group === undefined
      ? []
      : [
          '::: code-group',
          '',
          ...group.flatMap((file) => [`<<< ../demos/${file}`, '']),
          ':::',
          '',
        ]),
    '## Naming form controls',
    '',
  ].join('\n');
  return { path: 'docs/handbook/forms.md', family: 'handbook-forms', text };
}

const FORMS_FAILURES: {
  name: string;
  page: DemoPage;
  files: ReadonlySet<string>;
  problems: string[];
}[] = [
  {
    name: 'a frame with only the #tailwind slot and no code group after it',
    page: makeFormsPage(undefined),
    files: FORMS_FILES,
    problems: [
      'docs/handbook/forms.md: the frame of DemoFormsHero needs a code group directly after it that starts with ../demos/handbook-forms/hero/tailwind/index.vue.',
    ],
  },
  {
    name: 'a frame with only the #tailwind slot and a code group that starts with another file',
    page: makeFormsPage([
      'handbook-forms/hero/tailwind/ExampleForm.vue',
      'handbook-forms/hero/tailwind/index.vue',
    ]),
    files: FORMS_FILES,
    problems: [
      'docs/handbook/forms.md: the frame of DemoFormsHero needs a code group directly after it that starts with ../demos/handbook-forms/hero/tailwind/index.vue.',
    ],
  },
  {
    name: 'a frame with only the #tailwind slot that shows a demo that is not a Tailwind demo',
    page: {
      ...makeFormsPage(undefined),
      text: makeFormsPage(undefined).text.replace(
        'handbook-forms/hero/tailwind/index.vue',
        'handbook-forms/hero/css-modules/index.vue',
      ),
    },
    files: FORMS_FILES,
    problems: [
      'docs/handbook/forms.md: the #tailwind slot of the frame of DemoFormsHero must show a Tailwind demo.',
      'docs/demos/handbook-forms/hero/tailwind/index.vue is in the #tailwind slot of 0 frames. Show it one time, in the frame of its CSS-module demo.',
    ],
  },
  {
    name: 'a frame with only the #tailwind slot for a demo that has a CSS-module demo',
    page: makeFormsPage(['handbook-forms/hero/tailwind/index.vue']),
    files: new Set([...FORMS_FILES, 'handbook-forms/hero/css-modules/index.vue']),
    problems: [
      'docs/handbook/forms.md: the frame of DemoFormsHero must also show the CSS-module demo.',
    ],
  },
];

test('a frame with only the #tailwind slot, for a demo with no CSS-module demo, and a code group that starts with its file has no problem', () => {
  const page = makeFormsPage([
    'handbook-forms/hero/tailwind/index.vue',
    'handbook-forms/hero/tailwind/ExampleForm.vue',
    'handbook-forms/components/button.ts',
  ]);
  assert.deepEqual(problemsOf([page], FORMS_FILES), []);
});

for (const { name, page, files, problems } of FORMS_FAILURES) {
  test(`the check reports ${name}`, () => {
    assert.deepEqual(problemsOf([page], files), problems);
  });
}

test('a frame with a CSS-module demo only has no problem when the demo has no Tailwind demo', () => {
  const page = makePage({
    imports: importLine('DemoButtonHero', CSS_MODULES),
    frame: '<DemoFrame>\n  <DemoButtonHero />\n</DemoFrame>\n',
    sources: '',
  });
  assert.deepEqual(problemsOf([page], new Set([CSS_MODULES])), []);
});

test('a frame with a CSS-module demo only is a problem of its Tailwind demo when the demo has one', () => {
  const page = makePage({
    imports: importLine('DemoButtonHero', CSS_MODULES),
    frame: '<DemoFrame>\n  <DemoButtonHero />\n</DemoFrame>\n',
    sources: '',
  });
  assert.deepEqual(problemsOf([page]), [
    `docs/demos/${TAILWIND} is in the #tailwind slot of 0 frames. Show it one time, in the frame of its CSS-module demo.`,
  ]);
});

test('a frame in another form is a problem that names the page to use as the model', () => {
  const page = makePage({
    frame: '<DemoFrame>\n  <DemoButtonHero />\n  <DemoButtonHeroTailwind />\n</DemoFrame>\n',
    sources: '',
  });
  assert.deepEqual(problemsOf([page], new Set([CSS_MODULES])), [
    `${PATH}: a <DemoFrame> has another form than the frames of ${MODEL}.`,
  ]);
});

const roots: string[] = [];

after(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeRoot(paths: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'demo-pages-'));
  roots.push(root);
  for (const path of paths) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), `text of ${path}`);
  }
  return root;
}

test('the pages of the components, the utilities and the handbook come with the family of each page', () => {
  const root = makeRoot([
    'docs/components/button.md',
    'docs/utils/merge-props.md',
    'docs/handbook/forms.md',
    'docs/handbook/styling.md',
    'docs/quick-start.md',
    'docs/components/button/Anatomy.vue',
  ]);
  assert.deepEqual(
    loadDemoPages(root)
      .map(({ path, family, text }) => ({ path, family, text }))
      .toSorted((a, b) => (a.path < b.path ? -1 : 1)),
    [
      {
        path: 'docs/components/button.md',
        family: 'button',
        text: 'text of docs/components/button.md',
      },
      {
        path: 'docs/handbook/forms.md',
        family: 'handbook-forms',
        text: 'text of docs/handbook/forms.md',
      },
      {
        path: 'docs/handbook/styling.md',
        family: 'handbook-styling',
        text: 'text of docs/handbook/styling.md',
      },
      {
        path: 'docs/utils/merge-props.md',
        family: 'merge-props',
        text: 'text of docs/utils/merge-props.md',
      },
    ],
  );
});

test('the files of the demos come with their paths from the demos folder', () => {
  const root = makeRoot([
    'docs/demos/button/hero/css-modules/index.vue',
    'docs/demos/button/upstream.json',
  ]);
  assert.deepEqual(
    listDemoFiles(root),
    new Set(['button/hero/css-modules/index.vue', 'button/upstream.json']),
  );
});

test('each Tailwind demo of the repository is in the frame of its CSS-module demo, with the two sources', () => {
  const files = listDemoFiles(REPOSITORY_ROOT);
  assert.notEqual(files.size, 0);
  assert.deepEqual(checkDemoPages(loadDemoPages(REPOSITORY_ROOT), files), []);
});
