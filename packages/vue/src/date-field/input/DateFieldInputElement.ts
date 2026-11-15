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
  /** The `segment` slot of the part. */
  segmentSlot: ((props: { segment: DateTimeFieldSegment; index: number }) => unknown) | undefined;
}

/**
 * The element of `DateField.Input`, with the layout items as direct children. A `v-for` in a
 * template makes the items a fragment. A fragment with another number of items than the server
 * HTML makes Vue log `Hydration completed but contains mismatches`, also under
 * `data-allow-mismatch`. The layout of a server differs when its `Intl` data differs from the data
 * of the browser. Direct children differ only by item, and `data-allow-mismatch` allows that.
 *
 * The part gives the slot as a prop and not as a slot of this component. A server render of a slot
 * that a template makes with `v-if` is a function that writes to the output. Vue wraps such a
 * function again when it passes through `h`, and the wrapper then renders nothing.
 */
export const DateFieldInputElement: FunctionalComponent<DateFieldInputElementProps> = (props) => {
  const items = props.segments.map((segment) =>
    h(
      DateFieldInputLayoutItem,
      { key: `${props.listKey}:${segment.index}`, segment },
      props.segmentSlot ? { segment: props.segmentSlot } : undefined,
    ),
  );
  // A component takes its children as a slot, and an element takes them as an array.
  return typeof props.tag === 'string'
    ? h(props.tag, props.elementProps, items)
    : h(props.tag, props.elementProps, { default: () => items });
};

DateFieldInputElement.props = ['tag', 'elementProps', 'segments', 'listKey', 'segmentSlot'];
