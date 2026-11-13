import { afterEach, describe, expect, it, onTestFinished } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Tabs } from '@vase-ui/vue/tabs';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import TabsPanelHydration from './TabsPanelHydration.test.vue';

describe('<Tabs.Panel />', () => {
  const { render } = createRenderer();

  describeConformance(<Tabs.Panel value="1" keepMounted />, () => ({
    render: (node) => render(<Tabs.Root>{node}</Tabs.Root>),
    refInstanceof: window.HTMLDivElement,
  }));

  describe('panels sharing a value', () => {
    it('keeps the surviving registration when a shadowed panel unmounts', async () => {
      const App = defineComponent(() => {
        const shadowedMounted = shallowRef(true);

        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                shadowedMounted.value = false;
              }}
            >
              unmount shadowed
            </button>
            <Tabs.Root value="a">
              <Tabs.List>
                <Tabs.Tab value="a">A</Tabs.Tab>
                <Tabs.Tab value="b">B</Tabs.Tab>
              </Tabs.List>
              {shadowedMounted.value && <Tabs.Panel value="b" keepMounted data-testid="shadowed" />}
              <Tabs.Panel value="b" keepMounted data-testid="owner" />
            </Tabs.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const tabB = screen.getAllByRole('tab')[1];
      const owner = screen.getByTestId('owner');

      // The last panel to register owns the value.
      expect(tabB).toHaveAttribute('aria-controls', owner.id);

      await user.click(screen.getByRole('button', { name: 'unmount shadowed' }));

      expect(screen.queryByTestId('shadowed')).toBe(null);
      expect(tabB).toHaveAttribute('aria-controls', owner.id);
    });
  });

  it('sets the panel index data attribute', async () => {
    await render(
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one" />
        </Tabs.List>
        <Tabs.Panel value="one" data-testid="panel" />
      </Tabs.Root>,
    );

    expect(screen.getByTestId('panel')).toHaveAttribute('data-index', '0');
  });

  it('counts only the mounted panels for the index', async () => {
    const { user } = await render(
      <Tabs.Root defaultValue="b">
        <Tabs.List>
          <Tabs.Tab value="a" />
          <Tabs.Tab value="b" />
          <Tabs.Tab value="c" />
        </Tabs.List>
        <Tabs.Panel value="a" data-testid="a" />
        <Tabs.Panel value="b" data-testid="b" />
        <Tabs.Panel value="c" keepMounted data-testid="c" />
      </Tabs.Root>,
    );

    expect(screen.getByTestId('b')).toHaveAttribute('data-index', '0');
    expect(screen.getByTestId('c')).toHaveAttribute('data-index', '1');

    await user.click(screen.getAllByRole('tab')[0]);

    expect(screen.getByTestId('a')).toHaveAttribute('data-index', '0');
    expect(screen.getByTestId('c')).toHaveAttribute('data-index', '1');
  });

  describe('state', () => {
    it('sets the attributes of the open panel, of a hidden panel that stays mounted and of no other panel', async () => {
      await render(
        <Tabs.Root defaultValue="a" orientation="vertical">
          <Tabs.List>
            <Tabs.Tab value="a" id="tab-a" />
            <Tabs.Tab value="b" id="tab-b" />
            <Tabs.Tab value="c" id="tab-c" />
          </Tabs.List>
          <Tabs.Panel value="a" keepMounted data-testid="open" />
          <Tabs.Panel value="b" keepMounted data-testid="hidden" />
          <Tabs.Panel value="c" data-testid="unmounted" />
        </Tabs.Root>,
      );
      const open = screen.getByTestId('open');
      const hidden = screen.getByTestId('hidden');

      expect(open).toHaveAttribute('role', 'tabpanel');
      expect(open).toHaveAttribute('aria-labelledby', 'tab-a');
      expect(open).toHaveAttribute('tabindex', '0');
      expect(open).toHaveAttribute('data-index', '0');
      expect(open).toHaveAttribute('data-orientation', 'vertical');
      expect(open).toHaveAttribute('data-activation-direction', 'none');
      expect(open).not.toHaveAttribute('hidden');
      expect(open).not.toHaveAttribute('inert');
      expect(open).not.toHaveAttribute('data-hidden');
      // A panel that is open at the mount does not animate in.
      expect(open).not.toHaveAttribute('data-starting-style');

      expect(hidden).toHaveAttribute('role', 'tabpanel');
      expect(hidden).toHaveAttribute('aria-labelledby', 'tab-b');
      expect(hidden).toHaveAttribute('tabindex', '-1');
      expect(hidden).toHaveAttribute('data-index', '1');
      expect(hidden).toHaveAttribute('hidden');
      expect(hidden).toHaveAttribute('inert');
      expect(hidden).toHaveAttribute('data-hidden');

      expect(screen.queryByTestId('unmounted')).toBe(null);
    });
  });

  describe('prop: id', () => {
    it('VUE-14: names the id of the panel in the aria-controls of its tab', async () => {
      await render(
        <Tabs.Root defaultValue="a">
          <Tabs.List>
            <Tabs.Tab value="a" />
            <Tabs.Tab value="b" />
          </Tabs.List>
          <Tabs.Panel value="a" id="panel-a" data-testid="a" />
          <Tabs.Panel value="b" keepMounted data-testid="b" />
        </Tabs.Root>,
      );
      const [tabA, tabB] = screen.getAllByRole('tab');

      expect(screen.getByTestId('a')).toHaveAttribute('id', 'panel-a');
      expect(tabA).toHaveAttribute('aria-controls', 'panel-a');
      // A panel with no `id` has a generated `id`.
      expect(tabB).toHaveAttribute('aria-controls', screen.getByTestId('b').id);
    });
  });

  describe('KeepAlive', () => {
    // `KeepAlive` runs the `onActivated` hooks of one branch from its last part to its first part.
    // The panels must keep their order when `KeepAlive` shows the branch again.
    it('names the last of two panels of one value on the tab only while KeepAlive shows them', async () => {
      const visible = shallowRef(true);
      const Panels = defineComponent(() => () => (
        <>
          <Tabs.Panel value="a" id="first-panel" />
          <Tabs.Panel value="a" id="last-panel" data-testid="last-panel" />
        </>
      ));
      const App = defineComponent(() => () => (
        <Tabs.Root defaultValue="a">
          <Tabs.List>
            <Tabs.Tab value="a" />
          </Tabs.List>
          <KeepAlive>{visible.value ? <Panels /> : null}</KeepAlive>
        </Tabs.Root>
      ));

      await render(<App />);
      const tab = screen.getByRole('tab');
      const lastPanel = screen.getByTestId('last-panel');

      expect(tab).toHaveAttribute('aria-controls', 'last-panel');

      visible.value = false;
      await flushMicrotasks();

      expect(tab).not.toHaveAttribute('aria-controls');

      visible.value = true;
      await flushMicrotasks();

      expect(screen.getByTestId('last-panel')).toBe(lastPanel);
      expect(tab).toHaveAttribute('aria-controls', 'last-panel');
    });
  });

  describe('hydration', () => {
    const FIXTURE = 'src/tabs/panel/TabsPanelHydration.test.vue';

    // The panels of the server HTML count the panel that has no element. The mount sorts them again.
    it.each([
      { name: 'the first panel open', props: { defaultValue: 'a' } },
      { name: 'the second panel open', props: { defaultValue: 'b' } },
      { name: 'the last panel open', props: { defaultValue: 'c' } },
    ])('hydrates with $name, with no warning and no DOM difference', async ({ props }) => {
      const serverHtml = await renderOnServer(FIXTURE, props);

      await hydrate(TabsPanelHydration, { serverHtml, props });
    });
  });

  describe.skipIf(isJSDOM)('animations', () => {
    afterEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('triggers enter animation via data-starting-style when mounting', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      let transitionFinished = false;
      const notifyTransitionFinished = () => {
        transitionFinished = true;
      };

      const style = `
        .animation-test-panel {
          transition: opacity 1ms;
        }

        .animation-test-panel[data-starting-style],
        .animation-test-panel[data-ending-style] {
          opacity: 0;
        }
      `;

      const { user } = await render(
        <div>
          <style>{style}</style>
          <Tabs.Root defaultValue="one">
            <Tabs.List>
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="one">Panel one</Tabs.Panel>
            <Tabs.Panel
              class="animation-test-panel"
              data-testid="panel-two"
              onTransitionend={notifyTransitionFinished}
              value="two"
            >
              Panel two
            </Tabs.Panel>
          </Tabs.Root>
        </div>,
      );

      expect(screen.queryByTestId('panel-two')).toBeNull();

      await user.click(screen.getByRole('tab', { name: 'Two' }));

      await waitFor(() => {
        expect(transitionFinished).toBe(true);
      });

      expect(screen.getByTestId('panel-two')).not.toBeNull();
    });

    // A timer task changes the value, and no other panel closes in the same update. The case reads no
    // style and no layout, so only the layout read of the part starts the transition.
    it('starts the enter transition of a panel that opens when no other panel closes', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const value = shallowRef<string | null>(null);
      const style = `
        .animation-test-panel {
          transition: opacity 20ms linear;
        }

        .animation-test-panel[data-starting-style] {
          opacity: 0;
        }
      `;

      const { container } = await render(() => (
        <div>
          <style>{style}</style>
          <Tabs.Root value={value.value}>
            <Tabs.Panel value="one" class="animation-test-panel" />
          </Tabs.Root>
        </div>
      ));
      let transitionStarted = false;
      container.addEventListener('transitionrun', () => {
        transitionStarted = true;
      });

      setTimeout(() => {
        value.value = 'one';
      });

      await waitFor(() => {
        expect(transitionStarted).toBe(true);
      });
    });

    it('applies data-ending-style before unmount', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-panel[data-ending-style] {
          animation: test-anim 100ms;
        }
      `;

      const { user } = await render(
        <div>
          <style>{style}</style>
          <Tabs.Root defaultValue="one">
            <Tabs.List>
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel class="animation-test-panel" data-testid="panel-one" value="one">
              Panel one
            </Tabs.Panel>
            <Tabs.Panel value="two">Panel two</Tabs.Panel>
          </Tabs.Root>
        </div>,
      );

      const panelOne = screen.getByTestId('panel-one');
      // The attribute lasts only while the animation runs, so an observer records it.
      let hadEndingStyle = false;
      const observer = new MutationObserver(() => {
        hadEndingStyle ||= panelOne.hasAttribute('data-ending-style');
      });
      observer.observe(panelOne, { attributes: true, attributeFilter: ['data-ending-style'] });
      onTestFinished(() => observer.disconnect());

      await user.click(screen.getByRole('tab', { name: 'Two' }));

      await waitFor(() => {
        expect(screen.queryByTestId('panel-one')).toBeNull();
      });
      expect(hadEndingStyle).toBe(true);
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <Tabs.Root>', async () => {
    await expect(render(<Tabs.Panel value="1" keepMounted />)).rejects.toThrow(
      'Vase UI: A part of Tabs must be inside <Tabs.Root>. Without a root the part has no value and no orientation. Put the part inside <Tabs.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
