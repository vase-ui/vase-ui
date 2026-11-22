import {
  computed,
  inject,
  onMounted,
  onScopeDispose,
  provide,
  shallowReactive,
  shallowRef,
  watch,
  type InjectionKey,
} from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { createError } from '../common/createError';
import { useModel } from '../common/model';
import { ownerWindow } from '../common/owner';
import { platform } from '../common/platform';
import { DialogHandle, useDialogRoot, type DialogForParts } from '../dialog/root';
import {
  findSnapPoint,
  resolveSnapPoints,
  snapProgress,
  type ResolvedSnapPoint,
  type SnapSizes,
} from './snap';
import type {
  DrawerRootChangeEventDetails,
  DrawerRootProps,
  DrawerRootSnapPointChangeEventDetails,
  DrawerRootSnapPointChangeEventReason,
  DrawerSnapPoint,
  DrawerSwipeDirection,
} from './types';

/** Opens and closes a drawer from code, and connects triggers outside the root to it. */
export class DrawerHandle<Payload = unknown> extends DialogHandle<Payload> {
  // A handle of Dialog is no handle of Drawer.
  declare private readonly drawer: never;
}

/** Makes a handle. `new Drawer.Handle()` makes the same object. */
export function createHandle<Payload = unknown>() {
  return new DrawerHandle<Payload>();
}

/** The place and the progress of a swipe, as the parts render them. */
export interface DrawerSample {
  /** The movement of the popup, in pixels. */
  x: number;
  y: number;
  /** 0 at the open place, 1 at the closed place. */
  progress: number;
}

/** What a `Drawer.Root` gives to its parts and to each `Drawer.Root` in it. The properties are reactive. */
export interface DrawerRoot {
  readonly dialog: DialogForParts;
  readonly swipeDirection: DrawerSwipeDirection;
  readonly snapToSequentialPoints: boolean;
  readonly parent: DrawerRoot | null;
  /** The open drawers in it, at each depth. */
  readonly nestedOpen: number;
  /** A drawer in it is open or leaves. */
  readonly nestedPresent: boolean;
  /** A swipe moves a drawer in it by 10 px or more. */
  readonly nestedSwiping: boolean;
  /** The progress of the swipe of a drawer in it. */
  readonly nestedProgress: number;
  /** The height of its popup element. */
  readonly height: number;
  /** The height of the frontmost open drawer. */
  readonly frontmostHeight: number;
  /** A swipe moves its popup. */
  readonly swiping: boolean;
  /** The swipe moved the popup by 10 px or more. */
  readonly swipingFar: boolean;
  readonly sample: DrawerSample;
  /** The progress that the parts render: of the swipe, else of the rest place. */
  readonly progress: number;
  readonly snap: {
    readonly points: readonly ResolvedSnapPoint[];
    readonly active: DrawerSnapPoint | null;
    /** The distance from the open place to the active point, with no point `null`. */
    readonly offset: number | null;
    /** Asks for a change of the snap point. Gives `false` when a listener cancelled it. */
    set(
      point: DrawerSnapPoint | null,
      reason: DrawerRootSnapPointChangeEventReason,
      event: Event,
    ): boolean;
  };
  readonly viewport: HTMLElement | null;
  readonly backdrop: HTMLElement | null;
  setViewport(element: HTMLElement | null): void;
  setBackdrop(element: HTMLElement | null): void;
  setSizes(sizes: Partial<SnapSizes>): void;
  setSwiping(swiping: boolean, far?: boolean): void;
  addNested(child: DrawerRoot): () => void;
  /** `Drawer.Content` marks a press in it: a mouse there selects text. */
  markContentPress(event: PointerEvent): void;
  isContentPress(event: PointerEvent): boolean;
  write(sample: Partial<DrawerSample>): void;
  /** Removes the marks of a swipe close from the popup and the backdrop. */
  clearDismiss(): void;
}

/** What `Drawer.Provider` gives to its roots and to the indent parts. */
export interface DrawerProvider {
  readonly active: boolean;
  readonly progress: number;
  readonly height: number;
  add(open: () => boolean): () => void;
  write(progress: number, height: number): void;
}

const drawerKey: InjectionKey<DrawerRoot> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'drawer' : undefined,
);
/** Marks the parts in a `Drawer.Viewport`. */
export const viewportKey: InjectionKey<true> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'drawer viewport' : undefined,
);
export const providerKey: InjectionKey<DrawerProvider> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'drawer provider' : undefined,
);

