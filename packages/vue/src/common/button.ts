import { computed, mergeProps, type Ref } from 'vue';
import { useInDisabledFieldset } from '../fieldset/part';
import { dispatchClickWithModifiers } from './dispatchClickWithModifiers';

/**
 * The behavior of a button: the attributes of its state, the stop of a disabled button, and the
 * keys of an element that is not a native button.
 */
export function useButton(options: {
  element: Readonly<Ref<Element | null>>;
  /** Disabled by the part: its prop, or its group. */
  disabled: () => boolean;
  focusableWhenDisabled?: () => boolean;
  /**
   * The `type` of a `<button>`, so that the button does not submit its form. Written only on a
   * `<button>`, or on an element that the part does not know yet. A `type` of the developer wins.
   */
  type?: 'button';
  /**
   * The tag of the element before the mount, where the part knows it (a tag in `as`). The server
   * then writes the attributes of that element. With none, the part counts a `<button>`.
   */
  tag?: () => string | undefined;
  /**
   * Enter and Space click an element that is no native button. With `false`, the part gives its
   * keys to another element, such as the owner of a list in virtual mode.
   */
  keys?: () => boolean;
}) {
  const tag = () => options.tag?.() ?? 'button';
  const isNative = computed(() =>
    options.element.value ? isNativeButton(options.element.value) : isNativeTag(tag()),
  );
  const inDisabledFieldset = useInDisabledFieldset(options.element);
  const disabledByFieldset = computed(() => isNative.value && inDisabledFieldset.value);
  /** Disabled by the part, or by a disabled fieldset around a native button. */
  const disabled = computed(() => options.disabled() || disabledByFieldset.value);
  let isSpaceDown = false;

  // A native disabled button gets no `mousedown`, `mouseup` or `click`, and no ancestor gets them
  // in the bubble phase (test/measurements/button.test.ts). A disabled button that keeps the focus,
  // and each other element, stops them the same way.
  function stopWhileDisabled(event: Event) {
    if (!disabled.value) return;
    if (event.type === 'click') event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onKeydown(event: KeyboardEvent) {
    const target = event.currentTarget as Element;
    if (event.target !== target || event.defaultPrevented) return;
    if (event.key === ' ') {
      // A native button gives the click at `keyup`, and the page does not scroll.
      event.preventDefault();
      isSpaceDown = true;
    } else if (event.key === 'Enter' && !disabled.value && !isLink(target)) {
      dispatchClickWithModifiers(target, event);
      // A click that gives the focus to a button would let the key press that button too
      // (test/measurements/menu.test.ts).
      event.preventDefault();
    }
  }

  function onKeyup(event: KeyboardEvent) {
    if (event.key !== ' ' || !isSpaceDown) return;
    isSpaceDown = false;
    if (!event.defaultPrevented && !disabled.value) {
      dispatchClickWithModifiers(event.currentTarget as Element, event);
    }
  }

  const rule = computed(() => {
    const isDisabled = disabled.value;
    // A disabled `<fieldset>` takes each button in it out of the tab order. A `Fieldset.Root` with
    // another element does the same.
    const focusable = !!options.focusableWhenDisabled?.() && !disabledByFieldset.value;
    const element = options.element.value;
    const attributes: Record<string, unknown> = isNative.value
      ? isDisabled && focusable
        ? { 'aria-disabled': 'true' }
        : { disabled: isDisabled ? '' : undefined }
      : {
          role: 'button',
          tabindex: isDisabled && !focusable ? -1 : 0,
          'aria-disabled': isDisabled ? 'true' : undefined,
        };
    if (options.type && (element?.localName ?? tag()) === 'button') {
      attributes.type = options.type;
    }
    return {
      ...attributes,
      onClick: stopWhileDisabled,
      onMousedown: stopWhileDisabled,
      onMouseup: stopWhileDisabled,
    };
  });

  return {
    disabled,
    /**
     * The attributes of the element. The values of the developer (`attrs`) win, then those of the
     * part (`own`), then those of the button. The key listeners run last, so that
     * `preventDefault()` in a key listener of the developer stops the click of the key.
     */
    mergeAttributes(own: Record<string, unknown>, attrs: Record<string, unknown>) {
      const keys = !isNative.value && (options.keys?.() ?? true);
      return mergeProps(rule.value, own, attrs, keys ? { onKeydown, onKeyup } : {});
    },
  };
}

/** A `<button>`, or an `<input>` that is a button. */
function isNativeButton(element: Element) {
  if (element.localName === 'button') return true;
  return (
    element.localName === 'input' &&
    ['button', 'submit', 'reset', 'image'].includes((element as HTMLInputElement).type)
  );
}

/** The tag of a native button. The part reads the `type` of an `<input>` at the mount. */
function isNativeTag(tag: string) {
  return tag === 'button' || tag === 'input';
}

function isLink(element: Element) {
  return element.localName === 'a' && element.hasAttribute('href');
}
