import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, nextTick, onMounted, shallowRef } from 'vue';
import type { PropType } from 'vue';
import type { InteractionType } from '../../common/useEnhancedClickHandler';
import {
  createRenderer,
  createTransitionRunCounter,
  fireEvent,
  flushMicrotasks,
  hydrate,
  randomStringValue,
  renderOnServer,
  waitFor,
} from '#test-utils';
import { createPopupFixtureHandle } from '../../../test/fixtures/PopupFixture';
import type { PopupFixtureStore } from '../../../test/fixtures/PopupFixture';
import PopupPart from '../../../test/fixtures/PopupPart.vue';
import PopupRootPart from '../../../test/fixtures/PopupRootPart.vue';
import PopupTriggerPart from '../../../test/fixtures/PopupTriggerPart.vue';
import { useImplicitActiveTrigger, usePopupRootSync } from './popupRoot';
import PopupRootHydration from './PopupRootHydration.test.vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { REASONS } from '../../internals/reasons';
import { ReactiveStore } from './ReactiveStore';
import {
  createInitialPopupStoreState,
  createPopupOpenState,
  createPopupStoreContext,
  popupStoreSelectors,
} from './store';
import type { PopupStoreContext, PopupStoreSelectors, PopupStoreState } from './store';
import { provideFloatingNode } from './tree/FloatingTree';
import {
  createTestPopupStore,
  TestForwardedTrigger,
  TestTrigger,
} from '../../../test/popupStoreTestUtils';
import type { TestPopupStore } from '../../../test/popupStoreTestUtils';

const HYDRATION_FILE = 'src/utils/popups/PopupRootHydration.test.vue';

const storeProp = { type: Object as PropType<TestPopupStore>, required: true } as const;

const ImplicitActiveTriggerTest = defineComponent({
  props: { store: storeProp },
  setup(props) {
    useImplicitActiveTrigger(props.store);
    return () => null;
  },
});

const CloseOnActiveTriggerUnmountTest = defineComponent({
  props: { store: storeProp },
  setup(props) {
    useImplicitActiveTrigger(props.store, { closeOnActiveTriggerUnmount: true });
    return () => null;
  },
});

const HideOnMount = defineComponent({
  props: { hide: { type: Function as PropType<() => void>, required: true } },
  setup(props) {
    onMounted(props.hide);
    return () => null;
  },
});

const ImplicitTriggerUnmountTest = defineComponent({
  props: { store: storeProp, element: { type: Object as PropType<HTMLElement>, required: true } },
  setup(props) {
    const triggerVisible = shallowRef(true);
    useImplicitActiveTrigger(props.store, { closeOnActiveTriggerUnmount: true });

    return () =>
      triggerVisible.value ? (
        <>
          <TestTrigger id="trigger" store={props.store} element={props.element} />
          <HideOnMount
            hide={() => {
              triggerVisible.value = false;
            }}
          />
        </>
      ) : null;
  },
});

