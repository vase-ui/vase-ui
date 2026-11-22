import {
  computed,
  inject,
  provide,
  shallowRef,
  useAttrs,
  useId,
  type Component,
  type InjectionKey,
  type ShallowRef,
} from 'vue';
import { useAsTag, useElement } from '../common/element';
import { givenId } from '../common/id';
import { warn } from '../common/warn';
import { usePopupFocus, type FocusTarget } from '../popup/focus';
import { layersAbove, useLayer, type Layer } from '../popup/layer';
import { PopupHandle, rootToOpen, usePopupRoot, type PopupRoot } from '../popup/root';
import { useHandleRoot, usePopupTrigger } from '../popup/trigger';
import type { DialogRootChangeEventDetails, DialogRootProps, DialogTriggerState } from './types';

/** Opens and closes a dialog from code, and connects triggers outside the root to it. */
export class DialogHandle<Payload = unknown> extends PopupHandle<Payload> {
  /**
   * Opens the popup for the trigger with this `id`. With `null`, or with an `id` that no trigger of
   * the root has, the popup opens with no trigger. A development build warns for such an `id`, and
   * for a call with no mounted root.
   */
  override open(triggerId: string | null) {
    const root = rootToOpen<Payload>(this, 'open');
    if (!root) return;
    const trigger = root.triggers.find((each) => each.id === triggerId);
    if (triggerId !== null && !trigger) {
      warn(
        `\`open()\` found no trigger with the id "${triggerId}". The popup opens with no trigger.`,
      );
    }
    root.request(true, 'imperative-action', new Event('vase-ui'), trigger?.element ?? null);
  }

  /**
   * Opens the popup with no trigger. The default slot of the root gets the payload until a trigger
   * opens the popup. A development build warns for a call with no mounted root.
   */
  openWithPayload(payload: Payload) {
    rootToOpen<Payload>(this, 'openWithPayload')?.openWithPayload(payload, new Event('vase-ui'));
  }
}

/** Makes a handle. `new Dialog.Handle()` makes the same object. */
export function createHandle<Payload = unknown>() {
  return new DialogHandle<Payload>();
}

/** Opens and closes an alert dialog from code, and connects triggers outside the root to it. */
export class AlertDialogHandle<Payload = unknown> extends DialogHandle<Payload> {
  // A handle of Dialog is no handle of Alert Dialog.
  declare private readonly alertDialog: never;
}

/** What a dialog root gives to its parts. The properties are reactive. */
export interface DialogForParts<Payload = unknown> {
  readonly root: PopupRoot<Payload>;
  readonly layer: Layer;
  readonly role: 'dialog' | 'alertdialog';
  readonly modal: boolean | 'trap-focus';
  /** A dialog root is above this root in the component tree. */
  readonly nested: boolean;
  /** The dialogs that are above this dialog in the stack. */
  readonly dialogsAbove: number;
  readonly focus: ReturnType<typeof usePopupFocus>;
  /** The focus props of the popup. */
  popupFocus: ShallowRef<{ initialFocus?: FocusTarget; finalFocus?: FocusTarget }>;
  /** Adds a backdrop that renders its element. */
  addBackdrop(): () => void;
}

export const dialogKey: InjectionKey<DialogForParts> = Symbol('dialog');
const portalKey: InjectionKey<PopupRoot> = Symbol('dialog portal');
const contexts = new WeakMap<PopupRoot, DialogForParts>();

/** The props of `Dialog.Root` and `AlertDialog.Root`, with their defaults. */
type RootProps<Payload> = Required<
  Pick<DialogRootProps<Payload>, 'defaultOpen' | 'defaultTriggerId'>
> &
  DialogRootProps<Payload>;

/**
 * Does what `Dialog.Root` and `AlertDialog.Root` do. An alert dialog is modal, and an outside press
 * does not close it.
 */
