import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, h, KeepAlive, nextTick, onMounted, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import ToastTextList from '../../../test/fixtures/ToastTextList.vue';
import type { ToastManager } from '../createToastManager';
import * as Toast from '../index.parts';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import type { ToastStore } from '../store';
import ToastViewportHydration from './ToastViewportHydration.test.vue';

const HYDRATION_FILE = 'src/toast/viewport/ToastViewportHydration.test.vue';

// The real pointer of the browser can rest on the viewport. A dispatched event still reaches the
// viewport, and the real pointer sends no event of its own.
const noRealPointer = { pointerEvents: 'none' } as const;

describe('<Toast.Viewport />', () => {
  const { render } = createRenderer();

  // The nodes of the viewport itself, its focus guards, render while there is a toast and a place
  // to return the focus to.
  const GuardsOpener = defineComponent({
    setup() {
      const store = useToastProviderContext();
      onMounted(() => {
        store.addToast({ title: 'toast', timeout: 0 });
        store.set('prevFocusElement', document.body);
      });
      return () => null;
    },
  });

  describeConformance(<Toast.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    childrenSelector: '[data-vase-ui-focus-guard]',
    render(node) {
      return render(
        <Toast.Provider>
          <GuardsOpener />
          {node}
        </Toast.Provider>,
      );
    },
  }));

  function renderViewport(
    manager: ToastManager,
    providerProps: { timeout?: number; limit?: number } = {},
  ) {
    return render(
      <Toast.Provider toastManager={manager} {...providerProps}>
        <button type="button" data-testid="origin">
          origin
        </button>
        <Toast.Viewport data-testid="viewport" style={noRealPointer}>
          <ToastTextList />
        </Toast.Viewport>
      </Toast.Provider>,
    );
  }

  it('renders a region that announces the additions politely', async () => {
    await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport" />
      </Toast.Provider>,
    );

    const viewport = screen.getByTestId('viewport');
    expect(viewport).toHaveAttribute('role', 'region');
    expect(viewport).toHaveAttribute('aria-live', 'polite');
    expect(viewport).toHaveAttribute('aria-atomic', 'false');
    expect(viewport).toHaveAttribute('aria-relevant', 'additions text');
    expect(viewport).toHaveAttribute('aria-label', 'Notifications');
    expect(viewport).toHaveAttribute('tabindex', '-1');
  });

  it('sets the height of the frontmost toast as a CSS variable', async () => {
    const manager = Toast.createToastManager();
    await renderViewport(manager);

    manager.add({ id: 'first', title: 'First', timeout: 0 });
    await flushMicrotasks();

    expect(screen.getByTestId('viewport').style.getPropertyValue('--toast-frontmost-height')).toBe(
      `${screen.getByTestId('first').offsetHeight}px`,
    );
  });

  describe('timers', () => {
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

    it('pauses the timers and expands the viewport on hover, and resumes them on leave', async () => {
      const onClose = vi.fn();
      const manager = Toast.createToastManager();
      await renderViewport(manager);
      manager.add({ title: 'toast', timeout: 1000, onClose });
      await flushMicrotasks();
      const viewport = screen.getByTestId('viewport');

      await fireEvent.mouseEnter(viewport);

      expect(viewport).toHaveAttribute('data-expanded');
      await tick(5000);
      expect(onClose).not.toHaveBeenCalled();

      await fireEvent.mouseLeave(viewport);

      expect(viewport).not.toHaveAttribute('data-expanded');
      await tick(1001);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps the viewport expanded until the toasts that are leaving are gone', async () => {
      const manager = Toast.createToastManager();
      let store!: ToastStore;
      const Probe = defineComponent({
        setup() {
          store = useToastProviderContext();
          return () => null;
        },
      });
      await render(
        <Toast.Provider toastManager={manager}>
          <Probe />
          <Toast.Viewport data-testid="viewport" style={noRealPointer} />
        </Toast.Provider>,
      );
      manager.add({ id: 'leaving', title: 'toast', timeout: 0 });
      manager.add({ id: 'staying', title: 'toast', timeout: 0 });
      manager.close('leaving');
      await flushMicrotasks();
      const viewport = screen.getByTestId('viewport');

      await fireEvent.mouseEnter(viewport);
      await fireEvent.mouseLeave(viewport);

      expect(viewport).toHaveAttribute('data-expanded');

      store.removeToast('leaving');
      await flushMicrotasks();

      expect(viewport).not.toHaveAttribute('data-expanded');
    });

    it('collapses on the next mouseover outside the viewport, when no mouseleave comes', async () => {
      const manager = Toast.createToastManager();
      await renderViewport(manager);
      manager.add({ title: 'toast', timeout: 0 });
      await flushMicrotasks();
      const viewport = screen.getByTestId('viewport');

      await fireEvent.mouseEnter(viewport);
      await fireEvent.mouseOver(viewport);

      expect(viewport).toHaveAttribute('data-expanded');

      await fireEvent.mouseOver(document.body);

      expect(viewport).not.toHaveAttribute('data-expanded');
    });

    it('keeps the viewport expanded during a touch gesture, and collapses it when the gesture ends', async () => {
      const manager = Toast.createToastManager();
      await renderViewport(manager);
      manager.add({ title: 'toast', timeout: 0 });
      await flushMicrotasks();
      const viewport = screen.getByTestId('viewport');

      await fireEvent.mouseEnter(viewport);
      await fireEvent.pointerDown(viewport, { pointerType: 'touch', pointerId: 1 });
      await fireEvent.mouseLeave(viewport);

      expect(viewport).toHaveAttribute('data-expanded');

      await fireEvent.pointerUp(viewport, { pointerType: 'touch', pointerId: 1 });

      expect(viewport).not.toHaveAttribute('data-expanded');
    });

    it('pauses the timers while the window is blurred, and resumes them when it is focused', async () => {
      const onClose = vi.fn();
      const manager = Toast.createToastManager();
      await renderViewport(manager);
      manager.add({ title: 'toast', timeout: 1000, onClose });
      await flushMicrotasks();

      window.dispatchEvent(new FocusEvent('blur'));
      await tick(5000);

      expect(onClose).not.toHaveBeenCalled();

      window.dispatchEvent(new FocusEvent('focus'));
      await tick(1);
      await tick(1001);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('starts the timer of a toast that a blurred window gets as paused, and runs it when the window is focused', async () => {
      const onClose = vi.fn();
      const manager = Toast.createToastManager();
      await renderViewport(manager);

      window.dispatchEvent(new FocusEvent('blur'));
      manager.add({ title: 'toast', timeout: 1000, onClose });
      await tick(5000);

      expect(onClose).not.toHaveBeenCalled();

      window.dispatchEvent(new FocusEvent('focus'));
      await tick(1);
      await tick(1001);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('BUG-6174: keeps the timers running when the focus goes into a frame of the page', async () => {
      const onClose = vi.fn();
      const manager = Toast.createToastManager();
      await renderViewport(manager);

      const frame = document.createElement('iframe');
      frame.srcdoc = '<button id="inner">inner</button>';
      await new Promise<void>((resolve) => {
        frame.addEventListener('load', () => resolve(), { once: true });
        document.body.append(frame);
      });
      onTestFinished(() => frame.remove());

      manager.add({ title: 'toast', timeout: 1000, onClose });
      await flushMicrotasks();

      // The window gets `blur` only when it has the focus before the move.
      window.focus();
      screen.getByTestId('origin').focus();
      const onWindowBlur = vi.fn();
      window.addEventListener('blur', onWindowBlur, true);
      onTestFinished(() => window.removeEventListener('blur', onWindowBlur, true));

      frame.contentDocument!.getElementById('inner')!.focus();
      await flushMicrotasks();

      expect(onWindowBlur).toHaveBeenCalled();

      await tick(1);
      await tick(1001);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('BUG-6174: keeps the timers paused when the window blurs and the focus stays in the page', async () => {
      const onClose = vi.fn();
      const manager = Toast.createToastManager();
      await renderViewport(manager);
      manager.add({ title: 'toast', timeout: 1000, onClose });
      await flushMicrotasks();
      window.focus();
      screen.getByTestId('origin').focus();

      window.dispatchEvent(new FocusEvent('blur'));
      await tick(1);
      await tick(5000);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('focus', () => {
    it('moves the focus to the viewport on F6, and back to its origin on F6 inside it', async () => {
      const manager = Toast.createToastManager();
      await renderViewport(manager);
      manager.add({ title: 'toast', timeout: 0 });
      await flushMicrotasks();
      const origin = screen.getByTestId('origin');
      const viewport = screen.getByTestId('viewport');
      origin.focus();

      await fireEvent.keyDown(origin, { key: 'F6' });

      expect(viewport).toHaveFocus();
      expect(viewport).toHaveAttribute('data-expanded');
      expect(document.querySelectorAll('[data-vase-ui-focus-guard]')).toHaveLength(3);

      await fireEvent.keyDown(viewport, { key: 'F6' });

      expect(origin).toHaveFocus();
      expect(viewport).not.toHaveAttribute('data-expanded');
      expect(document.querySelectorAll('[data-vase-ui-focus-guard]')).toHaveLength(0);
    });

    it('does nothing on F6 while there is no toast', async () => {
      const manager = Toast.createToastManager();
      await renderViewport(manager);
      const origin = screen.getByTestId('origin');
      origin.focus();

      await fireEvent.keyDown(origin, { key: 'F6' });

      expect(origin).toHaveFocus();
    });

    it('moves the focus from the first guard to the first toast, and from the last toast back to the origin', async () => {
      const manager = Toast.createToastManager();
      const { user } = await renderViewport(manager);
      manager.add({ id: 'toast', title: 'toast', timeout: 0 });
      await flushMicrotasks();
      const origin = screen.getByTestId('origin');
      origin.focus();
      await fireEvent.keyDown(origin, { key: 'F6' });

      await user.tab();

      expect(screen.getByTestId('toast')).toHaveFocus();

      await user.tab();

      expect(origin).toHaveFocus();
    });

    it('returns the focus to the origin on shift+Tab from the viewport', async () => {
      const manager = Toast.createToastManager();
      const { user } = await renderViewport(manager);
      manager.add({ title: 'toast', timeout: 0 });
      await flushMicrotasks();
      const origin = screen.getByTestId('origin');
      origin.focus();
      await fireEvent.keyDown(origin, { key: 'F6' });

      await user.tab({ shift: true });

      expect(origin).toHaveFocus();
    });
  });

  describe('alert region', () => {
    it('announces a high priority toast in an alert region, as text or as the content of a function', async () => {
      const Marker = defineComponent({
        setup: () => () => <em data-testid="marker">marker</em>,
      });
      const manager = Toast.createToastManager();
      await renderViewport(manager);

      manager.add({
        id: 'high',
        title: 'Saved',
        description: () => h(Marker),
        priority: 'high',
        timeout: 0,
      });
      manager.add({ id: 'low', title: 'Draft', priority: 'low', timeout: 0 });
      await flushMicrotasks();

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toHaveTextContent('Savedmarker');
      expect(screen.getAllByTestId('marker')).toHaveLength(1);
    });

    it('removes the alert region while the viewport has focus', async () => {
      const manager = Toast.createToastManager();
      await renderViewport(manager);
      manager.add({ title: 'Saved', priority: 'high', timeout: 0 });
      await flushMicrotasks();
      const origin = screen.getByTestId('origin');
      origin.focus();

      expect(screen.queryAllByRole('alert')).toHaveLength(1);

      await fireEvent.keyDown(origin, { key: 'F6' });

      expect(screen.queryAllByRole('alert')).toHaveLength(0);
    });
  });

  it('removes its document listeners while KeepAlive holds it, and takes them back', async () => {
    const manager = Toast.createToastManager();
    const Page = defineComponent({
      name: 'Page',
      setup: () => () => (
        <Toast.Provider toastManager={manager}>
          <Toast.Viewport data-testid="viewport" style={noRealPointer}>
            <ToastTextList />
          </Toast.Viewport>
        </Toast.Provider>
      ),
    });
    const Other = defineComponent({ name: 'Other', setup: () => () => <p /> });
    const showPage = shallowRef(true);
    await render(() => (
      <KeepAlive>{showPage.value ? <Page key="page" /> : <Other key="other" />}</KeepAlive>
    ));
    manager.add({ title: 'toast', timeout: 0 });
    await flushMicrotasks();
    const viewport = screen.getByTestId('viewport');
    await fireEvent.mouseEnter(viewport);

    showPage.value = false;
    await nextTick();

    // The viewport handles F6 and prevents its default action.
    expect(await fireEvent.keyDown(document.body, { key: 'F6' })).toBe(true);
    // A `mouseover` outside the viewport ends its hover, but not while `KeepAlive` holds it.
    await fireEvent.mouseOver(document.body);

    showPage.value = true;
    await nextTick();

    expect(viewport).toHaveAttribute('data-expanded');
    expect(await fireEvent.keyDown(document.body, { key: 'F6' })).toBe(false);
    expect(viewport).toHaveFocus();
  });

  describe('hydration', () => {
    it.each([
      { name: 'inline', props: {}, serverHtml: 'role="region"' },
      { name: 'in a portal', props: { portal: true }, serverHtml: '<!---->' },
      { name: 'with a text label', props: { toast: 'text' }, serverHtml: 'role="alert"' },
    ])('hydrates the viewport $name with no message', async ({ props, serverHtml }) => {
      const html = await renderOnServer(HYDRATION_FILE, props);

      expect(html).toContain(serverHtml);

      await hydrate(ToastViewportHydration, { serverHtml: html, props });
    });

    it('hydrates the component of a function label in the toast and in the alert region, and renders it in both for the next toast', async () => {
      const props = { toast: 'component' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      const { container } = await hydrate(ToastViewportHydration, { serverHtml, props });
      const labels = () => container.querySelectorAll('[data-toast-label]');

      expect(labels()).toHaveLength(2);

      await fireEvent.click(within(container).getByTestId('close'));
      await waitFor(() => {
        expect(labels()).toHaveLength(0);
      });

      await fireEvent.click(within(container).getByTestId('add'));

      expect(labels()).toHaveLength(2);
    });
  });

  // A case that throws in `setup` is the last case of its file.
  it('throws a descriptive error when rendered outside <Toast.Provider>', async () => {
    await expect(render(<Toast.Viewport />)).rejects.toThrow(
      'Vase UI: No <Toast.Provider> is above this component. `useToastManager` and each part of Toast read the toasts of the provider. Put the component inside <Toast.Provider>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
