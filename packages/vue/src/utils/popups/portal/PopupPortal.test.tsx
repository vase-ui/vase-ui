import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, onMounted, onUnmounted, shallowRef, watch } from 'vue';
import type { Component, PropType } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import { useFloating } from '../../../../test/fixtures/useFloating';
import { FloatingFocusManager } from '../../../../test/fixtures/floatingFocusManagerHarness';
import { usePortalFocus } from './usePortalFocus';
import PopupPortal from './PopupPortal.vue';
import type { PortalTarget } from './PopupPortal.vue';

type RenderSlotProps = { props: Record<string, unknown>; children: Component };

const App = defineComponent({
  props: {
    container: {
      type: [Object, String] as PropType<PortalTarget>,
      default: undefined,
    },
  },
  setup(props) {
    const open = shallowRef(false);

    return () => (
      <>
        <button
          data-testid="reference"
          onClick={() => {
            open.value = !open.value;
          }}
        />
        <PopupPortal guards={usePortalFocus} to={props.container}>
          {open.value && <div data-testid="floating" />}
        </PopupPortal>
      </>
    );
  },
});

describe('FloatingPortal', () => {
  const { render } = createRenderer();

  test('allows custom containers', async () => {
    const customRoot = document.createElement('div');
    customRoot.id = 'custom-root';
    document.body.appendChild(customRoot);
    await render(<App container={customRoot} />);
    await fireEvent.click(screen.getByTestId('reference'));

    await flushMicrotasks();

    const parent = screen.getByTestId('floating').parentElement;
    expect(parent?.hasAttribute('data-vase-ui-portal')).toBe(true);
    expect(parent?.parentElement).toBe(customRoot);
    customRoot.remove();
  });

  test('allows containers to be initially null', async () => {
    const RootApp = defineComponent({
      setup() {
        const container = shallowRef<HTMLElement | null>(null);
        const renderContainer = shallowRef(false);

        onMounted(() => {
          renderContainer.value = true;
        });

        return () => (
          <>
            {renderContainer.value && (
              <div
                ref={(element) => {
                  container.value = element as HTMLElement | null;
                }}
                data-testid="root"
              />
            )}
            <App container={container.value} />
          </>
        );
      },
    });

    await render(<RootApp />);

    await fireEvent.click(screen.getByTestId('reference'));
    await flushMicrotasks();

    const subRoot = screen.getByTestId('floating').parentElement;
    const root = screen.getByTestId('root');
    expect(root).toBe(subRoot?.parentElement);
  });

  test('reattaches the portal when the container changes', async () => {
    const customRoot = document.createElement('div');
    document.body.appendChild(customRoot);

    try {
      const RootSwitcher = defineComponent({
        setup() {
          const container = shallowRef<PortalTarget>();

          return () => (
            <>
              <App container={container.value} />
              <button
                onClick={() => {
                  container.value = undefined;
                }}
                data-testid="use-undefined"
              />
              <button
                onClick={() => {
                  container.value = customRoot;
                }}
                data-testid="use-element"
              />
            </>
          );
        },
      });

      await render(<RootSwitcher />);

      await fireEvent.click(screen.getByTestId('reference'));

      expect((await screen.findByTestId('floating')).parentElement?.parentElement).toBe(
        document.body,
      );

      await fireEvent.click(screen.getByTestId('use-element'));

      expect((await screen.findByTestId('floating')).parentElement?.parentElement).toBe(customRoot);

      await fireEvent.click(screen.getByTestId('use-undefined'));

      const floatingInBodyAgain = await screen.findByTestId('floating');
      expect(floatingInBodyAgain.parentElement?.parentElement).toBe(document.body);
      expect(customRoot.contains(floatingInBodyAgain)).toBe(false);
    } finally {
      customRoot.remove();
    }
  });

  test('forwards HTML props to the portal element', async () => {
    await render(
      <PopupPortal guards={usePortalFocus} data-testid="portal-element" class="closed">
        <div />
      </PopupPortal>,
    );

    await flushMicrotasks();

    const portal = document.querySelector('[data-testid="portal-element"]') as HTMLElement | null;
    expect(portal).not.toBeNull();
    expect(portal).toHaveClass('closed');
    expect(portal).toHaveAttribute('data-vase-ui-portal');
  });

  test('uses the rendered portal ID for the aria-owns relationship', async () => {
    const Test = defineComponent({
      setup() {
        const { context, refs } = useFloating({ open: true });

        return () => (
          <PopupPortal guards={usePortalFocus} id="custom-portal">
            <FloatingFocusManager store={context.rootStore} modal={false}>
              <div ref={refs.setFloating} />
            </FloatingFocusManager>
          </PopupPortal>
        );
      },
    });

    await render(<Test />);
    await flushMicrotasks();

    expect(document.querySelector('[aria-owns]')).toHaveAttribute('aria-owns', 'custom-portal');
  });

  test('FloatingPortalLite forwards HTML props to the portal element', async () => {
    await render(
      <PopupPortal data-testid="lite-portal">
        <div />
      </PopupPortal>,
    );

    await flushMicrotasks();

    const portal = document.querySelector('[data-testid="lite-portal"]');
    expect(portal).not.toBeNull();
  });
});

