import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, nextTick, onMounted, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, ShallowRef } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import type { ToastManager } from '../createToastManager';
import { Toast } from '@vase-ui/vue/toast';
import type { ToastStore } from '../store';
import { useToastProviderContext } from './ToastProviderContext';

describe('<Toast.Provider />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function tick(ms: number) {
    vi.advanceTimersByTime(ms);
    await flushMicrotasks();
  }

  function createStoreProbe() {
    const probe: { store?: ToastStore } = {};
    const Probe = defineComponent({
      setup() {
        probe.store = useToastProviderContext();
        return () => null;
      },
    });
    return { probe, Probe };
  }

  it('syncs a changed timeout before descendant layout effects', async () => {
    const onClose = vi.fn();

    const AddToastInLayoutEffect = defineComponent({
      props: { active: { type: Boolean, required: true } },
      setup(props) {
        const { add } = Toast.useToastManager();

        function addToast() {
          if (props.active) {
            add({ id: 'toast', title: 'Toast', onClose });
          }
        }

        onMounted(addToast);
        watch(() => props.active, addToast, { flush: 'post' });

        return () => null;
      },
    });

    const App = defineComponent({
      props: {
        timeout: { type: Number, required: true },
        addToast: { type: Boolean, required: true },
      },
      setup(props) {
        return () => (
          <Toast.Provider timeout={props.timeout}>
            <AddToastInLayoutEffect active={props.addToast} />
          </Toast.Provider>
        );
      },
    });

    const { setProps } = await render(<App timeout={5000} addToast={false} />);

    await setProps({ timeout: 1000, addToast: true });

    await tick(999);
    expect(onClose).not.toHaveBeenCalled();

    await tick(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('syncs a changed limit before descendant layout effects', async () => {
    const observeToasts = vi.fn();

    const AddToastsInLayoutEffect = defineComponent({
      props: { active: { type: Boolean, required: true } },
      setup(props) {
        const { add } = Toast.useToastManager();

        function addToasts() {
          if (props.active) {
            add({ id: 'first', title: 'First', timeout: 0 });
            add({ id: 'second', title: 'Second', timeout: 0 });
          }
        }

        onMounted(addToasts);
        watch(() => props.active, addToasts, { flush: 'post' });

        return () => null;
      },
    });

    const ObserveToastsInLayoutEffect = defineComponent({
      props: { active: { type: Boolean, required: true } },
      setup(props) {
        const store = useToastProviderContext();

        function observeToastsOfStore() {
          if (props.active) {
            observeToasts(
              store.state.toasts.map((toast) => ({
                id: toast.id,
                limited: toast.limited,
              })),
            );
          }
        }

        onMounted(observeToastsOfStore);
        watch(() => props.active, observeToastsOfStore, { flush: 'post' });

        return () => null;
      },
    });

    const App = defineComponent({
      props: {
        limit: { type: Number, required: true },
        runEffects: { type: Boolean, required: true },
      },
      setup(props) {
        return () => (
          <Toast.Provider limit={props.limit}>
            <AddToastsInLayoutEffect active={props.runEffects} />
            <ObserveToastsInLayoutEffect active={props.runEffects} />
          </Toast.Provider>
        );
      },
    });

    const { setProps } = await render(<App limit={3} runEffects={false} />);

    await setProps({ limit: 1, runEffects: true });

    expect(observeToasts).toHaveBeenCalledWith([
      { id: 'second', limited: false },
      { id: 'first', limited: true },
    ]);
  });

  describe('prop: toastManager', () => {
    it('forwards the add, update, promise and close of the manager to the toasts', async () => {
      const manager = Toast.createToastManager();
      const { probe, Probe } = createStoreProbe();
      await render(
        <Toast.Provider toastManager={manager}>
          <Probe />
        </Toast.Provider>,
      );

      const id = manager.add({ title: 'Saving', timeout: 0 });

      expect(probe.store!.state.toasts.map((toast) => toast.id)).toEqual([id]);

      manager.update(id, { title: 'Saved' });

      expect(probe.store!.state.toasts[0].title).toBe('Saved');

      const settled = manager.promise(Promise.resolve('result'), {
        loading: 'Loading',
        success: (value) => ({ title: value }),
        error: 'Failed',
      });

      expect(probe.store!.state.toasts[0]).toMatchObject({
        type: 'loading',
        description: 'Loading',
      });

      await settled;

      expect(probe.store!.state.toasts[0]).toMatchObject({ type: 'success', title: 'result' });

      manager.close();

      expect(probe.store!.state.toasts.map((toast) => toast.transitionStatus)).toEqual([
        'ending',
        'ending',
      ]);
    });

    it('listens to the manager that it gets after the mount, and no longer to the old one', async () => {
      const first = Toast.createToastManager();
      const second = Toast.createToastManager();
      const { probe, Probe } = createStoreProbe();
      const { setProps } = await render(
        <Toast.Provider toastManager={first}>
          <Probe />
        </Toast.Provider>,
      );

      await setProps({ toastManager: second });
      first.add({ title: 'from the first manager', timeout: 0 });

      expect(probe.store!.state.toasts).toHaveLength(0);

      second.add({ title: 'from the second manager', timeout: 0 });

      expect(probe.store!.state.toasts).toHaveLength(1);
    });

    it('stops listening to the manager when it unmounts', async () => {
      const manager = Toast.createToastManager();
      const { probe, Probe } = createStoreProbe();
      const { unmount } = await render(
        <Toast.Provider toastManager={manager}>
          <Probe />
        </Toast.Provider>,
      );

      unmount();
      manager.add({ title: 'after the unmount', timeout: 0 });

      expect(probe.store!.state.toasts).toHaveLength(0);
    });
  });

  describe('KeepAlive', () => {
    const Other = defineComponent({ name: 'Other', setup: () => () => <p /> });

    function renderKept(manager: MaybeRefOrGetter<ToastManager>, visible: ShallowRef<boolean>) {
      const { probe, Probe } = createStoreProbe();
      const Page = defineComponent({
        name: 'Page',
        setup: () => () => (
          <Toast.Provider toastManager={toValue(manager)}>
            <Probe />
          </Toast.Provider>
        ),
      });
      const rendered = render(() => (
        <KeepAlive>{visible.value ? <Page key="page" /> : <Other key="other" />}</KeepAlive>
      ));
      return { probe, rendered };
    }

    it('does not listen to the manager while it is deactivated, and listens again after it', async () => {
      const manager = Toast.createToastManager();
      const visible = shallowRef(true);
      const { probe, rendered } = renderKept(manager, visible);
      await rendered;

      visible.value = false;
      await nextTick();
      manager.add({ title: 'while deactivated', timeout: 0 });
      visible.value = true;
      await nextTick();

      expect(probe.store!.state.toasts).toHaveLength(0);

      manager.add({ title: 'after the activation', timeout: 0 });

      expect(probe.store!.state.toasts).toHaveLength(1);
    });

    it('does not listen to a manager that it gets while it is deactivated, and listens to it after the activation', async () => {
      const second = Toast.createToastManager();
      const manager = shallowRef(Toast.createToastManager());
      const visible = shallowRef(true);
      const { probe, rendered } = renderKept(manager, visible);
      await rendered;

      visible.value = false;
      await nextTick();
      manager.value = second;
      await nextTick();
      second.add({ title: 'while deactivated', timeout: 0 });

      expect(probe.store!.state.toasts).toHaveLength(0);

      visible.value = true;
      await nextTick();
      second.add({ title: 'after the activation', timeout: 0 });

      expect(probe.store!.state.toasts).toHaveLength(1);
    });
  });

  describe('React.Activity', () => {
    const ToastList = defineComponent({
      setup() {
        const { toasts } = Toast.useToastManager();
        return () =>
          toasts.value.map((toast) => (
            <Toast.Root key={toast.id} toast={toast}>
              <Toast.Title />
            </Toast.Root>
          ));
      },
    });

    // The real pointer of the browser can rest on the viewport. A dispatched event still reaches the
    // viewport, and the real pointer sends no event of its own.
    const noRealPointer = { pointerEvents: 'none' } as const;

    function renderApp(toastManager: ToastManager, visible: ShallowRef<boolean>) {
      const Page = defineComponent({
        name: 'Page',
        setup: () => () => (
          <Toast.Provider toastManager={toastManager}>
            <Toast.Viewport data-testid="viewport" style={noRealPointer}>
              <ToastList />
            </Toast.Viewport>
          </Toast.Provider>
        ),
      });
      const Hidden = defineComponent({ name: 'Hidden', setup: () => () => <p /> });

      return render(() => (
        <KeepAlive>{visible.value ? <Page key="page" /> : <Hidden key="hidden" />}</KeepAlive>
      ));
    }

    async function setVisible(visible: ShallowRef<boolean>, value: boolean) {
      visible.value = value;
      await nextTick();
    }

    it('pauses the auto-dismiss timer while hidden and resumes it with the remaining time once revealed', async () => {
      const onClose = vi.fn();
      const toastManager = Toast.createToastManager();
      const visible = shallowRef(true);
      await renderApp(toastManager, visible);

      toastManager.add({ title: 'Toast', timeout: 1000, onClose });
      await flushMicrotasks();

      vi.advanceTimersByTime(400);
      await setVisible(visible, false);

      await tick(5000);
      expect(onClose).not.toHaveBeenCalled();

      await setVisible(visible, true);

      await tick(599);
      expect(onClose).not.toHaveBeenCalled();

      await tick(2);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps the timer paused after reveal while the viewport is still hovered', async () => {
      const onClose = vi.fn();
      const toastManager = Toast.createToastManager();
      const visible = shallowRef(true);
      await renderApp(toastManager, visible);

      toastManager.add({ title: 'Toast', timeout: 1000, onClose });
      await flushMicrotasks();

      await fireEvent.mouseEnter(screen.getByTestId('viewport'));
      expect(screen.getByTestId('viewport')).toHaveAttribute('data-expanded');

      await setVisible(visible, false);
      await setVisible(visible, true);

      await tick(2000);
      expect(onClose).not.toHaveBeenCalled();

      await fireEvent.mouseLeave(screen.getByTestId('viewport'));

      await tick(1001);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not start the timer of a toast updated while hidden until it is revealed', async () => {
      const onClose = vi.fn();
      const toastManager = Toast.createToastManager();
      const visible = shallowRef(true);
      await renderApp(toastManager, visible);

      let resolvePromise: (value: string) => void = () => {};
      void toastManager.promise(
        new Promise<string>((resolve) => {
          resolvePromise = resolve;
        }),
        {
          loading: 'loading',
          success: { title: 'success', timeout: 1000, onClose },
          error: 'error',
        },
      );
      await flushMicrotasks();

      await setVisible(visible, false);

      // The promise settles while hidden, which gives the toast a timer.
      resolvePromise('done');
      await flushMicrotasks();

      await tick(5000);
      expect(onClose).not.toHaveBeenCalled();

      await setVisible(visible, true);

      await tick(1001);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
