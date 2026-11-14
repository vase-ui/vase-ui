import { computed, nextTick, onMounted, shallowRef, useSlots, watch } from 'vue';
// eslint-disable-next-line no-restricted-imports -- Vue sets `vnode.el` before `setup` only when it hydrates the component from server HTML. Vue has no public API for this fact, and Nuxt reads the same field. In Vapor mode the instance is `null`, and the part then writes its value as in a client-only mount.
import { getCurrentInstance } from 'vue';
import type { ComputedRef, Ref } from 'vue';
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

type TextControl = HTMLInputElement | HTMLTextAreaElement;

// Each control that got the `input` event of the take. A part in the `#render` slot of another
// part gives two calls for one element, and the element gets the events one time.
const takenControls = new WeakSet<Element>();

const queuedTakes: (() => boolean)[] = [];
let isTaking = false;

// A take that sends an event waits for the flush of that event before the next take runs, as a
// real event in another control comes in a later task. A root that holds the values of several
// controls, such as `OTPField.Root`, then has the new value of the earlier control in its props.
async function runQueuedTakes() {
  for (let take = queuedTakes.shift(); take !== undefined; take = queuedTakes.shift()) {
    if (take()) {
      await nextTick();
    }
  }
  isTaking = false;
}

function isTextControl(element: Element | null): element is TextControl {
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

/**
 * For a part that renders a text control. While Vue hydrates the part from server HTML, the
 * result is `false`, and the part gives its element no `value` key. The control then keeps a
 * value that it got before the hydration: typed text or an autofill.
 *
 * After the flush of the mount, a control whose value differs from its server HTML gets one
 * `input` event, and then the result is `true`. The handler of the part thus reads `false` for
 * that event. One tick later, such a control that does not have the focus also gets `change`,
 * `blur` and `focusout`, because the user left it before the listeners existed.
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
  if (!rendersElement || getCurrentInstance()?.vnode.el == null) {
    return shallowRef(true);
  }

  const writesValue = shallowRef(false);

  function leave(element: TextControl) {
    const doc = ownerDocument(element);
    const active = activeElement(doc);
    if (!element.isConnected || active === element) {
      return;
    }
    // A browser gives no `relatedTarget` for a focus that goes to no element.
    const relatedTarget = active === doc.body ? null : active;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new FocusEvent('blur', { composed: true, relatedTarget }));
    element.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget }),
    );
  }

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
    element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    writesValue.value = true;
    // A controlled part gets the new value in its prop only in the flush after the event.
    void nextTick(() => {
      leave(element);
    });
    return true;
  }

  // The watcher gives Vue a job in the flush that `onMounted` starts. `nextTick` then waits for
  // that flush, in which a root that registers its control in its own `onMounted` takes the
  // initial value. A post watcher would send the event before that.
  const isMounted = shallowRef(false);
  watch(isMounted, () => {});
  onMounted(() => {
    isMounted.value = true;
    queuedTakes.push(take);
    if (!isTaking) {
      isTaking = true;
      void nextTick(runQueuedTakes);
    }
  });

  return writesValue;
}
