import { defineComponent, onMounted, shallowRef } from 'vue';

/**
 * A wrapper of a widget that makes its element in `onMounted`. A getter with no reactive source
 * exposes the element, so the part does not render again when the element comes. The element has
 * the test id `widget`.
 */
export const MountedElementTarget = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, expose }) {
    const host = shallowRef<HTMLElement | null>(null);
    let widgetElement: HTMLElement | null = null;
    onMounted(() => {
      widgetElement = host.value;
    });
    expose({
      get element() {
        return widgetElement;
      },
    });
    return () => <div {...attrs} ref={host} data-testid="widget" />;
  },
});
