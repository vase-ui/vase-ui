<script lang="ts">
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { DrawerHandle } from '../handle';
import type {
  DrawerOpeningSwipe,
  DrawerSnapPoint,
  DrawerSwipeDirection,
} from './DrawerRootContext';

export interface DrawerRootState {}

export interface DrawerRootProps<Payload = unknown> {
  /**
   * Whether the drawer is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether the drawer is initially open.
   *
   * To render a controlled drawer, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Determines if the drawer enters a modal state when open.
   * - `true`: user interaction is limited to just the drawer: focus is trapped, document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the drawer, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   * @default true
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * Whether to prevent the drawer from closing on outside presses.
   * For non-modal drawers, this also prevents the drawer from closing when focus moves outside of it.
   * @default false
   */
  disablePointerDismissal?: boolean | undefined;
  /**
   * A handle to associate the drawer with a trigger.
   * If specified, allows detached triggers to control the drawer's open state.
   * Can be created with the Drawer.createHandle() method.
   */
  handle?: DrawerHandle<Payload> | undefined;
  /**
   * ID of the trigger that the drawer is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled drawer.
   * There's no need to specify this prop when the drawer is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the drawer is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open drawer.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * The swipe direction used to dismiss the drawer.
   * @default 'down'
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
  /**
   * Snap points used to position the drawer.
   * Use numbers between 0 and 1 to represent fractions of the viewport height,
   * numbers greater than 1 as pixel values, or strings in `px`/`rem` units
   * (for example, `'148px'` or `'30rem'`).
   */
  snapPoints?: DrawerSnapPoint[] | undefined;
  /**
   * Disables velocity-based snap skipping so drag distance determines the next snap point.
   * @default false
   */
  snapToSequentialPoints?: boolean | undefined;
  /**
   * The currently active snap point. Use with `snapPointChange` to control the snap point.
   */
  snapPoint?: DrawerSnapPoint | null | undefined;
  /**
   * The initial snap point value when uncontrolled.
   */
  defaultSnapPoint?: DrawerSnapPoint | null | undefined;
}

export interface DrawerRootActions {
  /**
   * Ends the closing phase of the drawer after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `openChange` first, otherwise the drawer completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   */
  unmount: () => void;
  /**
   * Closes the drawer imperatively when called.
   */
  close: () => void;
}

export type DrawerRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closeWatcher
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.swipe
  | typeof REASONS.none;

export type DrawerRootChangeEventDetails = VaseUIChangeEventDetails<DrawerRootChangeEventReason> & {
  /** Prevents the popup from unmounting until the `unmount` action is called. */
  preventUnmountOnClose: () => void;
};

export type DrawerRootSnapPointChangeEventReason = DrawerRootChangeEventReason;

export type DrawerRootSnapPointChangeEventDetails =
  VaseUIChangeEventDetails<DrawerRootSnapPointChangeEventReason>;
</script>

<script setup lang="ts" generic="Payload = unknown">
import {
  computed,
  onMounted,
  onScopeDispose,
  provide,
  shallowReactive,
  shallowRef,
  watch,
} from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { NOOP } from '../../common/empty';
import { ownerWindow } from '../../common/owner';
import { platform } from '../../common/platform';
import { useControlled } from '../../common/useControlled';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useDialogRoot } from '../../dialog/root/useDialogRoot';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import type { DrawerViewportContext } from './DrawerRootContext';
import { DrawerRootContext, useDrawerRootContext } from './DrawerRootContext';

const props = withDefaults(defineProps<DrawerRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  modal: true,
  disablePointerDismissal: false,
  handle: undefined,
  triggerId: undefined,
  defaultTriggerId: null,
  swipeDirection: 'down',
  snapPoints: undefined,
  snapToSequentialPoints: false,
  snapPoint: undefined,
  defaultSnapPoint: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Drawer.Root');
}