export function useDialogRoot<Payload>(
  kind: 'dialog' | 'alertdialog',
  props: RootProps<Payload>,
  emit: {
    (event: 'openChange', open: boolean, details: DialogRootChangeEventDetails): void;
    (event: 'update:open', open: boolean): void;
    (event: 'update:triggerId', id: string | null): void;
  },
) {
  const root = usePopupRoot<Payload>({
    name: kind === 'dialog' ? 'Dialog' : 'AlertDialog',
    open: () => props.open,
    defaultOpen: props.defaultOpen,
    triggerId: () => props.triggerId,
    defaultTriggerId: props.defaultTriggerId,
    handle: () => props.handle,
    emitChange: (open, details) =>
      emit('openChange', open, details as DialogRootChangeEventDetails),
    emitOpen: (open) => emit('update:open', open),
    emitTriggerId: (id) => emit('update:triggerId', id),
  });

  const nested = inject(dialogKey, null) !== null;
  // `AlertDialog.Root` has no `modal` prop.
  const modal = computed(() => props.modal ?? true);
  const backdrops = shallowRef(0);
  // The stack has each open layer. A dialog counts the layers of dialog roots above its own.
  const dialogsAbove = computed(
    () => layersAbove(layer).filter((above) => contexts.has(above.root)).length,
  );
  const layer = useLayer(root, () => ({
    escape: true,
    // One press closes one dialog: a dialog with a dialog above it waits for its own press.
    outsidePress: kind === 'dialog' && !props.disablePointerDismissal && dialogsAbove.value === 0,
    focusOut: modal.value === false && !props.disablePointerDismissal,
    trap: modal.value !== false,
    hide: modal.value === true ? 'inert' : modal.value === 'trap-focus' ? 'aria-hidden' : false,
    block: modal.value === true,
    lockScroll: modal.value === true,
    // With a backdrop, the page gets no pointer, and a release in the popup cancels a press.
    pressStart: modal.value === 'trap-focus' && backdrops.value === 0,
    triggerInUse: false,
  }));

  const popupFocus = shallowRef<{ initialFocus?: FocusTarget; finalFocus?: FocusTarget }>({});
  const focus = usePopupFocus(root, layer, {
    takesFocus: () => true,
    placed: () => true,
    initialFocus: () => popupFocus.value.initialFocus,
    finalFocus: () => popupFocus.value.finalFocus,
    lostFocus: () => root.popup,
  });

  const context: DialogForParts<Payload> = {
    root,
    layer,
    role: kind,
    get modal() {
      return modal.value;
    },
    nested,
    get dialogsAbove() {
      return dialogsAbove.value;
    },
    focus,
    popupFocus,
    addBackdrop() {
      backdrops.value += 1;
      return () => (backdrops.value -= 1);
    },
  };
  contexts.set(root, context);
  provide(dialogKey, context);

  return {
    root,
    context,
    /** Asks for a close with the reason `'imperative-action'`. */
    close() {
      root.request(false, 'imperative-action', new Event('vase-ui'));
    },
  };
}

/** The dialog of the part. A part with no root throws an error that names it. */
export function injectDialog(part: string) {
  const context = inject(dialogKey, null);
  if (!context) {
    throw new Error(
      `Vase UI: <Dialog.${part}> must be inside <Dialog.Root>, <AlertDialog.Root> or <Drawer.Root>. Without a root the part has no dialog. Put the part inside one of these roots.`,
    );
  }
  return context;
}

/**
 * Does what `Dialog.Trigger`, `AlertDialog.Trigger` and `Drawer.Trigger` do. The dialog of a
 * trigger is the root of its `handle`, else the root around it. A trigger with a `handle` and no
 * mounted root is closed.
 */
export function useDialogTrigger(
  family: 'Dialog' | 'AlertDialog' | 'Drawer',
  props: {
    readonly id?: string | undefined;
    readonly disabled?: boolean | undefined;
    readonly payload?: unknown;
    readonly handle?: DialogHandle | undefined;
    readonly as?: keyof HTMLElementTagNameMap | Component | undefined;
  },
) {
  const injected = inject(dialogKey, null);
  if (!injected && !props.handle) {
    throw new Error(
      `Vase UI: <${family}.Trigger> must be inside <${family}.Root>, or it must have a \`handle\`. Without a root the trigger has no dialog to open. Put the trigger inside <${family}.Root>, or pass a \`handle\`.`,
    );
  }
  const handleRoot = useHandleRoot(() => props.handle);
  const context = computed(() => {
    if (!props.handle) return injected;
    const root = handleRoot.value;
    return root ? (contexts.get(root) ?? null) : null;
  });
  const attrs = useAttrs();
  const generatedId = useId();
  const { element, setElement } = useElement<HTMLElement>();
  const elementId = computed(() => givenId(props.id) ?? generatedId);

  const trigger = usePopupTrigger(() => context.value?.root ?? null, {
    element,
    id: () => elementId.value,
    payload: () => props.payload,
    disabled: () => props.disabled ?? false,
    tag: useAsTag(() => props.as),
  });

  const state = computed<DialogTriggerState>(() => ({
    open: trigger.open.value,
    disabled: trigger.button.disabled.value,
  }));

  function elementProps() {
    const popup = context.value?.root.popup;
    return trigger.button.mergeAttributes(
      {
        id: elementId.value,
        'aria-haspopup': 'dialog',
        'aria-expanded': trigger.open.value ? 'true' : 'false',
        'aria-controls': trigger.open.value && popup ? popup.id : undefined,
        onClick: trigger.onClick,
        onKeydown: (event: KeyboardEvent) => {
          if (trigger.open.value) context.value?.focus.onTriggerKeydown(event);
        },
      },
      attrs,
    );
  }

  return { element, setElement, state, elementProps };
}

/** Marks the parts in the portal of the dialog. */
export function provideDialogPortal(context: DialogForParts) {
  provide(portalKey, context.root);
}

/** A backdrop, a viewport and a popup need the portal of their root. */
export function injectDialogPortal(
  part: string,
  context: DialogForParts,
  family: 'Dialog' | 'Drawer' = 'Dialog',
) {
  if (inject(portalKey, null) !== context.root) {
    throw new Error(
      `Vase UI: <${family}.${part}> must be inside <${family}.Portal>. Without the portal the part is not above the page. Put the part inside <${family}.Portal>.`,
    );
  }
}
