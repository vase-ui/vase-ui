import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, Teleport, computed, defineComponent, shallowRef } from 'vue';
import type { PropType } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import { platform } from '../../../common/platform';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { useFloating } from '../../../../test/fixtures/useFloating';
import { createAttribute } from '../createAttribute';
import type { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { useFocus } from './useFocus';
import type { UseFocusProps } from './useFocus';

// A module namespace is read-only. The mock gives `os` and `engine` as plain objects, so a case can
// set `mac` and `webkit`. Both start `false`, so a case does not depend on the engine that runs it.
vi.mock('../../../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../../../common/platform')>(
    '../../../common/platform',
  );
  return {
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, mac: false },
      engine: { ...actual.platform.engine, webkit: false },
    },
  };
});

function setSafariOnMac() {
  function define(value: boolean) {
    Object.defineProperty(platform.os, 'mac', { value, configurable: true });
    Object.defineProperty(platform.engine, 'webkit', { value, configurable: true });
  }

  define(true);
  onTestFinished(() => define(false));
}

describe('useFocus', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not reopen when focus is restored after leaving the tab', async () => {
    const App = defineComponent({
      setup() {
        const open = shallowRef(false);
        const { refs, context } = useFloating({
          open,
          onOpenChange(nextOpen) {
            open.value = nextOpen;
          },
        });
        const focusProps = useFocus(context.rootStore, { delay: 100 });

        return () => (
          <>
            <button {...focusProps} ref={refs.setReference} />
            {open.value && <div role="tooltip" ref={refs.setFloating} />}
          </>
        );
      },
    });

    await render(<App />);
    const button = screen.getByRole('button');

    button.focus();
    await flushMicrotasks();

    window.dispatchEvent(new Event('blur'));
    await fireEvent.focusIn(button);

    vi.advanceTimersByTime(200);
    await flushMicrotasks();

    expect(screen.queryByRole('tooltip')).toBe(null);
  });

  describe('rules with no Base UI case', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    interface Call {
      open: boolean;
      reason: string;
      trigger: string | undefined;
    }

    // A trigger part: it calls `useFocus` and registers its element as a trigger of the store.
    const Trigger = defineComponent({
      props: {
        id: { type: String, required: true },
        store: { type: Object as PropType<FloatingRootStore>, required: true },
        options: { type: Object as PropType<UseFocusProps>, required: true },
      },
      setup(props) {
        const focusProps = useFocus(() => props.store, props.options);

        return () => (
          <button
            id={props.id}
            data-testid={props.id}
            {...focusProps}
            ref={(node) => {
              if (node) {
                props.store.context.triggerElements.add(props.id, node as Element);
              }
            }}
          />
        );
      },
    });

    // `KeepAlive` deactivates what it holds while `Other` shows. It does not unmount it.
    const Other = defineComponent({ setup: () => () => <p>other</p> });

    // Two triggers of one popup, and a button outside. The second trigger is in a `KeepAlive`, so a
    // case can deactivate it alone. As a popup root does, the app moves the anchor to the trigger
    // that opens the popup. The span beside the popup is a focus guard of the focus manager. The
    // popup can be in a shadow root.
    function createFocusApp(
      options: UseFocusProps = {},
      {
        secondOptions = options,
        shadowRoot,
      }: { secondOptions?: UseFocusProps; shadowRoot?: ShadowRoot } = {},
    ) {
      const calls: Call[] = [];
      const open = shallowRef(false);
      const showSecond = shallowRef(true);
      let store!: FloatingRootStore;

      const App = defineComponent({
        setup() {
          const { refs, context } = useFloating({
            open,
            onOpenChange(nextOpen, details: VaseUIChangeEventDetails<string>) {
              calls.push({ open: nextOpen, reason: details.reason, trigger: details.trigger?.id });
              if (nextOpen && details.trigger) {
                refs.setReference(details.trigger);
              }
              open.value = nextOpen;
            },
          });
          store = context.rootStore;

          return () => {
            const popup = open.value && (
              <div data-testid="popup" tabindex={-1} ref={refs.setFloating} />
            );

            return (
              <>
                <Trigger id="trigger" store={store} options={options} />
                <KeepAlive>
                  {showSecond.value ? (
                    <Trigger key="second" id="second" store={store} options={secondOptions} />
                  ) : (
                    <Other key="other" />
                  )}
                </KeepAlive>
                {shadowRoot ? <Teleport to={shadowRoot}>{popup}</Teleport> : popup}
                <span
                  data-testid="guard"
                  tabindex={0}
                  {...{ [createAttribute('focus-guard')]: '', 'data-type': 'outside' }}
                />
                <button data-testid="outside" />
              </>
            );
          };
        },
      });

      return { App, calls, showSecond, getStore: () => store };
    }

    // One trigger. `opened` lists the store that gets each open request. A change of `second`
    // moves the trigger to another store.
    function createSingleTriggerApp(options: UseFocusProps = {}) {
      const second = shallowRef(false);
      const opened: string[] = [];

      const App = defineComponent({
        setup() {
          const stores = {
            first: useFloating({ onOpenChange: () => opened.push('first') }).context.rootStore,
            second: useFloating({ onOpenChange: () => opened.push('second') }).context.rootStore,
          };
          const store = computed(() => (second.value ? stores.second : stores.first));
          const focusProps = useFocus(store, options);

          return () => <button data-testid="trigger" {...focusProps} />;
        },
      });

      return { App, second, opened };
    }

    type SingleTriggerApp = ReturnType<typeof createSingleTriggerApp>['App'];

    async function renderInKeepAlive(App: SingleTriggerApp) {
      const show = shallowRef(true);
      await render(() => (
        <KeepAlive>{show.value ? <App key="app" /> : <Other key="other" />}</KeepAlive>
      ));

      return {
        async toggle(visible: boolean) {
          show.value = visible;
          await flushMicrotasks();
        },
      };
    }

    // The ways to release a trigger. `start` renders the trigger and gives the function that
    // releases it. A `KeepAlive` that unmounts deactivates its child first, so the unmount case
    // renders with no `KeepAlive`.
    const releases = [
      {
        name: 'the trigger unmounts',
        async start(App: SingleTriggerApp) {
          const { unmount } = await render(<App />);
          return unmount;
        },
      },
      {
        name: 'KeepAlive deactivates the trigger',
        async start(App: SingleTriggerApp) {
          const view = await renderInKeepAlive(App);
          return () => view.toggle(false);
        },
      },
    ];

    const getTrigger = () => screen.getByTestId('trigger');
    const getSecond = () => screen.getByTestId('second');
    const isOpen = () => screen.queryByTestId('popup') !== null;

    async function focus(element: HTMLElement) {
      element.focus();
      await flushMicrotasks();
    }

    async function tick(ms: number) {
      vi.advanceTimersByTime(ms);
      await flushMicrotasks();
    }

    it.each([
      { name: 'at once with no delay', delay: undefined, openAt99: true },
      { name: 'after a delay of 100 ms', delay: 100, openAt99: false },
    ])('opens $name, with the reason trigger-focus', async ({ delay, openAt99 }) => {
      const { App, calls } = createFocusApp({ delay });
      await render(<App />);

      await focus(getTrigger());
      await tick(99);
      expect(isOpen()).toBe(openAt99);

      await tick(1);
      expect(isOpen()).toBe(true);
      expect(calls).toEqual([{ open: true, reason: REASONS.triggerFocus, trigger: 'trigger' }]);
    });

    it('reads the delay when the focus comes', async () => {
      const delay = shallowRef(100);
      const { App } = createFocusApp({ delay });
      await render(<App />);
      delay.value = 300;

      await focus(getTrigger());
      await tick(299);
      expect(isOpen()).toBe(false);

      await tick(1);
      expect(isOpen()).toBe(true);
    });

    it('does not open for a focus event of an element that is not focus-visible', async () => {
      const { App } = createFocusApp();
      await render(<App />);

      // A dispatched event moves no focus, so the trigger does not match `:focus-visible`.
      await fireEvent.focusIn(getTrigger());
      await tick(1000);

      expect(isOpen()).toBe(false);
    });

    it('does not open while it is disabled', async () => {
      const { App } = createFocusApp({ enabled: false });
      await render(<App />);

      await focus(getTrigger());
      await tick(1000);

      expect(isOpen()).toBe(false);
    });

    it('does not open when the focus leaves before the delay ends', async () => {
      const { App } = createFocusApp({ delay: 100 });
      await render(<App />);
      await focus(getTrigger());
      await tick(50);

      await focus(screen.getByTestId('outside'));
      await tick(200);

      expect(isOpen()).toBe(false);
    });

    it('opens at once when the focus moves from another trigger while the popup is open', async () => {
      const { App, calls } = createFocusApp({ delay: 100 });
      await render(<App />);
      await focus(getTrigger());
      await tick(100);
      expect(isOpen()).toBe(true);

      await focus(getSecond());
      await tick(0);

      expect(isOpen()).toBe(true);
      expect(calls.map((call) => [call.open, call.trigger])).toEqual([
        [true, 'trigger'],
        [true, 'second'],
      ]);
    });

    it.each([
      { name: 'an element outside', target: 'outside', stays: false },
      { name: 'the popup', target: 'popup', stays: true },
      { name: 'a focus guard of the popup', target: 'guard', stays: true },
    ])('with the focus moved to $name, the popup stays open: $stays', async (row) => {
      const { App, calls } = createFocusApp();
      await render(<App />);
      await focus(getTrigger());
      expect(isOpen()).toBe(true);

      await focus(screen.getByTestId(row.target));
      await tick(0);

      expect(isOpen()).toBe(row.stays);
      expect(calls.filter((call) => !call.open)).toEqual(
        row.stays ? [] : [{ open: false, reason: REASONS.triggerFocus, trigger: undefined }],
      );
    });

    it('keeps the popup open when the focus moves to a trigger that does not open it', async () => {
      const { App, calls } = createFocusApp({}, { secondOptions: { enabled: false } });
      await render(<App />);
      await focus(getTrigger());

      await focus(getSecond());
      await tick(0);

      expect(isOpen()).toBe(true);
      expect(calls.map((call) => call.open)).toEqual([true]);
    });

    it('keeps the popup open when the focus moves into a popup in a shadow root', async () => {
      const host = document.createElement('div');
      document.body.append(host);
      onTestFinished(() => host.remove());
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const { App, calls } = createFocusApp({}, { shadowRoot });
      await render(<App />);
      await focus(getTrigger());

      // The related target of the focus out is the host of the shadow root, which is not in the
      // popup.
      await focus(shadowRoot.querySelector<HTMLElement>('[data-testid="popup"]')!);
      await tick(0);

      expect(calls.map((call) => call.open)).toEqual([true]);
    });

    describe('after a dismissal by Escape or by a press of the trigger', () => {
      async function dismiss(reason: string) {
        const app = createFocusApp();
        await render(<app.App />);
        await focus(getTrigger());
        expect(isOpen()).toBe(true);

        app.getStore().setOpen(false, createChangeEventDetails(reason));
        await flushMicrotasks();
        expect(isOpen()).toBe(false);
      }

      it.each([
        { name: 'Escape', reason: REASONS.escapeKey },
        { name: 'a press of the trigger', reason: REASONS.triggerPress },
      ])('the focus of the trigger does not open the popup after $name', async ({ reason }) => {
        await dismiss(reason);

        await fireEvent.focusIn(getTrigger());

        expect(isOpen()).toBe(false);
      });

      it.each([
        { name: 'a mouse leave of the trigger', reset: () => fireEvent.mouseLeave(getTrigger()) },
        { name: 'a focus out of the trigger', reset: () => fireEvent.focusOut(getTrigger()) },
      ])('$name lets the focus open the popup again', async ({ reset }) => {
        await dismiss(REASONS.escapeKey);

        await reset();
        await fireEvent.focusIn(getTrigger());

        expect(isOpen()).toBe(true);
      });

      it('the focus of another trigger opens the popup', async () => {
        await dismiss(REASONS.escapeKey);

        await focus(getSecond());

        expect(isOpen()).toBe(true);
      });
    });

    describe('Safari on a Mac', () => {
      const App = defineComponent({
        setup() {
          const open = shallowRef(false);
          const { refs, context } = useFloating({
            open,
            onOpenChange(nextOpen) {
              open.value = nextOpen;
            },
          });
          const focusProps = useFocus(context.rootStore);

          return () => (
            <>
              <button data-testid="button" {...focusProps} ref={refs.setReference} />
              <input data-testid="input" {...focusProps} />
              {open.value && <div data-testid="popup" ref={refs.setFloating} />}
            </>
          );
        },
      });

      it.each([
        {
          name: 'a pointer press, a button',
          events: ['pointerdown'],
          target: 'button',
          opens: false,
        },
        {
          name: 'a pointer press, a text field',
          events: ['pointerdown'],
          target: 'input',
          opens: true,
        },
        {
          name: 'a key press after a pointer press',
          events: ['pointerdown', 'keydown'],
          target: 'button',
          opens: true,
        },
      ])('after $name, the first focus opens the popup: $opens', async (row) => {
        setSafariOnMac();
        await render(<App />);

        for (const type of row.events) {
          window.dispatchEvent(new Event(type));
        }
        await focus(screen.getByTestId(row.target));

        expect(isOpen()).toBe(row.opens);
      });
    });

    describe('the timer of the open delay', () => {
      it.each(releases)('stops when $name', async ({ start }) => {
        const { App, opened } = createSingleTriggerApp({ delay: 500 });
        const release = await start(App);
        const timersAfterMount = vi.getTimerCount();
        await focus(getTrigger());
        expect(vi.getTimerCount()).toBe(timersAfterMount + 1);

        await release();
        expect(vi.getTimerCount()).toBe(timersAfterMount);

        await tick(1000);
        expect(opened).toEqual([]);
      });

      describe('VUE-31: the trigger stops its open delay when it gets disabled or changes its store', () => {
        it('stops when the trigger gets disabled', async () => {
          const enabled = shallowRef(true);
          const { App, opened } = createSingleTriggerApp({ delay: 500, enabled });
          await render(<App />);
          const timersAfterMount = vi.getTimerCount();
          await focus(getTrigger());
          expect(vi.getTimerCount()).toBe(timersAfterMount + 1);

          enabled.value = false;
          await flushMicrotasks();
          expect(vi.getTimerCount()).toBe(timersAfterMount);

          await tick(1000);
          expect(opened).toEqual([]);
        });

        it('stops when the store changes', async () => {
          const { App, second, opened } = createSingleTriggerApp({ delay: 500 });
          await render(<App />);
          const timersAfterMount = vi.getTimerCount();
          await focus(getTrigger());
          expect(vi.getTimerCount()).toBe(timersAfterMount + 1);

          second.value = true;
          await flushMicrotasks();
          expect(vi.getTimerCount()).toBe(timersAfterMount);

          await tick(1000);
          expect(opened).toEqual([]);
        });
      });
    });

    describe('the blur listener of the window', () => {
      // Gives the number of `blur` listeners that the window got since the call.
      function trackBlurListeners() {
        const listeners = new Set<unknown>();
        const add = window.addEventListener.bind(window);
        const remove = window.removeEventListener.bind(window);
        vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
          if (type === 'blur') {
            listeners.add(listener);
          }
          add(type, listener, options);
        });
        vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener, options) => {
          if (type === 'blur') {
            listeners.delete(listener);
          }
          remove(type, listener, options);
        });
        return () => listeners.size;
      }

      it.each(releases)('is removed when $name', async ({ start }) => {
        const listeners = trackBlurListeners();
        const { App } = createSingleTriggerApp();
        const release = await start(App);
        expect(listeners()).toBe(1);

        await release();

        expect(listeners()).toBe(0);
      });

      it('is removed while the trigger is disabled, and added again when it is enabled', async () => {
        const enabled = shallowRef(true);
        const listeners = trackBlurListeners();
        const { App } = createSingleTriggerApp({ enabled });
        await render(<App />);
        expect(listeners()).toBe(1);

        enabled.value = false;
        await flushMicrotasks();
        expect(listeners()).toBe(0);

        enabled.value = true;
        await flushMicrotasks();
        expect(listeners()).toBe(1);
      });

      it('is added again when KeepAlive activates the trigger', async () => {
        const listeners = trackBlurListeners();
        const { App } = createSingleTriggerApp();
        const view = await renderInKeepAlive(App);
        await view.toggle(false);
        expect(listeners()).toBe(0);

        await view.toggle(true);

        expect(listeners()).toBe(1);
      });
    });

    describe('VUE-32: a popup that focus opened closes when KeepAlive deactivates its trigger', () => {
      it('closes the popup one time', async () => {
        const { App, calls, showSecond } = createFocusApp();
        await render(<App />);
        await focus(getSecond());
        expect(isOpen()).toBe(true);

        showSecond.value = false;
        await flushMicrotasks();
        // Chromium sends a `focusout` for the removal of the focused trigger. The check that the
        // event starts must not close the popup a second time.
        await tick(100);

        expect(isOpen()).toBe(false);
        expect(calls).toEqual([
          { open: true, reason: REASONS.triggerFocus, trigger: 'second' },
          { open: false, reason: REASONS.triggerFocus, trigger: undefined },
        ]);
      });

      it('keeps a popup that another trigger anchors', async () => {
        const { App, calls, showSecond } = createFocusApp();
        await render(<App />);
        await focus(getSecond());
        await focus(getTrigger());
        await tick(0);

        showSecond.value = false;
        await flushMicrotasks();

        expect(isOpen()).toBe(true);
        expect(calls.map((call) => call.open)).toEqual([true, true]);
      });

      it('keeps a popup that a press opened', async () => {
        const { App, calls, showSecond, getStore } = createFocusApp();
        await render(<App />);
        await focus(getSecond());
        getStore().setOpen(false, createChangeEventDetails(REASONS.escapeKey));
        await flushMicrotasks();
        getStore().setOpen(
          true,
          createChangeEventDetails(REASONS.triggerPress, new MouseEvent('click'), getSecond()),
        );
        await flushMicrotasks();
        expect(isOpen()).toBe(true);

        showSecond.value = false;
        await flushMicrotasks();

        expect(isOpen()).toBe(true);
        expect(calls.map((call) => [call.open, call.reason])).toEqual([
          [true, REASONS.triggerFocus],
          [false, REASONS.escapeKey],
          [true, REASONS.triggerPress],
        ]);
      });
    });
  });
});