describe('useImplicitActiveTrigger', () => {
  const { render } = createRenderer();

  it('claims the only registered trigger when a closed popup opens', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');

    await render(
      <>
        <ImplicitActiveTriggerTest store={store} />
        <TestTrigger id="trigger" store={store} element={element} />
      </>,
    );

    expect(store.context.triggerElements.getById('trigger')).toBe(element);
    expect(store.state.triggerCount).toBe(0);
    expect(store.state.activeTriggerId).toBe(null);

    store.set('open', true);
    await flushMicrotasks();

    expect(store.state.triggerCount).toBe(1);
    expect(store.state.activeTriggerId).toBe('trigger');
    expect(store.state.activeTriggerElement).toBe(element);
  });

  it('does not claim the only registered trigger when the popup opened without a trigger', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');

    await render(
      <>
        <ImplicitActiveTriggerTest store={store} />
        <TestTrigger id="trigger" store={store} element={element} />
      </>,
    );

    store.update(createPopupOpenState(store.state, true, undefined, false));
    await flushMicrotasks();

    expect(store.state.triggerCount).toBe(1);
    expect(store.state.openedWithoutTrigger).toBe(true);
    expect(store.state.activeTriggerId).toBe(null);
    expect(store.state.activeTriggerElement).toBe(null);
  });

  it('claims the only registered trigger again after a trigger-less open is closed by a controlled prop', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');

    await render(
      <>
        <ImplicitActiveTriggerTest store={store} />
        <TestTrigger id="trigger" store={store} element={element} />
      </>,
    );

    store.update(createPopupOpenState(store.state, true, undefined, false));
    await flushMicrotasks();
    expect(store.state.activeTriggerId).toBe(null);

    // A controlled close bypasses `createPopupOpenState`, so the root clears the flag itself.
    store.set('open', false);
    await flushMicrotasks();
    expect(store.state.openedWithoutTrigger).toBe(false);

    store.set('open', true);
    await flushMicrotasks();
    expect(store.state.activeTriggerId).toBe('trigger');
    expect(store.state.activeTriggerElement).toBe(element);
  });

  it('does not let a trigger registering into an open trigger-less popup claim it', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');
    store.set('payload', 'programmatic');
    store.update(createPopupOpenState(store.state, true, undefined, false));

    await render(
      <TestForwardedTrigger id="trigger" store={store} element={element} payload="from trigger" />,
    );

    expect(store.context.triggerElements.getById('trigger')).toBe(element);
    expect(store.state.activeTriggerId).toBe(null);
    expect(store.state.activeTriggerElement).toBe(null);
    expect(store.state.payload).toBe('programmatic');
  });

  it('lets a trigger registering into a popup opened by a controlled prop claim it', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');
    store.set('open', true);

    await render(
      <TestForwardedTrigger id="trigger" store={store} element={element} payload="from trigger" />,
    );

    expect(store.state.activeTriggerId).toBe('trigger');
    expect(store.state.activeTriggerElement).toBe(element);
    expect(store.state.payload).toBe('from trigger');
  });

  it('closes when an implicitly claimed trigger unmounts during the claim commit', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');
    store.set('open', true);

    await render(<ImplicitTriggerUnmountTest store={store} element={element} />);

    await waitFor(() => {
      expect(store.setOpen).toHaveBeenCalledTimes(1);
    });

    expect(store.context.triggerElements.getById('trigger')).toBeUndefined();
    expect(store.state.activeTriggerId).toBe(null);
    expect(store.state.activeTriggerElement).toBe(null);
    expect(store.setOpen).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'none' }));
    expect(store.state.open).toBe(false);
  });

  it('closes when the active trigger unregisters while open', async () => {
    const store = createTestPopupStore();
    const first = document.createElement('button');
    const second = document.createElement('button');

    store.update({
      open: true,
      activeTriggerId: 'first',
      activeTriggerElement: first,
    });

    const { rerender } = await render(
      <>
        <TestTrigger key="first" id="first" store={store} element={first} />
        <TestTrigger key="second" id="second" store={store} element={second} />
        <CloseOnActiveTriggerUnmountTest key="root" store={store} />
      </>,
    );

    expect(store.state.triggerCount).toBe(2);
    expect(store.state.activeTriggerId).toBe('first');
    expect(store.state.activeTriggerElement).toBe(first);

    await rerender(
      <>
        <TestTrigger key="second" id="second" store={store} element={second} />
        <CloseOnActiveTriggerUnmountTest key="root" store={store} />
      </>,
    );

    await waitFor(() => {
      expect(store.setOpen).toHaveBeenCalledTimes(1);
    });

    expect(store.state.triggerCount).toBe(0);
    expect(store.state.activeTriggerId).toBe(null);
    expect(store.state.activeTriggerElement).toBe(null);
    expect(store.setOpen).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'none' }));
    expect(store.state.open).toBe(false);
  });

  it.each([
    ['a different unresolved id', 'second'],
    ['no active trigger', null],
  ] as const)(
    'keeps the popup open when ownership returns to a pending trigger after %s',
    async (_description, pendingTriggerId) => {
      const store = createTestPopupStore();
      const first = document.createElement('button');
      const replacement = document.createElement('button');

      store.update({
        open: true,
        activeTriggerId: 'first',
        activeTriggerElement: first,
      });

      const { rerender } = await render(
        <>
          <TestTrigger key="trigger" id="first" store={store} element={first} />
          <CloseOnActiveTriggerUnmountTest key="root" store={store} />
        </>,
      );

      store.context.triggerElements.delete('first');
      store.update({
        activeTriggerId: pendingTriggerId,
        activeTriggerElement: null,
        triggerCount: 0,
      });
      await flushMicrotasks();

      await rerender(
        <>
          <CloseOnActiveTriggerUnmountTest key="root" store={store} />
        </>,
      );

      store.update({
        activeTriggerId: 'first',
        activeTriggerElement: null,
      });
      await flushMicrotasks();

      expect(store.state.open).toBe(true);
      expect(store.setOpen).not.toHaveBeenCalled();

      await rerender(
        <>
          <TestTrigger key="trigger" id="first" store={store} element={replacement} />
          <CloseOnActiveTriggerUnmountTest key="root" store={store} />
        </>,
      );

      expect(store.context.triggerElements.getById('first')).toBe(replacement);
      expect(store.state.open).toBe(true);
      expect(store.setOpen).not.toHaveBeenCalled();
    },
  );

  it('closes when the active trigger unmounts after registering in a count-neutral commit', async () => {
    const store = createTestPopupStore();
    const first = document.createElement('button');
    const second = document.createElement('button');

    store.update({
      open: true,
      // The `activeTriggerElement` selector resolves to null while unmounted, so reflect the
      // real open-popup state for the element subscription to observe registration.
      mounted: true,
      activeTriggerId: 'first',
      activeTriggerElement: first,
    });

    const { rerender } = await render(
      <>
        <TestForwardedTrigger key="first" id="first" store={store} element={first} />
        <CloseOnActiveTriggerUnmountTest key="root" store={store} />
      </>,
    );

    // Ownership moves to a trigger that has not registered yet: the popup stays open (pending).
    store.update({ activeTriggerId: 'second', activeTriggerElement: null });
    await flushMicrotasks();

    expect(store.state.open).toBe(true);
    expect(store.setOpen).not.toHaveBeenCalled();

    // Swap "first" out and "second" in within one commit, so the trigger count nets out
    // unchanged and only the forwarded active trigger element reruns the reconciliation.
    await rerender(
      <>
        <TestForwardedTrigger key="second" id="second" store={store} element={second} />
        <CloseOnActiveTriggerUnmountTest key="root" store={store} />
      </>,
    );

    await flushMicrotasks();

    expect(store.context.triggerElements.getById('second')).toBe(second);
    expect(store.state.activeTriggerElement).toBe(second);
    expect(store.state.open).toBe(true);
    expect(store.setOpen).not.toHaveBeenCalled();

    // The now-registered active trigger genuinely unmounts: the popup must close.
    await rerender(
      <>
        <CloseOnActiveTriggerUnmountTest key="root" store={store} />
      </>,
    );

    await waitFor(() => {
      expect(store.setOpen).toHaveBeenCalledTimes(1);
    });

    expect(store.setOpen).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'none' }));
    expect(store.state.open).toBe(false);
    expect(store.state.activeTriggerId).toBe(null);
    expect(store.state.activeTriggerElement).toBe(null);
  });

  it('keeps the popup open when the active trigger is replaced with the same id', async () => {
    const store = createTestPopupStore();
    const first = document.createElement('button');
    const replacement = document.createElement('button');
    const second = document.createElement('button');

    store.update({
      open: true,
      activeTriggerId: 'first',
      activeTriggerElement: first,
    });

    const { rerender } = await render(
      <>
        <TestForwardedTrigger key="first" id="first" store={store} element={first} />
        <TestForwardedTrigger key="second" id="second" store={store} element={second} />
        <CloseOnActiveTriggerUnmountTest store={store} />
      </>,
    );

    expect(store.state.triggerCount).toBe(2);
    expect(store.state.activeTriggerId).toBe('first');
    expect(store.state.activeTriggerElement).toBe(first);

    await rerender(
      <>
        <TestForwardedTrigger key="replacement" id="first" store={store} element={replacement} />
        <TestForwardedTrigger key="second" id="second" store={store} element={second} />
        <CloseOnActiveTriggerUnmountTest store={store} />
      </>,
    );

    await flushMicrotasks();

    expect(store.context.triggerElements.getById('first')).toBe(replacement);
    expect(store.context.triggerElements.getById('second')).toBe(second);
    expect(store.state.triggerCount).toBe(2);
    expect(store.state.activeTriggerId).toBe('first');
    expect(store.state.activeTriggerElement).toBe(replacement);
    expect(store.state.open).toBe(true);
    expect(store.setOpen).not.toHaveBeenCalled();
  });

  it('keeps the popup open when the active trigger element is registered with another id', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');
    element.id = 'dom-id';

    store.update({
      open: true,
      activeTriggerId: 'dom-id',
      activeTriggerElement: element,
    });

    await render(
      <>
        <TestTrigger id="registered-id" store={store} element={element} />
        <CloseOnActiveTriggerUnmountTest store={store} />
      </>,
    );

    await flushMicrotasks();

    expect(store.state.triggerCount).toBe(1);
    expect(store.state.activeTriggerId).toBe('registered-id');
    expect(store.state.activeTriggerElement).toBe(element);
    expect(store.state.open).toBe(true);
    expect(store.setOpen).not.toHaveBeenCalled();
  });

  it('reassociates the active trigger when ownership moves to another rendered-id trigger while open', async () => {
    const store = createTestPopupStore();
    const first = document.createElement('button');
    const second = document.createElement('button');
    second.id = 'dom-id-2';

    store.update({
      open: true,
      activeTriggerId: 'registered-1',
      activeTriggerElement: first,
    });

    await render(
      <>
        <TestTrigger id="registered-1" store={store} element={first} />
        <TestTrigger id="registered-2" store={store} element={second} />
        <CloseOnActiveTriggerUnmountTest store={store} />
      </>,
    );

    await flushMicrotasks();

    expect(store.state.activeTriggerId).toBe('registered-1');

    // A handoff to the second trigger updates the active id from its DOM id (as
    // `getPopupOpenState` does), without changing `open` or `triggerCount`.
    store.update({ activeTriggerId: 'dom-id-2', activeTriggerElement: second });
    await flushMicrotasks();

    expect(store.state.activeTriggerId).toBe('registered-2');
    expect(store.state.activeTriggerElement).toBe(second);
    expect(store.state.open).toBe(true);
    expect(store.setOpen).not.toHaveBeenCalled();
  });

  it('preserves active trigger ownership without closing by default', async () => {
    const store = createTestPopupStore();
    const first = document.createElement('button');
    const second = document.createElement('button');

    store.update({
      open: true,
      activeTriggerId: 'first',
      activeTriggerElement: first,
    });

    const { rerender } = await render(
      <>
        <TestTrigger key="first" id="first" store={store} element={first} />
        <TestTrigger key="second" id="second" store={store} element={second} />
        <ImplicitActiveTriggerTest key="root" store={store} />
      </>,
    );

    expect(store.state.triggerCount).toBe(2);
    expect(store.state.activeTriggerId).toBe('first');
    expect(store.state.activeTriggerElement).toBe(first);

    await rerender(
      <>
        <TestTrigger key="second" id="second" store={store} element={second} />
        <ImplicitActiveTriggerTest key="root" store={store} />
      </>,
    );

    // The close is queued in a microtask, so flush before asserting it never happened.
    await flushMicrotasks();

    expect(store.setOpen).not.toHaveBeenCalled();
    expect(store.state.open).toBe(true);
    expect(store.context.triggerElements.getById('first')).toBeUndefined();
    expect(store.context.triggerElements.getById('second')).toBe(second);
    expect(store.state.triggerCount).toBe(1);
    expect(store.state.activeTriggerId).toBe('first');
    expect(store.state.activeTriggerElement).toBe(first);
  });

  it('VUE-22: picks the first trigger that is in the document when triggers join an open popup that has no active trigger', async () => {
    const store = createTestPopupStore();
    const outside = document.createElement('button');
    const inside = document.createElement('button');
    document.body.append(inside);
    onTestFinished(() => inside.remove());
    store.set('open', true);

    const { rerender } = await render(<ImplicitActiveTriggerTest key="root" store={store} />);
    await rerender(
      <>
        <ImplicitActiveTriggerTest key="root" store={store} />
        <TestTrigger key="outside" id="outside" store={store} element={outside} />
        <TestTrigger key="inside" id="inside" store={store} element={inside} />
      </>,
    );
    await flushMicrotasks();

    expect(store.state.triggerCount).toBe(2);
    expect(store.state.activeTriggerId).toBe('inside');
    expect(store.state.activeTriggerElement).toBe(inside);
  });

  it('resets triggerCount when the popup closes', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');

    store.set('open', true);

    await render(
      <>
        <ImplicitActiveTriggerTest store={store} />
        <TestTrigger id="trigger" store={store} element={element} />
      </>,
    );

    expect(store.state.triggerCount).toBe(1);

    store.set('open', false);
    await flushMicrotasks();

    expect(store.state.triggerCount).toBe(0);
  });
});

