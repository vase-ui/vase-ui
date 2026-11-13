import { shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { NOOP } from '../../common/empty';
import type { InteractionType } from '../../common/useEnhancedClickHandler';
import { NullStore } from '../../utils/popups/NullStore';
import {
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupStoreContext,
  popupStoreSelectors,
} from '../../utils/popups/store';
import type {
  PopupStoreContext,
  PopupStoreState,
  PopupTriggerStoreKeys,
} from '../../utils/popups/store';
import type { DialogRootChangeEventDetails } from '../root/DialogRoot.vue';

export type State<Payload> = PopupStoreState<Payload> & {
  modal: boolean | 'trap-focus';
  disablePointerDismissal: boolean;
  openMethod: InteractionType | null;
  nested: boolean;
  nestedOpenDialogCount: number;
  nestedOpenDrawerCount: number;
  titleElementId: string | undefined;
  descriptionElementId: string | undefined;
  viewportElement: HTMLElement | null;
  role: 'dialog' | 'alertdialog';
};

type Context = PopupStoreContext<DialogRootChangeEventDetails> & {
  readonly backdropRef: ShallowRef<HTMLDivElement | null>;
  readonly internalBackdropRef: ShallowRef<HTMLDivElement | null>;
  readonly outsidePressEnabledRef: ShallowRef<boolean>;
  onNestedDialogOpen?: ((dialogCount: number, drawerCount: number) => void) | undefined;
};

const selectors = {
  ...popupStoreSelectors,
  modal: (state: State<unknown>) => state.modal,
  nested: (state: State<unknown>) => state.nested,
  nestedOpenDialogCount: (state: State<unknown>) => state.nestedOpenDialogCount,
  nestedOpenDrawerCount: (state: State<unknown>) => state.nestedOpenDrawerCount,
  disablePointerDismissal: (state: State<unknown>) => state.disablePointerDismissal,
  openMethod: (state: State<unknown>) => state.openMethod,
  descriptionElementId: (state: State<unknown>) => state.descriptionElementId,
  titleElementId: (state: State<unknown>) => state.titleElementId,
  viewportElement: (state: State<unknown>) => state.viewportElement,
  role: (state: State<unknown>) => state.role,
  // Dialogs aren't anchored, so their popup acts as their positioner.
  // The parameter has the type of the selector that this one replaces. A function that takes the
  // store of any popup then accepts this store.
  positionerElement: (state: PopupStoreState<unknown>) => state.popupElement,
};

/**
 * The subset of `DialogStore` that detached handle-backed triggers rely on. Both the real
 * `DialogStore` and the inert fallback store satisfy it, so a trigger can read from whichever
 * store the handle currently exposes.
 */
export type DialogHandleStore<Payload> = Pick<
  DialogStore<Payload>,
  PopupTriggerStoreKeys | 'setOpen'
>;

export class DialogStore<Payload> extends BasePopupStore<
  State<Payload>,
  Context,
  typeof selectors,
  DialogRootChangeEventDetails
> {
  constructor(
    initialState: Partial<State<Payload>> | undefined,
    defaultPopupId: string | undefined,
  ) {
    super(
      createInitialState<Payload>(initialState, defaultPopupId),
      createInitialContext(),
      selectors,
    );
  }
}

/**
 * Creates the inert fallback store used by detached handle-backed triggers while no
 * `Dialog.Root` is attached. It preserves a dialog-specific trigger registry in context so
 * detached triggers can register before migrating to the live root store.
 */
export function createNullDialogStore<Payload>(): DialogHandleStore<Payload> {
  const store = new NullStore<Readonly<State<Payload>>, Context, typeof selectors>(
    Object.freeze(createInitialState<Payload>(undefined)),
    Object.freeze(createInitialContext()),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP });
}

function createInitialState<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  defaultPopupId?: string | undefined,
): State<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(defaultPopupId),
    modal: true,
    disablePointerDismissal: false,
    viewportElement: null,
    descriptionElementId: undefined,
    titleElementId: undefined,
    openMethod: null,
    nested: false,
    nestedOpenDialogCount: 0,
    nestedOpenDrawerCount: 0,
    role: 'dialog',
    ...initialState,
  };
}

function createInitialContext(): Context {
  return {
    ...createPopupStoreContext(),
    backdropRef: shallowRef<HTMLDivElement | null>(null),
    internalBackdropRef: shallowRef<HTMLDivElement | null>(null),
    outsidePressEnabledRef: shallowRef(true),
  };
}
