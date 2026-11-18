import { expect, vi, describe, it, onTestFinished } from 'vitest';
import { defineComponent, KeepAlive, nextTick, onMounted, shallowRef, watch } from 'vue';
import type { HTMLAttributes } from 'vue';
import { Collapsible } from '@vase-ui/vue/collapsible';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  nextEndingStyle,
  nextEvent,
  renderOnServer,
  screen,
  seekBeforeEnd,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import CollapsiblePanelHydration from './CollapsiblePanelHydration.test.vue';
import CollapsiblePanelScoped from './CollapsiblePanelScoped.test.vue';

const PANEL_CONTENT = 'This is panel content';

type RenderArguments = { props: HTMLProps; state: Collapsible.Panel.State };

function fireBeforeMatch(element: Element) {
  return fireEvent(
    element,
    new window.Event('beforematch', {
      bubbles: true,
      cancelable: false,
    }),
  );
}

// A reopen sets `data-starting-style`, and a later frame removes it. The observer records it.
function recordStartingStyle(panel: HTMLElement) {
  let seen = false;
  const observer = new MutationObserver(() => {
    seen ||= panel.hasAttribute('data-starting-style');
  });
  observer.observe(panel, { attributes: true, attributeFilter: ['data-starting-style'] });
  onTestFinished(() => observer.disconnect());
  return { seen: () => seen };
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

// A part that can render no element sets its exposed `element` with a function ref. Vue sets a ref
// object after the render, and the panel reads `element` during its own patch.
const PanelThatMountsDuringEnding = defineComponent({
  name: 'PanelThatMountsDuringEnding',
  inheritAttrs: false,
  props: {
    open: { type: Boolean, required: true },
    transitionStatus: { type: String, default: undefined },
    onRender: { type: Function, default: undefined },
  },
  setup(props, { attrs, expose, slots }) {
    const element = shallowRef<HTMLElement | null>(null);
    expose({ element });

    return () => {
      props.onRender?.(props.transitionStatus);

      if (!props.open && props.transitionStatus !== 'ending') {
        return null;
      }

      return (
        <div
          {...(attrs as HTMLAttributes)}
          ref={(value) => {
            element.value = value as HTMLElement | null;
          }}
        >
          {slots.default?.()}
        </div>
      );
    };
  },
});

const RemovablePanel = defineComponent({
  name: 'RemovablePanel',
  inheritAttrs: false,
  props: { open: { type: Boolean, required: true } },
  setup(props, { attrs, expose, slots }) {
    const element = shallowRef<HTMLElement | null>(null);
    expose({ element });

    return () =>
      props.open ? (
        <div
          {...(attrs as HTMLAttributes)}
          ref={(value) => {
            element.value = value as HTMLElement | null;
          }}
        >
          {slots.default?.()}
        </div>
      ) : null;
  },
});

describe('<Collapsible.Panel />', () => {
  const { render } = createRenderer();

  describeConformance(<Collapsible.Panel />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => {
      return render(<Collapsible.Root defaultOpen>{node}</Collapsible.Root>);
    },
  }));

  it('VUE-144: restores the layout styles when the panel unmounts before its first open frame', async () => {
    const open = shallowRef(false);
    const { unmount } = await render(() => (
      <Collapsible.Root open={open.value}>
        <Collapsible.Panel
          data-testid="panel"
          style={{ justifyContent: 'center !important', transition: 'height 1s' }}
        >
          Content
        </Collapsible.Panel>
      </Collapsible.Root>
    ));
    vi.useFakeTimers();
    try {
      open.value = true;
      await nextTick();
      const panel = screen.getByTestId('panel');
      expect(panel.style.justifyContent).toBe('initial');

      unmount();
      expect(panel.style.justifyContent).toBe('center');
      expect(panel.style.getPropertyPriority('justify-content')).toBe('important');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops the close animation check when KeepAlive holds the panel', async () => {
    const open = shallowRef(true);
    const shown = shallowRef(true);
    await render(() => (
      <Collapsible.Root open={open.value}>
        <KeepAlive>
          {shown.value && (
            <Collapsible.Panel keepMounted data-testid="panel" style={{ transition: 'height 1s' }}>
              Content
            </Collapsible.Panel>
          )}
        </KeepAlive>
      </Collapsible.Root>
    ));
    const panel = screen.getByTestId('panel');
    const disabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    vi.useFakeTimers();
    try {
      open.value = false;
      await nextTick();
      vi.advanceTimersToNextFrame();
      await nextTick();
      expect(panel).toHaveAttribute('data-ending-style');
      shown.value = false;
      await nextTick();

      const reads = vi.spyOn(panel, 'getAnimations');
      vi.advanceTimersByTime(100);
      await nextTick();
      expect(reads).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      globalThis.VASE_UI_ANIMATIONS_DISABLED = disabled;
    }
  });

  describe('VUE-60: the panel has one root node', () => {
    const FIXTURE = 'src/collapsible/panel/CollapsiblePanelScoped.test.vue';

    it('gives the scope id of the consumer to an element that mounts after the part', async () => {
      await render(<CollapsiblePanelScoped />);
      expect(screen.queryByTestId('panel')).toBe(null);

      await fireEvent.click(screen.getByTestId('trigger'));

      expect(getComputedStyle(screen.getByTestId('panel')).outlineStyle).toBe('dashed');
    });

    it('hides its element with v-show', async () => {
      const shown = shallowRef(true);
      await render(() => <CollapsiblePanelScoped defaultOpen shown={shown.value} />);
      const panel = screen.getByTestId('panel');
      expect(getComputedStyle(panel).display).toBe('block');

      shown.value = false;
      await nextTick();

      expect(getComputedStyle(panel).display).toBe('none');
    });

    it('enters with the Transition of the consumer', async () => {
      const onBeforeEnter = vi.fn();
      await render(<CollapsiblePanelScoped inTransition onBeforeEnter={onBeforeEnter} />);
      expect(onBeforeEnter).not.toHaveBeenCalled();

      await fireEvent.click(screen.getByTestId('trigger'));

      expect(onBeforeEnter).toHaveBeenCalledExactlyOnceWith(screen.getByTestId('panel'));
    });

    it('has the scope id of the consumer in the server HTML, and keeps it after the hydration', async () => {
      const props = { defaultOpen: true };
      const serverHtml = await renderOnServer(FIXTURE, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverPanel = template.content.querySelector('[data-testid="panel"]')!;
      expect(
        serverPanel.getAttributeNames().filter((name) => name.startsWith('data-v-')),
      ).toHaveLength(1);

      const { container } = await hydrate(CollapsiblePanelScoped, { serverHtml, props });

      expect(getComputedStyle(container.querySelector('[data-testid="panel"]')!).outlineStyle).toBe(
        'dashed',
      );
    });
  });

  it('warns when hiddenUntilFound overrides keepMounted={false}', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <Collapsible.Root>
          <Collapsible.Panel hiddenUntilFound keepMounted={false}>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>,
      );

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        'Vase UI: The `keepMounted` prop of `Collapsible.Panel` is `false` and `hiddenUntilFound` is enabled. The panel must stay mounted while it is closed, so `keepMounted` has no effect. Remove `keepMounted`, or remove `hiddenUntilFound`.',
      );
      expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe('prop: keepMounted', () => {
    it('does not unmount the panel when true', async () => {
      const App = defineComponent(() => {
        const open = shallowRef(false);
        return () => (
          <Collapsible.Root
            open={open.value}
            onOpenChange={(nextOpen: boolean) => {
              open.value = nextOpen;
            }}
          >
            <Collapsible.Trigger />
            <Collapsible.Panel keepMounted>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
        );
      });

      await render(<App />);

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).not.toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-closed');

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.queryByText(PANEL_CONTENT)?.getAttribute('id'),
      );
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger.getAttribute('aria-controls')).toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).not.toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-closed');
    });

    it.skipIf(isJSDOM)(
      'hides the panel after external controlled close when true and no animations are applied',
      async () => {
        const App = defineComponent(() => {
          const open = shallowRef(false);

          return () => (
            <>
              <Collapsible.Root
                open={open.value}
                onOpenChange={(nextOpen: boolean) => {
                  open.value = nextOpen;
                }}
              >
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel keepMounted>{PANEL_CONTENT}</Collapsible.Panel>
              </Collapsible.Root>

              <button
                type="button"
                onClick={() => {
                  open.value = !open.value;
                }}
              >
                toggle externally
              </button>
            </>
          );
        });

        const { user } = await render(<App />);

        const trigger = screen.getByRole('button', { name: 'Trigger' });
        const externalTrigger = screen.getByRole('button', { name: 'toggle externally' });
        const panel = screen.getByText(PANEL_CONTENT);

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(panel).toHaveAttribute('hidden');
        expect(panel).toHaveAttribute('data-closed');
        expect(panel).not.toHaveAttribute('data-ending-style');

        await user.click(externalTrigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(panel).not.toHaveAttribute('hidden');
        expect(panel).toHaveAttribute('data-open');

        await user.click(externalTrigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(panel).toHaveAttribute('hidden');
        expect(panel).toHaveAttribute('data-closed');
        expect(panel).not.toHaveAttribute('data-ending-style');
      },
    );
  });

  it('unmounts a panel that mounts after the close has already entered the ending phase', async () => {
    const renderedStatuses: (string | undefined)[] = [];

    await render(
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel
          v-slots={{
            render: ({ props, state }: RenderArguments) => (
              <PanelThatMountsDuringEnding
                {...props}
                open={state.open}
                transitionStatus={state.transitionStatus}
                onRender={(status: string | undefined) => renderedStatuses.push(status)}
              >
                {PANEL_CONTENT}
              </PanelThatMountsDuringEnding>
            ),
          }}
        />
      </Collapsible.Root>,
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));

    await waitForAnimationFrame();
    await flushMicrotasks();

    expect(renderedStatuses).toContain('ending');
    expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
  });

  describe.skipIf(isJSDOM)('CSS transitions', () => {
    it('applies data-starting-style while opening', async () => {
      await render(
        <>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition: height 100ms linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="transition-test-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      // Nothing waits for a frame here, so the transient starting-style render is observable.
      await fireEvent.click(trigger);

      const panel = screen.getByTestId('panel');

      expect(panel).toHaveAttribute('data-starting-style');
      expect(panel).toHaveAttribute('data-open');
    });

    it('restores a measured height before applying closing transition styles', async () => {
      const { user } = await render(
        <>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition: height 100ms linear;
            }

            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="transition-test-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await waitFor(() => {
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });

      // With animations off, the panel leaves the document one frame after it gets the ending
      // style. The case reads the size in the update that gives the style.
      await nextEndingStyle(panel, { action: () => user.click(trigger) });

      expect({
        endingStyle: panel.hasAttribute('data-ending-style'),
        height: panel.style.getPropertyValue('--collapsible-panel-height'),
      }).toEqual({ endingStyle: true, height: expect.stringMatching(/px$/) });
    });

    it('unmounts a zero-size panel without waiting for unrelated transitions', async () => {
      await render(
        <>
          <style>{`
            .zero-size-panel {
              overflow: hidden;
              width: 0;
              height: 0;
              opacity: 1;
              transition: opacity 10s linear;
            }

            .zero-size-panel[data-ending-style] {
              opacity: 0;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="zero-size-panel" data-testid="panel" />
          </Collapsible.Root>
        </>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      expect(screen.getByTestId('panel')).toHaveAttribute('data-open');

      await fireEvent.click(trigger);
      await waitForAnimationFrame();
      await flushMicrotasks();

      expect(screen.queryByTestId('panel')).toBe(null);
    });

    it('finishes closing when the render function removes the panel element', async () => {
      const onOpenChange = vi.fn();

      const { user } = await render(
        <Collapsible.Root defaultOpen onOpenChange={onOpenChange}>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel
            v-slots={{
              render: ({ props, state }: RenderArguments) => (
                <RemovablePanel {...props} open={state.open}>
                  {PANEL_CONTENT}
                </RemovablePanel>
              ),
            }}
            style={{ transition: 'height 100ms linear' }}
          />
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      expect(screen.getByText(PANEL_CONTENT)).toHaveAttribute('data-open');

      await user.click(trigger);
      await waitForAnimationFrame();
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
      expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
      // Closing settles even though no element is left to animate.
      expect(trigger).not.toHaveAttribute('data-ending-style');
    });

    it('preserves inline alignment styles while measuring an opening panel', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        await render(
          <>
            <style>{`
              @keyframes panel-fade-in {
                from {
                  opacity: 0;
                }

                to {
                  opacity: 1;
                }
              }

              .mixed-motion-panel {
                height: var(--collapsible-panel-height);
                transition: height 100ms linear;
                animation: panel-fade-in 100ms linear;
              }

              .mixed-motion-panel[data-starting-style] {
                height: 0;
              }
            `}</style>

            <Collapsible.Root>
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel
                class="mixed-motion-panel"
                data-testid="panel"
                keepMounted
                style={{ justifyContent: 'center' }}
              >
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>,
        );

        const trigger = screen.getByRole('button', { name: 'Trigger' });
        const panel = screen.getByTestId('panel');

        await fireEvent.click(trigger);

        expect(panel).toHaveAttribute('data-starting-style');
        expect(panel.style.getPropertyValue('justify-content')).toBe('initial');
        expect(panel.style.getPropertyPriority('justify-content')).toBe('important');
        expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
          'Vase UI: A panel of Collapsible or Accordion has a CSS transition and a CSS animation. The part waits for one of them only, so it treats the panel as a transition. Use only a transition or only an animation on the panel.',
        );

        await waitForAnimationFrame();
        await flushMicrotasks();

        expect(panel.style.justifyContent).toBe('center');
        expect(warnSpy).toHaveBeenCalledTimes(1);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('keeps exit transitions working after a close is interrupted by reopening', async () => {
      // Keep the close running long enough for a slow run to interrupt it. Without animations,
      // the close ends one frame after `data-ending-style`.
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const { user } = await render(
        <>
          <style>{`
            .interruptible-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition: height 10s linear;
            }

            .interruptible-panel[data-starting-style],
            .interruptible-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="interruptible-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await nextEndingStyle(panel, { action: () => user.click(trigger) });
      expect(panel).toHaveAttribute('data-ending-style');

      const startingStyle = recordStartingStyle(panel);
      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });
      await waitFor(() => {
        expect(startingStyle.seen()).toBe(true);
      });
      await waitFor(() => {
        expect(panel).not.toHaveAttribute('data-starting-style');
      });

      // The wait resolves only for an ending style that comes after the click.
      await nextEndingStyle(panel, { action: () => fireEvent.click(trigger) });
      expect(panel).toHaveAttribute('data-ending-style');
      expect(screen.getByTestId('panel')).toBe(panel);
    });

    it('keeps the measured size when an open animation finishes during a close commit', async () => {
      const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort').mockImplementation(() => {});
      let animationStarted = false;
      const animation = new Animation(new KeyframeEffect(null, [], 10_000), document.timeline);
      animation.play();

      const ResolveAnimationOnClose = defineComponent({
        props: { open: { type: Boolean, required: true } },
        setup(props) {
          const resolveAnimation = () => {
            if (!props.open && animationStarted) {
              animation.finish();
            }
          };
          onMounted(resolveAnimation);
          watch(() => props.open, resolveAnimation, { flush: 'post' });

          return () => null;
        },
      });

      const setPanelRef = (node: HTMLDivElement | null) => {
        if (node) {
          node.getAnimations = () => {
            if (node.hasAttribute('data-open')) {
              animationStarted = true;
              return [animation];
            }

            return [];
          };
        }
      };

      try {
        await render(
          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              keepMounted
              v-slots={{
                render: ({ props, state }: RenderArguments) => (
                  <div
                    {...props}
                    ref={(node) => {
                      props.ref(node as HTMLDivElement | null);
                      setPanelRef(node as HTMLDivElement | null);
                    }}
                  >
                    <ResolveAnimationOnClose open={state.open} />
                    {PANEL_CONTENT}
                  </div>
                ),
              }}
              style={{ transition: 'height 10s linear' }}
            />
          </Collapsible.Root>,
        );

        const panel = screen.getByText(PANEL_CONTENT);

        await waitForAnimationFrame();
        await flushMicrotasks();
        expect(animationStarted).toBe(true);

        await fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
        await flushMicrotasks();

        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toMatch(/px$/);
      } finally {
        animation.cancel();
        abortSpy.mockRestore();
        globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
      }
    });

    it('does not restart the entrance transition when a close animation finishes after reopening', async () => {
      const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort').mockImplementation(() => {});
      let closeAnimationStarted = false;
      const closeAnimation = new Animation(new KeyframeEffect(null, [], 10_000), document.timeline);
      closeAnimation.play();

      const setPanelRef = (node: HTMLDivElement | null) => {
        if (node) {
          node.getAnimations = () => {
            if (node.hasAttribute('data-ending-style')) {
              closeAnimationStarted = true;
              return [closeAnimation];
            }

            return [];
          };
        }
      };

      try {
        // Vue drops a ref on a vnode that the body of the test makes. The ref is therefore in a
        // render function.
        await render(() => (
          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              ref={(component) => {
                setPanelRef(
                  (component as { element: HTMLDivElement | null } | null)?.element ?? null,
                );
              }}
              style={{ transition: 'height 10s linear' }}
            >
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        ));

        const trigger = screen.getByRole('button', { name: 'Trigger' });
        const panel = screen.getByText(PANEL_CONTENT);

        await fireEvent.click(trigger);
        await waitFor(() => {
          expect(closeAnimationStarted).toBe(true);
        });

        const startingStyle = recordStartingStyle(panel);
        await fireEvent.click(trigger);
        await waitFor(() => {
          expect(panel).toHaveAttribute('data-open');
        });
        await waitFor(() => {
          expect(startingStyle.seen()).toBe(true);
        });
        await waitFor(() => {
          expect(panel).not.toHaveAttribute('data-starting-style');
        });

        closeAnimation.finish();
        await flushMicrotasks();

        expect(panel).toHaveAttribute('data-open');
        expect(panel).not.toHaveAttribute('data-starting-style');
        expect(screen.getByText(PANEL_CONTENT)).toBe(panel);
      } finally {
        closeAnimation.cancel();
        abortSpy.mockRestore();
        globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
      }
    });
  });

  describe.skipIf(isJSDOM)('CSS animations', () => {
    it('does not run the mount animation when initially open', async () => {
      await render(
        <>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            .animation-test-panel[data-open] {
              overflow: hidden;
              animation: panel-slide-down 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="animation-test-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>,
      );

      const panel = screen.getByTestId('panel');

      expect(panel).toHaveAttribute('data-open');
      expect(panel.getAnimations().length).toBe(0);
      expect(getComputedStyle(panel).animationName).toBe('none');
    });

    it('animates on reopen after an initially open panel is removed by the render function', async () => {
      const { user } = await render(
        <>
          <style>{`
            @keyframes removable-panel-open {
              from {
                opacity: 0;
              }

              to {
                opacity: 1;
              }
            }

            .removable-animation-panel[data-open] {
              animation: removable-panel-open 10s linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              class="removable-animation-panel"
              data-testid="panel"
              v-slots={{
                render: ({ props, state }: RenderArguments) => (
                  <RemovablePanel {...props} open={state.open}>
                    {PANEL_CONTENT}
                  </RemovablePanel>
                ),
              }}
            />
          </Collapsible.Root>
        </>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(screen.getByTestId('panel').getAnimations()).toHaveLength(0);

      await user.click(trigger);

      expect(screen.queryByTestId('panel')).toBe(null);

      await user.click(trigger);

      const panel = screen.getByTestId('panel');
      expect(panel).toHaveAttribute('data-open');
      expect(getComputedStyle(panel).animationName).toBe('removable-panel-open');
      expect(panel.getAnimations()).toHaveLength(1);
    });

    it('still animates on close and reopen after being initially open', async () => {
      // With the animations of the part off, the part hides the panel one frame after the ending
      // style, and the browser cancels the animation.
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const { user } = await render(
        <>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            @keyframes panel-slide-up {
              from {
                height: var(--collapsible-panel-height);
              }

              to {
                height: 0;
              }
            }

            .animation-test-panel[data-open] {
              overflow: hidden;
              animation: panel-slide-down 100ms linear;
            }

            .animation-test-panel[data-closed] {
              overflow: hidden;
              animation: panel-slide-up 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="animation-test-panel" data-testid="panel" keepMounted>
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      expect(panel.getAnimations().length).toBe(0);

      // The state exists only while the animation runs. The listener exists before the click, so
      // the test reads the state when the animation starts.
      const closing = nextEvent(panel, 'animationstart').then((event) => ({
        closed: panel.hasAttribute('data-closed'),
        animationName: (event as AnimationEvent).animationName,
      }));
      const [closingState] = await Promise.all([closing, user.click(trigger)]);
      expect(closingState).toEqual({ closed: true, animationName: 'panel-slide-up' });

      await waitFor(() => {
        expect(panel).toHaveAttribute('hidden');
      });

      const opening = nextEvent(panel, 'animationstart').then((event) => ({
        open: panel.hasAttribute('data-open'),
        animationName: (event as AnimationEvent).animationName,
      }));
      const [openingState] = await Promise.all([opening, user.click(trigger)]);
      expect(openingState).toEqual({ open: true, animationName: 'panel-slide-down' });
    });

    it('restores measured dimensions before applying a closing keyframe animation', async () => {
      // With the animations of the part off, the part removes the panel one frame after the ending
      // style, and the browser cancels the animation before it ends.
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const { user } = await render(
        <>
          <style>{`
            @keyframes panel-slide-up {
              from {
                height: var(--collapsible-panel-height);
              }

              to {
                height: 0;
              }
            }

            .closing-animation-panel[data-closed] {
              overflow: hidden;
              animation: panel-slide-up 100s linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="closing-animation-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await waitFor(() => {
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });

      // Base UI's exit lasts 100 ms. This exit lasts 100 s, so no late frame ends it before the
      // case reads it.
      await nextEndingStyle(panel, { action: () => user.click(trigger) });
      const exitAnimations = panel.getAnimations();

      expect({
        endingStyle: panel.hasAttribute('data-ending-style'),
        height: panel.style.getPropertyValue('--collapsible-panel-height'),
        animations: exitAnimations.length,
      }).toEqual({ endingStyle: true, height: expect.stringMatching(/px$/), animations: 1 });

      // The size must stay in pixels until the animation ends. A callback of `finished` runs
      // before the part completes the close.
      const heightAtEnd = Promise.all(exitAnimations.map((animation) => animation.finished)).then(
        () => panel.style.getPropertyValue('--collapsible-panel-height'),
      );
      seekBeforeEnd(exitAnimations, 50);
      expect(await heightAtEnd).toMatch(/px$/);

      await waitFor(() => {
        expect(panel).not.toBeInTheDocument();
      });
      expect(screen.queryByTestId('panel')).toBe(null);
    });

    it('still animates on reopen after being initially open when only open keyframes are defined', async () => {
      const { user } = await render(
        <>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            .animation-test-panel[data-open] {
              overflow: hidden;
              animation: panel-slide-down 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="animation-test-panel" data-testid="panel" keepMounted>
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      expect(panel.getAnimations().length).toBe(0);

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-closed');
      });

      // The state exists only while the animation runs. The listener exists before the click, so
      // the test reads the state when the animation starts.
      const opening = nextEvent(panel, 'animationstart').then((event) => ({
        open: panel.hasAttribute('data-open'),
        animationName: (event as AnimationEvent).animationName,
      }));
      const [openingState] = await Promise.all([opening, user.click(trigger)]);
      expect(openingState).toEqual({ open: true, animationName: 'panel-slide-down' });
    });
  });

  describe.skipIf(isJSDOM)('React.Activity', () => {
    it('does not replay open transitions when revealing an initially open panel', async () => {
      const App = defineComponent(() => {
        const visible = shallowRef(true);

        return () => (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition: height 100ms linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button
              type="button"
              onClick={() => {
                visible.value = !visible.value;
              }}
            >
              toggle activity
            </button>

            <KeepAlive>
              {visible.value ? (
                <Collapsible.Root defaultOpen>
                  <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                  <Collapsible.Panel class="transition-test-panel" data-testid="panel">
                    {PANEL_CONTENT}
                  </Collapsible.Panel>
                </Collapsible.Root>
              ) : null}
            </KeepAlive>
          </>
        );
      });

      const { user } = await render(<App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const panel = screen.getByTestId('panel');
      let transitionRuns = 0;

      panel.addEventListener('transitionrun', () => {
        transitionRuns += 1;
      });

      await waitFor(() => {
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });

      transitionRuns = 0;

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(transitionRuns).toBe(0);
    });

    it('does not replay open transitions when revealing a panel opened by the user', async () => {
      // Wait for the first opening transition before the checks for a replay after `KeepAlive`.
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const App = defineComponent(() => {
        const visible = shallowRef(true);

        return () => (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition: height 100ms linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button
              type="button"
              onClick={() => {
                visible.value = !visible.value;
              }}
            >
              toggle activity
            </button>

            <KeepAlive>
              {visible.value ? (
                <Collapsible.Root>
                  <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                  <Collapsible.Panel class="transition-test-panel" data-testid="panel" keepMounted>
                    {PANEL_CONTENT}
                  </Collapsible.Panel>
                </Collapsible.Root>
              ) : null}
            </KeepAlive>
          </>
        );
      });

      const { user } = await render(<App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');
      let transitionRuns = 0;

      panel.addEventListener('transitionrun', () => {
        transitionRuns += 1;
      });

      await user.click(trigger);

      // The height switches to auto once the opening transition ends.
      await waitFor(() => {
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });
      expect(panel).toHaveAttribute('data-open');

      transitionRuns = 0;

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(transitionRuns).toBe(0);
    });

    it('does not replay open keyframe animations when revealing an initially open panel', async () => {
      const App = defineComponent(() => {
        const visible = shallowRef(true);

        return () => (
          <>
            <style>{`
              @keyframes panel-slide-down {
                from {
                  height: 0;
                }

                to {
                  height: var(--collapsible-panel-height);
                }
              }

              .animation-test-panel[data-open] {
                overflow: hidden;
                animation: panel-slide-down 100ms linear;
              }
            `}</style>

            <button
              type="button"
              onClick={() => {
                visible.value = !visible.value;
              }}
            >
              toggle activity
            </button>

            <KeepAlive>
              {visible.value ? (
                <Collapsible.Root defaultOpen>
                  <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                  <Collapsible.Panel class="animation-test-panel" data-testid="panel" keepMounted>
                    {PANEL_CONTENT}
                  </Collapsible.Panel>
                </Collapsible.Root>
              ) : null}
            </KeepAlive>
          </>
        );
      });

      const { user } = await render(<App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const panel = screen.getByTestId('panel');

      await waitFor(() => {
        expect(panel.getAnimations().length).toBe(0);
      });

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(panel.getAnimations().length).toBe(0);
    });

    it('skips the initial open animation after a held mount and closes from its height', async () => {
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel class="animation-test-panel" data-testid="panel" keepMounted>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));
      const { user } = await render(
        <>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            @keyframes panel-slide-up {
              from {
                height: var(--collapsible-panel-height);
              }

              to {
                height: 0;
              }
            }

            .animation-test-panel[data-open] {
              overflow: hidden;
              animation: panel-slide-down 100s linear;
            }

            .animation-test-panel[data-closed] {
              overflow: hidden;
              animation: panel-slide-up 100s linear;
            }
          `}</style>
          <HeldBranch />
        </>,
      );

      await mountWhileHeld();
      await show();
      const panel = screen.getByTestId('panel');

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });
      expect(panel.getAnimations()).toHaveLength(0);

      const openHeight = `${panel.scrollHeight}px`;
      // The state exists only while the animation runs, so the listener reads it.
      const closing = nextEvent(panel, 'animationstart').then((event) => ({
        animationName: (event as AnimationEvent).animationName,
        height: panel.style.getPropertyValue('--collapsible-panel-height'),
      }));
      const [closingState] = await Promise.all([
        closing,
        user.click(screen.getByRole('button', { name: 'Trigger' })),
      ]);
      expect(closingState).toEqual({ animationName: 'panel-slide-up', height: openHeight });

      await waitSingleFrame();
      for (const animation of panel.getAnimations()) {
        animation.finish();
      }
      await waitFor(() => {
        expect(panel).toHaveAttribute('hidden');
      });
    });

    it('gives a closed held mount the shown attributes at its first activation', async () => {
      async function readAfterMount(heldMount: boolean) {
        const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
          () => (
            <Collapsible.Root>
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel class="animation-test-panel" data-testid="panel" hiddenUntilFound>
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          ),
          { mounted: !heldMount },
        );
        const { unmount } = await render(
          <>
            <style>{`
              @keyframes panel-slide-up {
                from {
                  height: var(--collapsible-panel-height);
                }

                to {
                  height: 0;
                }
              }

              .animation-test-panel[data-closed] {
                overflow: hidden;
                animation: panel-slide-up 100ms linear;
              }
            `}</style>
            <HeldBranch />
          </>,
        );
        if (heldMount) {
          await mountWhileHeld();
          await show();
        }
        const panel = screen.getByTestId('panel');
        const attributes = Object.fromEntries(
          Array.from(panel.attributes, ({ name, value }) => [name, value]),
        );
        unmount();
        return attributes;
      }

      const shownMount = await readAfterMount(false);
      const heldMount = await readAfterMount(true);

      expect(shownMount).not.toHaveProperty('data-starting-style');
      expect(heldMount).toEqual(shownMount);
    });

    it('does not replay open keyframe animations when revealing a panel opened by the user', async () => {
      const App = defineComponent(() => {
        const visible = shallowRef(true);

        return () => (
          <>
            <style>{`
              @keyframes panel-slide-down {
                from {
                  height: 0;
                }

                to {
                  height: var(--collapsible-panel-height);
                }
              }

              .animation-test-panel[data-open] {
                overflow: hidden;
                animation: panel-slide-down 100ms linear;
              }
            `}</style>

            <button
              type="button"
              onClick={() => {
                visible.value = !visible.value;
              }}
            >
              toggle activity
            </button>

            <KeepAlive>
              {visible.value ? (
                <Collapsible.Root>
                  <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                  <Collapsible.Panel class="animation-test-panel" data-testid="panel" keepMounted>
                    {PANEL_CONTENT}
                  </Collapsible.Panel>
                </Collapsible.Root>
              ) : null}
            </KeepAlive>
          </>
        );
      });

      const { user } = await render(<App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await waitFor(() => {
        expect(panel.getAnimations().length).toBe(0);
      });

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(panel.getAnimations().length).toBe(0);
    });

    it('does not replay open keyframe animations from inline styles when revealing a panel opened by the user', async () => {
      const App = defineComponent(() => {
        const visible = shallowRef(true);

        return () => (
          <>
            <style>{`
              @keyframes panel-slide-down {
                from {
                  height: 0;
                }

                to {
                  height: var(--collapsible-panel-height);
                }
              }
            `}</style>

            <button
              type="button"
              onClick={() => {
                visible.value = !visible.value;
              }}
            >
              toggle activity
            </button>

            <KeepAlive>
              {visible.value ? (
                <Collapsible.Root>
                  <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                  <Collapsible.Panel
                    data-testid="panel"
                    keepMounted
                    style={{
                      animationDuration: '100ms',
                      animationName: 'panel-slide-down',
                      animationTimingFunction: 'linear',
                      overflow: 'hidden',
                    }}
                  >
                    {PANEL_CONTENT}
                  </Collapsible.Panel>
                </Collapsible.Root>
              ) : null}
            </KeepAlive>
          </>
        );
      });

      const { user } = await render(<App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await waitFor(() => {
        expect(panel.getAnimations().length).toBe(0);
      });

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(panel.getAnimations().length).toBe(0);
    });

    it('is not named by the trigger while KeepAlive holds a panel that mounted in a held branch', async () => {
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <Collapsible.Panel key="panel" id="held-panel">
          Panel
        </Collapsible.Panel>
      ));
      await render(() => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <HeldBranch />
        </Collapsible.Root>
      ));
      const trigger = screen.getByRole('button');

      await mountWhileHeld();
      expect(trigger).not.toHaveAttribute('aria-controls', 'held-panel');

      await show();
      expect(trigger).toHaveAttribute('aria-controls', 'held-panel');
    });
  });

  // An engine with no `beforematch` cannot run these cases.
  describe.skipIf(isJSDOM || !('onbeforematch' in window))('interrupted beforematch opens', () => {
    it('keeps the temporary zero animation duration until the panel closes', async () => {
      function App() {
        return (
          <>
            <style>{`
              @keyframes panel-slide-down {
                from {
                  height: 0;
                }

                to {
                  height: var(--collapsible-panel-height);
                }
              }

              @keyframes panel-slide-up {
                from {
                  height: var(--collapsible-panel-height);
                }

                to {
                  height: 0;
                }
              }

              .animation-test-panel {
                overflow: hidden;
                animation-duration: 123ms;
              }

              .animation-test-panel[data-open] {
                animation-name: panel-slide-down;
              }

              .animation-test-panel[data-closed] {
                animation-name: panel-slide-up;
              }
            `}</style>

            <Collapsible.Root>
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel
                class="animation-test-panel"
                data-testid="panel"
                hiddenUntilFound
                keepMounted
              >
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        );
      }

      const { user } = await render(<App />);

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await fireBeforeMatch(panel);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await waitForAnimationFrame();
      await waitForAnimationFrame();
      await flushMicrotasks();

      expect(getComputedStyle(panel).animationDuration).toBe('0s');

      // The state exists only while the animation runs. The listener exists before the click, so
      // the test reads the state when the animation starts.
      const closing = nextEvent(panel, 'animationstart').then((event) => ({
        closed: panel.hasAttribute('data-closed'),
        animationName: (event as AnimationEvent).animationName,
      }));
      const [closingState] = await Promise.all([closing, user.click(trigger)]);
      expect(closingState).toEqual({ closed: true, animationName: 'panel-slide-up' });

      expect(getComputedStyle(panel).animationDuration).toBe('0.123s');
    });

    it('restores the transition duration before the first close after a beforematch open', async () => {
      // With the animations of the part off, the part hides the panel one frame after the ending
      // style, and the browser cancels the transition.
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      function App() {
        return (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition-property: height;
                transition-duration: 999ms;
                transition-timing-function: linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <Collapsible.Root>
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel
                class="transition-test-panel"
                data-testid="panel"
                hiddenUntilFound
                keepMounted
                style={{ transitionDuration: '123ms' }}
              >
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        );
      }

      const { user } = await render(<App />);

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await fireBeforeMatch(panel);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await waitForAnimationFrame();
      await waitForAnimationFrame();
      await flushMicrotasks();

      expect(getComputedStyle(panel).transitionDuration).toBe('0s');

      // The state exists only while the transition runs. The listener exists before the click, so
      // the test reads the state when the transition runs.
      const closing = nextEvent(panel, 'transitionrun').then((event) => ({
        endingStyle: panel.hasAttribute('data-ending-style'),
        transitionDuration: panel.style.transitionDuration,
        propertyName: (event as TransitionEvent).propertyName,
      }));
      const [closingState] = await Promise.all([closing, user.click(trigger)]);
      expect(closingState).toEqual({
        endingStyle: true,
        transitionDuration: '123ms',
        propertyName: 'height',
      });
    });

    it('does not suppress a later animated open after a no-motion beforematch open', async () => {
      const App = defineComponent(() => {
        const motionEnabled = shallowRef(false);

        return () => (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition: height 100ms linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button
              type="button"
              onClick={() => {
                motionEnabled.value = true;
              }}
            >
              enable motion
            </button>

            <Collapsible.Root>
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel
                class={motionEnabled.value ? 'transition-test-panel' : undefined}
                data-testid="panel"
                hiddenUntilFound
                keepMounted
                style={motionEnabled.value ? { transitionDuration: '123ms' } : undefined}
              >
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const enableMotion = screen.getByRole('button', { name: 'enable motion' });

      await fireBeforeMatch(panel);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-closed');
      });

      await user.click(enableMotion);
      await fireEvent.click(trigger);

      expect(panel).toHaveAttribute('data-open');
      expect(panel.style.transitionDuration).toBe('123ms');
    });

    it('restores the inline transition duration when an instant open is interrupted', async () => {
      const App = defineComponent(() => {
        const visible = shallowRef(true);

        return () => (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition-property: height;
                transition-duration: 999ms;
                transition-timing-function: linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button
              type="button"
              onClick={() => {
                visible.value = !visible.value;
              }}
            >
              toggle activity
            </button>

            <KeepAlive>
              {visible.value ? (
                <Collapsible.Root>
                  <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                  <Collapsible.Panel
                    class="transition-test-panel"
                    data-testid="panel"
                    hiddenUntilFound
                    keepMounted
                    style={{ transitionDuration: '123ms' }}
                  >
                    {PANEL_CONTENT}
                  </Collapsible.Panel>
                </Collapsible.Root>
              ) : null}
            </KeepAlive>
          </>
        );
      });

      await render(<App />);

      const panel = screen.getByTestId('panel');
      const toggle = screen.getByRole('button', { name: 'toggle activity' });

      await fireBeforeMatch(panel);
      await fireEvent.click(toggle);

      await fireEvent.click(toggle);

      await waitFor(() => {
        expect({
          open: panel.hasAttribute('data-open'),
          transitionDuration: panel.style.transitionDuration,
        }).toEqual({ open: true, transitionDuration: '123ms' });
      });
    });

    it('does not keep a hidden transition running after a hiddenUntilFound panel closes', async () => {
      function App() {
        return (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                opacity: 1;
                transition:
                  height 1000ms linear,
                  opacity 1000ms linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
                opacity: 0;
              }
            `}</style>

            <Collapsible.Root>
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel class="transition-test-panel" data-testid="panel" hiddenUntilFound>
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        );
      }

      const { user } = await render(<App />);

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('hidden', 'until-found');
      });

      await waitForAnimationFrame();
      await waitForAnimationFrame();
      await flushMicrotasks();

      expect(
        panel.getAnimations().filter((animation) => animation.playState !== 'finished').length,
      ).toBe(0);
      expect(getComputedStyle(panel).opacity).toBe('0');
    });
  });

  // An engine with no `beforematch` cannot run these cases.
  describe.skipIf(!('onbeforematch' in window) || isJSDOM)('prop: hiddenUntilFound', () => {
    it.each([
      { name: 'the decision timer', afterTimer: false },
      { name: 'the revert frame', afterTimer: true },
    ])('cancels $name when KeepAlive deactivates the panel', async ({ afterTimer }) => {
      const active = shallowRef(true);
      const searchable = shallowRef(true);
      await render(() => (
        <KeepAlive>
          {active.value ? (
            <Collapsible.Root key="panel" open={false}>
              <Collapsible.Panel
                hiddenUntilFound={searchable.value}
                keepMounted
                data-testid="panel"
              >
                Content
              </Collapsible.Panel>
            </Collapsible.Root>
          ) : null}
        </KeepAlive>
      ));
      const panel = screen.getByTestId('panel');
      expect(panel).toHaveAttribute('hidden', 'until-found');

      vi.useFakeTimers();
      try {
        await fireBeforeMatch(panel);
        panel.removeAttribute('hidden');
        if (afterTimer) {
          vi.advanceTimersByTime(0);
        }

        active.value = false;
        await nextTick();
        expect(panel).not.toBeInTheDocument();
        searchable.value = false;
        active.value = true;
        await nextTick();
        expect(panel).toHaveAttribute('hidden', '');

        await vi.advanceTimersByTimeAsync(32);

        expect(panel).toHaveAttribute('hidden', '');
      } finally {
        vi.useRealTimers();
      }
    });

    describe('VUE-133: a reveal that KeepAlive holds before its revert', () => {
      it.each([
        { name: 'ignored, before the timer', cancel: false, afterTimer: false },
        { name: 'ignored, before the frame', cancel: false, afterTimer: true },
        { name: 'canceled, before the timer', cancel: true, afterTimer: false },
      ])('hides the panel again at the activation: $name', async ({ cancel, afterTimer }) => {
        const active = shallowRef(true);
        await render(() => (
          <KeepAlive>
            {active.value ? (
              <Collapsible.Root
                key="panel"
                open={false}
                onOpenChange={(_open, details) => {
                  if (cancel) {
                    details.cancel();
                  }
                }}
              >
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel hiddenUntilFound keepMounted data-testid="panel">
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            ) : null}
          </KeepAlive>
        ));
        const panel = screen.getByTestId('panel');
        expect(panel).toHaveAttribute('hidden', 'until-found');

        vi.useFakeTimers();
        try {
          await fireBeforeMatch(panel);
          panel.removeAttribute('hidden');
          if (afterTimer) {
            vi.advanceTimersByTime(0);
          }

          active.value = false;
          await nextTick();
          await vi.advanceTimersByTimeAsync(64);

          expect(panel).not.toHaveAttribute('hidden');

          active.value = true;
          await nextTick();

          expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
            'aria-expanded',
            'false',
          );
          expect(panel).toHaveAttribute('hidden', 'until-found');
          expect(panel).toHaveAttribute('data-starting-style');
        } finally {
          vi.useRealTimers();
        }
      });

      it('keeps the motion of the next open', async () => {
        const active = shallowRef(true);
        const open = shallowRef(false);
        const { user } = await render(() => (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition-property: height;
                transition-duration: 999ms;
                transition-timing-function: linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>
            <KeepAlive>
              {active.value ? (
                <Collapsible.Root
                  key="panel"
                  open={open.value}
                  onOpenChange={(nextOpen, details) => {
                    if (details.reason !== REASONS.none) {
                      open.value = nextOpen;
                    }
                  }}
                >
                  <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                  <Collapsible.Panel
                    class="transition-test-panel"
                    data-testid="panel"
                    hiddenUntilFound
                    keepMounted
                    style={{ transitionDuration: '123ms' }}
                  >
                    {PANEL_CONTENT}
                  </Collapsible.Panel>
                </Collapsible.Root>
              ) : null}
            </KeepAlive>
          </>
        ));
        const panel = screen.getByTestId('panel');
        const trigger = screen.getByRole('button', { name: 'Trigger' });

        vi.useFakeTimers();
        try {
          await fireBeforeMatch(panel);
          panel.removeAttribute('hidden');
          active.value = false;
          await nextTick();
          active.value = true;
          await nextTick();
        } finally {
          vi.useRealTimers();
        }

        expect(panel).toHaveAttribute('hidden', 'until-found');

        await user.click(trigger);

        expect(panel).toHaveAttribute('data-open');
        expect(panel.style.transitionDuration).toBe('123ms');
      });

      it('leaves a panel open when its root opened it', async () => {
        const active = shallowRef(true);
        await render(() => (
          <KeepAlive>
            {active.value ? (
              <Collapsible.Root key="panel">
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel hiddenUntilFound keepMounted data-testid="panel">
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            ) : null}
          </KeepAlive>
        ));
        const panel = screen.getByTestId('panel');

        vi.useFakeTimers();
        try {
          await fireBeforeMatch(panel);
          panel.removeAttribute('hidden');
          active.value = false;
          await nextTick();
          active.value = true;
          await nextTick();
          await vi.advanceTimersByTimeAsync(64);

          expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
            'aria-expanded',
            'true',
          );
          expect(panel).toHaveAttribute('data-open');
          expect(panel).not.toHaveAttribute('hidden');
        } finally {
          vi.useRealTimers();
        }
      });
    });

    it('does not open or suppress the next trigger open when beforematch is canceled', async () => {
      const handleOpenChange = vi.fn(
        (nextOpen: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          if (eventDetails.reason === REASONS.none) {
            eventDetails.cancel();
          }
        },
      );

      const { user } = await render(
        <>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition-property: height;
              transition-duration: 999ms;
              transition-timing-function: linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root onOpenChange={handleOpenChange}>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              class="transition-test-panel"
              data-testid="panel"
              hiddenUntilFound
              keepMounted
              // A canceled `beforematch` must not install the temporary `0s` override.
              style={{ transitionDuration: '123ms' }}
            >
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>,
      );

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await fireBeforeMatch(panel);
      // The browser drops `hidden` as part of revealing the match, regardless of
      // what the event handler decided.
      panel.removeAttribute('hidden');

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(panel).toHaveAttribute('data-closed');
      // A canceled reveal must leave the collapsed styles in place.
      expect(panel).toHaveAttribute('data-starting-style');
      expect(getComputedStyle(panel).height).toBe('0px');

      // A canceled reveal must also stay hidden and searchable.
      await waitFor(() => {
        expect(panel).toHaveAttribute('hidden', 'until-found');
      });

      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledTimes(2);
      expect(panel).toHaveAttribute('data-open');
      expect(panel.style.transitionDuration).toBe('123ms');
    });

    it('expands the panel while beforematch is being dispatched', async () => {
      await render(
        <>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition-property: height;
              transition-duration: 999ms;
              transition-timing-function: linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="transition-test-panel" data-testid="panel" hiddenUntilFound>
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>,
      );

      const panel = screen.getByTestId('panel');

      expect(panel).toHaveAttribute('data-starting-style');

      let startingStyleWhenRevealed: boolean | undefined;
      let heightWhenRevealed: string | undefined;

      // This listener comes after the listener of the panel, so it sees the panel as the browser
      // does. The browser removes `hidden` and measures the match in the task that dispatches
      // `beforematch`. A panel that keeps its collapsed starting styles has no size at that time.
      panel.addEventListener('beforematch', () => {
        startingStyleWhenRevealed = panel.hasAttribute('data-starting-style');
        panel.removeAttribute('hidden');
        heightWhenRevealed = getComputedStyle(panel).height;
      });

      await fireBeforeMatch(panel);

      expect(startingStyleWhenRevealed).toBe(false);
      expect(heightWhenRevealed).not.toBe('0px');
    });

    it('re-collapses the panel when the open state never arrives', async () => {
      const App = defineComponent(() => {
        const open = shallowRef(false);
        const renderCount = shallowRef(0);

        return () => (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition-property: height;
                transition-duration: 999ms;
                transition-timing-function: linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button
              type="button"
              onClick={() => {
                renderCount.value += 1;
              }}
            >
              Rerender
            </button>

            <Collapsible.Root
              open={open.value}
              onOpenChange={(
                nextOpen: boolean,
                eventDetails: Collapsible.Root.ChangeEventDetails,
              ) => {
                // A find-in-page reveal gets no response here. A press of the trigger still opens the
                // panel.
                if (eventDetails.reason === REASONS.none) {
                  return;
                }

                open.value = nextOpen;
              }}
            >
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              {/* A part renders again only when its props change. The attribute changes, so the panel renders again. */}
              <Collapsible.Panel
                class="transition-test-panel"
                data-testid="panel"
                data-render={renderCount.value}
                hiddenUntilFound
                style={{ transitionDuration: '123ms' }}
              >
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const panel = screen.getByTestId('panel');

      expect(panel).toHaveAttribute('data-starting-style');

      await fireBeforeMatch(panel);
      // The browser drops `hidden` as part of revealing the match.
      panel.removeAttribute('hidden');

      await waitFor(() => {
        expect(panel).toHaveAttribute('hidden', 'until-found');
      });
      expect(panel).toHaveAttribute('data-starting-style');
      expect(getComputedStyle(panel).height).toBe('0px');

      await user.click(screen.getByRole('button', { name: 'Rerender' }));

      expect(panel).toHaveAttribute('data-render', '1');
      expect(panel).toHaveAttribute('data-starting-style');
      expect(getComputedStyle(panel).height).toBe('0px');

      // The reveal never opened the panel, so it must not consume the motion of the
      // next ordinary open.
      await user.click(screen.getByRole('button', { name: 'Trigger' }));

      expect(panel).toHaveAttribute('data-open');
      expect(getComputedStyle(panel).transitionDuration).toBe('0.123s');
    });

    it('re-collapses a keyframe panel when the open state never arrives', async () => {
      const App = defineComponent(() => {
        const open = shallowRef(false);

        return () => (
          <>
            <style>{`
              @keyframes test-panel-slide-down {
                from { height: 0; }
                to { height: var(--collapsible-panel-height); }
              }

              @keyframes test-panel-slide-up {
                from { height: var(--collapsible-panel-height); }
                to { height: 0; }
              }

              .animation-test-panel {
                overflow: hidden;
              }

              .animation-test-panel[data-open] {
                animation: test-panel-slide-down 100ms ease-out;
              }

              .animation-test-panel[data-closed] {
                animation: test-panel-slide-up 100ms ease-in;
              }
            `}</style>

            <Collapsible.Root
              open={open.value}
              onOpenChange={(
                nextOpen: boolean,
                eventDetails: Collapsible.Root.ChangeEventDetails,
              ) => {
                // A find-in-page reveal gets no response here. A press of the trigger still opens
                // the panel.
                if (eventDetails.reason === REASONS.none) {
                  return;
                }

                open.value = nextOpen;
              }}
            >
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel class="animation-test-panel" data-testid="panel" hiddenUntilFound>
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      // A full open and close cycle reaches the steady state. The closed panel then has no
      // `data-starting-style`. A keyframe panel keeps the attribute only until the part detects the
      // animation type.
      await user.click(trigger);
      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('hidden', 'until-found');
      });
      expect(panel).not.toHaveAttribute('data-starting-style');

      await fireBeforeMatch(panel);
      // The browser drops `hidden` as part of revealing the match.
      panel.removeAttribute('hidden');

      // The panel returns to the fully closed state without gaining attributes
      // Vue does not render for it.
      await waitFor(() => {
        expect(panel).toHaveAttribute('hidden', 'until-found');
      });
      expect(panel).not.toHaveAttribute('data-starting-style');

      // The reveal never opened the panel, so it must not consume the motion of
      // the next ordinary open.
      await user.click(trigger);

      expect(panel).toHaveAttribute('data-open');
      expect(getComputedStyle(panel).animationDuration).toBe('0.1s');
      expect(panel.getAnimations().length).toBeGreaterThan(0);
    });

    it('uses `hidden="until-found" to hide panel when true', async () => {
      const handleOpenChange = vi.fn();

      await render(
        <Collapsible.Root defaultOpen={false} onOpenChange={handleOpenChange}>
          <Collapsible.Trigger />
          <Collapsible.Panel hiddenUntilFound keepMounted>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>,
      );

      const panel = screen.getByText(PANEL_CONTENT);

      await fireBeforeMatch(panel);

      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(panel).toHaveAttribute('data-open');
    });
  });

  describe('hydration', () => {
    const FIXTURE = 'src/collapsible/panel/CollapsiblePanelHydration.test.vue';

    it.each([
      { name: 'an open panel', props: { defaultOpen: true } },
      { name: 'a closed panel with keepMounted', props: { keepMounted: true } },
      { name: 'a closed panel with hiddenUntilFound', props: { hiddenUntilFound: true } },
      {
        name: 'an open panel with an id',
        props: { defaultOpen: true, panelId: 'custom-panel-id' },
      },
    ])('hydrates $name with no warning and no DOM difference', async ({ props }) => {
      const serverHtml = await renderOnServer(FIXTURE, props);

      await hydrate(CollapsiblePanelHydration, { serverHtml, props });
    });

    it('has hidden="until-found" on a closed hiddenUntilFound panel after the hydration', async () => {
      const props = { hiddenUntilFound: true };
      const serverHtml = await renderOnServer(FIXTURE, props);

      const { container } = await hydrate(CollapsiblePanelHydration, { serverHtml, props });

      expect(container.querySelector('[data-testid="panel"]')!.getAttribute('hidden')).toBe(
        'until-found',
      );
    });

    it('VUE-80: names a panel with an id in aria-controls of the trigger in the server HTML and after the hydration', async () => {
      const props = { defaultOpen: true, panelId: 'custom-panel-id' };
      const serverHtml = await renderOnServer(FIXTURE, props);

      // The parse in a `<template>` element has no side effect. Its elements are of another
      // document, so the matchers of the DOM do not take them.
      const server = document.createElement('template');
      server.innerHTML = serverHtml;
      expect(server.content.querySelector('button')!.getAttribute('aria-controls')).toBe(
        'custom-panel-id',
      );
      expect(server.content.querySelector('[data-testid="panel"]')!.id).toBe('custom-panel-id');

      const { container } = await hydrate(CollapsiblePanelHydration, { serverHtml, props });

      expect(container.querySelector('button')).toHaveAttribute('aria-controls', 'custom-panel-id');
      expect(container.querySelector('[data-testid="panel"]')).toHaveAttribute(
        'id',
        'custom-panel-id',
      );
    });

    it('has no animation on an open panel with a keyframe animation after the hydration', async () => {
      const props = { defaultOpen: true, panelClass: 'collapsible-hydration-animation-panel' };
      const serverHtml = await renderOnServer(FIXTURE, props);

      const { container } = await hydrate(CollapsiblePanelHydration, { serverHtml, props });
      const panel = container.querySelector<HTMLElement>('[data-testid="panel"]')!;

      expect(panel.getAnimations()).toEqual([]);
      expect(panel.style.animationName).toBe('none');
      expect(takeReportedMessages()).toEqual([]);
    });
  });
});
