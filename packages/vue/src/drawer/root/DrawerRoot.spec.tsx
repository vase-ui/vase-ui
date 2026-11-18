import { Drawer } from '@vase-ui/vue/drawer';
import { expectType } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { DrawerRootContext } from './DrawerRootContext';

// `openChange` is an emit, so the props type has no handler key.
type DrawerChangeHandler = (open: boolean, eventDetails: Drawer.Root.ChangeEventDetails) => void;
type DrawerChangeDetails = Parameters<DrawerChangeHandler>[1];
type DrawerSwipeEvent = Extract<DrawerChangeDetails, { reason: typeof REASONS.swipe }>['event'];

expectType<PointerEvent | TouchEvent, DrawerSwipeEvent>(null as unknown as DrawerSwipeEvent);

function assertDrawerChange(details: DrawerChangeDetails) {
  if (details.reason === REASONS.swipe) {
    const event: PointerEvent | TouchEvent = details.event;
    void event;
    // @ts-expect-error swipe details should not expose keyboard events
    const keyboardEvent: KeyboardEvent = details.event;
    void keyboardEvent;
  }

  if (details.reason === REASONS.escapeKey) {
    const event: KeyboardEvent = details.event;
    void event;
  }
}

const handleDrawerChange: DrawerChangeHandler = (open, details) => {
  expectType<boolean, typeof open>(open);
  assertDrawerChange(details);
};

const drawerOpenChangeReasonNarrowing = (
  <Drawer.Root onOpenChange={handleDrawerChange}>
    <Drawer.Trigger />
    <Drawer.Portal />
  </Drawer.Root>
);

void drawerOpenChangeReasonNarrowing;

function assertDrawerContext(context: DrawerRootContext) {
  context.setOpen(true, createChangeEventDetails(REASONS.swipe, new PointerEvent('pointerup')));
  context.setOpen(false, createChangeEventDetails(REASONS.swipe, new TouchEvent('touchend')));
  context.setOpen(false, createChangeEventDetails(REASONS.closeWatcher));
  // @ts-expect-error A drawer has no item press reason.
  context.setOpen(false, createChangeEventDetails(REASONS.itemPress));
}

// @ts-expect-error The store adds preventUnmountOnClose before the emit.
const incompleteDetails: Drawer.Root.ChangeEventDetails = createChangeEventDetails(REASONS.none);