const emit = defineEmits<{
  /**
   * Event handler called when the drawer is opened or closed.
   */
  openChange: [open: boolean, eventDetails: DrawerRootChangeEventDetails];
  /**
   * Event handler called after `openChange` with the new value, unless a listener cancels the
   * change. `v-model:open` uses it.
   */
  'update:open': [open: boolean];
  /**
   * Event handler called after any animations complete when the drawer is opened or closed.
   */
  openChangeComplete: [open: boolean];
  /**
   * Callback fired when the snap point changes.
   */
  snapPointChange: [
    snapPoint: DrawerSnapPoint | null,
    eventDetails: DrawerRootSnapPointChangeEventDetails,
  ];
  /**
   * Event handler called after `snapPointChange` with the new value, unless a listener cancels the
   * change. `v-model:snapPoint` uses it.
   */
  'update:snapPoint': [snapPoint: DrawerSnapPoint | null];
}>();

defineSlots<{
  /**
   * The content of the drawer. The slot gets the `payload` of the active trigger.
   */
  default(props: { payload: Payload | undefined }): unknown;
}>();

const parentDrawerRootContext = useDrawerRootContext(true);

const notifyParentSwipeProgressChange = parentDrawerRootContext?.onNestedSwipeProgressChange;
const notifyParentFrontmostHeight = parentDrawerRootContext?.onNestedFrontmostHeightChange;
const notifyParentSwipingChange = parentDrawerRootContext?.onNestedSwipingChange;
const notifyParentHasNestedDrawer = parentDrawerRootContext?.onNestedDrawerPresenceChange;

const popupHeight = shallowRef(0);
const frontmostHeight = shallowRef(0);
const nestedDrawer = shallowReactive({ present: false, swiping: false, swipeProgress: 0 });

const resolvedDefaultSnapPoint = computed(() =>
  props.defaultSnapPoint !== undefined ? props.defaultSnapPoint : (props.snapPoints?.[0] ?? null),
);

const activeSnapPoint = useControlled<DrawerSnapPoint | null>({
  controlled: () => props.snapPoint,
  default: () => resolvedDefaultSnapPoint.value,
  name: 'Drawer',
  state: 'snapPoint',
});

let isNestedDrawerOpen = false;
const openingSwipe = shallowRef<DrawerOpeningSwipe | null>(null);
const viewportGesture = shallowRef<DrawerViewportContext>();

function setActiveSnapPoint(
  nextSnapPoint: DrawerSnapPoint | null,
  eventDetails?: DrawerRootSnapPointChangeEventDetails,
) {
  const resolvedEventDetails = eventDetails ?? createChangeEventDetails(REASONS.none);

  emit('snapPointChange', nextSnapPoint, resolvedEventDetails);

  if (resolvedEventDetails.isCanceled) {
    return;
  }

  activeSnapPoint.value = nextSnapPoint;
  emit('update:snapPoint', nextSnapPoint);
}

const resolvedActiveSnapPoint = computed(() => {
  const snapPoint = activeSnapPoint.value;
  const snapPoints = props.snapPoints;

  if (props.snapPoint !== undefined) {
    return snapPoint;
  }

  if (!snapPoints || snapPoints.length === 0) {
    return snapPoint;
  }

  if (snapPoint === null || !snapPoints.some((value) => Object.is(value, snapPoint))) {
    return resolvedDefaultSnapPoint.value;
  }

  return snapPoint;
});

function onPopupHeightChange(height: number) {
  popupHeight.value = height;

  if (!isNestedDrawerOpen && height > 0) {
    frontmostHeight.value = height;
  }
}

function onNestedFrontmostHeightChange(height: number) {
  if (height > 0) {
    isNestedDrawerOpen = true;
    frontmostHeight.value = height;
    return;
  }

  isNestedDrawerOpen = false;
  if (popupHeight.value > 0) {
    frontmostHeight.value = popupHeight.value;
  }
}

function onNestedDrawerPresenceChange(present: boolean) {
  nestedDrawer.present = present;
}

function onNestedSwipeProgressChange(progress: number) {
  nestedDrawer.swipeProgress = Number.isFinite(progress) ? progress : 0;
  notifyParentSwipeProgressChange?.(progress);
}

function onNestedSwipingChange(swiping: boolean) {
  nestedDrawer.swiping = swiping;
  notifyParentSwipingChange?.(swiping);
}

type RootEventArguments =
  | [event: 'openChange', open: boolean, eventDetails: DrawerRootChangeEventDetails]
  | [event: 'update:open', open: boolean]
  | [event: 'openChangeComplete', open: boolean];

