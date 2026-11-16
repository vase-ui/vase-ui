import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileScript, parse } from 'vue/compiler-sfc';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';

// The API reference takes the props of a part from the bindings of `compileScript` that have the
// type `props` (`scripts/parity/vaseSurface.ts`). A constant of `setup` with the name of a prop
// replaces that binding, so the API reference leaves the prop out. Each part is in this table, so
// the second case fails for a part that it lacks.
const PARTS = [
  { name: 'Root', file: 'root/DateRangePickerRoot.vue', part: DateRangePicker.Root },
  {
    name: 'StartField',
    file: 'start-field/DateRangePickerStartField.vue',
    part: DateRangePicker.StartField,
  },
  {
    name: 'EndField',
    file: 'end-field/DateRangePickerEndField.vue',
    part: DateRangePicker.EndField,
  },
  { name: 'Trigger', file: 'trigger/DateRangePickerTrigger.vue', part: DateRangePicker.Trigger },
  {
    name: 'Positioner',
    file: 'positioner/DateRangePickerPositioner.vue',
    part: DateRangePicker.Positioner,
  },
  { name: 'Popup', file: 'popup/DateRangePickerPopup.vue', part: DateRangePicker.Popup },
  {
    name: 'Calendar',
    file: 'calendar/DateRangePickerCalendar.vue',
    part: DateRangePicker.Calendar,
  },
];

describe('the parts of Date Range Picker', () => {
  it.each(PARTS)('$name gives each prop to the API reference', ({ file, part }) => {
    const path = fileURLToPath(new URL(file, import.meta.url));
    const { descriptor } = parse(readFileSync(path, 'utf8'), { filename: path });
    const { bindings = {} } = compileScript(descriptor, { id: path });
    const declared: unknown = Reflect.get(part, 'props');
    const names = typeof declared === 'object' && declared !== null ? Object.keys(declared) : [];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- `vue/compiler-sfc` does not export the enum `BindingTypes`, so the case compares its value.
    const hidden = names.filter((name) => bindings[name] !== 'props');

    expect(names.length).toBeGreaterThan(0);
    expect(hidden).toEqual([]);
  });

  it('has a row in the table above for each part of its folder', () => {
    const folder = fileURLToPath(new URL('.', import.meta.url));
    const files = readdirSync(folder, { recursive: true, encoding: 'utf8' }).filter(
      (file) => file.endsWith('.vue') && !/\.(test|spec)\.vue$/.test(file),
    );

    expect(files.toSorted()).toEqual(PARTS.map(({ file }) => file).toSorted());
  });
});
