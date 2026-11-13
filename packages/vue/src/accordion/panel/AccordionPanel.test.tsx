import { expect, vi, describe, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Accordion } from '@vase-ui/vue/accordion';
import { createRenderer, describeConformance, isJSDOM, screen, waitFor } from '#test-utils';

const PANEL_CONTENT = 'This is panel content';

describe('<Accordion.Panel />', () => {
  const { render } = createRenderer();

  describeConformance(<Accordion.Panel keepMounted />, () => ({
    render: (node) =>
      render(
        <Accordion.Root>
          <Accordion.Item>{node}</Accordion.Item>
        </Accordion.Root>,
      ),
    refInstanceof: window.HTMLDivElement,
  }));

  it('warns when a panel enables hiddenUntilFound and disables keepMounted', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <Accordion.Root>
          <Accordion.Item>
            <Accordion.Panel hiddenUntilFound keepMounted={false}>
              {PANEL_CONTENT}
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      expect(warnSpy).toHaveBeenCalledWith(
        'Vase UI: The `keepMounted` prop of `Accordion.Panel` is `false` and `hiddenUntilFound` is enabled on the panel or on the root. The panel must stay mounted while it is closed, so `keepMounted` has no effect. Remove `keepMounted`, or remove `hiddenUntilFound`.',
      );
      expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('passes root keepMounted to closed panels', async () => {
    await render(
      <Accordion.Root keepMounted>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT}</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );

    expect(screen.getByText(PANEL_CONTENT)).toHaveAttribute('hidden');
  });

  it('passes root hiddenUntilFound to closed panels and allows panel overrides', async () => {
    await render(
      <Accordion.Root hiddenUntilFound keepMounted>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger 1</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT}</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value={1}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger 2</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel hiddenUntilFound={false} keepMounted={false}>
            Overridden panel
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );

    expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    expect(screen.queryByText('Overridden panel')).toBe(null);
  });

  describe.skipIf(isJSDOM)('CSS transitions', () => {
    it('keeps the closing panel visible until its exit transition completes when switching items', async () => {
      // The state of the closing panel lasts only while its transition runs. A listener records it
      // when the transition starts.
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const { user } = await render(
        <>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--accordion-panel-height);
              transition: height 300ms linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Accordion.Root defaultValue={[0]} multiple={false}>
            <Accordion.Item value={0}>
              <Accordion.Header>
                <Accordion.Trigger>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel class="transition-test-panel" data-testid="panel-1" keepMounted>
                First panel
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value={1}>
              <Accordion.Header>
                <Accordion.Trigger>Trigger 2</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel class="transition-test-panel" data-testid="panel-2" keepMounted>
                Second panel
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </>,
      );

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const panel1 = screen.getByTestId('panel-1');
      const panel2 = screen.getByTestId('panel-2');

      await waitFor(() => {
        expect(panel1.style.getPropertyValue('--accordion-panel-height')).toBe('auto');
      });
      expect(panel1).toHaveAttribute('data-open');

      const snapshots: Record<string, boolean>[] = [];
      panel1.addEventListener('transitionrun', () => {
        snapshots.push({
          panel1EndingStyle: panel1.hasAttribute('data-ending-style'),
          panel1Hidden: panel1.hasAttribute('hidden'),
          panel1HeightInPx: /px$/.test(panel1.style.getPropertyValue('--accordion-panel-height')),
          panel2Open: panel2.hasAttribute('data-open'),
        });
      });

      await user.click(trigger2);

      await waitFor(() => {
        expect(panel1).toHaveAttribute('hidden');
      });
      expect(snapshots).toEqual([
        {
          panel1EndingStyle: true,
          panel1Hidden: false,
          panel1HeightInPx: true,
          panel2Open: true,
        },
      ]);
      expect(panel2).not.toHaveAttribute('hidden');
    });
  });

  describe.skipIf(isJSDOM)('React.Activity', () => {
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
                  height: var(--accordion-panel-height);
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
                <Accordion.Root>
                  <Accordion.Item value={0}>
                    <Accordion.Header>
                      <Accordion.Trigger>Trigger</Accordion.Trigger>
                    </Accordion.Header>
                    <Accordion.Panel
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
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion.Root>
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
  });

  describe('prop: id', () => {
    it('VUE-18: a panel with an empty id has the generated id, and its trigger names that id in aria-controls', async () => {
      await render(
        <Accordion.Root defaultValue={['a']}>
          <Accordion.Item value="a">
            <Accordion.Header>
              <Accordion.Trigger>Trigger</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel id="" data-testid="panel">
              {PANEL_CONTENT}
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const panel = screen.getByTestId('panel');

      expect(panel.id).not.toBe('');
      expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
        'aria-controls',
        panel.id,
      );
    });
  });
});
