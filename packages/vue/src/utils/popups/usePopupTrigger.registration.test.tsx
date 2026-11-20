import { describe, expect, it, vi } from 'vitest';
import {
  computed,
  defineComponent,
  KeepAlive,
  nextTick,
  onBeforeMount,
  onScopeDispose,
  shallowRef,
} from 'vue';
import type { PropType } from 'vue';
import { createHeldBranch, createRenderer, screen } from '#test-utils';
import { NOOP } from '../../common/empty';
import type { InteractionType } from './usePopupTrigger';
import type { HTMLProps } from '../../internals/types';
import {
  NullStore,
  PopupTriggerMap,
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupOpenState,
  createPopupStoreContext,
  popupStoreSelectors,
} from './usePopupRoot';
import { usePopupTrigger, useTriggerRegistration, usePopupHandleStore } from './usePopupTrigger';
import {
  createDefaultInitialFocus,
  bindPopupParts,
  popupBindings,
  triggerBindings,
} from './popupBindings';
import { BasePopupHandle } from './popupHandle';
import type {
  PopupOpenChangeEventDetails,
  PopupStoreContext,
  PopupStoreSelectors,
  PopupStoreState,
  PopupTriggerStoreKeys,
} from './usePopupRoot';
import {
  createTestPopupStore,
  TestForwardedTrigger,
  TestTrigger,
} from '../../../test/popupStoreTestUtils';
import type { TestPopupStore } from '../../../test/popupStoreTestUtils';

const storeProp = { type: Object as PropType<TestPopupStore>, required: true } as const;

function interactionProps(props: object) {
  return props as HTMLProps;
}

const PopupInteractionPropsTest = defineComponent({
  props: {
    store: storeProp,
    activeTriggerProps: { type: Object as PropType<HTMLProps>, required: true },
    inactiveTriggerProps: { type: Object as PropType<HTMLProps>, required: true },
    popupProps: { type: Object as PropType<HTMLProps>, required: true },
  },
  setup(props) {
    bindPopupParts(props.store, {
      trigger: () => props.activeTriggerProps,
      inactiveTrigger: () => props.inactiveTriggerProps,
      popup: () => props.popupProps,
    });

    return () => null;
  },
});

// A trigger with a real element, as a part of a family renders it.
const RegisteredTrigger = defineComponent({
  props: { id: { type: String, required: true }, store: storeProp, payload: null },
  setup(props, { slots }) {
    const { registerTrigger } = usePopupTrigger(
      () => props.id,
      () => props.store,
      () => ({ payload: props.payload }),
    );
    const setElement = (element: unknown) => registerTrigger(element as Element | null);

    return () => (
      <div id={props.id} ref={setElement}>
        {slots.default?.()}
      </div>
    );
  },
});

function registeredIds(store: TestPopupStore) {
  return Array.from(store.context.triggerElements.entries(), ([id]) => id);
}

const Other = defineComponent({ name: 'Other', setup: () => () => <p /> });

type TestHandleStore = Pick<TestPopupStore, PopupTriggerStoreKeys | 'setOpen'>;

// The inert store of a handle that has no root: a frozen state and a frozen context.
function createInertStore(): TestHandleStore {
  const store = new NullStore<
    Readonly<PopupStoreState<unknown>>,
    PopupStoreContext<unknown>,
    PopupStoreSelectors
  >(
    Object.freeze(createInitialPopupStoreState()),
    Object.freeze(createPopupStoreContext()),
    popupStoreSelectors,
  );
  return Object.assign(store, { setOpen: NOOP });
}

class TestHandle extends BasePopupHandle<TestHandleStore, TestPopupStore> {
  constructor() {
    super(createInertStore(), 'Test');
  }

  get inertStore() {
    return this.fallbackStore;
  }
}

const HandleRoot = defineComponent({
  props: { handle: { type: Object as PropType<TestHandle>, required: true }, store: storeProp },
  setup(props) {
    let detach: (() => void) | undefined;
    onBeforeMount(() => {
      detach = props.handle.attachStore(props.store);
    });
    onScopeDispose(() => detach?.());

    return () => null;
  },
});

