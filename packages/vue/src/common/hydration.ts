import { computed, nextTick, onMounted, shallowRef, useSlots, watch } from 'vue';
// eslint-disable-next-line no-restricted-imports -- Vue sets `vnode.el` before `setup` only when it hydrates the component from server HTML. Vue has no public API for this fact, and Nuxt reads the same field. In Vapor mode the instance is `null`, and each composable then acts as in a client-only mount.
import { getCurrentInstance } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { isHTMLElement, isNode } from '@floating-ui/utils/dom';
import { ownerDocument } from './owner';
import { activeElement } from './shadowDom';

// Vue has no public API that tells a hydration from a client-only mount in `setup`.
// The lifecycle gives two facts. A server render never calls `onMounted`.
// An app that hydrates calls it after the hydration of the component.
// https://vuejs.org/api/composition-api-lifecycle.html#onmounted
// https://vuejs.org/guide/scaling-up/ssr.html#hydration-mismatch
//
// Each call is for the component that calls it. A part that hydrates after its root, such as an
// async component in `<Suspense>`, then still reads its first render as hydrating.
// The cost: the first render of a client-only mount also reads as hydrating. The component then
// renders again in the flush after the mount, before a paint.

/** Gives `true` once the component that calls it is mounted on the client. */
export function useIsHydrated(): Readonly<Ref<boolean>> {
  const hydrated = shallowRef(false);
  onMounted(() => {
    hydrated.value = true;
  });
  return hydrated;
}

/**
 * Gives `true` on a server and until the component that calls it is mounted on the client.
 * It is the inverse of {@link useIsHydrated}.
 */
export function useIsHydrating(): ComputedRef<boolean> {
  const hydrated = useIsHydrated();
  return computed(() => !hydrated.value);
}

/**
 * Gives the function that a part calls for each `aria-*` value of an element that
 * `useRenderElement` does not render, such as a hidden input. The first client render of such an
 * element can differ from the server HTML. It does not know a later part, such as a description
 * after the part, and the browser can format a date with other `Intl` data.
 * The function gives `null` while Vue hydrates the part from server HTML. On a server, in a
 * client-only mount and after the mount, it gives the value.
 *
 * An `aria-*` attribute from a `v-bind` object keeps its server value while Vue hydrates. The
 * page can remove or change a later part at the mount. The render after the mount can then give
 * the value of the first client render, and Vue writes nothing. With `null` in the first client
 * render, the render after the mount always writes its value.
 *
 * Give the function only the value of an attribute that Vue does not compare while it hydrates, or
 * of an attribute that the element allows to differ with `data-allow-mismatch` and the category
 * `attribute`. Vue does not compare `aria-*` attributes or other attributes outside its lists of
 * known attributes. Vue compares the attributes of those lists, such as `id` and `tabindex`, and it
 * warns when they differ.
 */
export function useAriaAfterHydration(): <Value>(value: Value) => Value | null {
  if (getCurrentInstance()?.vnode.el == null) {
    return (value) => value;
  }
  const hydrated = useIsHydrated();
  return (value) => (hydrated.value ? value : null);
}

// The first element that Vue hydrates for the component. A component whose template starts with a
// fragment, such as a part with a `#render` slot, starts with the comment `[`, and the fragment
// ends with the comment `]`. Vue 3.6 writes the fallback content of a slot between the comments `(`
// and `)`. A component that renders only a comment has no element. The walk thus stops before the
// nodes of the next component, and it does not give the element of that component.
function serverElementOf(first: unknown): Element | null {
  let depth = 0;
  for (let node = isNode(first) ? first : null; node !== null; node = node.nextSibling) {
    if (node.nodeType === 1) {
      return node as Element;
    }
    const text = node.nodeType === 8 ? (node as Comment).data : undefined;
    depth += text === '[' || text === '(' ? 1 : text === ']' || text === ')' ? -1 : 0;
    if (depth <= 0) {
      return null;
    }
  }
  return null;
}

/**
 * Gives the element of the server HTML that Vue hydrates for the component that calls it. It gives
 * `null` on a server, in a client-only mount and in a part that Vue compiles as a Vapor component.
 * Call it in `setup`.
 */
export function getServerElement(): Element | null {
  return serverElementOf(getCurrentInstance()?.vnode.el);
}

/**
 * Gives the element of the server HTML that Vue hydrates for the component that calls it, until
 * the component is mounted. It gives `null` on a server, in a client-only mount and after the
 * mount.
 *
 * A part whose first client render cannot know a value of the server HTML reads that value from
 * the element. The first client render then gives the value of the server HTML, and Vue writes
 * each value that the render after the mount changes.
 */
export function useServerElement(): () => HTMLElement | null {
  const element = getServerElement();
  if (!isHTMLElement(element)) {
    return () => null;
  }
  const hydrated = useIsHydrated();
  return () => (hydrated.value ? null : element);
}

type TextControl = HTMLInputElement | HTMLTextAreaElement;

// Each control that got the `input` event of the take. A part in the `#render` slot of another
// part gives two calls for one element, and the element gets the events one time.
const takenControls = new WeakSet<Element>();

const queuedTakes: (() => boolean)[] = [];
let isTaking = false;

// A take that sends an event waits for the flush of that event before the next take runs, as a
// real event in another control comes in a later task. A root that holds the values of several
// controls then has the new value of the earlier control in its props.
async function runQueuedTakes() {
  for (let take = queuedTakes.shift(); take !== undefined; take = queuedTakes.shift()) {
    if (take()) {
      await nextTick();
    }
  }
  isTaking = false;
}

