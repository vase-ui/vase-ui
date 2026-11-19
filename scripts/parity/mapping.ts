import type { PropRow, SurfaceFile, SurfacePart } from './typesMd.ts';

// The void elements of the HTML standard. They have no content, so a part with one has no default slot.
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

const REACT_EVENT_HANDLER = /\bReact\.\w*Event|BaseUIEvent|EventHandler</;

export interface ExpectedProp {
  required: boolean;
  /** The default that Base UI documents, as it is written. `null` when Base UI documents none. */
  default: string | null;
  compareDefault: boolean;
  /** A controlled prop (`x` with `defaultX`) must have the default `undefined`. */
  controlled: boolean;
  /** The name of the Base UI row that needs the prop. */
  row: string;
}

export interface NativeListener {
  row: string;
  prop: string;
  emit: string;
}

export interface ExpectedSurface {
  props: Map<string, ExpectedProp>;
  /** Each map gives the name of the Base UI row that needs the member. */
  emits: Map<string, string>;
  slots: Map<string, string>;
  exposed: Map<string, string>;
  nativeListeners: NativeListener[];
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Makes two default texts comparable: one quote form, one white space form, and no Vue factory. */
export function normalizeDefault(text: string | null | undefined): string | null {
  if (text === null || text === undefined) {
    return null;
  }
  let value = text.replace(/["`]/g, "'").replace(/\s+/g, ' ').trim();
  const factory = /^\(\s*\)\s*=>\s*(.+)$/.exec(value);
  if (factory) {
    value = factory[1].trim();
    if (value.startsWith('(') && closingParenthesis(value, 0) === value.length - 1) {
      value = value.slice(1, -1).trim();
    }
  }
  return value;
}

function closingParenthesis(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '(') {
      depth += 1;
    } else if (text[index] === ')' && --depth === 0) {
      return index;
    }
  }
  return -1;
}

function actionMembers(part: SurfacePart, file: SurfaceFile): string[] {
  const actions = part.actions ?? file.parts.find(({ name }) => name === 'Root')?.actions;
  if (!actions) {
    throw new Error(
      `${file.file}: "${part.name}" has the row "actionsRef", but it has no Actions block and the part "Root" has none. Teach scripts/parity/mapping.ts the form.`,
    );
  }
  return actions.members;
}

function changeState(row: PropRow): string | undefined {
  if (
    /^on[A-Z].*Change$/.test(row.name) &&
    row.type.includes('eventDetails') &&
    !REACT_EVENT_HANDLER.test(row.type)
  ) {
    return lowerFirst(row.name.slice(2, -'Change'.length));
  }
  return undefined;
}

function modelName(state: string): string {
  return state === 'value' || state === 'checked' || state === 'pressed' ? 'modelValue' : state;
}

function addEvent(expected: ExpectedSurface, row: PropRow, rowNames: Set<string>): void {
  const base = row.name.slice(2);
  const emit = lowerFirst(base);
  const state = changeState(row);
  if (REACT_EVENT_HANDLER.test(row.type)) {
    expected.nativeListeners.push({ row: row.name, prop: row.name, emit: lowerFirst(base) });
  } else if (state !== undefined) {
    expected.emits.set(emit, row.name);
    if (rowNames.has(state)) {
      expected.emits.set(`update:${modelName(state)}`, row.name);
    }
  } else if (/=>\s*void\)?$/.test(row.type.replace(/\s*\|\s*undefined$/, ''))) {
    expected.emits.set(emit, row.name);
  } else {
    expected.props.set(row.name, {
      required: row.required,
      default: row.default,
      compareDefault: row.default !== null,
      controlled: false,
      row: row.name,
    });
  }
}

export function expectedSurface(part: SurfacePart, file: SurfaceFile): ExpectedSurface {
  const expected: ExpectedSurface = {
    props: new Map(),
    emits: new Map(),
    slots: new Map(),
    exposed: new Map(),
    nativeListeners: [],
  };
  const rows = part.props ?? [];
  const rowNames = new Set(rows.map(({ name }) => name));
  const models = new Set(rows.map(changeState));
  const controlled = new Set(
    rows.flatMap(({ name }) => {
      const match = /^default([A-Z]\w*)$/.exec(name);
      return match && rowNames.has(lowerFirst(match[1])) ? [lowerFirst(match[1])] : [];
    }),
  );
  for (const row of rows) {
    // Vue forwards class and style as native attributes.
    if (row.name === 'className' || row.name === 'style') {
      continue;
    }
    if (row.name === 'render') {
      expected.props.set('as', {
        required: false,
        default: part.tag === null ? null : `'${part.tag}'`,
        compareDefault: part.tag !== null,
        controlled: false,
        row: row.name,
      });
      expected.slots.set('render', row.name);
      expected.exposed.set('element', row.name);
      if (part.tag === null || !VOID_ELEMENTS.has(part.tag)) {
        expected.slots.set('default', expected.slots.get('default') ?? row.name);
      }
    } else if (row.name === 'children') {
      expected.slots.set('default', row.name);
    } else if (row.name === 'actionsRef') {
      for (const member of actionMembers(part, file)) {
        expected.exposed.set(member, row.name);
      }
    } else if (row.name.endsWith('Ref')) {
      expected.exposed.set(`${row.name.slice(0, -'Ref'.length)}Element`, row.name);
    } else if (/^on[A-Z]/.test(row.name)) {
      addEvent(expected, row, rowNames);
    } else {
      const name = part.name === 'Portal' && row.name === 'container' ? 'to' : row.name;
      expected.props.set(models.has(name) ? modelName(name) : name, {
        required: row.required,
        default: row.default,
        compareDefault: !controlled.has(row.name) && row.default !== null,
        controlled: controlled.has(row.name),
        row: row.name,
      });
    }
  }
  return expected;
}

/**
 * A part of the refactored form takes the slot `element` in place of the prop `as` and the slot
 * `render`. The part has the slot `element` and no prop `as`. The check accepts both forms until
 * each family has the new one.
 */
export function acceptElementSlot(
  expected: ExpectedSurface,
  actual: { props: ReadonlyMap<string, unknown>; slots: ReadonlyMap<string, unknown> },
): void {
  const row = expected.slots.get('render');
  if (row === undefined || !actual.slots.has('element') || actual.props.has('as')) {
    return;
  }
  expected.props.delete('as');
  expected.slots.delete('render');
  expected.slots.set('element', row);
}