const DetachedTrigger = defineComponent({
  props: {
    id: { type: String, required: true },
    handle: { type: Object as PropType<TestHandle>, required: true },
    payload: null,
  },
  setup(props, { slots }) {
    const handleStore = usePopupHandleStore(() => props.handle);
    const { registerTrigger } = usePopupTrigger(
      () => props.id,
      () => handleStore.value!,
      () => ({ payload: props.payload }),
    );
    const setElement = (element: unknown) => registerTrigger(element as Element | null);

    return () => (
      <div id={props.id} ref={setElement}>
        {slots.default?.()}
      </div>
    );
  },
});

describe('PopupTriggerMap', () => {
  it('stores and retrieves elements by id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);

    expect(map.getById('trigger')).toBe(button);
    expect(map.hasElement(button)).toBe(true);
    expect(map.hasMatchingElement((element) => element === button)).toBe(true);
  });

  it('replaces a registered element when the id is reused', () => {
    const map = new PopupTriggerMap();
    const first = document.createElement('button');
    const second = document.createElement('button');

    map.add('trigger', first);
    map.add('trigger', second);

    expect(map.getById('trigger')).toBe(second);
    expect(map.hasElement(first)).toBe(false);
    expect(map.hasElement(second)).toBe(true);
  });

  it('deletes an element and no longer matches it', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);
    map.delete('trigger');

    expect(map.getById('trigger')).toBeUndefined();
    expect(map.hasElement(button)).toBe(false);
    expect(map.hasMatchingElement((element) => element === button)).toBe(false);
  });
});

