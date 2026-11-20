import { onMounted } from 'vue';
import { warn } from '../../../common/warn';

/**
 * Warns as a part of the older form does when the calendar of a picker has no element. The
 * calendar of a picker renders its `as` and its `#render` slot through `Calendar.Root`.
 */
export function warnWithoutCalendarElement(
  element: () => Element | null,
  hasRenderSlot: () => boolean,
) {
  if (process.env.NODE_ENV === 'production') return;
  onMounted(() => {
    if (element()) return;
    if (hasRenderSlot()) {
      warn(
        'The `#render` slot gave no element to the part.',
        'The part cannot find its element, so the behavior that needs the element does not work.',
        'Bind `props` on the element: `v-bind="props"`.',
        'In a Vapor component, also bind the `ref` setter by name: `:ref="props.ref"`.',
        'If the element has a `ref` of its own, call `props.ref` in it.',
      );
    } else {
      warn(
        'The component has no single root element, because it renders a fragment, a text or a comment.',
        'The part then cannot reach its element.',
        'Render one root element in the component, or expose the element as `element`.',
      );
    }
  });
}
