import { h } from 'vue';
import type { Component, FunctionalComponent } from 'vue';
import type { DateTimeFieldSegment } from '../../internals/date-time/field/DateTimeFieldContext';
import DateFieldInputLayoutItem from './DateFieldInputLayoutItem.vue';

interface DateFieldInputElementProps {
  tag: string | Component;
  elementProps: Record<string, any>;
  segments: readonly DateTimeFieldSegment[];
  /** Changes when the layout of the server differs from the layout of the browser. */
  listKey: number;
}

/**
 * The element of `DateField.Input`, with the layout items as direct children. A `v-for` in a
 * template makes the items a fragment. A fragment with another number of items than the server
 * HTML makes Vue log `Hydration completed but contains mismatches`, also under
 * `data-allow-mismatch`. The layout of a server differs when its `Intl` data differs from the data
 * of the browser. Direct children differ only by item, and `data-allow-mismatch` allows that.
 */
export const DateFieldInputElement: FunctionalComponent<
  DateFieldInputElementProps,
  {},
  { segment?(props: { segment: DateTimeFieldSegment; index: number }): unknown }
> = (props, { slots }) =>
  h(
    props.tag,
    props.elementProps,
    props.segments.map((segment) =>
      h(
        DateFieldInputLayoutItem,
        { key: `${props.listKey}:${segment.index}`, segment },
        slots.segment ? { segment: slots.segment } : undefined,
      ),
    ),
  );

DateFieldInputElement.props = ['tag', 'elementProps', 'segments', 'listKey'];
