import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expectedSurface, normalizeDefault } from './mapping.ts';
import type { PropRow, SurfaceFile, SurfacePart } from './typesMd.ts';

function row(
  name: string,
  type = 'string',
  defaultValue: string | null = null,
  required = false,
): PropRow {
  return { name, required, type, default: defaultValue };
}

function makePart(rows: PropRow[], overrides: Partial<SurfacePart> = {}): SurfacePart {
  return {
    name: 'Part',
    tag: null,
    props: rows,
    state: null,
    actions: null,
    changeEventReason: null,
    changeEventDetails: null,
    dataAttributes: [],
    cssVariables: [],
    ...overrides,
  };
}

function makeFile(...parts: SurfacePart[]): SurfaceFile {
  return {
    file: 'docs/sample/types.md',
    parts,
    functions: [],
    types: [],
    additionalTypes: [],
    externalTypes: [],
  };
}

function summarize(part: SurfacePart, file = makeFile(part)) {
  const expected = expectedSurface(part, file);
  return {
    props: [...expected.props].map(
      ([name, prop]) =>
        `${name}<-${prop.row}${prop.required ? ' required' : ''}${prop.compareDefault ? ` default ${prop.default}` : ''}${prop.controlled ? ' controlled' : ''}`,
    ),
    emits: [...expected.emits.keys()],
    slots: [...expected.slots.keys()],
    exposed: [...expected.exposed.keys()],
    nativeListeners: expected.nativeListeners.map(
      ({ row: name, prop, emit }) => `${name}:${prop}:${emit}`,
    ),
  };
}

const CLICK = '((event: BaseUIEvent<React.MouseEvent<HTMLDivElement, MouseEvent>>) => void)';
const CHANGE = '((value: string, eventDetails: Part.ChangeEventDetails) => void)';

const rules: {
  name: string;
  part: SurfacePart;
  expected: Partial<ReturnType<typeof summarize>>;
}[] = [
  {
    name: 'render needs the prop as with the tag as its default, the render slot, the default slot and the element',
    part: makePart([row('render')], { tag: 'button' }),
    expected: {
      props: ["as<-render default 'button'"],
      slots: ['render', 'default'],
      exposed: ['element'],
    },
  },
  {
    name: 'render with no stated tag does not compare the default of as, and the part has a default slot',
    part: makePart([row('render')]),
    expected: { props: ['as<-render'], slots: ['render', 'default'], exposed: ['element'] },
  },
  {
    name: 'render with a void tag needs no default slot',
    part: makePart([row('render')], { tag: 'input' }),
    expected: { props: ["as<-render default 'input'"], slots: ['render'], exposed: ['element'] },
  },
  {
    name: 'children needs the default slot also for a void tag',
    part: makePart([row('render'), row('children')], { tag: 'img' }),
    expected: {
      props: ["as<-render default 'img'"],
      slots: ['render', 'default'],
      exposed: ['element'],
    },
  },
  {
    name: 'className and style need the props stateClass and stateStyle with no default',
    part: makePart([row('className'), row('style')]),
    expected: { props: ['stateClass<-className', 'stateStyle<-style'] },
  },
  {
    name: 'x with defaultX is controlled, and defaultX keeps its default',
    part: makePart([row('open', 'boolean'), row('defaultOpen', 'boolean', 'false')]),
    expected: { props: ['open<-open controlled', 'defaultOpen<-defaultOpen default false'] },
  },
  {
    name: 'x with no defaultX is a plain prop',
    part: makePart([row('open', 'boolean', null, true)]),
    expected: { props: ['open<-open required'] },
  },
  {
    name: 'a change handler with event details needs the emits xChange and update:x when the entry has the row x',
    part: makePart([row('value'), row('onValueChange', CHANGE)]),
    expected: { props: ['value<-value'], emits: ['valueChange', 'update:value'] },
  },
  {
    name: 'a change handler with event details needs no update:x when the entry has no row x',
    part: makePart([row('onOpenChange', CHANGE)]),
    expected: { emits: ['openChange'] },
  },
  {
    name: 'a handler that returns void needs the emit with the name of the handler',
    part: makePart([row('onOpenChangeComplete', '((open: boolean) => void)')]),
    expected: { emits: ['openChangeComplete'] },
  },
  {
    name: 'a handler that returns void and can be undefined needs the emit',
    part: makePart([row('onItemHighlighted', '((value: string) => void) | undefined')]),
    expected: { emits: ['itemHighlighted'] },
  },
  {
    name: 'a React event handler needs nothing and is a native listener',
    part: makePart([
      row('onClick', CLICK),
      row('onFocus', 'React.FocusEventHandler<HTMLElement>'),
      row('onBlur', 'EventHandler<FocusEvent>'),
    ]),
    expected: {
      nativeListeners: ['onClick:onClick:click', 'onFocus:onFocus:focus', 'onBlur:onBlur:blur'],
    },
  },
  {
    name: 'a handler that returns a value is a prop',
    part: makePart([row('onFilter', '((value: string) => boolean)')]),
    expected: { props: ['onFilter<-onFilter'] },
  },
  {
    name: 'actionsRef needs the exposed members of the Actions block of the part',
    part: makePart([row('actionsRef')], {
      actions: { name: 'PartActions', members: ['close', 'unmount'], code: '' },
    }),
    expected: { exposed: ['close', 'unmount'] },
  },
  {
    name: 'another ref needs the exposed member with Element in its name',
    part: makePart([row('inputRef')]),
    expected: { exposed: ['inputElement'] },
  },
  {
    name: 'each other row needs the prop with its required flag and its default',
    part: makePart([
      row('side', "'top' | 'bottom'", "'bottom'"),
      row('name', 'string', null, true),
    ]),
    expected: { props: ["side<-side default 'bottom'", 'name<-name required'] },
  },
];

