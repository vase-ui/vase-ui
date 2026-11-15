import type { TemporalPart } from '@vase-ui/vue/temporal-part';
import type { TemporalReexport } from '@vase-ui/vue/temporal-reexport';
import type { TimeField } from '@vase-ui/vue/time-field';

declare const day: Temporal.PlainDate;
declare const time: Temporal.PlainTime;

export const temporalPartProps: TemporalPart.Props = { value: day };
export const temporalReexportProps: TemporalReexport.Props = { value: day };
export const timeFieldProps: TimeField.Root.Props = { value: time };
