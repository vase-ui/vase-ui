import { isHTMLElement } from '@floating-ui/utils/dom';
import { inject, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { error } from '../../common/error';
import { makeEventPreventable, mergeProps } from '../../merge-props';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { useFocusableWhenDisabled } from '../../utils/useFocusableWhenDisabled';
import { CompositeRootContext } from '../composite/root/CompositeRootContext';
import type { VaseUIEvent } from '../types';

/**
 * Gives a part the attributes and the keyboard activation of a button.
 * Call it in `setup`, because it reads the context of the composite root with `inject`.
 * Each parameter is a value, a ref or a getter, so the attributes follow the props of the part.
 */
export function useButton(parameters: UseButtonParameters = {}): UseButtonReturnValue {
  const compositeRootContext = inject(CompositeRootContext, undefined);

  // `setup` runs one time, so a read of a parameter here would never see a change.
  const isDisabled = () => toValue(parameters.disabled) ?? false;
  const isNative = () => toValue(parameters.native) ?? true;
  const isComposite = () => toValue(parameters.composite) ?? compositeRootContext !== undefined;

  const { props: focusableWhenDisabledProps } = useFocusableWhenDisabled({
    focusableWhenDisabled: parameters.focusableWhenDisabled,
    disabled: isDisabled,
    composite: isComposite,
    tabIndex: parameters.tabIndex,
    isNativeButton: isNative,
  });

  // Vue calls the ref of a part during the render of that part. A reactive read there would make
  // the render depend on it, so this is a plain variable.
  let buttonElement: HTMLElement | null = null;

  // A disabled composite button can render another button part, such as a toolbar button that
  // renders a menu trigger. `disabled` then goes through two `useButton` calls and reaches the DOM.
  // The item must stay focusable, so the code removes the `disabled` property of the element.
  function updateDisabled() {
    const element = buttonElement;

    if (!isButtonElement(element)) {
      return;
    }

    if (
      isComposite() &&
      isDisabled() &&
      focusableWhenDisabledProps.value.disabled === undefined &&
      element.disabled
    ) {
      element.disabled = false;
    }
  }

  // A post watcher runs after Vue patches the DOM. It does not run in a server render.
  watch(
    [isDisabled, () => focusableWhenDisabledProps.value.disabled, isComposite],
    updateDisabled,
    { flush: 'post' },
  );

  // A wrapper component gives its element after its render. A mount hook of `useButton` can run
  // before that, so the check runs when the element arrives and when `native` changes.
  function checkElement() {
    if (!buttonElement) {
      return;
    }

    const isButtonTag = isButtonElement(buttonElement);

    if (isNative()) {
      if (!isButtonTag) {
        error(
          'A component that acts as a button expected a native <button> because the `nativeButton` prop is true.',
          'Rendering a non-<button> removes native button semantics, which can impact forms and accessibility.',
          'Use a real <button> with the `as` prop or the `#render` slot, or set `nativeButton` to `false`.',
        );
      }
    } else if (isButtonTag) {
      error(
        'A component that acts as a button expected a non-<button> because the `nativeButton` prop is false.',
        'Rendering a <button> keeps native behavior while Vase UI applies non-native attributes and handlers, which can add unintended extra attributes (such as `role` or `aria-disabled`).',
        'Use a non-<button> with the `as` prop or the `#render` slot, or set `nativeButton` to `true`.',
      );
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    watch(isNative, checkElement, { flush: 'post' });
  }

  function getButtonProps(externalProps: Record<string, any> = {}): Record<string, any> {
    const disabled = isDisabled();
    const isNativeButton = isNative();
    const isCompositeItem = isComposite();
    const {
      onClick: externalOnClick,
      onMousedown: externalOnMousedown,
      onKeyup: externalOnKeyup,
      onKeydown: externalOnKeydown,
      onPointerdown: externalOnPointerdown,
      ...otherExternalProps
    } = externalProps;

    return mergeProps<'button'>(
      {
        onClick(event: MouseEvent) {
          // An element with `aria-disabled` and no `disabled` attribute still gets this event.
          if (disabled) {
            event.preventDefault();
            return;
          }
          callHandler(externalOnClick, event);
        },
        onMousedown(event: MouseEvent) {
          if (!disabled) {
            callHandler(externalOnMousedown, event);
          }
        },
        onKeydown(event: VaseUIEvent<KeyboardEvent>) {
          if (disabled) {
            return;
          }

          makeEventPreventable(event);
          callHandler(externalOnKeydown, event);
          if (event.vaseUIHandlerPrevented) {
            return;
          }

          const isCurrentTarget = event.target === event.currentTarget;
          const currentTarget = event.currentTarget as Element;
          const isButton = isButtonElement(currentTarget);
          const isLink = !isNativeButton && isValidLinkElement(currentTarget);
          const shouldClick = isCurrentTarget && (isNativeButton ? isButton : !isLink);
          const isEnterKey = event.key === 'Enter';
          const isSpaceKey = event.key === ' ';
          const role = currentTarget.getAttribute('role');
          const isTextNavigationRole =
            role?.startsWith('menuitem') || role === 'option' || role === 'gridcell';

          if (isCurrentTarget && isCompositeItem && isSpaceKey) {
            // In a list with typeahead, a prevented Space is text and not an activation.
            if (event.defaultPrevented && isTextNavigationRole) {
              return;
            }

            // Space scrolls the page.
            event.preventDefault();

            // Only a native-mode item that is not a real <button> gets no click.
            if (!isNativeButton || isButton) {
              event.preventVaseUIHandler();
              dispatchClickWithModifiers(currentTarget, event);
            }

            return;
          }

          if (!shouldClick || isNativeButton || (!isSpaceKey && !isEnterKey)) {
            // Space activates a link on keyup, as it does for `role="button"`. The keydown must
            // still stop the page scroll that Space causes.
            // The browser activates a link on Enter by itself.
            if (isCurrentTarget && isLink && isSpaceKey) {
              event.preventDefault();
            }
            return;
          }

          // A native button does the same: a prevented keydown default cancels the activation.
          if (event.defaultPrevented) {
            return;
          }

          event.preventDefault();

          if (isEnterKey) {
            event.preventVaseUIHandler();
            dispatchClickWithModifiers(currentTarget, event);
          }
        },
        onKeyup(event: VaseUIEvent<KeyboardEvent>) {
          if (disabled) {
            return;
          }

          makeEventPreventable(event);
          callHandler(externalOnKeyup, event);

          // A <button> clicks on the Space keyup. The keydown already dispatched the click, and a
          // prevented keyup stops the second click.
          // https://codesandbox.io/p/sandbox/button-keyup-preventdefault-dn7f0
          if (
            event.target === event.currentTarget &&
            isNativeButton &&
            isCompositeItem &&
            isButtonElement(event.currentTarget as HTMLElement) &&
            event.key === ' '
          ) {
            event.preventDefault();
            return;
          }

          if (event.vaseUIHandlerPrevented) {
            return;
          }

          // A native button does the same: a prevented keyup default cancels the Space activation.
          // A prevented keydown cannot cancel it, because the code keeps no state between the
          // keydown and the keyup. The code cannot tell if the keydown was prevented, or if it
          // happened on this element.
          if (
            event.target === event.currentTarget &&
            !isNativeButton &&
            !isCompositeItem &&
            !event.defaultPrevented &&
            event.key === ' '
          ) {
            event.preventVaseUIHandler();
            dispatchClickWithModifiers(event.currentTarget as Element, event);
          }
        },
        onPointerdown(event: PointerEvent) {
          // An element with `aria-disabled` and no `disabled` attribute still gets this event.
          if (disabled) {
            event.preventDefault();
            return;
          }
          callHandler(externalOnPointerdown, event);
        },
      },
      isNativeButton ? { type: 'button' } : { role: 'button' },
      focusableWhenDisabledProps.value,
      otherExternalProps,
    );
  }

  function buttonRef(element: HTMLElement | null) {
    // Vue calls a function ref again on each patch, with the same element.
    if (element === buttonElement) {
      return;
    }

    buttonElement = element;
    updateDisabled();

    if (process.env.NODE_ENV !== 'production') {
      checkElement();
    }
  }

  return {
    getButtonProps,
    buttonRef,
  };
}

// A handler value can be a function, an array of functions or a falsy value, as in `mergeProps`.
function callHandler(handler: unknown, event: Event) {
  if (typeof handler === 'function') {
    handler(event);
  } else if (Array.isArray(handler)) {
    for (const item of handler) {
      callHandler(item, event);
    }
  }
}

function isButtonElement(elem: Element | null): elem is HTMLButtonElement {
  return isHTMLElement(elem) && elem.tagName === 'BUTTON';
}

function isValidLinkElement(elem: Element | null): elem is HTMLAnchorElement {
  return isHTMLElement(elem) && elem.tagName === 'A' && Boolean((elem as HTMLAnchorElement).href);
}

export interface UseButtonParameters {
  /**
   * Whether the component ignores user interaction.
   * @default false
   */
  disabled?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * Whether the button can get focus when it is disabled.
   * @default false
   */
  focusableWhenDisabled?: MaybeRefOrGetter<boolean | undefined> | undefined;
  tabIndex?: MaybeRefOrGetter<number | undefined> | undefined;
  /**
   * Whether the component renders a native `<button>` element.
   * @default true
   */
  native?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * Whether the button is part of a composite widget.
   * When `true`, the Space key activates the button on keydown and not on keyup.
   * @default inferred from the CompositeRootContext
   */
  composite?: MaybeRefOrGetter<boolean | undefined> | undefined;
}

export interface UseButtonReturnValue {
  /**
   * Makes the props of the button.
   * A part puts it last in the `props` of `useRenderElement`.
   * @param externalProps additional props for the button
   * @returns props that the part binds on the button
   */
  getButtonProps: (externalProps?: Record<string, any>) => Record<string, any>;
  /**
   * A callback that gets the button element, and `null` when the element goes away.
   * A part gives it to `useRenderElement` in `ref`.
   * It is not a part of the props that `getButtonProps` returns.
   */
  buttonRef: (element: HTMLElement | null) => void;
}