describe('focus in the millisecond of the mount', () => {
  const { render } = createRenderer();

  // A mocked clock moves only in `render`, `rerender`, `setProps` and `waitForLaterMillisecond`.
  // The focus of the case thus comes in the millisecond in which Vue attached the listener of the
  // input.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('gives a focus in the popup to the Vue listener of the target', async () => {
    const focusin = vi.fn();
    const FocusOnMount = defineComponent(() => {
      onMounted(() => {
        screen.getByTestId('input').focus();
      });
      return () => null;
    });
    const Popup = defineComponent(() => {
      const open = shallowRef(false);
      return () => (
        <>
          <button
            data-testid="reference"
            onClick={() => {
              open.value = true;
            }}
          />
          <PopupPortal guards={usePortalFocus}>
            {open.value && [<input data-testid="input" onFocusin={focusin} />, <FocusOnMount />]}
          </PopupPortal>
        </>
      );
    });
    await render(<Popup />);

    await fireEvent.click(screen.getByTestId('reference'));
    const input = await screen.findByTestId('input');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    expect(focusin).toHaveBeenCalledTimes(1);
  });
});

describe.each([
  { name: 'FloatingPortal', guards: usePortalFocus },
  { name: 'FloatingPortalLite', guards: undefined },
])('$name slot: render', ({ guards }) => {
  const { render } = createRenderer();

  test('puts the content of children in the portal element of the #render slot', async () => {
    await render(
      <PopupPortal guards={guards}
        v-slots={{
          render: ({ props, children }: RenderSlotProps) => (
            <section {...props} data-testid="portal-element">
              {h(children, null, () => (
                <div data-testid="content" />
              ))}
            </section>
          ),
        }}
      />,
    );
    await flushMicrotasks();

    expect(screen.getByTestId('portal-element')).toContainElement(screen.getByTestId('content'));
  });

  test('warns when the #render slot does not mount children', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await render(
      <PopupPortal guards={guards}
        v-slots={{
          render: ({ props }: RenderSlotProps) => (
            <section {...props} data-testid="portal-element" />
          ),
        }}
      />,
    );
    await flushMicrotasks();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('The `#render` slot did not mount `children`');
  });
});