function emitRootEvent(...[event, nextOpen, eventDetails]: RootEventArguments) {
  if (event === 'update:open') {
    emit('update:open', nextOpen);
    return;
  }

  if (event === 'openChangeComplete') {
    emit('openChangeComplete', nextOpen);
    return;
  }

  emit('openChange', nextOpen, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  if (!nextOpen && props.snapPoints && props.snapPoints.length > 0) {
    setActiveSnapPoint(
      resolvedDefaultSnapPoint.value,
      createChangeEventDetails(
        eventDetails.reason,
        eventDetails.event,
        eventDetails.trigger as HTMLElement | undefined,
      ),
    );
  }
}

const { store, payload, actions } = useDialogRoot<Payload>('drawer', props, emitRootEvent);
// Drawer shares the dialog store but adds swipe and close watcher reasons.
const setOpen = store.setOpen as DrawerRootContext['setOpen'];

provide(DrawerRootContext, {
  dialogContext: store.context,
  setOpen,
  swipeDirection: computed(() => props.swipeDirection),
  openingSwipe,
  viewportGesture,
  setViewportGesture(gesture) {
    viewportGesture.value = gesture;
  },
  setOpeningSwipe(sample) {
    openingSwipe.value = sample;
  },
  snapToSequentialPoints: computed(() => props.snapToSequentialPoints),
  snapPoints: computed(() => props.snapPoints),
  activeSnapPoint: resolvedActiveSnapPoint,
  setActiveSnapPoint,
  frontmostHeight,
  popupHeight,
  nestedDrawer,
  onNestedDrawerPresenceChange,
  onPopupHeightChange,
  onNestedFrontmostHeightChange,
  onNestedSwipingChange,
  onNestedSwipeProgressChange,
  notifyParentFrontmostHeight,
  notifyParentSwipingChange,
  notifyParentSwipeProgressChange,
  notifyParentHasNestedDrawer,
});

const providerContext = useDrawerProviderContext();
const isOpen = computed(() => store.select('open'));

// `KeepAlive` takes a held drawer out of the document, so the provider does not count it.
const { isHeld } = useKeepAliveState();

onMounted(() => {
  if (providerContext) {
    watch([isOpen, isHeld], ([open, held]) => providerContext.setDrawerOpen(store, open && !held), {
      immediate: true,
    });
    onScopeDispose(() => providerContext.removeDrawer(store));
  }

  watch(
    [
      isOpen,
      () => store.select('nestedOpenDialogCount') === 0,
      () => store.select('popupElement'),
      isHeld,
    ],
    ([open, frontmost, popup, held], _previous, onCleanup) => {
      // CloseWatcher enables the Android back gesture (Chromium-only).
      // Keep this Android-only for now to avoid interfering with Escape/nesting semantics on desktop due to `useDismissLayer`.
      if (!open || !frontmost || held || !platform.os.android) {
        return;
      }

      const win = ownerWindow(popup);

      const CloseWatcherCtor = (win as Window & { CloseWatcher?: (new () => any) | undefined })
        .CloseWatcher;
      if (!CloseWatcherCtor) {
        return;
      }

      function handleCancel(event: Event) {
        if (!store.select('open')) {
          return;
        }

        const eventDetails: Parameters<typeof setOpen>[1] = createChangeEventDetails(
          REASONS.closeWatcher,
          event,
        );

        if (!event.cancelable) {
          // The browser lets only one close request per user activation be prevented; any further
          // request closes the drawer regardless, like a native `<dialog>`.
          eventDetails.cancel = NOOP;
        }

        setOpen(false, eventDetails);

        if (eventDetails.isCanceled) {
          // Keeps this watcher active for the next close request.
          event.preventDefault();
        }
      }

      const closeWatcher = new CloseWatcherCtor();
      // The browser destroys the watcher before `close` fires, so the request is handled from
      // `cancel`, where it can still be prevented.
      const unsubscribe = addEventListener(closeWatcher, 'cancel', handleCancel);

      onCleanup(() => {
        unsubscribe();
        closeWatcher.destroy();
      });
    },
    { immediate: true, flush: 'post' },
  );
});

defineExpose({ unmount: actions.unmount, close: actions.close });
</script>

<template>
  <slot :payload="payload" />
</template>