const TriggerAndPopup = () => (
  <>
    <PopupTriggerPart id="trigger">trigger</PopupTriggerPart>
    <PopupPart>popup</PopupPart>
  </>
);

const Other = defineComponent({ name: 'Other', setup: () => () => <p /> });

function createAnimation() {
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const animation = {
    finished,
    effect: { getTiming: () => ({ duration: 1, iterations: 1 }) },
    pending: false,
    playState: 'running',
  } as unknown as Animation;
  return { animation, finish };
}

interface RootInstance {
  close(): void;
  unmount(): void;
  store: PopupFixtureStore<unknown>;
  open: boolean;
  mounted: boolean;
  transitionStatus: TransitionStatus;
}

// A ref on a part gives its exposed members. Vue sets the ref to `null` when the root unmounts, so
// the helper keeps the last root.
function createRootRef() {
  let root: RootInstance | undefined;
  return {
    ref(instance: unknown) {
      root = (instance as RootInstance | null) ?? root;
    },
    get current() {
      return root!;
    },
  };
}

describe('usePopupRoot', () => {
  const { render } = createRenderer();

  describe('open state', () => {
    it('emits openChange, update:open and openChangeComplete in order, with the reason and the trigger', async () => {
      const events: unknown[] = [];
      const { getByText } = await render(
        <PopupRootPart
          onOpenChange={(open, details) =>
            events.push(['openChange', open, details.reason, details.trigger?.id])
          }
          {...{ 'onUpdate:open': (open: boolean) => events.push(['update:open', open]) }}
          onOpenChangeComplete={(open) => events.push(['openChangeComplete', open])}
        >
          <TriggerAndPopup />
        </PopupRootPart>,
      );

      await fireEvent.click(getByText('trigger'));
      await waitFor(() => {
        expect(events).toContainEqual(['openChangeComplete', true]);
      });
      await fireEvent.click(getByText('trigger'));
      await waitFor(() => {
        expect(events).toContainEqual(['openChangeComplete', false]);
      });

      expect(events).toEqual([
        ['openChange', true, 'trigger-press', 'trigger'],
        ['update:open', true],
        ['openChangeComplete', true],
        ['openChange', false, 'trigger-press', 'trigger'],
        ['update:open', false],
        ['openChangeComplete', false],
      ]);
    });

    it('keeps the popup open and emits no update:open when the listener cancels the change', async () => {
      const updates: boolean[] = [];
      let cancel = true;
      const { getByText, queryByRole } = await render(
        <PopupRootPart
          defaultOpen
          onOpenChange={(_open, details) => {
            if (cancel) {
              details.cancel();
            }
          }}
          {...{ 'onUpdate:open': (open: boolean) => updates.push(open) }}
        >
          <TriggerAndPopup />
        </PopupRootPart>,
      );

      await fireEvent.click(getByText('trigger'));

      expect(updates).toEqual([]);
      expect(queryByRole('dialog')).not.toBe(null);

      cancel = false;
      await fireEvent.click(getByText('trigger'));

      expect(updates).toEqual([false]);
    });

    it('follows the open prop, and keeps the popup open when the parent declines a request', async () => {
      const open = shallowRef(false);
      const follow = shallowRef(true);
      const updates: boolean[] = [];
      const { getByText, queryByRole } = await render(() => (
        <PopupRootPart
          open={open.value}
          {...{
            'onUpdate:open': (value: boolean) => {
              updates.push(value);
              if (follow.value) {
                open.value = value;
              }
            },
          }}
        >
          <TriggerAndPopup />
        </PopupRootPart>
      ));

      await fireEvent.click(getByText('trigger'));
      expect(queryByRole('dialog')).not.toBe(null);
      expect(getByText('trigger')).toHaveAttribute('aria-expanded', 'true');

      follow.value = false;
      await fireEvent.click(getByText('trigger'));
      expect(updates).toEqual([true, false]);
      expect(queryByRole('dialog')).not.toBe(null);

      open.value = false;
      await waitFor(() => {
        expect(queryByRole('dialog')).toBe(null);
      });
    });

    it('forgets the trigger of a controlled popup that the open prop closed', async () => {
      const open = shallowRef(false);
      const root = createRootRef();
      const { getByText, queryByRole } = await render(() => (
        <PopupRootPart
          ref={root.ref}
          open={open.value}
          {...{ 'onUpdate:open': (value: boolean) => (open.value = value) }}
        >
          <TriggerAndPopup />
        </PopupRootPart>
      ));
      await fireEvent.click(getByText('trigger'));
      expect(root.current.store.state.activeTriggerId).toBe('trigger');

      // A close through the prop makes no request, so the request of the press is still in the store.
      open.value = false;
      await waitFor(() => {
        expect(queryByRole('dialog')).toBe(null);
      });

      expect(root.current.store.state.activeTriggerId).toBe(null);
    });

    it('drops a close request while the open prop keeps the popup closed', async () => {
      const changes: boolean[] = [];
      const root = createRootRef();
      await render(() => (
        <PopupRootPart
          ref={root.ref}
          open={false}
          defaultOpen
          onOpenChange={(open) => changes.push(open)}
        >
          <TriggerAndPopup />
        </PopupRootPart>
      ));

      root.current.close();

      expect(changes).toEqual([]);
    });

    it('renders as closed while it is disabled, and keeps its open state in the store', async () => {
      const disabled = shallowRef(true);
      const root = createRootRef();
      const { queryByRole } = await render(() => (
        <PopupRootPart ref={root.ref} defaultOpen disabled={disabled.value}>
          <TriggerAndPopup />
        </PopupRootPart>
      ));

      expect(queryByRole('dialog')).toBe(null);
      expect(root.current.store.select('open')).toBe(true);

      disabled.value = false;
      await flushMicrotasks();

      expect(queryByRole('dialog')).not.toBe(null);
    });

    it('writes mounted and transitionStatus to the store in the write that changes the open state, and returns them', async () => {
      const root = createRootRef();
      await render(() => (
        <PopupRootPart ref={root.ref}>
          <TriggerAndPopup />
        </PopupRootPart>
      ));
      const { store } = root.current;
      expect([root.current.open, root.current.mounted]).toEqual([false, false]);
      expect(store.state.mounted).toBe(false);

      store.setOpen(true, createChangeEventDetails(REASONS.imperativeAction));
      expect([store.state.mounted, store.state.transitionStatus]).toEqual([true, 'starting']);
      expect([root.current.open, root.current.mounted, root.current.transitionStatus]).toEqual([
        true,
        true,
        'starting',
      ]);

      store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
      expect([store.state.mounted, store.state.transitionStatus]).toEqual([true, 'ending']);
      expect(root.current.transitionStatus).toBe('ending');
    });

    it('mounts a popup that is open at the first render with no starting style', async () => {
      const { getByRole } = await render(
        <PopupRootPart defaultOpen>
          <TriggerAndPopup />
        </PopupRootPart>,
      );

      expect(getByRole('dialog')).toHaveAttribute('data-open');
      expect(getByRole('dialog')).not.toHaveAttribute('data-starting-style');
    });

    it('plays the enter transition of a popup that is open at the first render when animateInitialOpen is set', async () => {
      const { getByRole } = await render(
        <PopupRootPart defaultOpen animateInitialOpen>
          <TriggerAndPopup />
        </PopupRootPart>,
      );

      expect(getByRole('dialog')).toHaveAttribute('data-starting-style');
    });

    it('closes with the reason imperative-action from its close action', async () => {
      const reasons: string[] = [];
      const root = createRootRef();
      const { queryByRole } = await render(() => (
        <PopupRootPart
          ref={root.ref}
          defaultOpen
          onOpenChange={(_open, details) => reasons.push(details.reason)}
        >
          <TriggerAndPopup />
        </PopupRootPart>
      ));
      expect(queryByRole('dialog')).not.toBe(null);

      root.current.close();

      await waitFor(() => {
        expect(queryByRole('dialog')).toBe(null);
      });
      expect(reasons).toEqual(['imperative-action']);
    });

    it('keeps the same element, hidden while the popup is closed, when keepMounted is set', async () => {
      const { getByText, getByRole } = await render(
        <PopupRootPart>
          <PopupTriggerPart id="trigger">trigger</PopupTriggerPart>
          <PopupPart keepMounted>popup</PopupPart>
        </PopupRootPart>,
      );
      const popup = getByRole('dialog', { hidden: true });
      expect(popup).toHaveAttribute('hidden');

      await fireEvent.click(getByText('trigger'));
      expect(getByRole('dialog')).toBe(popup);
      expect(popup).not.toHaveAttribute('hidden');

      await fireEvent.click(getByText('trigger'));
      await waitFor(() => {
        expect(popup).toHaveAttribute('hidden');
      });
      expect(getByRole('dialog', { hidden: true })).toBe(popup);
    });

    it('marks a root inside a popup tree as nested', async () => {
      const Node = defineComponent((_props, { slots }) => {
        provideFloatingNode('parent');
        return () => slots.default?.();
      });
      const outside = createRootRef();
      const inside = createRootRef();

      await render(() => (
        <>
          <PopupRootPart ref={outside.ref} />
          <Node>
            <PopupRootPart ref={inside.ref} />
          </Node>
        </>
      ));

      expect(outside.current.store.context.nested).toBe(false);
      expect(inside.current.store.context.nested).toBe(true);
    });

    it.each([
      { name: 'open', props: { open: true } },
      { name: 'triggerId', props: { triggerId: 'trigger' } },
    ])(
      'warns when the $name prop changes from uncontrolled to controlled',
      async ({ name, props }) => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { setProps } = await render(
          <PopupRootPart>
            <TriggerAndPopup />
          </PopupRootPart>,
        );
        expect(errorSpy).not.toHaveBeenCalled();

        await setProps(props);

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0][0]).toContain(
          `Vase UI: A component is changing the uncontrolled ${name} state of PopupRootPart to be controlled.`,
        );
        errorSpy.mockRestore();
      },
    );

    it.each([
      { name: 'open', prop: 'defaultOpen', props: { defaultOpen: true } },
      { name: 'triggerId', prop: 'defaultTriggerId', props: { defaultTriggerId: 'trigger' } },
    ])('warns when the $prop prop of an uncontrolled root changes', async ({ name, props }) => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { setProps } = await render(
        <PopupRootPart>
          <TriggerAndPopup />
        </PopupRootPart>,
      );
      expect(errorSpy).not.toHaveBeenCalled();

      await setProps(props);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain(
        `Vase UI: A component is changing the default ${name} state of an uncontrolled PopupRootPart after being initialized.`,
      );
      errorSpy.mockRestore();
    });
  });

  describe('unmount and close actions', () => {
    it.each([
      { name: 'close, then unmount', calls: ['close', 'unmount'] },
      { name: 'unmount, then close', calls: ['unmount', 'close'] },
    ] as const)(
      'unmounts when `close` and `unmount` are called in one batch ($name)',
      async ({ calls }) => {
        const completions: boolean[] = [];
        const root = createRootRef();
        const { queryByRole } = await render(() => (
          <PopupRootPart
            ref={root.ref}
            defaultOpen
            onOpenChange={(open, details) => {
              if (!open) {
                details.preventUnmountOnClose();
              }
            }}
            onOpenChangeComplete={(open) => completions.push(open)}
          >
            <TriggerAndPopup />
          </PopupRootPart>
        ));
        expect(queryByRole('dialog')).not.toBe(null);

        for (const call of calls) {
          root.current[call]();
        }
        await waitFor(() => {
          expect(queryByRole('dialog')).toBe(null);
        });

        expect(completions.filter((open) => !open)).toHaveLength(1);
      },
    );

    it.each([
      { name: 'close, then unmount', calls: ['close', 'unmount'] },
      { name: 'unmount, then close', calls: ['unmount', 'close'] },
    ] as const)(
      'unmounts when `close` and `unmount` are called in one batch while controlled ($name)',
      async ({ calls }) => {
        const open = shallowRef(true);
        const completions: boolean[] = [];
        const root = createRootRef();
        const { queryByRole } = await render(() => (
          <PopupRootPart
            ref={root.ref}
            open={open.value}
            onOpenChange={(nextOpen, details) => {
              if (!nextOpen) {
                details.preventUnmountOnClose();
              }
            }}
            {...{ 'onUpdate:open': (value: boolean) => (open.value = value) }}
            onOpenChangeComplete={(nextOpen) => completions.push(nextOpen)}
          >
            <TriggerAndPopup />
          </PopupRootPart>
        ));
        expect(queryByRole('dialog')).not.toBe(null);

        for (const call of calls) {
          root.current[call]();
        }
        await waitFor(() => {
          expect(queryByRole('dialog')).toBe(null);
        });

        expect(completions.filter((nextOpen) => !nextOpen)).toHaveLength(1);
      },
    );

    it('keeps the popup mounted after a close that opted out, until unmount is called', async () => {
      const completions: boolean[] = [];
      const root = createRootRef();
      const { queryByRole } = await render(() => (
        <PopupRootPart
          ref={root.ref}
          defaultOpen
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
          onOpenChangeComplete={(open) => completions.push(open)}
        >
          <TriggerAndPopup />
        </PopupRootPart>
      ));

      root.current.close();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(queryByRole('dialog')).not.toBe(null);
      expect(completions).not.toContain(false);

      root.current.unmount();
      await flushMicrotasks();

      expect(queryByRole('dialog')).toBe(null);
      expect(completions.filter((open) => !open)).toHaveLength(1);
    });
  });

  describe('with animations', () => {
    it('gives the popup its starting and ending styles, and runs one transition for the enter and one for the exit', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const className = randomStringValue();
      const completions: boolean[] = [];
      const isOpen = shallowRef(false);
      const counter = createTransitionRunCounter(() => isOpen.value);
      const { getByText, container } = await render(() => (
        <>
          <style>{`.${className} { transition: opacity 50ms; opacity: 1 } .${className}[data-starting-style], .${className}[data-ending-style] { opacity: 0 }`}</style>
          <PopupRootPart
            onOpenChangeComplete={(open) => completions.push(open)}
            onOpenChange={(open) => (isOpen.value = open)}
          >
            <PopupTriggerPart id="trigger">trigger</PopupTriggerPart>
            <PopupPart class={className} onTransitionrun={counter.onTransitionrun}>
              popup
            </PopupPart>
          </PopupRootPart>
        </>
      ));
      const states: string[] = [];
      const observer = new MutationObserver(() => {
        const popup = container.querySelector('[role=dialog]');
        const state = popup
          ? ['open', 'closed', 'starting-style', 'ending-style']
              .filter((name) => popup.hasAttribute(`data-${name}`))
              .join('+')
          : 'absent';
        if (states.at(-1) !== state) {
          states.push(state);
        }
      });
      observer.observe(container, { childList: true, subtree: true, attributes: true });

      await fireEvent.click(getByText('trigger'));
      await waitFor(() => {
        expect(completions).toEqual([true]);
      });
      await fireEvent.click(getByText('trigger'));
      await waitFor(() => {
        expect(completions).toEqual([true, false]);
      });
      observer.disconnect();

      expect(states).toEqual(['open+starting-style', 'open', 'closed+ending-style', 'absent']);
      expect(counter.counts).toEqual({ enter: 1, exit: 1 });
    });

    it('keeps the popup mounted until its exit animation finishes', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const completions: boolean[] = [];
      const { getByText, getByRole, queryByRole } = await render(
        <PopupRootPart onOpenChangeComplete={(open) => completions.push(open)}>
          <TriggerAndPopup />
        </PopupRootPart>,
      );
      await fireEvent.click(getByText('trigger'));
      await waitFor(() => {
        expect(completions).toEqual([true]);
      });
      const exit = createAnimation();
      getByRole('dialog').getAnimations = () => [exit.animation];

      await fireEvent.click(getByText('trigger'));
      await waitFor(() => {
        expect(getByRole('dialog')).toHaveAttribute('data-ending-style');
      });
      await flushMicrotasks();
      expect(queryByRole('dialog')).not.toBe(null);
      expect(completions).toEqual([true]);

      exit.finish();
      await waitFor(() => {
        expect(completions).toEqual([true, false]);
      });
      expect(queryByRole('dialog')).toBe(null);
    });
  });

  describe('active trigger', () => {
    it('gives the popup the payload of the active trigger, and follows a change of it', async () => {
      const payload = shallowRef('one');
      const { getByText, getByRole } = await render(() => (
        <PopupRootPart
          v-slots={{
            default: ({ payload: current }: { payload: string | undefined }) => [
              <PopupTriggerPart id="a" payload={payload.value}>
                a
              </PopupTriggerPart>,
              <PopupTriggerPart id="b" payload="two">
                b
              </PopupTriggerPart>,
              <PopupPart>payload: {current}</PopupPart>,
            ],
          }}
        />
      ));

      await fireEvent.click(getByText('a'));
      expect(getByRole('dialog')).toHaveTextContent('payload: one');

      payload.value = 'one changed';
      await flushMicrotasks();
      expect(getByRole('dialog')).toHaveTextContent('payload: one changed');

      await fireEvent.click(getByText('b'));
      expect(getByRole('dialog')).toHaveTextContent('payload: two');
      expect(getByText('a')).toHaveAttribute('aria-expanded', 'false');
      expect(getByText('b')).toHaveAttribute('aria-expanded', 'true');
    });

    it('opens from the trigger that defaultTriggerId names', async () => {
      const { getByText } = await render(
        <PopupRootPart defaultOpen defaultTriggerId="b">
          <PopupTriggerPart id="a">a</PopupTriggerPart>
          <PopupTriggerPart id="b">b</PopupTriggerPart>
          <PopupPart>popup</PopupPart>
        </PopupRootPart>,
      );

      expect(getByText('a')).toHaveAttribute('aria-expanded', 'false');
      expect(getByText('b')).toHaveAttribute('aria-expanded', 'true');
    });

    it('follows the triggerId prop of a controlled root', async () => {
      // The first trigger claims an open popup that has no trigger id, so the prop starts on the
      // second trigger.
      const triggerId = shallowRef('b');
      const { getByText } = await render(() => (
        <PopupRootPart defaultOpen triggerId={triggerId.value}>
          <PopupTriggerPart id="a">a</PopupTriggerPart>
          <PopupTriggerPart id="b">b</PopupTriggerPart>
          <PopupPart>popup</PopupPart>
        </PopupRootPart>
      ));
      expect(getByText('a')).toHaveAttribute('aria-expanded', 'false');
      expect(getByText('b')).toHaveAttribute('aria-expanded', 'true');

      triggerId.value = 'a';
      await flushMicrotasks();

      expect(getByText('a')).toHaveAttribute('aria-expanded', 'true');
      expect(getByText('b')).toHaveAttribute('aria-expanded', 'false');
    });

    it('takes no trigger when a closed popup opens with many triggers and no trigger id', async () => {
      const open = shallowRef(false);
      const root = createRootRef();
      const { getByText } = await render(() => (
        <PopupRootPart ref={root.ref} open={open.value}>
          <PopupTriggerPart id="a">a</PopupTriggerPart>
          <PopupTriggerPart id="b">b</PopupTriggerPart>
          <PopupPart>popup</PopupPart>
        </PopupRootPart>
      ));

      open.value = true;
      await flushMicrotasks();

      expect(root.current.store.select('open')).toBe(true);
      expect(root.current.store.state.activeTriggerId).toBe(null);
      expect(getByText('a')).toHaveAttribute('aria-expanded', 'false');
      expect(getByText('b')).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes with the reason none when the active trigger unmounts while the popup is open', async () => {
      const showTrigger = shallowRef(true);
      const changes: unknown[] = [];
      const { getByText, queryByRole } = await render(() => (
        <PopupRootPart onOpenChange={(open, details) => changes.push([open, details.reason])}>
          {showTrigger.value ? <PopupTriggerPart id="a">a</PopupTriggerPart> : null}
          <PopupPart>popup</PopupPart>
        </PopupRootPart>
      ));
      await fireEvent.click(getByText('a'));
      expect(queryByRole('dialog')).not.toBe(null);

      showTrigger.value = false;

      await waitFor(() => {
        expect(queryByRole('dialog')).toBe(null);
      });
      expect(changes).toEqual([
        [true, 'trigger-press'],
        [false, 'none'],
      ]);
    });

    it('keeps a controlled popup open with no active trigger when it opens in the update that removes its only trigger', async () => {
      const open = shallowRef(false);
      const showTrigger = shallowRef(true);
      const changes: unknown[] = [];
      const root = createRootRef();
      const { queryByRole } = await render(() => (
        <PopupRootPart
          ref={root.ref}
          open={open.value}
          onOpenChange={(next, details) => changes.push([next, details.reason])}
        >
          {showTrigger.value ? <PopupTriggerPart id="a">a</PopupTriggerPart> : null}
          <PopupPart>popup</PopupPart>
        </PopupRootPart>
      ));
      expect(queryByRole('dialog')).toBe(null);

      open.value = true;
      showTrigger.value = false;
      await flushMicrotasks();

      expect(changes).toEqual([]);
      expect(root.current.store.state.activeTriggerId).toBe(null);
      expect(queryByRole('dialog')).not.toBe(null);
    });
  });

  describe('with a handle', () => {
    it('attaches its store when it mounts, so a detached trigger can open it, and detaches when it unmounts', async () => {
      const handle = createPopupFixtureHandle<string>();
      const root = createRootRef();
      const { getByText, getByRole, unmount } = await render(() => (
        <>
          <PopupTriggerPart id="detached" handle={handle} payload="from detached">
            detached
          </PopupTriggerPart>
          <PopupRootPart
            ref={root.ref}
            handle={handle}
            v-slots={{
              default: ({ payload }: { payload: string | undefined }) => (
                <PopupPart>payload: {payload}</PopupPart>
              ),
            }}
          />
        </>
      ));
      expect(handle.store).toBe(root.current.store);

      handle.open('detached');
      await flushMicrotasks();

      expect(getByText('detached')).toHaveAttribute('aria-expanded', 'true');
      expect(getByRole('dialog')).toHaveTextContent('payload: from detached');

      unmount();
      expect(handle.store).toBe(handle.serverStore);
    });

    it('moves to the new handle when the handle prop changes', async () => {
      const first = createPopupFixtureHandle<string>();
      const second = createPopupFixtureHandle<string>();
      const handle = shallowRef(first);
      const root = createRootRef();
      await render(() => <PopupRootPart ref={root.ref} handle={handle.value} />);
      expect(first.store).toBe(root.current.store);

      handle.value = second;
      await nextTick();

      expect(first.store).toBe(first.serverStore);
      expect(second.store).toBe(root.current.store);
    });
  });

  describe('with KeepAlive', () => {
    it('leaves its handle while KeepAlive holds it, and keeps its popup open', async () => {
      const handle = createPopupFixtureHandle<string>();
      const show = shallowRef(true);
      const Branch = defineComponent({
        name: 'Branch',
        setup: () => () => (
          <PopupRootPart handle={handle}>
            <TriggerAndPopup />
          </PopupRootPart>
        ),
      });
      const { getByText, queryByRole } = await render(() => (
        <KeepAlive>{show.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
      ));
      await fireEvent.click(getByText('trigger'));
      expect(handle.isOpen).toBe(true);

      show.value = false;
      await flushMicrotasks();
      expect(handle.store).toBe(handle.serverStore);
      expect(handle.isOpen).toBe(false);

      show.value = true;
      await flushMicrotasks();

      expect(handle.store).not.toBe(handle.serverStore);
      expect(handle.isOpen).toBe(true);
      expect(queryByRole('dialog')).not.toBe(null);
      expect(getByText('trigger')).toHaveAttribute('aria-expanded', 'true');
    });

    it('gives a new handle its store at the activation when the handle prop changes while KeepAlive holds the root', async () => {
      const first = createPopupFixtureHandle<string>();
      const second = createPopupFixtureHandle<string>();
      const handle = shallowRef(first);
      const show = shallowRef(true);
      const root = createRootRef();
      const Branch = defineComponent({
        name: 'Branch',
        setup: () => () => <PopupRootPart ref={root.ref} handle={handle.value} />,
      });
      await render(() => (
        <KeepAlive>{show.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
      ));
      expect(first.store).toBe(root.current.store);

      show.value = false;
      await flushMicrotasks();
      handle.value = second;
      await flushMicrotasks();

      expect(first.store).toBe(first.serverStore);
      expect(second.store).toBe(second.serverStore);

      show.value = true;
      await flushMicrotasks();

      expect(second.store).toBe(root.current.store);
      expect(first.store).toBe(first.serverStore);
    });

    it('closes with the reason none when KeepAlive deactivates the active trigger and the root stays', async () => {
      const show = shallowRef(true);
      const changes: unknown[] = [];
      const Branch = defineComponent({
        name: 'Branch',
        setup: () => () => <PopupTriggerPart id="trigger">trigger</PopupTriggerPart>,
      });
      const { getByText, queryByRole } = await render(() => (
        <PopupRootPart onOpenChange={(open, details) => changes.push([open, details.reason])}>
          <KeepAlive>{show.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
          <PopupPart>popup</PopupPart>
        </PopupRootPart>
      ));
      await fireEvent.click(getByText('trigger'));
      expect(queryByRole('dialog')).not.toBe(null);

      show.value = false;

      await waitFor(() => {
        expect(queryByRole('dialog')).toBe(null);
      });
      expect(changes).toEqual([
        [true, 'trigger-press'],
        [false, 'none'],
      ]);
    });

    it('takes no trigger when it opens with many triggers after the popup closed while KeepAlive held the root', async () => {
      const show = shallowRef(true);
      const open = shallowRef(false);
      const root = createRootRef();
      const Branch = defineComponent({
        name: 'Branch',
        setup: () => () => (
          <PopupRootPart ref={root.ref} open={open.value}>
            <PopupTriggerPart id="first">first</PopupTriggerPart>
            <PopupTriggerPart id="second">second</PopupTriggerPart>
            <PopupPart>popup</PopupPart>
          </PopupRootPart>
        ),
      });
      await render(() => (
        <KeepAlive>{show.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
      ));
      open.value = true;
      await flushMicrotasks();
      expect(root.current.store.state.activeTriggerId).toBe(null);

      show.value = false;
      await flushMicrotasks();
      open.value = false;
      await flushMicrotasks();
      show.value = true;
      await flushMicrotasks();
      expect(root.current.store.select('open')).toBe(false);

      open.value = true;
      await flushMicrotasks();

      expect(root.current.store.select('open')).toBe(true);
      expect(root.current.store.state.activeTriggerId).toBe(null);
    });

    // `KeepAlive` runs the `onActivated` hooks from the last part to the first part. A claim by
    // each trigger would give the popup to the last trigger.
    it.each([
      { name: 'at mount', cycle: 'none' },
      { name: 'when KeepAlive activates them', cycle: 'triggers' },
      { name: 'when KeepAlive activates the root', cycle: 'root' },
    ] as const)(
      'VUE-22: gives an open popup that has no active trigger the first trigger of the map ($name)',
      async ({ cycle }) => {
        const show = shallowRef(true);
        const open = shallowRef(cycle === 'none');
        const root = createRootRef();
        const triggers = () => (
          <>
            <PopupTriggerPart id="first" payload="from first">
              first
            </PopupTriggerPart>
            <PopupTriggerPart id="second" payload="from second">
              second
            </PopupTriggerPart>
          </>
        );
        const Branch = defineComponent({
          name: 'Branch',
          setup: () => () => (
            <PopupRootPart
              ref={root.ref}
              open={open.value}
              v-slots={{
                default: ({ payload }: { payload: string | undefined }) => [
                  triggers(),
                  <PopupPart>payload: {payload}</PopupPart>,
                ],
              }}
            />
          ),
        });
        const Triggers = defineComponent({ name: 'Triggers', setup: () => () => triggers() });
        const { getByText, queryByRole } = await render(() =>
          cycle === 'triggers' ? (
            <PopupRootPart
              ref={root.ref}
              open={open.value}
              v-slots={{
                default: ({ payload }: { payload: string | undefined }) => [
                  <KeepAlive>
                    {show.value ? <Triggers key="triggers" /> : <Other key="other" />}
                  </KeepAlive>,
                  <PopupPart>payload: {payload}</PopupPart>,
                ],
              }}
            />
          ) : (
            <KeepAlive>{show.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
          ),
        );

        if (cycle !== 'none') {
          show.value = false;
          await flushMicrotasks();
          open.value = true;
          await flushMicrotasks();
          expect(root.current.store.state.activeTriggerId).toBe(null);

          show.value = true;
          await flushMicrotasks();
        }

        expect(root.current.store.state.activeTriggerId).toBe('first');
        expect(getByText('first')).toHaveAttribute('aria-expanded', 'true');
        expect(queryByRole('dialog')).toHaveTextContent('payload: from first');
      },
    );
  });

  describe('hydration', () => {
    interface TriggerValues {
      expanded: string | null;
      controls: string | null;
      open: boolean;
    }

    // The triggers, in the order of the document.
    function readTriggers(root: ParentNode): TriggerValues[] {
      return Array.from(root.querySelectorAll('button'), (trigger) => ({
        expanded: trigger.getAttribute('aria-expanded'),
        controls: trigger.getAttribute('aria-controls'),
        open: trigger.hasAttribute('data-popup-open'),
      }));
    }

    const closed: TriggerValues = { expanded: 'false', controls: null, open: false };
    const open: TriggerValues = {
      expanded: 'true',
      controls: expect.stringMatching(/^vase-ui-/) as string,
      open: true,
    };

    // A server registers no trigger and attaches no store to a handle. A trigger that the root has
    // not named gets its values in the first flush after the mount. Vue does not patch an attribute
    // when it hydrates, so the first render of each trigger must have the values of the server HTML.
    it.each<{
      name: string;
      props: Record<string, unknown>;
      server: TriggerValues[];
      client: TriggerValues[];
    }>([
      {
        name: 'closed with a trigger id',
        props: { defaultTriggerId: 'first', triggers: ['first', 'second'] },
        server: [closed, closed],
        client: [closed, closed],
      },
      {
        name: 'open with defaultTriggerId',
        props: { defaultOpen: true, defaultTriggerId: 'first', triggers: ['first', 'second'] },
        server: [open, closed],
        client: [open, closed],
      },
      {
        name: 'open with the triggerId prop',
        props: { open: true, triggerId: 'second', triggers: ['first', 'second'] },
        server: [closed, open],
        client: [closed, open],
      },
      {
        name: 'one trigger, no trigger id',
        props: { defaultOpen: true, triggers: ['first'] },
        server: [closed],
        client: [open],
      },
      {
        name: 'one trigger with a generated id',
        props: { defaultOpen: true, triggers: [null] },
        server: [closed],
        client: [open],
      },
      {
        name: 'two triggers, no trigger id',
        props: { defaultOpen: true, triggers: ['first', 'second'] },
        server: [closed, closed],
        client: [open, closed],
      },
      {
        name: 'a trigger with a handle after the root',
        props: {
          defaultOpen: true,
          defaultTriggerId: 'after',
          triggers: ['first'],
          detachedAfter: 'after',
        },
        server: [closed, closed],
        client: [closed, open],
      },
      {
        name: 'a trigger with a handle before the root',
        props: {
          defaultOpen: true,
          defaultTriggerId: 'before',
          triggers: ['first'],
          detachedBefore: 'before',
        },
        server: [closed, closed],
        client: [open, closed],
      },
      {
        name: 'a popup with an id of its own',
        props: { defaultOpen: true, defaultTriggerId: 'first', popupId: 'my-popup' },
        server: [open],
        client: [{ expanded: 'true', controls: 'my-popup', open: true }],
      },
    ])('hydrates the server HTML of a root: $name', async ({ props, server, client }) => {
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(readTriggers(template.content)).toEqual(server);

      const { container } = await hydrate(PopupRootHydration, { serverHtml, props });

      const triggers = readTriggers(container);
      expect(triggers).toEqual(client);
      // `hydrate` mounts two apps, so an open popup is in the document two times. The portal puts
      // the popup into the document after the mount, and `aria-controls` names it.
      const controls = triggers.find((trigger) => trigger.open)?.controls;
      const popups = Array.from(document.querySelectorAll('[role="dialog"]'), (popup) => popup.id);
      expect(popups).toEqual(controls ? [controls, controls] : []);
    });
  });
});

type OpenMethodStore = ReactiveStore<
  Readonly<PopupStoreState<unknown> & { openMethod: InteractionType | null }>,
  PopupStoreContext<never>,
  PopupStoreSelectors
>;

function createOpenMethodStore(open: boolean, openMethod: InteractionType | null) {
  return new ReactiveStore(
    { ...createInitialPopupStoreState(), open, openMethod },
    createPopupStoreContext(),
    popupStoreSelectors,
  ) as OpenMethodStore;
}

const PopupRootSyncTest = defineComponent({
  props: { store: { type: Object as PropType<OpenMethodStore>, required: true } },
  setup(props) {
    usePopupRootSync(props.store, () => props.store.select('open'));
    return () => null;
  },
});

describe('usePopupRootSync', () => {
  const { render } = createRenderer();

  it('clears openMethod when the popup closes', async () => {
    const store = createOpenMethodStore(true, 'touch');
    await render(<PopupRootSyncTest store={store} />);

    store.set('open', false);
    await flushMicrotasks();

    expect(store.state.openMethod).toBe(null);
  });

  it('keeps openMethod while the popup is open', async () => {
    const store = createOpenMethodStore(true, 'touch');
    await render(<PopupRootSyncTest store={store} />);
    await flushMicrotasks();
    expect(store.state.openMethod).toBe('touch');

    store.set('openMethod', 'mouse');
    await flushMicrotasks();

    expect(store.state.openMethod).toBe('mouse');
  });

  it('clears openMethod when the root unmounts', async () => {
    const store = createOpenMethodStore(true, 'touch');
    const { unmount } = await render(<PopupRootSyncTest store={store} />);

    unmount();

    expect(store.state.openMethod).toBe(null);
  });

  it('keeps openMethod while KeepAlive holds the root', async () => {
    const store = createOpenMethodStore(true, 'touch');
    const visible = shallowRef(true);
    await render(() => (
      <KeepAlive>
        {visible.value ? <PopupRootSyncTest key="root" store={store} /> : <Other key="other" />}
      </KeepAlive>
    ));

    visible.value = false;
    await flushMicrotasks();
    expect(store.state.openMethod).toBe('touch');

    visible.value = true;
    await flushMicrotasks();
    expect(store.state.openMethod).toBe('touch');
  });
});
