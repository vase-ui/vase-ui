import { isHTMLElement, isShadowRoot } from '@floating-ui/utils/dom';
import { computed, toValue } from 'vue';
import type { ComputedRef, LabelHTMLAttributes, MaybeRefOrGetter } from 'vue';
import { ownerDocument } from '../../common/owner';
import { closest, getTarget } from '../../common/shadowDom';
import { given } from '../givenAttributes';
import { useVaseUiId } from '../useVaseUiId';
import type { RegisterId } from './createIdRegistry';
import { useRegisteredId } from './useRegisteredId';

/**
 * A label calls it in `setup`. The part reads `.value` in the function that it gives to
 * `useRenderElement` as `props`: `props: (attrs) => [labelProps.value, attrs]`.
 */
export function useLabel(params: UseLabelParameters): ComputedRef<UseLabelReturnValue> {
  const ownId = useVaseUiId();

  const id = computed(() => given('id', toValue(params.id)) ?? ownId.value);

  useRegisteredId(
    () => id.value,
    (source, getId) => params.registerLabelId?.(source, getId),
    params.element,
  );

  const resolveControlId = () => toValue(params.fallbackControlId);

  function focusControl(event: MouseEvent) {
    const resolvedControlId = resolveControlId();

    if (params.focusControl) {
      params.focusControl(event, resolvedControlId);
      return;
    }

    const controlElement =
      toValue(params.controlElement) ??
      (resolvedControlId
        ? getControlById(event.currentTarget as Element, resolvedControlId)
        : null);
    if (isHTMLElement(controlElement)) {
      focusElementWithVisible(controlElement);
    }
  }

  function handleInteraction(event: MouseEvent) {
    const target = getTarget(event) as HTMLElement | null;
    if (closest(target, 'button,input,select,textarea')) {
      return;
    }

    // Prevent text selection when double clicking label.
    if (!event.defaultPrevented && event.detail > 1) {
      event.preventDefault();
    }

    if (toValue(params.native)) {
      return;
    }

    focusControl(event);
  }

  function preventDefault(event: Event) {
    event.preventDefault();
  }

  return computed(() =>
    toValue(params.native)
      ? {
          id: id.value,
          for: resolveControlId(),
          onMousedown: handleInteraction,
        }
      : {
          id: id.value,
          onClick: handleInteraction,
          onPointerdown: preventDefault,
        },
  );
}

export interface UseLabelParameters {
  /**
   * The `id` of the label.
   * The default is a generated id.
   */
  id?: MaybeRefOrGetter<string | undefined> | undefined;
  /**
   * The element of the label. From the mount on, each part that names the label names the `id` of
   * this element. A `#render` slot can give it another `id` than the label gives.
   */
  element: MaybeRefOrGetter<Element | null | undefined>;
  /**
   * The id of the control.
   */
  fallbackControlId?: MaybeRefOrGetter<string | undefined> | undefined;
  /**
   * The control element, for a part that holds it. A click on a label that is not native focuses
   * this element, and the id of the element does not matter. With no element, the click focuses
   * the element that has the id of the control.
   */
  controlElement?: MaybeRefOrGetter<HTMLElement | null | undefined> | undefined;
  /**
   * Whether the rendered element is a native `<label>`.
   * @default false
   */
  native?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * Registers the label with the root that owns it, as the labelable context does.
   * A root that has labels of its own makes the function with `createLabelIdRegistry()`.
   * The function gets a getter for the id of the label, and `undefined` when the label goes away.
   * The getter returns `undefined` while `KeepAlive` holds the label.
   */
  registerLabelId?: RegisterId | undefined;
  /**
   * A focus handler for a label that is not native.
   * If it is omitted, the click focuses `controlElement`. With no `controlElement`, it focuses the
   * control that has the resolved id.
   */
  focusControl?: ((event: MouseEvent, controlId: string | undefined) => void) | undefined;
}

export type UseLabelReturnValue = LabelHTMLAttributes;

export function getControlById(label: Element, id: string) {
  let root = label.getRootNode();
  while (isShadowRoot(root)) {
    const element = root.getElementById(id);
    if (element) {
      return element;
    }
    root = root.host.getRootNode();
  }
  return ownerDocument(label).getElementById(id);
}

export function focusElementWithVisible(element: HTMLElement) {
  element.focus({
    // Available from Chrome 144+ (January 2026).
    // Safari and Firefox already support it.
    focusVisible: true,
  });
}
