import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readTypesMd } from './typesMd.ts';
import type { PropRow } from './typesMd.ts';

const FILE = 'docs/src/app/(docs)/react/components/sample/types.md';
const fixture = readFileSync(join(import.meta.dirname, 'fixtures', 'sample.types.md'), 'utf8');
const surface = readTypesMd(FILE, fixture);

function row(
  name: string,
  type: string,
  defaultValue: string | null = null,
  required = false,
): PropRow {
  return { name, required, type, default: defaultValue };
}

test('readTypesMd reads each prop row of a part with its type, default and required flag', () => {
  const [root, popup] = surface.parts;
  assert.deepEqual(root.props, [
    row('defaultOpen', 'boolean', 'false'),
    row('open', 'boolean'),
    row('onOpenChange', '((open: boolean, eventDetails: Sample.Root.ChangeEventDetails) => void)'),
    row('onOpenChangeComplete', '((open: boolean) => void)'),
    row('actionsRef', 'React.RefObject<Sample.Root.Actions | null>'),
    row('children', 'React.ReactNode | PayloadChildRenderFunction<Payload>'),
  ]);
  assert.deepEqual(popup.props, [
    row('name', 'string', null, true),
    row('side', "'top' | 'bottom'", "'bottom'"),
    row('keepMounted', 'boolean', 'false'),
    row('className', 'string | ((state: Sample.Popup.State) => string | undefined)'),
    row(
      'style',
      'React.CSSProperties | ((state: Sample.Popup.State) => React.CSSProperties | undefined)',
    ),
    row('onClick', '((event: BaseUIEvent<React.MouseEvent<HTMLDivElement, MouseEvent>>) => void)'),
    row('render', 'ReactElement | ((props: HTMLProps, state: Sample.Popup.State) => ReactElement)'),
  ]);
});

test('readTypesMd reads the tag of a part from its description', () => {
  assert.deepEqual(
    surface.parts.map(({ name, tag }) => [name, tag]),
    [
      ['Root', null],
      ['Popup', 'div'],
    ],
  );
});

test('readTypesMd reads the state fields, the action members and the reason strings', () => {
  const [root, popup] = surface.parts;
  assert.deepEqual(root.state, {
    name: 'SampleRootState',
    fields: [],
    code: 'type SampleRootState = {};',
  });
  assert.deepEqual(popup.state?.fields, [
    { name: 'open', optional: false, type: 'boolean' },
    { name: 'side', optional: false, type: "'top' | 'bottom'" },
    { name: 'disabled', optional: false, type: 'boolean' },
  ]);
  assert.equal(root.actions?.name, 'SampleRootActions');
  assert.deepEqual(root.actions?.members, ['unmount', 'close']);
  assert.equal(root.changeEventReason?.name, 'SampleRootChangeEventReason');
  assert.deepEqual(root.changeEventReason?.values, ['trigger-press', 'escape-key', 'none']);
  assert.equal(root.changeEventDetails?.name, 'SampleRootChangeEventDetails');
});

test('readTypesMd reads the data attributes and the CSS variables of a part', () => {
  const popup = surface.parts[1];
  assert.deepEqual(popup.dataAttributes, [
    { name: 'data-open', type: null },
    { name: 'data-closed', type: null },
  ]);
  assert.deepEqual(popup.cssVariables, [{ name: '--popup-width', type: 'number' }]);
});

test('readTypesMd prints code with no comment and keeps each block', () => {
  const [root, popup] = surface.parts;
  assert.equal(
    root.changeEventDetails?.code,
    [
      'type SampleRootChangeEventDetails = ({',
      "    reason: 'trigger-press';",
      '    event: MouseEvent;',
      '} | {',
      "    reason: 'escape-key';",
      '    event: KeyboardEvent;',
      '} | {',
      "    reason: 'none';",
      '    event: Event;',
      '}) & {',
      '    cancel: () => void;',
      '    isCanceled: boolean;',
      '};',
    ].join('\n'),
  );
  assert.equal(
    popup.state?.code,
    [
      'type SamplePopupState = {',
      '    open: boolean;',
      "    side: 'top' | 'bottom';",
      '    disabled: boolean;',
      '};',
    ].join('\n'),
  );
});

test('readTypesMd does not read a prop example block', () => {
  assert.equal('code' in surface.parts[1], false);
});

test('readTypesMd reads a function entry with its printed code', () => {
  assert.deepEqual(surface.functions, [
    { name: 'createHandle', tables: [], code: ['type ReturnValue = Sample.Handle;'] },
  ]);
});

test('readTypesMd reads the constants of a namespace and an external type', () => {
  assert.deepEqual(
    surface.additionalTypes.map(({ name, constants }) => [name, constants]),
    [
      ['SamplePopupCssVariables', [{ name: 'popupWidth', value: '--popup-width' }]],
      [
        'SamplePopupDataAttributes',
        [
          { name: 'open', value: 'data-open' },
          { name: 'closed', value: 'data-closed' },
        ],
      ],
    ],
  );
  assert.deepEqual(surface.externalTypes, [
    {
      name: 'InteractionType',
      code: "type InteractionType = 'mouse' | 'touch' | 'pen' | 'keyboard' | '';",
    },
  ]);
});

const API_REFERENCE = '# Sample\n\n## API Reference\n\n### Root\n\n';

const refusals: { name: string; markdown: string; message: RegExp }[] = [
  {
    name: 'a section that it does not know',
    markdown: '# Sample\n\n## Surprise\n\n### Item\n',
    message: /^docs\/sample\/types\.md: the section "Surprise" is not known\./,
  },
  {
    name: 'a label that it does not know',
    markdown: `${API_REFERENCE}**Odd Label:**\n\n| Prop | Type | Default | Description |\n| :-- | :-- | :-- | :-- |\n| a | \`b\` | - | - |\n`,
    message: /"Root": the label "Odd Label" is not known\./,
  },
  {
    name: 'a table header that it does not know',
    markdown: `${API_REFERENCE}**Root Props:**\n\n| Prop | Kind |\n| :-- | :-- |\n| a | b |\n`,
    message: /"Root": the table under "Root Props" has the header "Prop \| Kind"\./,
  },
  {
    name: 'a table with no label',
    markdown: `${API_REFERENCE}| Prop | Type |\n| :-- | :-- |\n| a | b |\n`,
    message: /"Root": a table with the header "Prop \| Type" has no label that the reader knows\./,
  },
  {
    name: 'a code block language that it does not know',
    markdown: `${API_REFERENCE}**Return Value:**\n\n\`\`\`python\nx = 1\n\`\`\`\n`,
    message: /"Root": the code block language "python" is not known\./,
  },
  {
    name: 'text before the first section',
    markdown: '# Sample\n\nA stray paragraph.\n\n## API Reference\n',
    message: /the Markdown element "paragraph" is before the first section\./,
  },
  {
    name: 'a Markdown element in an entry that it does not know',
    markdown: `${API_REFERENCE}> A quote.\n`,
    message: /"Root": the Markdown element "blockquote" is not known\./,
  },
];

for (const { name, markdown, message } of refusals) {
  test(`readTypesMd refuses ${name} and names it`, () => {
    assert.throws(() => readTypesMd('docs/sample/types.md', markdown), { message });
  });
}