for (const { name, part, expected } of rules) {
  test(`expectedSurface: ${name}`, () => {
    assert.deepEqual(summarize(part), {
      ...{ props: [], emits: [], slots: [], exposed: [], nativeListeners: [] },
      ...expected,
    });
  });
}

test('expectedSurface reads the actions of the Root of the file when the part has none', () => {
  const root = makePart([], {
    name: 'Root',
    actions: { name: 'RootActions', members: ['close'], code: '' },
  });
  const submenu = makePart([row('actionsRef')], { name: 'SubmenuRoot' });
  assert.deepEqual(summarize(submenu, makeFile(root, submenu)).exposed, ['close']);
});

test('expectedSurface refuses an actionsRef row with no Actions block anywhere', () => {
  const part = makePart([row('actionsRef')]);
  assert.throws(() => expectedSurface(part, makeFile(part)), {
    message:
      /docs\/sample\/types\.md: "Part" has the row "actionsRef", but it has no Actions block/,
  });
});

const defaults: [string, string | null, string | null][] = [
  ['quotes: a double quote and a back tick become one quote', `"a" \`b\``, "'a' 'b'"],
  ['white space: a run of white space is one space', '  { a:   1,\n  b: 2 }  ', '{ a: 1, b: 2 }'],
  ['a factory of an array is the array', '() => []', '[]'],
  ['a factory with parentheses is the value', '() => ({ a: 1 })', '{ a: 1 }'],
  ['a factory with a spaced arrow is the value', '(  ) =>   [1, 2]', '[1, 2]'],
  ['parentheses that do not wrap the whole value stay', '() => (a) + (b)', '(a) + (b)'],
  ['a value that is not a factory stays', 'false', 'false'],
  ['no value stays no value', null, null],
];

for (const [name, input, expected] of defaults) {
  test(`normalizeDefault: ${name}`, () => {
    assert.equal(normalizeDefault(input), expected);
  });
}