describe.each([
  { name: 'FloatingPortal', guards: usePortalFocus },
  { name: 'FloatingPortalLite', guards: undefined },
])('$name container resolution', ({ guards }) => {
  const { render: renderPortal } = createRenderer();

  test('mounts children once in a connected container when a later update replaces its ref', async () => {
    const counts = { mounted: 0, unmounted: 0 };
    const connectedAtMount: (boolean | undefined)[] = [];
    const Content = defineComponent({
      setup() {
        const content = shallowRef<HTMLDivElement | null>(null);
        onMounted(() => {
          counts.mounted += 1;
          connectedAtMount.push(content.value?.isConnected);
        });
        onUnmounted(() => {
          counts.unmounted += 1;
        });
        return () => <div ref={content} data-testid="content" />;
      },
    });
    const Test = defineComponent({
      setup() {
        const container = shallowRef<HTMLDivElement | null>(null);
        const step = shallowRef(0);

        function advance() {
          if (step.value < 2) {
            step.value += 1;
          }
        }
        onMounted(advance);
        watch(step, advance, { flush: 'post' });

        return () => {
          const containerId = step.value < 2 ? 'first' : 'second';
          return (
            <>
              <PopupPortal guards={guards} to={container.value ?? undefined} data-testid="portal">
                <Content />
              </PopupPortal>
              <div key={containerId} ref={container} data-testid={containerId} />
            </>
          );
        };
      },
    });

    await renderPortal(<Test />);

    expect(screen.getByTestId('portal').parentElement).toBe(screen.getByTestId('second'));
    expect(counts).toEqual({ mounted: 1, unmounted: 0 });
    expect(connectedAtMount).toEqual([true]);
  });

  test.each([
    { ancestor: true, strict: false },
    { ancestor: false, strict: false },
  ])(
    'mounts directly inside a ref attached later in the commit (ancestor=$ancestor, strict=$strict)',
    async ({ ancestor }) => {
      const parents = new Set<ParentNode | null>();
      function addParents(records: MutationRecord[]) {
        for (const { addedNodes, target } of records) {
          for (const node of addedNodes) {
            if ((node as Element).hasAttribute?.('data-vase-ui-portal')) {
              parents.add(target as ParentNode);
            }
          }
        }
      }
      const observer = new MutationObserver(addParents);
      observer.observe(document.body, { childList: true, subtree: true });

      const Test = defineComponent({
        setup() {
          const container = shallowRef<HTMLDivElement | null>(null);
          return () => {
            const content = (
              <PopupPortal guards={guards} to={container.value}>
                <div data-testid="content" />
              </PopupPortal>
            );
            return ancestor ? (
              <div ref={container} data-testid="container">
                {content}
              </div>
            ) : (
              <>
                {content}
                <div ref={container} data-testid="container" />
              </>
            );
          };
        },
      });

      await renderPortal(<Test />);
      addParents(observer.takeRecords());
      observer.disconnect();

      const container = screen.getByTestId('container');
      expect(container).toContainElement(screen.getByTestId('content'));
      // The portal must never mount in the fallback container, even temporarily.
      expect(parents).toEqual(new Set([container]));
    },
  );

  test('mounts inside an ancestor ref before the next paint', async () => {
    const visible = shallowRef(false);
    const Content = defineComponent({
      setup() {
        const container = shallowRef<HTMLDivElement | null>(null);
        return () => (
          <div ref={container} data-testid="container">
            <PopupPortal guards={guards} to={container.value}>
              <div data-testid="content" />
            </PopupPortal>
          </div>
        );
      },
    });

    const Test = defineComponent({ setup: () => () => (visible.value ? <Content /> : null) });

    await renderPortal(<Test />);
    expect(screen.queryByTestId('container')).toBe(null);

    // Both callbacks run in one frame with a microtask checkpoint between them, so the second
    // one sees the DOM that the browser paints after the update.
    const mountedBeforePaint = await new Promise<boolean>((resolve) => {
      requestAnimationFrame(() => {
        visible.value = true;
      });
      requestAnimationFrame(() => {
        resolve(screen.getByTestId('container').contains(screen.queryByTestId('content')));
      });
    });

    expect(mountedBeforePaint).toBe(true);
  });

  test('keeps content connected when an indicator exit removes the container in the same checkpoint', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const content = shallowRef<HTMLDivElement | null>(null);
    const visible = shallowRef(false);

    const Test = defineComponent({
      setup() {
        const container = shallowRef<HTMLSpanElement | null>(null);
        return () => (
          <>
            <style>{`
              @keyframes indicator-exit { from { opacity: 1; } to { opacity: 0; } }
              .indicator[data-ending-style] { animation: indicator-exit 100ms paused; }
            `}</style>
            {visible.value && (
              <PopupPortal guards={guards} to={container.value ?? undefined}>
                <div ref={content} />
              </PopupPortal>
            )}
            <Checkbox.Root defaultChecked>
              <Checkbox.Indicator class="indicator" data-testid="indicator">
                {visible.value && <span ref={container} />}
              </Checkbox.Indicator>
            </Checkbox.Root>
          </>
        );
      },
    });

    const { user } = await renderPortal(<Test />);
    await user.click(screen.getByRole('checkbox'));
    // Wait until the indicator has registered its own completion handler.
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-ending-style');
    const [animation] = indicator.getAnimations();

    // The write queues the flush of Vue before the callbacks of `animation.finished`. That flush
    // mounts the portal in the span of the indicator. The indicator then unmounts in a later
    // microtask of the same checkpoint, and the span leaves the document.
    visible.value = true;
    animation.finish();
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });

    expect(screen.queryByTestId('indicator')).toBe(null);
    expect(content.value?.isConnected).toBe(true);
  });

  test('mounts deeply nested portals inside their ancestor refs', async () => {
    const Nested = defineComponent({
      props: { remaining: { type: Number, required: true } },
      setup(props) {
        const container = shallowRef<HTMLDivElement | null>(null);
        return () => (
          <div ref={container} data-testid="nested-container">
            <PopupPortal guards={guards} to={container.value} data-testid="nested-portal">
              {props.remaining > 1 ? (
                <Nested remaining={props.remaining - 1} />
              ) : (
                <div data-testid="leaf" />
              )}
            </PopupPortal>
          </div>
        );
      },
    });

    await renderPortal(<Nested remaining={18} />);

    expect(screen.getByTestId('leaf')).toBeInTheDocument();
    expect(screen.getAllByTestId('nested-portal').map((node) => node.parentElement)).toEqual(
      screen.getAllByTestId('nested-container'),
    );
  });

  test('batches sibling portals without adding commits for each container ref', async () => {
    let commitCount = 0;
    const observer = new MutationObserver(() => {
      commitCount += 1;
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const Item = defineComponent({
      setup() {
        const container = shallowRef<HTMLDivElement | null>(null);
        return () => (
          <div ref={container} data-testid="container">
            <PopupPortal guards={guards} to={container.value}>
              <div data-testid="content" />
            </PopupPortal>
          </div>
        );
      },
    });

    const Test = defineComponent({
      props: { count: { type: Number, required: true } },
      setup(props) {
        return () => Array.from({ length: props.count }, (_, index) => <Item key={index} />);
      },
    });

    const { unmount } = await renderPortal(<Test count={1} />);
    expect(screen.getByTestId('container')).toContainElement(screen.getByTestId('content'));
    const singlePortalCommitCount = commitCount;
    expect(singlePortalCommitCount).toBeGreaterThan(0);
    unmount();
    await flushMicrotasks();
    commitCount = 0;

    await renderPortal(<Test count={20} />);

    expect(screen.getAllByTestId('content')).toHaveLength(20);
    expect(
      screen.getAllByTestId('content').map((node) => node.parentElement?.parentElement),
    ).toEqual(screen.getAllByTestId('container'));
    expect(commitCount).toBe(singlePortalCommitCount);
    observer.disconnect();
  });

  test.each([{ nested: false }, { nested: true }])(
    'uses the fallback container when a ref stays empty (nested=$nested)',
    async ({ nested }) => {
      const container = shallowRef<HTMLDivElement | null>(null);
      const content = (
        <PopupPortal guards={guards} to={container.value ?? undefined} data-testid="portal">
          <div data-testid="content" />
        </PopupPortal>
      );

      await renderPortal(
        nested ? <PopupPortal guards={usePortalFocus} data-testid="parent">{content}</PopupPortal> : content,
      );

      const fallback = nested ? screen.getByTestId('parent') : document.body;
      expect(screen.getByTestId('portal').parentElement).toBe(fallback);
      expect(fallback).toContainElement(screen.getByTestId('content'));
    },
  );

  test.each([{ clear: false }, { clear: true }])(
    'cancels a queued container check when the container prop changes (clear=$clear)',
    async ({ clear }) => {
      const firstContainer = shallowRef<HTMLDivElement | null>(null);
      const secondContainer = shallowRef<HTMLDivElement | null>(null);

      const Test = defineComponent({
        setup() {
          const step = shallowRef(0);

          function advance() {
            if (step.value < 2) {
              step.value += 1;
            }
          }
          onMounted(advance);
          watch(step, advance, { flush: 'post' });

          return () => {
            const nextContainer = clear ? null : secondContainer.value;
            return (
              <>
                <PopupPortal guards={guards}
                  to={step.value < 2 ? firstContainer.value : nextContainer}
                  data-testid="portal"
                >
                  <div data-testid="content" />
                </PopupPortal>
                <div ref={firstContainer} data-testid="first" />
                <div ref={secondContainer} data-testid="second" />
              </>
            );
          };
        },
      });

      await renderPortal(<Test />);

      // Vue 3.5.12 leaves an empty text node in the old target of a `Teleport`.
      expect(screen.getByTestId('first').innerHTML).toBe('');
      expect(screen.queryByTestId('portal')?.parentElement ?? null).toBe(
        clear ? null : screen.getByTestId('second'),
      );
    },
  );
});
