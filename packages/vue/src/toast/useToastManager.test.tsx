import { describe, expect, it } from 'vitest';
import { defineComponent, provide } from 'vue';
import { createRenderer, flushMicrotasks, screen, takeReportedMessages } from '#test-utils';
import { ToastContext } from './provider/ToastProviderContext';
import { ToastStore } from './store';
import { useToastManager } from './useToastManager';
import type { UseToastManagerReturnValue } from './useToastManager';

function createStore() {
  return new ToastStore({
    toasts: [],
    timeout: 0,
    limit: 3,
    hovering: false,
    focused: false,
    isWindowFocused: true,
    viewport: null,
    prevFocusElement: null,
  });
}

describe('useToastManager', () => {
  const { render } = createRenderer();

  const ToastTitles = defineComponent({
    props: { onManager: { type: Function, required: true } },
    setup(props) {
      const manager = useToastManager();
      props.onManager(manager);
      return () => (
        <ul>
          {manager.toasts.value.map((toast) => (
            <li key={toast.id}>{toast.title}</li>
          ))}
        </ul>
      );
    },
  });

  function createScope(store: ToastStore) {
    return defineComponent({
      setup(_, { slots }) {
        provide(ToastContext, store);
        return () => slots.default?.();
      },
    });
  }

  it('gives the toasts of the store as a ref that a render follows', async () => {
    const store = createStore();
    const Scope = createScope(store);
    let manager: UseToastManagerReturnValue | undefined;

    await render(
      <Scope>
        <ToastTitles
          onManager={(value: UseToastManagerReturnValue) => {
            manager = value;
          }}
        />
      </Scope>,
    );

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

    const id = manager!.add({ title: 'First' });
    store.addToast({ title: 'Second' });
    await flushMicrotasks();

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Second',
      'First',
    ]);

    manager!.update(id, { title: 'First, updated' });
    await flushMicrotasks();

    expect(screen.getAllByRole('listitem')[1].textContent).toBe('First, updated');

    manager!.close();
    await flushMicrotasks();

    expect(manager!.toasts.value.map((toast) => toast.transitionStatus)).toEqual([
      'ending',
      'ending',
    ]);
  });

  it('gives the methods of the store of the nearest provider', async () => {
    const outerStore = createStore();
    const innerStore = createStore();
    const Outer = createScope(outerStore);
    const Inner = createScope(innerStore);
    let manager: UseToastManagerReturnValue | undefined;

    await render(
      <Outer>
        <Inner>
          <ToastTitles
            onManager={(value: UseToastManagerReturnValue) => {
              manager = value;
            }}
          />
        </Inner>
      </Outer>,
    );

    manager!.add({ title: 'Inner' });

    expect(innerStore.state.toasts).toHaveLength(1);
    expect(outerStore.state.toasts).toHaveLength(0);
  });

  // A case that throws in `setup` is the last case of its file.
  it('throws an error that names the provider when no provider is above it', async () => {
    await expect(render(<ToastTitles onManager={() => {}} />)).rejects.toThrow(
      'Vase UI: No <Toast.Provider> is above this component. `useToastManager` and each part of Toast read the toasts of the provider. Put the component inside <Toast.Provider>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
