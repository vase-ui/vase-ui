import type { InjectionKey } from 'vue';
import type { FieldsetForPart } from './part';

/**
 * What a `Fieldset.Root` gives to its legend: the answer for a part in the legend. A disabled root
 * does not disable its legend, so the answer comes from the fieldsets around the root.
 */
export const legendKey: InjectionKey<FieldsetForPart> = Symbol('fieldset legend');
