import { TemporalPart } from '@vase-ui/vue/temporal-part';

declare const day: Temporal.PlainDate;

export const temporalPartProps: TemporalPart.Props = { value: day };
