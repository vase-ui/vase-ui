import {
  computed,
  mergeProps,
  onMounted,
  onUnmounted,
  shallowRef,
  useId,
  watch,
  type Ref,
} from 'vue';
import { givenId } from '../common/id';
import type { CollapsiblePart } from './part';

// With `normal`, no alignment moves the content out of a box of height 0, so the scroll size is the
// size of the content in the three browsers (test/measurements/collapsible.test.ts).
const ALIGNMENT = ['justify-content', 'align-content', 'align-items', 'justify-items'];

/** The behavior of `Collapsible.Panel` and `Accordion.Panel`. */
export function useCollapsiblePanel(
  part: CollapsiblePart,
  options: {
    element: Readonly<Ref<HTMLElement | null>>;
    id: () => string | undefined;
    keepMounted: () => boolean;
    hiddenUntilFound: () => boolean;
    /** The names of the CSS variables of the height and of the width. */
    variables: readonly [height: string, width: string];
  },
) {
  const generatedId = useId();
  const id = computed(() => givenId(options.id()) ?? generatedId);
  // Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
  // registers before the call.
  const unregister = part.addPanel({
    get id() {
      return id.value;
    },
  });
  onUnmounted(unregister);

  // An element that leaves in a `<Transition>` is in the document until its leave ends. Vue gives
  // a new element that enters during that leave no enter (test/measurements/collapsible.test.ts),
  // so the new element waits for the old one to go.
  const waiting = shallowRef(false);
  // A weak reference lets the browser free the removed element of a closed panel.
  let leaving: WeakRef<Element> | undefined;
  watch(
    () => part.open,
    (open) => {
      writeSize();
      if (!open) {
        const element = options.element.value;
        leaving = element ? new WeakRef(element) : undefined;
        return;
      }
      const gone = leaving?.deref();
      const parent = gone?.parentNode;
      // A kept element stays in the DOM, so it does not leave.
      if (!gone || !parent || gone === options.element.value) return;
      waiting.value = true;
      const observer = new MutationObserver(() => {
        if (gone.isConnected) return;
        observer.disconnect();
        waiting.value = false;
      });
      observer.observe(parent, { childList: true });
    },
  );
  // A new element, and a kept element that shows, get the size that they have at their closed style.
  watch(
    [options.element, () => part.open],
    ([element, open]) => {
      if (element && open) writeSize();
    },
    { flush: 'post' },
  );

  function writeSize() {
    const element = options.element.value;
    if (!element) return;
    const { style } = element;
    const saved = ALIGNMENT.map(
      (name) => [name, style.getPropertyValue(name), style.getPropertyPriority(name)] as const,
    );
    for (const name of ALIGNMENT) style.setProperty(name, 'normal', 'important');
    const sizes = [element.scrollHeight, element.scrollWidth];
    for (const [name, value, priority] of saved) style.setProperty(name, value, priority);
    options.variables.forEach((variable, index) =>
      style.setProperty(variable, `${sizes[index]}px`),
    );
  }

  // Before Vue 3.5.41 and 3.6.0-rc.3, the server writes a bare `hidden`, and the hydration keeps it
  // (test/measurements/collapsible.test.ts). Find-in-page then skips the panel.
  onMounted(() => {
    if (!part.open && options.hiddenUntilFound()) {
      options.element.value?.setAttribute('hidden', 'until-found');
    }
  });

  function onBeforematch(event: Event) {
    // The event bubbles from a panel in the panel.
    if (event.target !== event.currentTarget) return;
    part.request(true, 'none', event);
    // The browser removes `hidden` after the event, and Vue writes it only when the state changes.
    // A task runs after the removal and after the render of a parent that takes the change
    // (test/measurements/collapsible.test.ts).
    setTimeout(() => {
      if (!part.open) options.element.value?.setAttribute('hidden', 'until-found');
    });
  }

  return {
    /** The element is in the DOM. */
    shown: computed(
      () => (part.open && !waiting.value) || options.keepMounted() || options.hiddenUntilFound(),
    ),
    elementProps(own: Record<string, unknown>, attrs: Record<string, unknown>) {
      const closed = !part.open;
      const untilFound = options.hiddenUntilFound();
      return mergeProps(
        {
          id: id.value,
          // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
          hidden: closed ? (untilFound ? 'until-found' : true) : undefined,
          // The CSS of a developer can show a closed panel to animate it. Find-in-page does not
          // search `inert` content, and the browser keeps `hidden="until-found"` content out of
          // the focus order (test/measurements/collapsible.test.ts).
          inert: closed && !untilFound ? true : undefined,
          'data-disabled': part.disabled ? '' : undefined,
          onBeforematch,
          ...own,
        },
        attrs,
      );
    },
  };
}
