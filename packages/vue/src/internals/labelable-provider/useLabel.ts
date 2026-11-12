import { isHTMLElement, isShadowRoot } from '@floating-ui/utils/dom';
import { computed, onScopeDispose, toValue, watch } from 'vue';
import type { ComputedRef, LabelHTMLAttributes, MaybeRefOrGetter } from 'vue';
import { ownerDocument } from '../../common/owner';
import { closest, getTarget } from '../../common/shadowDom';
import { useVaseUiId } from '../useBaseUiId';
import { useLabelableContext } from './LabelableContext';

/**
 * A label calls it in `setup`. The part reads `.value` in the function that it gives to
 * `useRenderElement` as `props`: `props: (attrs) => [labelProps.value, attrs]`.
 */
export function useLabel(params: UseLabelParameters = {}): ComputedRef<UseLabelReturnValue> {
  const {
    controlId: contextControlId,
    labelId: contextLabelId,
    registerLabelId,
    defaultLabelId,
  } = useLabelableContext();

  // The id of a label that has no provider.
  const ownId = useVaseUiId();

  const id = computed(() => toValue(params.id) ?? defaultLabelId.value ?? ownId.value);

  // A direct call in `setup` puts the id in the server HTML of each part that renders after this
  // label.
  const source = Symbol();
  function register(nextId: string | undefined) {
    registerLabelId(source, nextId);
    params.setLabelId?.(nextId ?? contextLabelId.value);
  }

  register(id.value);
  watch(id, register);
  onScopeDispose(() => register(undefined));

  const resolveControlId = () => contextControlId.value ?? toValue(params.fallbackControlId);

  function focusControl(event: MouseEvent) {
    const resolvedControlId = resolveControlId();

    if (params.focusControl) {
      params.focusControl(event, resolvedControlId);
      return;
    }

    if (!resolvedControlId) {
      return;
    }

    const controlElement = getControlById(event.currentTarget as Element, resolvedControlId);
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
   * The default is the id that the provider made for the label. With no provider, it is a
   * generated id.
   */
  id?: MaybeRefOrGetter<string | undefined> | undefined;
  /**
   * The id of the control when the provider has none.
   */
  fallbackControlId?: MaybeRefOrGetter<string | undefined> | undefined;
  /**
   * Whether the rendered element is a native `<label>`.
   * @default false
   */
  native?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * Gives the id of the label to the state of the part.
   * When the label goes away, the part gets the id of the label that is left in the provider.
   * It gets `undefined` when no label is left.
   */
  setLabelId?: ((labelId: string | undefined) => void) | undefined;
  /**
   * A focus handler for a label that is not native.
   * If it is omitted, the click focuses the control that has the resolved id.
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
