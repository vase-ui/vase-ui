import type { TemporalPart } from '@vase-ui/vue/temporal-part';
import type { TemporalReexport } from '@vase-ui/vue/temporal-reexport';
import type { TimeClock } from '@vase-ui/vue/time-clock';

declare const day: Temporal.PlainDate;
declare const time: Temporal.PlainTime;

export const temporalPartProps: TemporalPart.Props = { value: day };
export const temporalReexportProps: TemporalReexport.Props = { value: day };
export const timeClockProps: TimeClock.Root.Props = { defaultValue: time };
