import { isHTMLElement } from '@floating-ui/utils/dom';
import { computed, toValue, watch, watchPostEffect } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { error } from '../../common/error';
import { makeEventPreventable } from '../../merge-props';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { useCompositeRootContext } from '../composite/root/useCompositeRoot';
import type { VaseUIEvent } from '../types';

/** Gives an element button semantics and keyboard activation. */
export function useButton(
  element: MaybeRefOrGetter<Element | null>,
  parameters: UseButtonParameters = {},
) {
  const root = useCompositeRootContext(true);
  const isDisabled = () => toValue(parameters.disabled) ?? false;
  const isNative = () => toValue(parameters.native) ?? true;
  const isComposite = () => toValue(parameters.composite) ?? root !== undefined;
  const focus = useFocusableWhenDisabled({
    focusableWhenDisabled: parameters.focusableWhenDisabled,
    disabled: isDisabled,
    composite: isComposite,
    tabIndex: parameters.tabIndex,
    isNativeButton: isNative,
  });
  const attributes = computed(() => ({
    ...(isNative() ? { type: 'button' as const } : { role: 'button' }),
    ...focus.attributes.value,
  }));

  function restoreFocusability(node: Element | null) {
    // A custom button can forward disabled to a native button that must keep its tab stop.
    if (
      isButtonElement(node) &&
      isComposite() &&
      isDisabled() &&
      focus.attributes.value.disabled === undefined &&
      node.disabled
    ) {
      node.disabled = false;
    }
  }
  watch(
    [() => toValue(element), isDisabled, isComposite, () => focus.attributes.value.disabled],
    ([node]) => restoreFocusability(node),
    { flush: 'post' },
  );

  if (process.env.NODE_ENV !== 'production') {
    watchPostEffect(() => {
      const node = toValue(element);
      if (!node) return;
      const isButtonTag = isButtonElement(node);

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
    });
  }

  function press(event: VaseUIEvent<MouseEvent>, listener?: (event: MouseEvent) => void) {
    makeEventPreventable(event);
    if (isDisabled()) {
      event.preventDefault();
    } else {
      listener?.(event);
    }
  }

  function mouseDown(event: VaseUIEvent<MouseEvent>, listener?: (event: MouseEvent) => void) {
    makeEventPreventable(event);
    if (!isDisabled()) listener?.(event);
  }

  function keyDown(event: VaseUIEvent<KeyboardEvent>, listener?: (event: KeyboardEvent) => void) {
    makeEventPreventable(event);
    focus.onKeydown(event);
    if (isDisabled()) return;
    listener?.(event);
    if (event.vaseUIHandlerPrevented || event.target !== event.currentTarget) return;

    const target = event.currentTarget as Element;
    const space = event.key === ' ';
    if (!space && event.key !== 'Enter') return;

    const native = isNative();
    if (space && isComposite()) {
      const role = target.getAttribute('role');
      // Typeahead can use Space as text.
      if (
        event.defaultPrevented &&
        (role?.startsWith('menuitem') || role === 'option' || role === 'gridcell')
      )
        return;
      event.preventDefault();
      if (!native || isButtonElement(target)) activate(target, event);
      return;
    }

    if (native) return;
    if (isValidLinkElement(target)) {
      // The browser follows a link on Enter. Space must not scroll.
      if (space) event.preventDefault();
      return;
    }
    if (event.defaultPrevented) return;

    event.preventDefault();
    if (!space) activate(target, event);
  }

  function keyUp(event: VaseUIEvent<KeyboardEvent>, listener?: (event: KeyboardEvent) => void) {
    makeEventPreventable(event);
    if (isDisabled()) return;
    listener?.(event);
    if (event.key !== ' ' || event.target !== event.currentTarget) return;

    const target = event.currentTarget as Element;
    if (isComposite()) {
      // Space already activated the native button on keydown.
      if (isNative() && isButtonElement(target)) event.preventDefault();
    } else if (!isNative() && !event.vaseUIHandlerPrevented && !event.defaultPrevented) {
      activate(target, event);
    }
  }

  return { attributes, press, mouseDown, keyDown, keyUp };
}

function activate(target: Element, event: VaseUIEvent<KeyboardEvent>) {
  event.preventVaseUIHandler();
  dispatchClickWithModifiers(target, event);
}

export type ButtonBehavior = ReturnType<typeof useButton>;

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

export function useFocusableWhenDisabled(parameters: UseFocusableWhenDisabledParameters) {
  function onKeydown(event: KeyboardEvent) {
    // Tab must still move focus away from a disabled button.
    if (
      event.key !== 'Tab' &&
      toValue(parameters.disabled) &&
      toValue(parameters.focusableWhenDisabled)
    ) {
      event.preventDefault();
    }
  }

  const attributes = computed(() => {
    const focusableWhenDisabled = toValue(parameters.focusableWhenDisabled);
    const disabled = toValue(parameters.disabled);
    const composite = toValue(parameters.composite) ?? false;
    const tabIndexProp = toValue(parameters.tabIndex) ?? 0;
    const isNativeButton = toValue(parameters.isNativeButton);

    const isFocusableComposite = composite && focusableWhenDisabled !== false;
    const isNonFocusableComposite = composite && focusableWhenDisabled === false;

    // The code adds a key only when it has a value. A key with the value `undefined` replaces
    // the value of an earlier set in `mergeProps`.
    const additionalProps: FocusableWhenDisabledProps = {};

    if (!composite) {
      additionalProps.tabindex = tabIndexProp;

      // A `<span>` has no `disabled` attribute that takes it out of the tab order.
      if (!isNativeButton && disabled) {
        additionalProps.tabindex = focusableWhenDisabled ? tabIndexProp : -1;
      }
    }

    if (
      (isNativeButton && (focusableWhenDisabled || isFocusableComposite)) ||
      (!isNativeButton && disabled)
    ) {
      additionalProps['aria-disabled'] = disabled;
    }

    if (isNativeButton && (!focusableWhenDisabled || isNonFocusableComposite)) {
      additionalProps.disabled = disabled;
    }

    return additionalProps;
  });

  return { attributes, onKeydown };
}

interface FocusableWhenDisabledProps {
  'aria-disabled'?: boolean | undefined;
  disabled?: boolean | undefined;
  tabindex?: number | undefined;
}

export interface UseFocusableWhenDisabledParameters {
  /**
   * Whether the component is focusable when it is disabled.
   * When `undefined`, composite items are focusable when disabled by default.
   */
  focusableWhenDisabled?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * The disabled state of the component.
   */
  disabled: MaybeRefOrGetter<boolean>;
  /**
   * Whether this is a composite item.
   * @default false
   */
  composite?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * @default 0
   */
  tabIndex?: MaybeRefOrGetter<number | undefined> | undefined;
  /**
   * Whether the component renders a native `<button>` element.
   */
  isNativeButton: MaybeRefOrGetter<boolean>;
}