export function createProvider(): DrawerProvider {
  const roots = shallowReactive(new Set<() => boolean>());
  const visual = shallowReactive({ progress: 0, height: 0 });
  return {
    get active() {
      return [...roots].some((open) => open());
    },
    get progress() {
      return visual.progress;
    },
    get height() {
      return visual.height;
    },
    add(open) {
      roots.add(open);
      return () => roots.delete(open);
    },
    write(progress, height) {
      visual.progress = progress;
      visual.height = height;
    },
  };
}

type RootProps<Payload> = Required<
  Pick<
    DrawerRootProps<Payload>,
    'defaultOpen' | 'defaultTriggerId' | 'swipeDirection' | 'snapToSequentialPoints'
  >
> &
  DrawerRootProps<Payload>;

export function useDrawerRoot<Payload>(
  props: RootProps<Payload>,
  emit: {
    (event: 'openChange', open: boolean, details: DrawerRootChangeEventDetails): void;
    (event: 'update:open', open: boolean): void;
    (event: 'update:triggerId', id: string | null): void;
    (
      event: 'snapPointChange',
      point: DrawerSnapPoint | null,
      details: DrawerRootSnapPointChangeEventDetails,
    ): void;
    (event: 'update:snapPoint', point: DrawerSnapPoint | null): void;
  },
) {
  const parent = inject(drawerKey, null);
  let lastClose: DrawerRootChangeEventDetails | undefined;

  const dialogRoot = useDialogRoot<Payload>('dialog', props, ((
    event: 'openChange' | 'update:open' | 'update:triggerId',
    value: boolean & string,
    details?: DrawerRootChangeEventDetails,
  ) => {
    if (event === 'openChange' && details) {
      // A back gesture that the browser does not let a page cancel closes the drawer.
      if (details.reason === 'close-watcher' && !details.event.cancelable) {
        details.cancel = () => {};
      }
      if (!value) lastClose = details;
      emit('openChange', value, details);
      return;
    }
    if (event === 'update:open') {
      emit('update:open', value);
      if (!value && lastClose && props.snapPoints?.length) {
        setSnap(defaultPoint(), lastClose.reason, lastClose.event, lastClose.trigger);
      }
      return;
    }
    emit('update:triggerId', value);
  }) as Parameters<typeof useDialogRoot>[2]);
  const { root, context: dialog } = dialogRoot;

  const defaultPoint = () =>
    props.defaultSnapPoint === undefined ? (props.snapPoints?.[0] ?? null) : props.defaultSnapPoint;
  const snapModel = useModel(
    () => props.snapPoint,
    props.snapPoint === undefined ? defaultPoint() : props.snapPoint,
  );
  // An uncontrolled root shows its default for a value that the list does not have. A value of the
  // parent stays as it is.
  const active = computed(() => {
    const value = snapModel.value.value;
    const points = props.snapPoints;
    if (props.snapPoint !== undefined || !points?.length) return value;
    return value !== null && points.some((point) => Object.is(point, value))
      ? value
      : defaultPoint();
  });

  function setSnap(
    point: DrawerSnapPoint | null,
    reason: DrawerRootSnapPointChangeEventReason,
    event: Event,
    trigger?: Element,
  ) {
    if (!props.snapPoints?.length) return true;
    const details = Object.assign(createChangeEventDetails(reason, event), { trigger });
    emit('snapPointChange', point, details);
    if (details.isCanceled) return false;
    snapModel.setOwn(point);
    emit('update:snapPoint', point);
    return true;
  }

  const sizes = shallowReactive({ popup: 0, viewport: 0, rootFontSize: 16 });
  const vertical = computed(() => props.swipeDirection === 'down' || props.swipeDirection === 'up');
  const points = computed(() => (vertical.value ? resolveSnapPoints(props.snapPoints, sizes) : []));
  const activePoint = computed(() => findSnapPoint(points.value, active.value, sizes));
  const offset = computed(() => (points.value.length ? (activePoint.value?.offset ?? null) : null));

  const viewport = shallowRef<HTMLElement | null>(null);
  const backdrop = shallowRef<HTMLElement | null>(null);
  const swiping = shallowRef(false);
  const swipingFar = shallowRef(false);
  const sample = shallowReactive<DrawerSample>({ x: 0, y: 0, progress: 0 });
  const children = shallowReactive<DrawerRoot[]>([]);
  const contentPresses = new WeakSet<Event>();

  const nestedOpen = computed(() =>
    children.reduce(
      (count, child) => count + (child.dialog.root.open ? 1 : 0) + child.nestedOpen,
      0,
    ),
  );
  const nestedPresent = computed(() =>
    children.some((child) => child.dialog.root.open || child.dialog.root.leaving),
  );
  // While a drawer in it is present, the drawer keeps its height: the CSS of a nest can stretch it.
  const kept = shallowRef(0);
  watch(
    [nestedPresent, () => sizes.popup],
    ([present, size]) => {
      if (!present) kept.value = 0;
      else kept.value ||= size;
    },
    { immediate: true, flush: 'sync' },
  );
  const height = computed(() => kept.value || sizes.popup);
  const frontmost = computed<number>(() => {
    const child = children.find((each) => each.dialog.root.open);
    return child ? child.frontmostHeight : height.value;
  });
  const rest = computed(() =>
    root.open && !dialog.nested ? snapProgress(points.value, offset.value) : 0,
  );

  const provider = inject(providerKey, null);

  const drawer: DrawerRoot = {
    dialog,
    get swipeDirection() {
      return props.swipeDirection;
    },
    get snapToSequentialPoints() {
      return props.snapToSequentialPoints;
    },
    parent,
    get nestedOpen() {
      return nestedOpen.value;
    },
    get nestedPresent() {
      return nestedPresent.value;
    },
    get nestedSwiping() {
      return children.some((child) => child.swipingFar || child.nestedSwiping);
    },
    get nestedProgress() {
      for (const child of children) {
        const progress = child.swiping ? child.progress : child.nestedProgress;
        if (progress > 0) return progress;
      }
      return 0;
    },
    get height() {
      return height.value;
    },
    get frontmostHeight() {
      return frontmost.value;
    },
    get swiping() {
      return swiping.value;
    },
    get swipingFar() {
      return swipingFar.value;
    },
    sample,
    get progress() {
      return swiping.value ? sample.progress : rest.value;
    },
    snap: {
      get points() {
        return points.value;
      },
      get active() {
        return active.value;
      },
      get offset() {
        return offset.value;
      },
      set: (point, reason, event) => setSnap(point, reason, event),
    },
    get viewport() {
      return viewport.value;
    },
    get backdrop() {
      return backdrop.value;
    },
    setViewport: (element) => (viewport.value = element),
    setBackdrop: (element) => (backdrop.value = element),
    setSizes(next) {
      Object.assign(sizes, next);
    },
    setSwiping(next, far = false) {
      swiping.value = next;
      swipingFar.value = next && far;
    },
    addNested(child) {
      children.push(child);
      return () => children.splice(children.indexOf(child), 1);
    },
    markContentPress: (event) => contentPresses.add(event),
    isContentPress: (event) => contentPresses.has(event),
    write(next) {
      Object.assign(sample, next);
    },
    clearDismiss() {
      for (const target of [root.popup, backdrop.value]) {
        target?.removeAttribute('data-swipe-dismiss');
        target?.style.setProperty('--drawer-swipe-strength', '1');
      }
    },
  };
  provide(drawerKey, drawer);
  // A popup and a backdrop that the portal keeps closed have the marks of a swipe close, and Vue
  // does not remove an attribute that it did not write.
  watch(
    () => root.open,
    (open) => {
      if (open) drawer.clearDismiss();
    },
    { flush: 'sync' },
  );
  if (parent) onScopeDispose(parent.addNested(drawer));

  // The indent of the page follows the drawers that no drawer holds.
  if (provider && !parent) {
    watch(
      () => [drawer.progress, frontmost.value] as const,
      ([progress, frontmostHeight]) => provider.write(progress, progress > 0 ? frontmostHeight : 0),
    );
  }
  // The server HTML has no active provider.
  onMounted(() => {
    if (provider) onScopeDispose(provider.add(() => root.open));
  });

  // The back gesture of Android closes the top open drawer.
  onMounted(() => {
    watch(
      () => root.open && dialog.dialogsAbove === 0 && platform.os.android,
      (top, _, onCleanup) => {
        const Watcher = (ownerWindow(root.popup) as { CloseWatcher?: new () => CloseWatcherLike })
          .CloseWatcher;
        if (!top || !Watcher) return;
        const watcher = new Watcher();
        watcher.addEventListener('cancel', (event) => {
          const details = root.request(false, 'close-watcher', event);
          if (details.isCanceled) event.preventDefault();
        });
        onCleanup(() => watcher.destroy());
      },
      { immediate: true },
    );
  });

  return { root, drawer, close: () => dialogRoot.close() };
}

interface CloseWatcherLike extends EventTarget {
  destroy(): void;
}

/** The drawer root of a part. A part with no root throws an error that names it. */
export function injectDrawer(part: string) {
  const drawer = inject(drawerKey, null);
  if (!drawer) {
    throw createError(28, part);
  }
  return drawer;
}
