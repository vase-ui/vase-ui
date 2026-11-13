import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, isReactive, isRef, nextTick, shallowRef, watch } from 'vue';
import { createRenderer } from '#test-utils';
import { NullStore } from './NullStore';
import { ReactiveStore } from './ReactiveStore';

describe('ReactiveStore', () => {
  const { render } = createRenderer();

  it('renders a part that reads a selector in a computed again only when the value of the selector changes', async () => {
    interface State {
      open: boolean;
      openProp: boolean | undefined;
      activeTriggerId: string | undefined;
      payload: unknown;
    }
    const selectors = {
      open: (state: State) => state.openProp ?? state.open,
    };
    const store = new ReactiveStore<State, Record<string, never>, typeof selectors>(
      { open: false, openProp: undefined, activeTriggerId: undefined, payload: undefined },
      undefined,
      selectors,
    );
    let renders = 0;
    const Reader = defineComponent(() => {
      const open = computed(() => store.select('open'));
      return () => {
        renders += 1;
        return <output>{String(open.value)}</output>;
      };
    });

    const { container } = await render(<Reader />);
    expect(renders).toBe(1);

    store.set('payload', { name: 'first' });
    store.set('activeTriggerId', 'trigger');
    await nextTick();
    expect(renders).toBe(1);

    store.set('openProp', false);
    await nextTick();
    expect(renders).toBe(1);

    // The controlled `false` hides this request.
    store.set('open', true);
    await nextTick();
    expect(renders).toBe(1);

    store.set('openProp', undefined);
    await nextTick();
    expect(renders).toBe(2);
    expect(container.querySelector('output')!.textContent).toBe('true');
  });

  it('follows the argument and the state of a selector that a computed reads', async () => {
    interface State {
      values: Record<string, string>;
    }
    const selectors = {
      valueByKey: (state: State, valueKey: string) => state.values[valueKey],
    };
    const store = new ReactiveStore<State, Record<string, never>, typeof selectors>(
      { values: { first: 'one', second: 'two' } },
      undefined,
      selectors,
    );
    const valueKey = shallowRef('first');
    const Reader = defineComponent(() => {
      const value = computed(() => store.select('valueByKey', valueKey.value));
      return () => <output>{value.value}</output>;
    });

    const { container } = await render(<Reader />);
    const output = container.querySelector('output')!;
    expect(output.textContent).toBe('one');

    valueKey.value = 'second';
    await nextTick();
    expect(output.textContent).toBe('two');

    store.update({ values: { first: 'one', second: 'changed' } });
    await nextTick();
    expect(output.textContent).toBe('changed');
  });

  interface ElementState {
    element: Element | null;
    other: number;
  }

  // Vue calls a function ref during the render of the part. A read of the state in the callback would
  // make that render depend on the state.
  it.each([
    {
      name: 'set',
      write: (store: ReactiveStore<ElementState>, element: Element | null) =>
        store.set('element', element),
    },
    {
      name: 'update',
      write: (store: ReactiveStore<ElementState>, element: Element | null) =>
        store.update({ element }),
    },
  ])(
    'adds no dependency to the render of a part when its ref callback calls $name',
    async ({ write }) => {
      const store = new ReactiveStore<ElementState>({ element: null, other: 0 });
      let renders = 0;
      const Part = defineComponent(() => () => {
        renders += 1;
        return <div ref={(element) => write(store, element as Element | null)} />;
      });

      const { container } = await render(<Part />);
      expect(store.state.element).toBe(container.firstElementChild);
      expect(renders).toBe(1);

      store.set('other', 1);
      await nextTick();
      expect(renders).toBe(1);
    },
  );

  it('keeps the value that a sync watcher writes to another key during an update', () => {
    const store = new ReactiveStore({ a: 0, b: 0, c: 0 });
    const stop = watch(
      () => store.state.a,
      () => {
        store.set('c', 9);
      },
      { flush: 'sync' },
    );

    store.update({ a: 1 });
    stop();

    expect({ ...store.state }).toEqual({ a: 1, b: 0, c: 9 });
  });

  it('sends each write of set and update to an override of setState with the full state', () => {
    interface State {
      a: number;
      b: number;
    }
    class RecordingStore extends ReactiveStore<State> {
      readonly writes: State[] = [];

      setState(newState: State) {
        this.writes.push(newState);
        super.setState(newState);
      }
    }
    const store = new RecordingStore({ a: 0, b: 0 });

    store.set('a', 1);
    store.update({ b: 2 });

    expect(store.writes).toEqual([
      { a: 1, b: 0 },
      { a: 1, b: 2 },
    ]);
  });

  it('keeps the identity of an object, an element and a ref', () => {
    const payload = { nested: { list: [1] } };
    const element = document.createElement('div');
    const props = { onClick() {} };
    const store = new ReactiveStore<{ payload: unknown; element: Element; props: object }>({
      payload,
      element,
      props,
    });

    expect(store.state.payload).toBe(payload);
    expect((store.state.payload as typeof payload).nested).toBe(payload.nested);
    expect(store.state.element).toBe(element);
    expect(store.state.props).toBe(props);

    const payloadRef = shallowRef(payload);
    store.set('payload', payloadRef);

    expect(store.state.payload).toBe(payloadRef);
    expect(isRef(store.state.payload)).toBe(true);
  });

  it('calls no selector when no part reads the store, and none after the reader unmounts', async () => {
    const open = vi.fn((state: { open: boolean }) => state.open);
    const store = new ReactiveStore({ open: false }, undefined, { open });
    const Reader = defineComponent(() => {
      const value = computed(() => store.select('open'));
      return () => <output>{String(value.value)}</output>;
    });

    store.set('open', true);
    expect(open).not.toHaveBeenCalled();

    const { unmount } = await render(<Reader />);
    expect(open).toHaveBeenCalledTimes(1);

    store.set('open', false);
    await nextTick();
    expect(open).toHaveBeenCalledTimes(2);

    unmount();
    store.set('open', true);
    await nextTick();
    expect(open).toHaveBeenCalledTimes(2);
  });
});

describe('NullStore', () => {
  it('takes no write and gives no reactive state', () => {
    interface State {
      value: string;
    }
    const selectors = {
      value: (state: Readonly<State>) => state.value,
    };
    const store = new NullStore<Readonly<State>, Record<string, never>, typeof selectors>(
      Object.freeze({ value: 'initial' }),
      Object.freeze({}),
      selectors,
    );

    expect(() => {
      store.set('value', 'set');
      store.update({ value: 'update' });
      store.setState({ value: 'setState' });
    }).not.toThrow();

    expect(store.select('value')).toBe('initial');
    expect(isReactive(store.state)).toBe(false);
  });
});
