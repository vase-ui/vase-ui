import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import type { UserEvent } from '@testing-library/user-event';
import {
  defineComponent,
  Fragment,
  h,
  KeepAlive,
  nextTick,
  onMounted,
  shallowRef,
  Teleport,
} from 'vue';
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
import { List, Button } from '../utils/test-utils';
import ToastViewportHydration from './ToastViewportHydration.test.vue';

const HYDRATION_FILE = 'src/toast/viewport/ToastViewportHydration.test.vue';

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
        <Toast.Viewport data-testid="viewport">
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

  it('sets the measured frontmost toast height CSS variable', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'add' }));

    await waitFor(() =>
      expect(
        screen.getByTestId('viewport').style.getPropertyValue('--toast-frontmost-height'),
      ).not.toBe(''),
    );
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

  it('rebinds owner-document listeners once across empty store cycles', async () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const iframeWindow = iframe.contentWindow;
    const iframeDocument = iframe.contentDocument;
    if (!iframeWindow || !iframeDocument) {
      throw new Error('Expected iframe window and document.');
    }
    const iframeGlobal = iframeWindow as Window & typeof globalThis;

    const portalContainer = iframeDocument.createElement('div');
    iframeDocument.body.appendChild(portalContainer);
    const addWindowListener = vi.spyOn(iframeWindow, 'addEventListener');
    const removeWindowListener = vi.spyOn(iframeWindow, 'removeEventListener');
    const addDocumentListener = vi.spyOn(iframeDocument, 'addEventListener');
    const removeDocumentListener = vi.spyOn(iframeDocument, 'removeEventListener');
    const liveWindowListeners = (type: string) =>
      addWindowListener.mock.calls.filter((call) => call[0] === type).length -
      removeWindowListener.mock.calls.filter((call) => call[0] === type).length;

    const Controls = defineComponent({
      setup() {
        const { add, close, toasts } = Toast.useToastManager();
        return () => (
          <Fragment>
            <button type="button" onClick={() => add({ title: 'title' })}>
              add alternate toast
            </button>
            <button type="button" onClick={() => close(toasts.value[0]?.id)}>
              close alternate toast
            </button>
          </Fragment>
        );
      },
    });

    try {
      const { user } = await render(
        <Toast.Provider timeout={0}>
          <Teleport to={portalContainer}>
            <Toast.Viewport data-testid="alternate-viewport">
              <List />
            </Toast.Viewport>
          </Teleport>
          <Controls />
        </Toast.Provider>,
      );

      const add = screen.getByRole('button', { name: 'add alternate toast' });
      const close = screen.getByRole('button', { name: 'close alternate toast' });

      await user.click(add);
      await waitFor(() =>
        expect(iframeDocument.querySelector('[data-testid="root"]')).not.toBe(null),
      );

      expect(addWindowListener.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
      expect(liveWindowListeners('blur')).toBe(1);
      expect(liveWindowListeners('focus')).toBe(1);
      expect(
        addDocumentListener.mock.calls.filter(([type]) => type === 'pointerdown'),
      ).toHaveLength(1);

      iframeWindow.dispatchEvent(new iframeGlobal.KeyboardEvent('keydown', { key: 'F6' }));
      await flushMicrotasks();
      expect(iframeDocument.activeElement).toBe(
        iframeDocument.querySelector('[data-testid="alternate-viewport"]'),
      );

      await user.click(close);
      await waitFor(() => expect(iframeDocument.querySelector('[data-testid="root"]')).toBe(null));
      expect(removeWindowListener.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(
        1,
      );
      // Window focus tracking stays attached while the viewport is empty.
      expect(liveWindowListeners('blur')).toBe(1);
      expect(liveWindowListeners('focus')).toBe(1);
      expect(
        removeDocumentListener.mock.calls.filter(([type]) => type === 'pointerdown'),
      ).toHaveLength(1);

      await user.click(add);
      await waitFor(() =>
        expect(iframeDocument.querySelector('[data-testid="root"]')).not.toBe(null),
      );
      expect(addWindowListener.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(2);
      expect(liveWindowListeners('blur')).toBe(1);
      expect(liveWindowListeners('focus')).toBe(1);
      expect(
        addDocumentListener.mock.calls.filter(([type]) => type === 'pointerdown'),
      ).toHaveLength(2);
    } finally {
      addWindowListener.mockRestore();
      removeWindowListener.mockRestore();
      addDocumentListener.mockRestore();
      removeDocumentListener.mockRestore();
      iframe.remove();
    }
  });

  it('gets focused when F6 is pressed', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);
    await user.keyboard('{F6}');

    expect(screen.getByTestId('viewport')).toHaveFocus();
  });

  it('focuses first toast upon tab after viewport is focused', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);
    await user.keyboard('{F6}');
    await user.keyboard('{Tab}');

    expect(screen.getByTestId('root')).toHaveFocus();
  });

  it('returns focus to previous element when pressing shift+Tab on first toast', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);
    await user.keyboard('{F6}');
    await user.tab();
    await user.tab({ shift: true });

    expect(button).toHaveFocus();
  });

  it('returns focus to previous element when pressing shift+Tab on last toast', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);
    await user.click(button);

    await user.keyboard('{F6}');
    await user.tab(); // first toast
    await user.tab(); // first toast close button
    await user.tab(); // first toast action button
    await user.tab(); // last toast
    await user.tab(); // last toast close button
    await user.tab(); // last toast action button
    await user.tab();

    expect(button).toHaveFocus();
  });

  it('returns focus to previous element when F6 is pressed from inside the viewport', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);
    await user.keyboard('{F6}');
    await user.tab();
    expect(screen.getByTestId('root')).toHaveFocus();

    await user.keyboard('{F6}');

    expect(button).toHaveFocus();
  });

  it('keeps focus where the viewport moves it on F6 and returns it to the F6 origin', async () => {
    const manager = Toast.createToastManager();
    const otherManager = Toast.createToastManager();
    const { user } = await render(
      <Fragment>
        <button type="button">origin</button>
        <button type="button">other</button>
        <Toast.Provider toastManager={manager}>
          <Toast.Viewport
            onFocusin={(event: FocusEvent) => {
              if (event.target === event.currentTarget) {
                (event.currentTarget as HTMLElement)
                  .querySelector<HTMLElement>('[data-testid="root"]')
                  ?.focus();
              }
            }}
          >
            <List />
          </Toast.Viewport>
        </Toast.Provider>
        <Toast.Provider toastManager={otherManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
        </Toast.Provider>
      </Fragment>,
    );

    manager.add({ title: 'title' });
    await flushMicrotasks();
    // The other viewport's F6 listener is registered second, so it only acts if the first
    // listener leaves the press unhandled.
    otherManager.add({ title: 'other' });
    await flushMicrotasks();

    const origin = screen.getByRole('button', { name: 'origin' });
    origin.focus();
    await flushMicrotasks();

    await user.keyboard('{F6}');
    expect(screen.getAllByTestId('root')[0]).toHaveFocus();

    await user.tab({ shift: true });

    expect(origin).toHaveFocus();
  });

  it('returns focus to the F6 origin when focusing the viewport closes the last toast', async () => {
    const manager = Toast.createToastManager();
    const otherManager = Toast.createToastManager();
    const { user } = await render(
      <Fragment>
        <button type="button">origin</button>
        <Toast.Provider toastManager={manager}>
          <Toast.Viewport data-testid="viewport" onFocusin={() => manager.close()}>
            <List />
          </Toast.Viewport>
        </Toast.Provider>
        <Toast.Provider toastManager={otherManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
        </Toast.Provider>
      </Fragment>,
    );

    manager.add({ title: 'title' });
    await flushMicrotasks();
    // The other viewport's F6 listener is registered second, so it only acts if the first
    // listener leaves the press unhandled.
    otherManager.add({ title: 'other' });
    await flushMicrotasks();

    const origin = screen.getByRole('button', { name: 'origin' });
    origin.focus();
    await flushMicrotasks();

    await user.keyboard('{F6}');

    expect(origin).toHaveFocus();
  });

  it('does not restore focus on an F6 press prevented by the consumer', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport
          data-testid="viewport"
          onKeydown={(event: KeyboardEvent) => event.preventDefault()}
        >
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'add' }));
    await user.keyboard('{F6}');
    const viewport = screen.getByTestId('viewport');
    expect(viewport).toHaveFocus();

    await user.keyboard('{F6}');

    expect(viewport).toHaveFocus();
  });

  it('leaves F6 to the browser when the viewport was entered without F6', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'add' }));

    const root = screen.getByTestId('root');
    root.focus();
    await flushMicrotasks();

    expect(await fireEvent.keyDown(root, { key: 'F6' })).toBe(true);
    expect(root).toHaveFocus();
  });

  it('leaves F6 to the browser when the viewport was entered without F6 after an earlier F6 visit', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);

    await user.keyboard('{F6}');
    expect(screen.getByTestId('viewport')).toHaveFocus();
    await user.tab({ shift: true });
    expect(button).toHaveFocus();

    const root = screen.getByTestId('root');
    root.focus();
    await flushMicrotasks();

    expect(await fireEvent.keyDown(root, { key: 'F6' })).toBe(true);
    expect(root).toHaveFocus();
  });

  it('leaves F6 to the browser when the element focused before F6 was removed', async ({
    onTestFinished,
  }) => {
    const manager = Toast.createToastManager();
    const { user } = await render(
      <Toast.Provider toastManager={manager}>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
      </Toast.Provider>,
    );

    manager.add({ title: 'title' });
    await flushMicrotasks();

    const origin = document.createElement('button');
    document.body.appendChild(origin);
    onTestFinished(() => origin.remove());
    origin.focus();
    await flushMicrotasks();

    await user.keyboard('{F6}');
    expect(screen.getByTestId('viewport')).toHaveFocus();
    origin.remove();

    expect(await fireEvent.keyDown(screen.getByTestId('viewport'), { key: 'F6' })).toBe(true);
    expect(screen.getByTestId('viewport')).toHaveFocus();
  });

  it('ignores F6 while the viewport is empty', async () => {
    await render(
      <Fragment>
        <button type="button">page</button>
        <Toast.Provider>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
        </Toast.Provider>
      </Fragment>,
    );

    const button = screen.getByRole('button', { name: 'page' });
    button.focus();
    await flushMicrotasks();

    expect(await fireEvent.keyDown(button, { key: 'F6' })).toBe(true);
    expect(button).toHaveFocus();
  });

  it.each([
    { name: 'with an F6 origin', enterWithF6: true },
    { name: 'without an F6 origin', enterWithF6: false },
  ])('handles F6 in the focused viewport $name before other providers', async ({ enterWithF6 }) => {
    const firstManager = Toast.createToastManager();
    const secondManager = Toast.createToastManager();
    const { user } = await render(
      <Fragment>
        <button type="button">origin</button>
        <Toast.Provider toastManager={firstManager}>
          <Toast.Viewport data-testid="first-viewport">
            <List />
          </Toast.Viewport>
        </Toast.Provider>
        <Toast.Provider toastManager={secondManager}>
          <Toast.Viewport data-testid="second-viewport">
            <List />
          </Toast.Viewport>
        </Toast.Provider>
      </Fragment>,
    );
    const origin = screen.getByRole('button', { name: 'origin' });
    firstManager.add({ title: 'first' });
    await flushMicrotasks();
    secondManager.add({ title: 'second' });
    origin.focus();
    await flushMicrotasks();
    // The first viewport's global listener was registered first, so F6 enters it.
    const firstViewport = screen.getByTestId('first-viewport');
    if (enterWithF6) {
      await user.keyboard('{F6}');
    } else {
      firstViewport.focus();
      await flushMicrotasks();
    }
    expect(firstViewport).toHaveFocus();

    expect(await fireEvent.keyDown(firstViewport, { key: 'F6' })).toBe(!enterWithF6);
    expect(enterWithF6 ? origin : firstViewport).toHaveFocus();
  });

  it('returns focus to the body on F6 when nothing had focus before entering', async () => {
    const manager = Toast.createToastManager();
    const { user } = await render(
      <Toast.Provider toastManager={manager}>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
      </Toast.Provider>,
    );

    manager.add({ title: 'title' });
    await flushMicrotasks();
    expect(document.activeElement).toBe(document.body);

    await user.keyboard('{F6}');
    await user.tab();
    expect(screen.getByTestId('root')).toHaveFocus();

    await user.keyboard('{F6}');

    expect(document.activeElement).toBe(document.body);
  });

  it('leaves shift+Tab to the browser on a viewport focused without F6 after an earlier F6 visit', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);

    await user.keyboard('{F6}');
    await user.tab({ shift: true });
    expect(button).toHaveFocus();

    const viewport = screen.getByTestId('viewport');
    viewport.focus();
    await flushMicrotasks();

    expect(await fireEvent.keyDown(viewport, { key: 'Tab', shiftKey: true })).toBe(true);
  });

  it.each([
    { name: 'F6', exit: (user: UserEvent) => user.keyboard('{F6}') },
    { name: 'shift+Tab', exit: (user: UserEvent) => user.tab({ shift: true }) },
  ])('returns focus to the page on $name after F6 with two providers', async ({ exit }) => {
    const firstManager = Toast.createToastManager();
    const secondManager = Toast.createToastManager();
    const { user } = await render(
      <Fragment>
        <Toast.Provider toastManager={firstManager}>
          <Toast.Viewport data-testid="first-viewport">
            <List />
          </Toast.Viewport>
        </Toast.Provider>
        <Toast.Provider toastManager={secondManager}>
          <Toast.Viewport data-testid="second-viewport">
            <List />
          </Toast.Viewport>
        </Toast.Provider>
        <button type="button">page</button>
      </Fragment>,
    );

    firstManager.add({ title: 'first' });
    secondManager.add({ title: 'second' });
    await flushMicrotasks();

    const button = screen.getByRole('button', { name: 'page' });
    button.focus();
    await flushMicrotasks();

    await user.keyboard('{F6}');
    expect([screen.getByTestId('first-viewport'), screen.getByTestId('second-viewport')]).toContain(
      document.activeElement,
    );

    await exit(user);

    expect(button).toHaveFocus();
  });

  it('removes expanded on mouseleave when focus-visible not inside', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);
    await screen.findByTestId('root');
    const viewport = screen.getByTestId('viewport');

    await fireEvent.mouseEnter(viewport);
    expect(viewport).toHaveAttribute('data-expanded');

    await fireEvent.mouseLeave(viewport);
    expect(viewport).not.toHaveAttribute('data-expanded');
  });

  it('collapses when the pointer moves away after the hovered toast was closed', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);
    await user.click(button);
    const [hoveredRoot] = await screen.findAllByTestId('root');
    const viewport = screen.getByTestId('viewport');

    await fireEvent.mouseEnter(viewport);
    expect(viewport).toHaveAttribute('data-expanded');

    await fireEvent.click(within(hoveredRoot).getByRole('button', { name: 'close-press' }));
    await waitFor(() => expect(screen.getAllByTestId('root')).toHaveLength(1));

    // The closed toast was under the pointer, so no `mouseout` reaches the viewport. The next
    // pointer movement only produces a `mouseover` on whatever is now under the pointer.
    await fireEvent.mouseOver(document.body);
    expect(viewport).not.toHaveAttribute('data-expanded');
  });

  it('stays expanded on a mouseover inside the viewport', async () => {
    const manager = Toast.createToastManager();
    await renderViewport(manager);
    manager.add({ id: 'toast', title: 'toast', timeout: 0 });
    await flushMicrotasks();
    const viewport = screen.getByTestId('viewport');

    await fireEvent.mouseEnter(viewport);
    await fireEvent.mouseOver(screen.getByTestId('toast'));

    expect(viewport).toHaveAttribute('data-expanded');
  });

  it('keeps expanded on mouseleave when focus-visible is inside', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);
    await screen.findByTestId('root');
    const viewport = screen.getByTestId('viewport');

    await user.keyboard('{F6}');
    await user.tab();

    await fireEvent.mouseEnter(viewport);
    expect(viewport).toHaveAttribute('data-expanded');
    await fireEvent.mouseLeave(viewport);
    expect(viewport).toHaveAttribute('data-expanded');
  });

  it('keeps expanded during an active touch swipe even if mouseleave fires', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);

    const root = await screen.findByTestId('root');
    const viewport = screen.getByTestId('viewport');

    Object.defineProperty(root, 'setPointerCapture', {
      value: () => {},
      configurable: true,
    });
    Object.defineProperty(root, 'releasePointerCapture', {
      value: () => {},
      configurable: true,
    });

    await fireEvent.pointerDown(root, {
      clientX: 100,
      clientY: 100,
      button: 0,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await fireEvent.pointerMove(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });

    expect(viewport).toHaveAttribute('data-expanded');

    await fireEvent.mouseLeave(viewport);

    expect(viewport).toHaveAttribute('data-expanded');

    await fireEvent.pointerUp(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });

    expect(viewport).not.toHaveAttribute('data-expanded');
  });

  it('keeps expanded when a touch swipe is canceled without leaving the viewport', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);

    const root = await screen.findByTestId('root');
    const viewport = screen.getByTestId('viewport');

    Object.defineProperty(root, 'setPointerCapture', {
      value: () => {},
      configurable: true,
    });

    await fireEvent.pointerDown(root, {
      clientX: 100,
      clientY: 100,
      button: 0,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await fireEvent.pointerMove(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });

    expect(root).toHaveAttribute('data-swiping');
    expect(viewport).toHaveAttribute('data-expanded');

    await fireEvent.pointerCancel(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });

    expect(root).not.toHaveAttribute('data-swiping');
    expect(viewport).toHaveAttribute('data-expanded');
  });

  it('collapses after a touch swipe is canceled if mouseleave already fired', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);

    const root = await screen.findByTestId('root');
    const viewport = screen.getByTestId('viewport');

    Object.defineProperty(root, 'setPointerCapture', {
      value: () => {},
      configurable: true,
    });

    await fireEvent.pointerDown(root, {
      clientX: 100,
      clientY: 100,
      button: 0,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await fireEvent.pointerMove(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });

    await fireEvent.mouseLeave(viewport);
    await fireEvent.pointerCancel(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });

    expect(root).not.toHaveAttribute('data-swiping');
    expect(viewport).not.toHaveAttribute('data-expanded');
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

    function dispatchWindowEvent(type: 'blur' | 'focus') {
      window.dispatchEvent(new FocusEvent(type));
    }

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
          <Toast.Viewport data-testid="viewport" />
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

    it('pauses timers when hovering', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });

      await fireEvent.click(button);
      await fireEvent.mouseEnter(screen.getByTestId('viewport'));

      await tick(5001);

      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('resumes timers when not hovering', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });

      await fireEvent.click(button);
      await fireEvent.mouseEnter(screen.getByTestId('viewport'));

      await tick(5000);

      await fireEvent.mouseLeave(screen.getByTestId('viewport'));

      await tick(4999);

      expect(screen.queryByTestId('root')).not.toBe(null);

      await tick(2);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('pauses timers when the viewport is focused', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });

      await fireEvent.click(button);
      await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'F6' });

      await tick(5001);

      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('runs timers when onFocus redirects focus outside the viewport', async () => {
      const manager = Toast.createToastManager();
      const originRef = shallowRef<HTMLButtonElement | null>(null);
      await render(() => (
        <Toast.Provider toastManager={manager}>
          <button ref={originRef} type="button">
            origin
          </button>
          <Toast.Viewport data-testid="viewport" onFocusin={() => originRef.value?.focus()}>
            <List />
          </Toast.Viewport>
        </Toast.Provider>
      ));

      manager.add({ title: 'title' });
      originRef.value?.focus();
      await flushMicrotasks();
      expect(originRef.value).toHaveFocus();
      expect(screen.getByTestId('root')).toBeInTheDocument();

      await fireEvent.keyDown(screen.getByRole('button', { name: 'origin' }), { key: 'F6' });

      expect(originRef.value).toHaveFocus();
      expect(screen.getByTestId('viewport')).not.toHaveAttribute('data-expanded');
      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBeInTheDocument();
    });

    it('runs new toast timers after onFocus closes the last toast', async () => {
      const manager = Toast.createToastManager();
      await render(
        <Toast.Provider toastManager={manager}>
          <button type="button">origin</button>
          <Toast.Viewport data-testid="viewport" onFocusin={() => manager.close()}>
            <List />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      const origin = screen.getByRole('button', { name: 'origin' });
      manager.add({ title: 'first' });
      origin.focus();
      await flushMicrotasks();
      expect(origin).toHaveFocus();
      expect(screen.getByTestId('root')).toBeInTheDocument();

      await fireEvent.keyDown(screen.getByRole('button', { name: 'origin' }), { key: 'F6' });
      await tick(100);
      expect(origin).toHaveFocus();
      expect(screen.queryByTestId('root')).not.toBeInTheDocument();

      manager.add({ title: 'second' });
      await flushMicrotasks();
      const viewport = screen.getByTestId('viewport');
      expect(viewport).not.toHaveAttribute('data-expanded');
      await fireEvent.mouseEnter(viewport);
      expect(viewport).toHaveAttribute('data-expanded');
      await tick(5001);
      expect(screen.getByTestId('root')).toBeInTheDocument();

      await fireEvent.mouseLeave(viewport);
      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBeInTheDocument();
    });

    it.each(['hovering', 'focused'] as const)(
      'keeps timers paused while still %s after the other interaction ends',
      async (remainingInteraction) => {
        await render(
          <Toast.Provider>
            <Toast.Viewport data-testid="viewport">
              <List />
            </Toast.Viewport>
            <Button />
          </Toast.Provider>,
        );

        const addButton = screen.getByRole('button', { name: 'add' });
        addButton.focus();
        await flushMicrotasks();
        await fireEvent.click(addButton);
        await tick(1000);

        await fireEvent.keyDown(addButton, { key: 'F6' });

        const action = screen.getByRole('button', { name: 'action' });
        const viewport = screen.getByTestId('viewport');
        action.focus();
        await flushMicrotasks();
        expect(action).toHaveFocus();
        await fireEvent.mouseEnter(viewport);

        if (remainingInteraction === 'hovering') {
          addButton.focus();
          await flushMicrotasks();
        } else {
          await fireEvent.mouseLeave(viewport);
        }
        expect(remainingInteraction === 'hovering' ? addButton : action).toHaveFocus();

        await tick(5001);
        expect(screen.getByTestId('root')).toBeInTheDocument();

        if (remainingInteraction === 'hovering') {
          await fireEvent.mouseLeave(viewport);
        } else {
          addButton.focus();
          await flushMicrotasks();
        }
        expect(addButton).toHaveFocus();

        await tick(3999);
        expect(screen.getByTestId('root')).toBeInTheDocument();

        await tick(2);
        expect(screen.queryByTestId('root')).not.toBeInTheDocument();
      },
    );

    it('restores focus and resumes timers on shift+Tab out of the focused viewport', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });

      button.focus();
      await flushMicrotasks();
      await fireEvent.click(button);
      await fireEvent.keyDown(button, { key: 'F6' });

      const viewport = screen.getByTestId('viewport');
      expect(viewport).toHaveFocus();

      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBe(null);

      await fireEvent.keyDown(viewport, { key: 'Tab', shiftKey: true });

      expect(button).toHaveFocus();

      await tick(5001);
      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('keeps the viewport focused when Tab is pressed without shift', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });

      button.focus();
      await flushMicrotasks();
      await fireEvent.click(button);
      await fireEvent.keyDown(button, { key: 'F6' });

      const viewport = screen.getByTestId('viewport');
      await fireEvent.keyDown(viewport, { key: 'Tab' });

      // Forward Tab moves into the toasts, so the viewport must not hand focus back.
      expect(button).not.toHaveFocus();

      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('collapses and resumes timers on a touch outside the viewport', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });

      await fireEvent.click(button);
      const viewport = screen.getByTestId('viewport');
      await fireEvent.mouseEnter(viewport);

      expect(viewport).toHaveAttribute('data-expanded');

      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBe(null);

      await fireEvent.pointerDown(document.body, { pointerType: 'touch' });

      expect(viewport).not.toHaveAttribute('data-expanded');

      await tick(5001);
      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('stays expanded on a touch inside the viewport', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });

      await fireEvent.click(button);
      const viewport = screen.getByTestId('viewport');
      await fireEvent.mouseEnter(viewport);

      await fireEvent.pointerDown(viewport, { pointerType: 'touch' });

      expect(viewport).toHaveAttribute('data-expanded');

      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('ignores a mouse pointerdown outside the viewport', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });

      await fireEvent.click(button);
      await fireEvent.mouseEnter(screen.getByTestId('viewport'));

      // Only touch activity ends the paused interaction; a mouse press outside
      // is followed by a `mouseleave`, which handles the collapse instead.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });

      expect(screen.getByTestId('viewport')).toHaveAttribute('data-expanded');

      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('keeps a toast added while the window is blurred paused until the window regains focus', async () => {
      const manager = Toast.createToastManager();

      await render(
        <Toast.Provider toastManager={manager}>
          <Toast.Portal>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
          </Toast.Portal>
        </Toast.Provider>,
      );

      dispatchWindowEvent('blur');
      await flushMicrotasks();
      manager.add({ title: 'title' });
      await flushMicrotasks();

      await tick(5001);
      expect(screen.getByTestId('root')).toBeInTheDocument();

      dispatchWindowEvent('focus');
      await flushMicrotasks();
      await tick(5001);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('keeps timers paused when the window blurs again before its focus settles', async () => {
      const manager = Toast.createToastManager();

      await render(
        <Toast.Provider toastManager={manager}>
          <Toast.Portal>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
          </Toast.Portal>
        </Toast.Provider>,
      );

      manager.add({ title: 'title' });
      await flushMicrotasks();
      dispatchWindowEvent('blur');
      await flushMicrotasks();
      dispatchWindowEvent('focus');
      dispatchWindowEvent('blur');
      await flushMicrotasks();

      await tick(5001);
      expect(screen.getByTestId('root')).toBeInTheDocument();

      dispatchWindowEvent('focus');
      await flushMicrotasks();
      await tick(5001);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('runs the timer of a toast added after the window regained focus while empty', async () => {
      const manager = Toast.createToastManager();

      await render(
        <Toast.Provider toastManager={manager}>
          <Toast.Portal>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
          </Toast.Portal>
        </Toast.Provider>,
      );

      manager.add({ id: 'manual', title: 'manual', timeout: 0 });
      await flushMicrotasks();
      dispatchWindowEvent('blur');
      await flushMicrotasks();
      manager.close('manual');
      await flushMicrotasks();
      await tick(100);
      expect(screen.queryByTestId('root')).toBe(null);

      dispatchWindowEvent('focus');
      await tick(1);
      manager.add({ title: 'title' });
      await flushMicrotasks();
      await tick(5001);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('runs the timer of a toast added by a window focus listener after the window blurred while empty', async ({
      onTestFinished,
    }) => {
      const manager = Toast.createToastManager();

      await render(
        <Toast.Provider toastManager={manager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      dispatchWindowEvent('blur');
      await flushMicrotasks();
      // Registered after the viewport's listener, so it runs before the deferred focus update.
      const addToast = () => manager.add({ title: 'title' });
      window.addEventListener('focus', addToast);
      onTestFinished(() => window.removeEventListener('focus', addToast));

      dispatchWindowEvent('focus');
      await flushMicrotasks();
      expect(screen.getByTestId('root')).toBeInTheDocument();

      await tick(5001);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('resumes timers when the viewport is blurred', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });

      await fireEvent.click(button);
      await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'F6' });

      await tick(5001);

      button.focus();
      await flushMicrotasks();

      await tick(5001);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('keeps timers paused on F6 after the outer focus guard returned focus to the page', async () => {
      const manager = Toast.createToastManager();
      await render(
        <Toast.Provider toastManager={manager}>
          <button type="button">origin</button>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
        </Toast.Provider>,
      );
      manager.add({ title: 'title' });
      await flushMicrotasks();
      const origin = screen.getByRole('button', { name: 'origin' });
      const viewport = screen.getByTestId('viewport');

      origin.focus();
      await flushMicrotasks();
      await fireEvent.keyDown(origin, { key: 'F6' });
      expect(viewport).toHaveFocus();

      // Leaving without the keyboard keeps the guards rendered, so tabbing forward from
      // the page reaches the outer guard, which returns focus to the F6 origin.
      origin.focus();
      await flushMicrotasks();
      const outerGuard = viewport.previousElementSibling as HTMLElement;
      outerGuard.focus();
      await flushMicrotasks();
      expect(origin).toHaveFocus();

      await fireEvent.keyDown(origin, { key: 'F6' });
      expect(viewport).toHaveFocus();
      expect(viewport).toHaveAttribute('data-expanded');

      await tick(5001);

      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('resumes timers after tabbing past the last toast when the F6 origin was disabled', async () => {
      const manager = Toast.createToastManager();
      await render(
        <Toast.Provider toastManager={manager}>
          <button type="button">origin</button>
          <button type="button">other</button>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
        </Toast.Provider>,
      );
      manager.add({ title: 'title' });
      await flushMicrotasks();
      const origin = screen.getByRole<HTMLButtonElement>('button', { name: 'origin' });
      const viewport = screen.getByTestId('viewport');

      origin.focus();
      await flushMicrotasks();
      await fireEvent.keyDown(origin, { key: 'F6' });
      expect(viewport).toHaveAttribute('data-expanded');

      screen.getByTestId('root').focus();
      await flushMicrotasks();
      origin.disabled = true;
      // Tabbing past the last toast lands on the trailing guard, which can't restore focus.
      const trailingGuard = viewport.lastElementChild as HTMLElement;
      trailingGuard.focus();
      await flushMicrotasks();

      screen.getByRole('button', { name: 'other' }).focus();
      await flushMicrotasks();
      expect(viewport).not.toHaveAttribute('data-expanded');

      await tick(5001);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('resumes timers when the window regains focus', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });

      await fireEvent.click(button);

      expect(screen.queryByTestId('root')).not.toBe(null);
      const blurListener = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'blur' && call[2] === true,
      )?.[1] as EventListener | undefined;
      const focusListener = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'focus' && call[2] === true,
      )?.[1] as EventListener | undefined;

      addEventListenerSpy.mockRestore();

      expect(blurListener).toBeDefined();
      expect(focusListener).toBeDefined();

      if (!blurListener || !focusListener) {
        throw new Error('Expected window focus and blur listeners to be registered.');
      }

      const blurEvent = new FocusEvent('blur');
      Object.defineProperty(blurEvent, 'composedPath', {
        value: () => [window],
      });

      const focusEvent = new FocusEvent('focus');
      Object.defineProperty(focusEvent, 'composedPath', {
        value: () => [window],
      });

      await tick(1000);

      blurListener(blurEvent);
      await flushMicrotasks();

      await tick(5000);

      expect(screen.queryByTestId('root')).not.toBe(null);

      focusListener(focusEvent);
      await flushMicrotasks();

      await tick(3999);

      expect(screen.queryByTestId('root')).not.toBe(null);

      await tick(2);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('keeps timers paused on mouseleave while the window is blurred', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button);

      const viewport = screen.getByTestId('viewport');

      const blurListener = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'blur' && call[2] === true,
      )?.[1] as EventListener | undefined;
      addEventListenerSpy.mockRestore();

      if (!blurListener) {
        throw new Error('Expected window blur listener to be registered.');
      }

      const blurEvent = new FocusEvent('blur');
      Object.defineProperty(blurEvent, 'composedPath', { value: () => [window] });

      // Hovering pauses the timer.
      await fireEvent.mouseEnter(viewport);
      await tick(1000);

      // The window loses focus while still hovering.
      blurListener(blurEvent);
      await flushMicrotasks();

      // Leaving with the pointer must not resume the timer while the window is
      // blurred, otherwise the toast could expire off-screen.
      await fireEvent.mouseLeave(viewport);
      await tick(10000);

      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('keeps timers paused on viewport blur while the window is blurred', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button);

      const blurListener = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'blur' && call[2] === true,
      )?.[1] as EventListener | undefined;
      addEventListenerSpy.mockRestore();

      if (!blurListener) {
        throw new Error('Expected window blur listener to be registered.');
      }

      await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'F6' });
      expect(screen.getByTestId('viewport')).toHaveFocus();

      await tick(1000);

      const blurEvent = new FocusEvent('blur');
      Object.defineProperty(blurEvent, 'composedPath', { value: () => [window] });

      blurListener(blurEvent);
      await flushMicrotasks();

      button.focus();
      await flushMicrotasks();

      await tick(10000);

      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('collapses a deferred mouseleave after a closing toast is removed while blurred', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      try {
        const CloseNewestButton = defineComponent({
          setup() {
            const { close, toasts } = Toast.useToastManager();

            return () => (
              <button
                onClick={() => {
                  close(toasts.value[0]?.id);
                }}
              >
                close newest
              </button>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport data-testid="viewport">
              <List />
            </Toast.Viewport>
            <Button />
            <CloseNewestButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);
        await fireEvent.click(button);

        const viewport = screen.getByTestId('viewport');
        const newestRoot = screen.getAllByTestId('root')[0];
        let finishAnimation!: () => void;
        const animationFinished = new Promise<void>((resolve) => {
          finishAnimation = resolve;
        });

        Object.defineProperty(newestRoot, 'getAnimations', {
          value: () => [{ finished: animationFinished }],
          configurable: true,
        });

        await fireEvent.mouseEnter(viewport);
        expect(viewport).toHaveAttribute('data-expanded');

        await fireEvent.click(screen.getByRole('button', { name: 'close newest' }));
        expect(newestRoot).toHaveAttribute('data-ending-style');

        const blurListener = addEventListenerSpy.mock.calls.find(
          (call) => call[0] === 'blur' && call[2] === true,
        )?.[1] as EventListener | undefined;

        if (!blurListener) {
          throw new Error('Expected window blur listener to be registered.');
        }

        const blurEvent = new FocusEvent('blur');
        Object.defineProperty(blurEvent, 'composedPath', { value: () => [window] });

        await fireEvent.mouseLeave(viewport);

        blurListener(blurEvent);
        await flushMicrotasks();

        vi.advanceTimersByTime(20);
        finishAnimation();
        await Promise.resolve();
        await flushMicrotasks();

        expect(screen.queryAllByTestId('root')).toHaveLength(1);
        expect(viewport).not.toHaveAttribute('data-expanded');
      } finally {
        addEventListenerSpy.mockRestore();
        globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
      }
    });
  });

  describe('focus management', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('skips toasts animating out when tabbing into the viewport', async () => {
      // The exit of a closed toast then waits for a frame of the fake clock, so the toast stays.
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      await render(
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button); // oldest toast
      await fireEvent.click(button); // newest toast (toasts[0])

      const roots = screen.getAllByTestId('root');
      const newest = roots[0];
      const survivor = roots[1];

      // Close the newest toast. It enters the `ending` state and stays mounted
      // because the exit animation hasn't completed (no clock tick). The close
      // button is `aria-hidden` until expanded, so query it by attribute.
      const newestCloseButton = document.querySelectorAll(
        '[aria-label="close-press"]',
      )[0] as HTMLElement;
      await fireEvent.click(newestCloseButton);

      // F6 focuses the viewport and renders the focus guards.
      await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'F6' });

      const viewport = screen.getByTestId('viewport');
      const guard = document.querySelector('[data-vase-ui-focus-guard]') as HTMLElement;
      await fireEvent.focusIn(guard, { relatedTarget: viewport });

      expect(survivor).toHaveFocus();
      expect(newest).not.toHaveFocus();
    });

    it('returns focus when no toast can receive focus', async () => {
      await render(
        <Toast.Provider limit={0}>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      button.focus();
      await flushMicrotasks();
      await fireEvent.click(button);

      await fireEvent.keyDown(button, { key: 'F6' });

      const viewport = screen.getByTestId('viewport');
      expect(viewport).toHaveFocus();

      const guard = document.querySelector('[data-vase-ui-focus-guard]') as HTMLElement;
      await fireEvent.focusIn(guard, { relatedTarget: viewport });

      expect(button).toHaveFocus();
    });

    it('returns focus to the trigger when every toast is closed', async () => {
      const manager = Toast.createToastManager();

      await render(
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      button.focus();
      await flushMicrotasks();
      await fireEvent.click(button);

      await fireEvent.keyDown(button, { key: 'F6' });
      const viewport = screen.getByTestId('viewport');
      const guard = document.querySelector('[data-vase-ui-focus-guard]') as HTMLElement;
      await fireEvent.focusIn(guard, { relatedTarget: viewport });

      expect(screen.getByTestId('root')).toHaveFocus();

      // Closing everything leaves no toast to hand focus to.
      manager.close();
      await flushMicrotasks();

      expect(button).toHaveFocus();
    });

    it('moves focus past toasts animating out when one is closed', async () => {
      // The exit of a closed toast then waits for a frame of the fake clock, so the toast stays.
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const manager = Toast.createToastManager();

      await render(
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      button.focus();
      await flushMicrotasks();

      manager.add({ title: 'oldest' });
      await flushMicrotasks();
      manager.add({ id: 'middle', title: 'middle' });
      await flushMicrotasks();
      manager.add({ id: 'newest', title: 'newest' });
      await flushMicrotasks();

      const [newest, middle, oldest] = screen.getAllByTestId('root');
      expect(middle).toHaveTextContent('middle');

      await fireEvent.keyDown(button, { key: 'F6' });
      const viewport = screen.getByTestId('viewport');
      const guard = document.querySelector('[data-vase-ui-focus-guard]') as HTMLElement;
      await fireEvent.focusIn(guard, { relatedTarget: viewport });

      expect(newest).toHaveFocus();

      // Dismissing both in one go leaves the middle toast animating out while
      // the focused toast closes, so focus has to skip over it.
      manager.close('middle');
      manager.close('newest');
      await flushMicrotasks();

      expect(middle).toHaveAttribute('data-ending-style');
      expect(oldest).toHaveFocus();
    });

    it('leaves focus alone when it is outside the viewport', async () => {
      const manager = Toast.createToastManager();

      await render(
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      button.focus();
      await flushMicrotasks();
      await fireEvent.click(button);
      await fireEvent.click(button);

      // Focus never entered the viewport, so closing a toast must not steal it.
      manager.close();
      await flushMicrotasks();

      expect(button).toHaveFocus();
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
          <Toast.Viewport data-testid="viewport">
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

  describe('real browser input', () => {
    const TitleList = defineComponent({
      setup() {
        const { toasts } = Toast.useToastManager();
        return () =>
          toasts.value.map((toast) => (
            <Toast.Root key={toast.id} toast={toast} data-testid={toast.id}>
              <Toast.Title data-testid={`${toast.id}-title`} />
            </Toast.Root>
          ));
      },
    });

    it('returns focus to the origin when onClose adds an unmounted replacement toast', async () => {
      const { userEvent } = await import('vitest/browser');
      const manager = Toast.createToastManager();
      await render(
        <Toast.Provider toastManager={manager} timeout={0}>
          <button type="button">origin</button>
          <Toast.Viewport data-testid="viewport">
            <TitleList />
          </Toast.Viewport>
        </Toast.Provider>,
      );
      const origin = screen.getByRole('button', { name: 'origin' });
      manager.add({
        id: 'first',
        title: 'first',
        onClose: () => manager.add({ id: 'replacement', title: 'replacement' }),
      });
      origin.focus();
      await flushMicrotasks();

      await userEvent.keyboard('{F6}{Tab}');
      await flushMicrotasks();
      expect(screen.getByTestId('first')).toHaveFocus();

      await userEvent.keyboard('{Escape}');
      await flushMicrotasks();
      expect(await screen.findByTestId('replacement')).toBeInTheDocument();
      expect(screen.queryByTestId('first')).not.toBeInTheDocument();
      expect(origin).toHaveFocus();
    });

    it.each([
      {
        name: 'hidden',
        disable: (element: HTMLButtonElement) => {
          element.hidden = true;
        },
      },
      {
        name: 'disabled',
        disable: (element: HTMLButtonElement) => {
          element.disabled = true;
        },
      },
      {
        name: 'inert',
        disable: (element: HTMLButtonElement) => {
          element.inert = true;
        },
      },
    ])('leaves F6 to the browser when its origin becomes $name', async ({ disable }) => {
      const manager = Toast.createToastManager();
      const { user } = await render(
        <Toast.Provider toastManager={manager}>
          <button type="button">origin</button>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
        </Toast.Provider>,
      );
      const origin = screen.getByRole<HTMLButtonElement>('button', { name: 'origin' });
      manager.add({ title: 'title' });
      origin.focus();
      await flushMicrotasks();
      await user.keyboard('{F6}');
      const viewport = screen.getByTestId('viewport');
      expect(viewport).toHaveFocus();
      disable(origin);

      expect(await fireEvent.keyDown(viewport, { key: 'F6' })).toBe(true);
    });

    it('moves focus to a visible toast when the next one was limited', async () => {
      const { userEvent } = await import('vitest/browser');
      const manager = Toast.createToastManager();

      await render(
        <Toast.Provider toastManager={manager} limit={2} timeout={0}>
          <Toast.Viewport data-testid="viewport">
            <TitleList />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      manager.add({ id: 'oldest', title: 'oldest' });
      manager.add({ id: 'middle', title: 'middle' });
      manager.add({ id: 'newest', title: 'newest' });
      await flushMicrotasks();

      const middle = screen.getByTestId('middle');
      expect(screen.getByTestId('oldest')).toHaveAttribute('inert');

      await userEvent.keyboard('{F6}');
      await flushMicrotasks();
      expect(screen.getByTestId('viewport')).toHaveFocus();

      middle.focus();
      await flushMicrotasks();
      expect(middle).toHaveFocus();
      expect(middle.matches(':focus-visible')).toBe(true);

      await userEvent.keyboard('{Escape}');
      await flushMicrotasks();
      await waitFor(() => {
        expect(middle).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('newest')).toHaveFocus();
    });

    it('moves focus to a toast that stays open when onClose closes another', async () => {
      const { userEvent } = await import('vitest/browser');
      const manager = Toast.createToastManager();

      await render(
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport data-testid="viewport">
            <TitleList />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      manager.add({ id: 'oldest', title: 'oldest' });
      manager.add({
        id: 'middle',
        title: 'middle',
        onClose: () => manager.close('oldest'),
      });
      manager.add({ id: 'newest', title: 'newest' });
      await flushMicrotasks();

      const middle = screen.getByTestId('middle');
      const oldest = screen.getByTestId('oldest');

      await userEvent.keyboard('{F6}');
      await flushMicrotasks();
      middle.focus();
      await flushMicrotasks();
      expect(middle.matches(':focus-visible')).toBe(true);

      await userEvent.keyboard('{Escape}');
      await flushMicrotasks();
      await waitFor(() => {
        expect(middle).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(oldest).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('newest')).toHaveFocus();
    });

    it('moves focus to the next toast when the closed toast adds one in onClose', async () => {
      const { userEvent } = await import('vitest/browser');
      const manager = Toast.createToastManager();

      await render(
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport data-testid="viewport">
            <TitleList />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      manager.add({ id: 'oldest', title: 'oldest' });
      manager.add({
        id: 'middle',
        title: 'middle',
        onClose: () => manager.add({ id: 'added', title: 'added' }),
      });
      manager.add({ id: 'newest', title: 'newest' });
      await flushMicrotasks();

      const middle = screen.getByTestId('middle');

      await userEvent.keyboard('{F6}');
      await flushMicrotasks();
      middle.focus();
      await flushMicrotasks();
      expect(middle.matches(':focus-visible')).toBe(true);

      await userEvent.keyboard('{Escape}');
      await flushMicrotasks();
      await waitFor(() => {
        expect(middle).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('added')).toBeInTheDocument();
      expect(screen.getByTestId('oldest')).toHaveFocus();
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
