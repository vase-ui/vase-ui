import type { DateField } from '@vase-ui/vue/date-field';
import type { TemporalPart } from '@vase-ui/vue/temporal-part';
import type { TemporalReexport } from '@vase-ui/vue/temporal-reexport';

declare const day: Temporal.PlainDate;

export const dateFieldProps: DateField.Root.Props = { value: day };
export const temporalPartProps: TemporalPart.Props = { value: day };
export const temporalReexportProps: TemporalReexport.Props = { value: day };