describe('useTriggerRegistration', () => {
  const { render } = createRenderer();

  it('registers and unregisters closed triggers through the context map without notifying the store', async () => {
    const store = createTestPopupStore();
    const spy = vi.spyOn(store, 'set');
    const element = document.createElement('button');

    const { unmount } = await render(
      <TestTrigger id="trigger" store={store} element={element} repeat={3} />,
    );

    expect(store.context.triggerElements.getById('trigger')).toBe(element);
    expect(store.context.triggerElements.hasElement(element)).toBe(true);
    expect(store.state.triggerCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();

    unmount();
    expect(store.context.triggerElements.getById('trigger')).toBeUndefined();
    expect(store.context.triggerElements.hasElement(element)).toBe(false);
    expect(store.state.triggerCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('re-registers closed triggers when the trigger id changes without notifying the store', async () => {
    const store = createTestPopupStore();
    const spy = vi.spyOn(store, 'set');
    const element = document.createElement('button');

    const { rerender, unmount } = await render(
      <TestTrigger id="first" store={store} element={element} />,
    );

    expect(store.context.triggerElements.getById('first')).toBe(element);
    expect(store.state.triggerCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();

    await rerender(<TestTrigger id="second" store={store} element={element} />);

    expect(store.context.triggerElements.getById('first')).toBeUndefined();
    expect(store.context.triggerElements.getById('second')).toBe(element);
    expect(store.state.triggerCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();

    unmount();
    expect(store.context.triggerElements.getById('second')).toBeUndefined();
    expect(store.context.triggerElements.hasElement(element)).toBe(false);
    expect(store.state.triggerCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns a stable callback that unregisters from the store it registered in', async () => {
    const first = createTestPopupStore();
    const second = createTestPopupStore();
    const element = document.createElement('button');
    let registerRef!: (element: Element | null) => void;

    const Probe = defineComponent({
      props: { store: storeProp },
      setup(props) {
        const { registerTrigger } = useTriggerRegistration(
          () => 'trigger',
          () => props.store,
        );
        registerRef = registerTrigger;
        registerTrigger(element);

        return () => null;
      },
    });

    const { rerender, unmount } = await render(<Probe store={first} />);
    const initialRegister = registerRef;

    expect(first.context.triggerElements.getById('trigger')).toBe(element);

    await rerender(<Probe store={second} />);

    expect(registerRef).toBe(initialRegister);
    expect(first.context.triggerElements.getById('trigger')).toBeUndefined();
    expect(second.context.triggerElements.getById('trigger')).toBe(element);

    // A retained callback from before the migration must still act on the current store.
    const replacement = document.createElement('button');
    initialRegister(null);
    initialRegister(replacement);
    await nextTick();

    expect(first.context.triggerElements.getById('trigger')).toBeUndefined();
    expect(second.context.triggerElements.getById('trigger')).toBe(replacement);

    unmount();
    expect(second.context.triggerElements.getById('trigger')).toBeUndefined();
  });

  describe('callers that pass the callback straight into a ref', () => {
    // The callback is the `ref` of the element. Vue calls it again on each patch, and the watcher of
    // the registration re-registers the element when the id changes.
    const RefOnlyTrigger = defineComponent({
      props: { id: String as PropType<string | undefined>, store: storeProp },
      setup(props) {
        const { registerTrigger } = useTriggerRegistration(
          () => props.id,
          () => props.store,
        );
        const setElement = (element: unknown) => registerTrigger(element as Element | null);

        return () => <button type="button" data-testid="trigger" ref={setElement} />;
      },
    });

    it('registers once the id resolves after the first commit', async () => {
      const store = createTestPopupStore();

      const { rerender } = await render(<RefOnlyTrigger id={undefined} store={store} />);
      const element = screen.getByTestId('trigger');

      expect(store.context.triggerElements.size).toBe(0);

      await rerender(<RefOnlyTrigger id="trigger" store={store} />);

      expect(store.context.triggerElements.getById('trigger')).toBe(element);
      expect(store.context.triggerElements.size).toBe(1);
    });

    it('follows an id change', async () => {
      const store = createTestPopupStore();

      const { rerender, unmount } = await render(<RefOnlyTrigger id="first" store={store} />);
      const element = screen.getByTestId('trigger');

      expect(store.context.triggerElements.getById('first')).toBe(element);

      await rerender(<RefOnlyTrigger id="second" store={store} />);

      expect(store.context.triggerElements.getById('first')).toBeUndefined();
      expect(store.context.triggerElements.getById('second')).toBe(element);
      expect(store.context.triggerElements.size).toBe(1);

      unmount();
      expect(store.context.triggerElements.size).toBe(0);
    });
  });

  it('keeps triggerCount reactive while the popup is open', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');
    store.set('open', true);

    const { unmount } = await render(<TestTrigger id="trigger" store={store} element={element} />);

    expect(store.context.triggerElements.getById('trigger')).toBe(element);
    expect(store.state.triggerCount).toBe(1);

    unmount();
    expect(store.context.triggerElements.getById('trigger')).toBeUndefined();
    expect(store.state.triggerCount).toBe(0);
  });

  it('keeps the entry that another trigger took over when the trigger that held the id changes its id', async () => {
    const store = createTestPopupStore();
    const first = document.createElement('button');
    const second = document.createElement('button');

    const { rerender } = await render(
      <>
        <TestTrigger key="first" id="a" store={store} element={first} />
        <TestTrigger key="second" id="b" store={store} element={second} />
      </>,
    );

    // The first trigger takes the id of the second trigger, and the second trigger takes a new id.
    await rerender(
      <>
        <TestTrigger key="first" id="b" store={store} element={first} />
        <TestTrigger key="second" id="c" store={store} element={second} />
      </>,
    );

    expect(store.context.triggerElements.getById('a')).toBeUndefined();
    expect(store.context.triggerElements.getById('b')).toBe(first);
    expect(store.context.triggerElements.getById('c')).toBe(second);
  });

  it('removes the entry and updates triggerCount when one of two triggers unmounts while the popup is open', async () => {
    const store = createTestPopupStore();
    const first = document.createElement('button');
    const second = document.createElement('button');
    const showSecond = shallowRef(true);
    store.set('open', true);

    await render(() => (
      <>
        <TestTrigger id="first" store={store} element={first} />
        {showSecond.value ? <TestTrigger id="second" store={store} element={second} /> : null}
      </>
    ));

    expect(store.state.triggerCount).toBe(2);

    showSecond.value = false;
    await nextTick();

    expect(registeredIds(store)).toEqual(['first']);
    expect(store.state.triggerCount).toBe(1);
  });

  it('adds no dependency to the render of the part that unmounts a trigger', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');
    const showTrigger = shallowRef(true);
    let renders = 0;
    store.set('open', true);

    const Parent = defineComponent(() => () => {
      renders += 1;
      return showTrigger.value ? (
        <TestTrigger id="trigger" store={store} element={element} />
      ) : null;
    });

    await render(<Parent />);
    expect(renders).toBe(1);

    // The cleanup of the trigger runs in this render. A read of the state there would make the
    // render depend on the state, and the cleanup writes the count that it read.
    showTrigger.value = false;
    await nextTick();
    expect(renders).toBe(2);

    store.set('open', false);
    await nextTick();
    expect(renders).toBe(2);
  });

  describe('with KeepAlive', () => {
    function createBranch(store: TestPopupStore) {
      return defineComponent({
        name: 'Branch',
        setup: () => () => (
          <div>
            <RegisteredTrigger id="s1" store={store} />
            <RegisteredTrigger id="outer" store={store}>
              <RegisteredTrigger id="inner" store={store} />
            </RegisteredTrigger>
            <RegisteredTrigger id="s2" store={store} />
          </div>
        ),
      });
    }

    it('hides the triggers from the map while KeepAlive deactivates them, and keeps their order', async () => {
      const store = createTestPopupStore();
      const Branch = createBranch(store);
      const showBranch = shallowRef(true);

      await render(() => (
        <KeepAlive>{showBranch.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
      ));
      expect(registeredIds(store)).toEqual(['s1', 'inner', 'outer', 's2']);

      showBranch.value = false;
      await nextTick();

      expect(registeredIds(store)).toEqual([]);
      expect(store.context.triggerElements.size).toBe(0);

      showBranch.value = true;
      await nextTick();

      expect(registeredIds(store)).toEqual(['s1', 'inner', 'outer', 's2']);
    });

    it('VUE-22: leaves the replacement trigger active when its predecessor is held', async () => {
      const store = createTestPopupStore();
      const first = document.createElement('button');
      const second = document.createElement('button');
      const shown = shallowRef(true);
      const replaced = shallowRef(false);
      const payload = shallowRef('first');
      store.update({ open: true, mounted: true, activeTriggerId: 'trigger' });
      const Branch = defineComponent(() => () => (
        <TestForwardedTrigger id="trigger" store={store} element={first} payload={payload.value} />
      ));
      await render(() => (
        <>
          <KeepAlive>{shown.value ? <Branch /> : <Other />}</KeepAlive>
          {replaced.value && (
            <TestForwardedTrigger id="trigger" store={store} element={second} payload="second" />
          )}
        </>
      ));

      replaced.value = true;
      await nextTick();
      expect(store.context.triggerElements.getById('trigger')).toBe(second);

      shown.value = false;
      await nextTick();
      expect(store.context.triggerElements.getById('trigger')).toBe(second);
      payload.value = 'stale';
      await nextTick();
      shown.value = true;
      await nextTick();
      expect(store.state.activeTriggerElement).toBe(second);
      expect(store.state.payload).toBe('second');
    });

    it('follows the number of triggers of an open popup while KeepAlive deactivates them', async () => {
      const store = createTestPopupStore();
      const Branch = createBranch(store);
      const showBranch = shallowRef(true);
      store.set('open', true);

      await render(() => (
        <KeepAlive>{showBranch.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
      ));
      expect(store.state.triggerCount).toBe(4);

      showBranch.value = false;
      await nextTick();
      expect(store.state.triggerCount).toBe(0);

      showBranch.value = true;
      await nextTick();
      expect(store.state.triggerCount).toBe(4);
    });

    it('VUE-22: hides a trigger entry from a held mount until the first activation', async () => {
      const store = createTestPopupStore();
      store.set('open', true);
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <RegisteredTrigger id="held" store={store} />
      ));
      await render(<HeldBranch />);

      await mountWhileHeld();
      expect(registeredIds(store)).toEqual([]);
      expect(store.state.triggerCount).toBe(0);

      await show();
      expect(registeredIds(store)).toEqual(['held']);
      expect(store.state.triggerCount).toBe(1);
    });

    it('removes the entry of a deactivated trigger when KeepAlive removes the trigger', async () => {
      const store = createTestPopupStore();
      const Branch = createBranch(store);
      const showBranch = shallowRef(true);
      const excluded = shallowRef<string | undefined>(undefined);

      await render(() => (
        <KeepAlive exclude={excluded.value}>
          {showBranch.value ? <Branch key="branch" /> : <Other key="other" />}
        </KeepAlive>
      ));

      showBranch.value = false;
      await nextTick();
      excluded.value = 'Branch';
      await nextTick();

      // `setActive` shows an entry that is still in the map.
      for (const id of ['s1', 'inner', 'outer', 's2']) {
        store.context.triggerElements.setActive(id, true);
      }
      expect(store.context.triggerElements.size).toBe(0);
    });

    // `KeepAlive` runs the `onActivated` hooks from the last part to the first part. A claim in the
    // activation would give the popup to the last trigger. The root picks the trigger instead.
    it('claims no open popup when KeepAlive activates the trigger', async () => {
      const store = createTestPopupStore();
      const showBranch = shallowRef(true);
      const Branch = defineComponent({
        name: 'Branch',
        setup: () => () => <RegisteredTrigger id="trigger" store={store} payload="from trigger" />,
      });

      await render(() => (
        <KeepAlive>{showBranch.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
      ));

      showBranch.value = false;
      await nextTick();
      store.set('open', true);
      await nextTick();

      expect(store.state.activeTriggerId).toBe(null);

      showBranch.value = true;
      await nextTick();

      expect(registeredIds(store)).toEqual(['trigger']);
      expect(store.state.triggerCount).toBe(1);
      expect(store.state.activeTriggerId).toBe(null);
      expect(store.state.payload).toBe(undefined);
    });

    it('keeps a deactivated trigger hidden when its handle gets a root, and shows it after the activation', async () => {
      const handle = new TestHandle();
      const rootStore = createTestPopupStore();
      const showBranch = shallowRef(true);
      const showRoot = shallowRef(false);
      rootStore.set('open', true);
      const Branch = defineComponent({
        name: 'Branch',
        setup: () => () => <DetachedTrigger id="detached" handle={handle} payload="from trigger" />,
      });

      await render(() => (
        <>
          <KeepAlive>
            {showBranch.value ? <Branch key="branch" /> : <Other key="other" />}
          </KeepAlive>
          {showRoot.value ? <HandleRoot handle={handle} store={rootStore} /> : null}
        </>
      ));

      showBranch.value = false;
      await nextTick();
      showRoot.value = true;
      await nextTick();

      expect(rootStore.context.triggerElements.size).toBe(0);
      expect(rootStore.state.activeTriggerId).toBe(null);

      showBranch.value = true;
      await nextTick();

      expect(rootStore.context.triggerElements.size).toBe(1);
      expect(rootStore.state.triggerCount).toBe(1);
    });
  });
});

describe('useTriggerDataForwarding', () => {
  const { render } = createRenderer();

  it('gives the payload of the trigger to the popup that the trigger owns, and follows a change of it', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');
    store.update({ open: true, mounted: true, activeTriggerId: 'trigger' });

    const { setProps } = await render(
      <TestForwardedTrigger id="trigger" store={store} element={element} payload="one" />,
    );

    expect(store.state.activeTriggerElement).toBe(element);
    expect(store.state.payload).toBe('one');

    await setProps({ payload: 'two' });

    expect(store.state.payload).toBe('two');
  });

  it('gives the data of the trigger to the new store when the store changes and the trigger still owns the popup', async () => {
    const first = createTestPopupStore();
    const second = createTestPopupStore();
    const element = document.createElement('button');
    // Both popups are closed and mounted for the same trigger. The registration gives no payload to
    // a closed popup, and `isMountedByThisTrigger` stays `true` when the store changes.
    first.update({ mounted: true, activeTriggerId: 'trigger' });
    second.update({ mounted: true, activeTriggerId: 'trigger' });

    const { setProps } = await render(
      <TestForwardedTrigger id="trigger" store={first} element={element} payload="payload" />,
    );
    expect(first.state.payload).toBe('payload');
    expect(second.state.payload).toBe(undefined);

    await setProps({ store: second });

    expect(second.state.payload).toBe('payload');
    expect(second.state.activeTriggerElement).toBe(element);
  });

  it('gives the payload of the trigger to a popup that is still mounted while it closes', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');
    store.update({ mounted: true, activeTriggerId: 'trigger' });

    await render(
      <TestForwardedTrigger id="trigger" store={store} element={element} payload="from trigger" />,
    );

    expect(store.state.activeTriggerElement).toBe(element);
    expect(store.state.payload).toBe('from trigger');
  });

  it('claims an open popup that has no active trigger', async () => {
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

  it('does not claim a popup that opened without a trigger', async () => {
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

  it('gives the element but no payload to a closed popup that the trigger opened last', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');
    store.set('activeTriggerId', 'trigger');

    await render(
      <TestForwardedTrigger id="trigger" store={store} element={element} payload="from trigger" />,
    );

    expect(store.state.activeTriggerElement).toBe(element);
    expect(store.state.payload).toBeUndefined();
  });

  it('gives the element and the payload of the active trigger to an open popup that is not mounted', async () => {
    const store = createTestPopupStore();
    const element = document.createElement('button');
    // The popup is not mounted, so only the registration of the trigger can give the payload.
    store.update({ open: true, activeTriggerId: 'trigger' });

    await render(
      <TestForwardedTrigger id="trigger" store={store} element={element} payload="from trigger" />,
    );

    expect(store.state.activeTriggerElement).toBe(element);
    expect(store.state.payload).toBe('from trigger');
  });

  it('gives the payload of the active trigger when two triggers share one popup', async () => {
    const store = createTestPopupStore();
    const first = document.createElement('button');
    const second = document.createElement('button');
    store.update({ open: true, mounted: true, activeTriggerId: 'first' });

    await render(
      <>
        <TestForwardedTrigger id="first" store={store} element={first} payload="one" />
        <TestForwardedTrigger id="second" store={store} element={second} payload="two" />
      </>,
    );

    expect(store.state.payload).toBe('one');
    expect(store.state.activeTriggerElement).toBe(first);

    store.set('activeTriggerId', 'second');
    await nextTick();

    expect(store.state.payload).toBe('two');
    expect(store.state.activeTriggerElement).toBe(second);
  });

  it('VUE-22: lets a shown trigger claim the popup before a held trigger activates', async () => {
    const store = createTestPopupStore();
    const heldElement = document.createElement('button');
    const shownElement = document.createElement('button');
    store.update({ open: true, mounted: true });
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
      <TestForwardedTrigger id="held" store={store} element={heldElement} payload="held" />
    ));
    const hasShownTrigger = shallowRef(false);
    await render(() => (
      <>
        <HeldBranch />
        {hasShownTrigger.value ? (
          <TestForwardedTrigger id="shown" store={store} element={shownElement} payload="shown" />
        ) : null}
      </>
    ));

    await mountWhileHeld();
    expect(store.state.activeTriggerId).toBe(null);

    hasShownTrigger.value = true;
    await nextTick();
    expect(store.state.activeTriggerId).toBe('shown');
    expect(store.state.payload).toBe('shown');

    await show();
    expect(store.state.activeTriggerId).toBe('shown');
    expect(store.state.activeTriggerElement).toBe(shownElement);
  });

  describe('for a detached trigger of a handle', () => {
    it('registers in the store that the handle gives, and gives its payload to the root', async () => {
      const handle = new TestHandle();
      const rootStore = createTestPopupStore();
      const showRoot = shallowRef(false);
      rootStore.update({ open: true, mounted: true, activeTriggerId: 'detached' });

      await render(() => (
        <>
          <DetachedTrigger id="detached" handle={handle} payload="from trigger" />
          {showRoot.value ? <HandleRoot handle={handle} store={rootStore} /> : null}
        </>
      ));
      const button = document.getElementById('detached');

      expect(handle.inertStore.context.triggerElements.getById('detached')).toBe(button);
      expect(rootStore.state.payload).toBeUndefined();

      showRoot.value = true;
      await nextTick();

      expect(handle.inertStore.context.triggerElements.getById('detached')).toBeUndefined();
      expect(rootStore.context.triggerElements.getById('detached')).toBe(button);
      expect(rootStore.state.triggerCount).toBe(1);
      expect(rootStore.state.payload).toBe('from trigger');

      showRoot.value = false;
      await nextTick();

      expect(rootStore.context.triggerElements.getById('detached')).toBeUndefined();
      expect(handle.inertStore.context.triggerElements.getById('detached')).toBe(button);
    });

    it('keeps the order of the triggers when a root attaches to their handle and detaches', async () => {
      const handle = new TestHandle();
      const rootStore = createTestPopupStore();
      const showRoot = shallowRef(false);
      const idsOfInertStore = () =>
        Array.from(handle.inertStore.context.triggerElements.entries(), ([id]) => id);

      await render(() => (
        <>
          <DetachedTrigger id="s1" handle={handle} />
          <DetachedTrigger id="outer" handle={handle}>
            <DetachedTrigger id="inner" handle={handle} />
          </DetachedTrigger>
          <DetachedTrigger id="s2" handle={handle} />
          {showRoot.value ? <HandleRoot handle={handle} store={rootStore} /> : null}
        </>
      ));
      expect(idsOfInertStore()).toEqual(['s1', 'inner', 'outer', 's2']);

      showRoot.value = true;
      await nextTick();
      expect(registeredIds(rootStore)).toEqual(['s1', 'inner', 'outer', 's2']);

      showRoot.value = false;
      await nextTick();
      expect(idsOfInertStore()).toEqual(['s1', 'inner', 'outer', 's2']);
    });
  });
});

describe('popupId selector', () => {
  // The `setState` of `BasePopupStore` copies the `id` of the popup element to the state, and a bare
  // store has no such step.
  function createBasePopupStore() {
    class PopupStore extends BasePopupStore<
      PopupStoreState<unknown>,
      PopupStoreContext<PopupOpenChangeEventDetails>,
      PopupStoreSelectors,
      PopupOpenChangeEventDetails
    > {}
    return new PopupStore(
      createInitialPopupStoreState(),
      createPopupStoreContext(),
      popupStoreSelectors,
    );
  }

  it('omits the popup id when the default popup id is empty', () => {
    const store = createTestPopupStore();

    store.set('defaultPopupId', '');

    expect(store.select('popupId')).toBeUndefined();
  });

  it('prefers an explicit popup element id over the default popup id', () => {
    const store = createBasePopupStore();
    const popupElement = document.createElement('div');
    popupElement.id = 'explicit-popup-id';

    store.update({
      open: true,
      activeTriggerId: 'trigger',
      defaultPopupId: 'generated-popup-id',
      popupElement,
    });

    expect(store.select('popupId')).toBe('explicit-popup-id');
  });

  describe('VUE-73: the popup id is the id of the popup element', () => {
    it('gives no popup id while no popup element exists', () => {
      const store = createTestPopupStore();

      store.update({ open: true, defaultPopupId: 'popup-id', triggerCount: 1 });

      expect(store.select('popupId')).toBeUndefined();
      expect(store.select('triggerPopupId', 'trigger')).toBeUndefined();
    });

    it('gives a lone trigger the id of the popup element unless the popup opened without a trigger', () => {
      const store = createBasePopupStore();
      const popupElement = document.createElement('div');
      popupElement.id = 'popup-id';

      store.update({
        open: true,
        defaultPopupId: 'generated-popup-id',
        triggerCount: 1,
        popupElement,
      });
      expect(store.select('triggerPopupId', 'trigger')).toBe('popup-id');

      store.set('openedWithoutTrigger', true);
      expect(store.select('triggerPopupId', 'trigger')).toBeUndefined();
    });
  });
});

describe('usePopupInteractionProps', () => {
  const { render } = createRenderer();

  it('clears stored interaction props when unmounting', async () => {
    const store = createTestPopupStore();
    const activeTriggerProps = interactionProps({ onClick: vi.fn() });
    const inactiveTriggerProps = interactionProps({ onKeydown: vi.fn() });
    const popupProps = interactionProps({ onPointerdown: vi.fn() });

    const { unmount } = await render(
      <PopupInteractionPropsTest
        store={store}
        activeTriggerProps={activeTriggerProps}
        inactiveTriggerProps={inactiveTriggerProps}
        popupProps={popupProps}
      />,
    );

    expect(triggerBindings(store, true)).toBe(activeTriggerProps);
    expect(triggerBindings(store, false)).toBe(inactiveTriggerProps);
    expect(popupBindings(store)).toBe(popupProps);

    unmount();

    expect(triggerBindings(store, true)).not.toBe(activeTriggerProps);
    expect(triggerBindings(store, true)).toEqual({});
    expect(triggerBindings(store, false)).not.toBe(inactiveTriggerProps);
    expect(triggerBindings(store, false)).toEqual({});
    expect(popupBindings(store)).not.toBe(popupProps);
    expect(popupBindings(store)).toEqual({});
  });

  it('writes the props again when a source of the getter changes', async () => {
    const store = createTestPopupStore();
    const first = interactionProps({ onClick: vi.fn() });
    const second = interactionProps({ onClick: vi.fn() });
    const other = interactionProps({});

    const { setProps } = await render(
      <PopupInteractionPropsTest
        store={store}
        activeTriggerProps={first}
        inactiveTriggerProps={other}
        popupProps={other}
      />,
    );
    expect(triggerBindings(store, true)).toBe(first);

    await setProps({ activeTriggerProps: second });

    expect(triggerBindings(store, true)).toBe(second);
    expect(popupBindings(store)).toBe(other);
  });

  it('writes the props in setup, so a part below the root gets them in its first render', async () => {
    const store = createTestPopupStore();
    const popupProps = interactionProps({ onPointerdown: vi.fn() });
    const seen: unknown[] = [];

    const Reader = defineComponent(() => {
      const props = computed(() => popupBindings(store));
      return () => {
        seen.push(props.value);
        return null;
      };
    });
    const Root = defineComponent(() => {
      bindPopupParts(store, { trigger: () => popupProps, popup: () => popupProps });
      return () => <Reader />;
    });

    await render(<Root />);

    expect(seen).toEqual([popupProps]);
  });
});

describe('createDefaultInitialFocus', () => {
  it.each<{ name: string; type: InteractionType; focuses: boolean }>([
    { name: 'a touch', type: 'touch', focuses: true },
    { name: 'a mouse press', type: 'mouse', focuses: false },
    { name: 'a pen press', type: 'pen', focuses: false },
    { name: 'a key press', type: 'keyboard', focuses: false },
    { name: 'an unknown input', type: '', focuses: false },
  ])(
    'gives the default focus after $name, and focuses the popup only after a touch',
    ({ type, focuses }) => {
      const popupRef = shallowRef<HTMLElement | null>(null);
      const initialFocus = createDefaultInitialFocus(popupRef);
      const popup = document.createElement('div');
      // The function reads the popup when it runs, and not when the root makes it.
      popupRef.value = popup;

      expect(initialFocus(type)).toBe(focuses ? popup : true);
    },
  );
});