/**
 * Runs `take` after the current flush of Vue, in the order of the calls. Call it after the mount
 * of a part whose control changed before the hydration.
 * @param take Gives `true` when it sent a change. The next take then runs after the flush of that
 * change, so a parent that controls two parts has the first change in its props.
 */
export function queueInputTake(take: () => boolean): void {
  queuedTakes.push(take);
  if (!isTaking) {
    isTaking = true;
    void nextTick(runQueuedTakes);
  }
}

/** Whether the element is an `<input>` or a `<textarea>`. */
export function isTextControl(element: Element | null): element is TextControl {
  return element?.localName === 'input' || element?.localName === 'textarea';
}

// The value of the control before a change. A browser sanitizes the `value` attribute of some
// types, and it changes the line breaks of a `<textarea>`, so `defaultValue` can differ from it.
function getUnchangedValue(control: TextControl): string {
  const doc = control.ownerDocument;
  const fresh =
    control.localName === 'input' ? doc.createElement('input') : doc.createElement('textarea');
  for (const { name, value } of control.attributes) {
    fresh.setAttribute(name, value);
  }
  fresh.defaultValue = control.defaultValue;
  return fresh.value;
}

function leave(control: TextControl) {
  const doc = ownerDocument(control);
  const active = activeElement(doc);
  if (!control.isConnected || active === control) {
    return;
  }
  // A browser gives no `relatedTarget` for a focus that goes to no element.
  const relatedTarget = active === doc.body ? null : active;
  control.dispatchEvent(new Event('change', { bubbles: true }));
  control.dispatchEvent(new FocusEvent('blur', { composed: true, relatedTarget }));
  control.dispatchEvent(
    new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget }),
  );
}

/**
 * Sends one `input` event to a control whose value changed with no event that its part handled.
 * @param leaves With `true`, one tick later, a control that does not have the focus also gets
 * `change`, `blur` and `focusout`, because the user left it before the part saw the change. A
 * controlled part gets the new value in its prop only in the flush after the `input` event.
 */
export function dispatchTakeEvents(control: TextControl, leaves: boolean): void {
  control.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  if (leaves) {
    void nextTick(() => {
      leave(control);
    });
  }
}

function useControlValueBeforeHydration(
  isNativeControl: boolean,
  control: () => Element | null,
  leaves: boolean,
): Readonly<Ref<boolean>> {
  const serverNode = getCurrentInstance()?.vnode.el;
  if (!isNativeControl || serverNode == null) {
    return shallowRef(true);
  }

  const writesValue = shallowRef(false);

  // Gives `true` when it sends the `input` event.
  function take() {
    const element = control();
    if (
      !isTextControl(element) ||
      takenControls.has(element) ||
      element.value === getUnchangedValue(element)
    ) {
      writesValue.value = true;
      return false;
    }

    takenControls.add(element);
    dispatchTakeEvents(element, leaves);
    writesValue.value = true;
    return true;
  }

  // The watcher gives Vue a job in the flush that `onMounted` starts, so `nextTick` waits for that
  // flush. A root that registers its control in its own `onMounted` takes the initial value of its
  // field in that flush, before the event.
  const isMounted = shallowRef(false);
  watch(isMounted, () => {});
  onMounted(() => {
    // A control that equals its server HTML has nothing to take, so it gets the `value` key from
    // the mount on. A root thus writes its value to its hidden input while the takes of the
    // controls inside it run, and their `blur` validates the field against that value.
    const element = control();
    if (!isTextControl(element) || element.value === getUnchangedValue(element)) {
      writesValue.value = true;
      return;
    }

    isMounted.value = true;
    queueInputTake(take);
  });

  return writesValue;
}

/**
 * For a part that renders a text control. While Vue hydrates the part from server HTML, the
 * result is `false`, and the part gives its element no `value` key. The control then keeps a
 * value that it got before the hydration: typed text, an autofill or a value that the browser
 * restored.
 *
 * A control that equals its server HTML gives `true` from the mount. After the flush of the mount,
 * a control whose value differs from its server HTML gets one `input` event, and then the result
 * is `true`. The handler of the part thus reads `false` for that event. One tick later, such a
 * control that does not have the focus also gets `change`, `blur` and `focusout`, because the user
 * left it before the listeners existed.
 *
 * In a client-only mount, and for a component in `as`, the result is `true` from the start.
 * @param componentProps The props of the part. The composable reads `as`.
 * @param control Gives the element of the part.
 */
export function useValueBeforeHydration(
  componentProps: { as?: unknown },
  control: () => Element | null,
): Readonly<Ref<boolean>> {
  const rendersElement = typeof componentProps.as === 'string' || useSlots().render !== undefined;
  return useControlValueBeforeHydration(rendersElement, control, true);
}

/**
 * For a root that renders a hidden `<input>` of its own, such as `Combobox.Root`. It is
 * {@link useValueBeforeHydration} with one difference: the input gets only the `input` event,
 * because the user cannot focus or leave it.
 * @param input Gives the hidden input.
 */
export function useHiddenValueBeforeHydration(
  input: () => HTMLInputElement | null,
): Readonly<Ref<boolean>> {
  return useControlValueBeforeHydration(true, input, false);
}
