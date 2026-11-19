import { inject, type InjectionKey } from 'vue';

/** What `Meter.Root` gives to its parts. The properties are reactive. */
export interface MeterForParts {
  /** The `value` prop, as the developer gave it. */
  readonly value: number;
  /** The place of the value in the range, from 0 to 100. */
  readonly percent: number;
  /** The text of the value. `aria-valuetext` has the same text. */
  readonly formattedValue: string;
  /** The id of a label that has no `id` of its own. */
  readonly labelId: string;
  /** Adds a label. Returns the function that removes it. */
  addLabel(label: { readonly id: string }): () => void;
}

export const meterKey: InjectionKey<MeterForParts> = Symbol('meter');

export function injectMeterRoot(part: string) {
  const meter = inject(meterKey, null);
  if (!meter) throw new Error(`Vase UI Meter: <Meter.${part}> must be inside <Meter.Root>.`);
  return meter;
}
