import { expect, vi, describe, it, onTestFinished } from 'vitest';
import { defineComponent, nextTick, shallowRef } from 'vue';
import { Tabs } from '@vase-ui/vue/tabs';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  expectSetupErrorWarnings,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  takeReportedMessages,
} from '#test-utils';

type RenderSlotProps = { props: Record<string, unknown> };

// A link component with one root element, as a router library makes. The ref of a part must reach
// the element of the link.
const Link = defineComponent({
  props: { to: { type: String, required: true } },
  setup(props, { slots }) {
    return () => <a href={props.to}>{slots.default?.()}</a>;
  },
});

// The component makes a new function ref on each render.
const UnstableRefTab = defineComponent({
  inheritAttrs: false,
  props: { href: { type: String, required: true } },
  setup(props, { attrs, expose, slots }) {
    const element = shallowRef<HTMLElement | null>(null);
    expose({ element });

    return () => (
      <a
        {...attrs}
        href={props.href}
        ref={(value) => {
          element.value = value as HTMLElement | null;
        }}
      >
        {slots.default?.()}
      </a>
    );
  },
});

describe('<Tabs.Tab />', () => {
  const { render } = createRenderer();

  describeConformance(<Tabs.Tab value="1" />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render: (node) =>
      render(
        <Tabs.Root>
          <Tabs.List>{node}</Tabs.List>
        </Tabs.Root>,
      ),
  }));

  describe('prop: nativeButton', () => {
    it('renders as an anchor and toggles selection when `nativeButton` is false', async () => {
      const { user } = await render(
        <Tabs.Root defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab
              nativeButton={false}
              value="overview"
              v-slots={{
                render: ({ props }: RenderSlotProps) => (
                  <a {...props} href="#overview">
                    Overview
                  </a>
                ),
              }}
            />
            <Tabs.Tab
              nativeButton={false}
              value="details"
              v-slots={{
                render: ({ props }: RenderSlotProps) => (
                  <a {...props} href="#details">
                    Details
                  </a>
                ),
              }}
            />
          </Tabs.List>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0].tagName).toBe('A');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');

      await user.click(tabs[1]);

      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('renders a react-router Link', async () => {
      await render(
        <Tabs.Root defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab
              nativeButton={false}
              value="overview"
              v-slots={{
                render: ({ props }: RenderSlotProps) => (
                  <Link {...props} to="/overview">
                    Overview
                  </Link>
                ),
              }}
            />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getByRole('tab')).toHaveAttribute('href', '/overview');
    });

    it('settles when the rendered component recreates its merged ref', async () => {
      await render(
        <Tabs.Root defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab
              nativeButton={false}
              value="overview"
              v-slots={{
                render: ({ props }: RenderSlotProps) => (
                  <UnstableRefTab {...props} href="#overview">
                    Overview
                  </UnstableRefTab>
                ),
              }}
            />
            <Tabs.Tab
              nativeButton={false}
              value="details"
              v-slots={{
                render: ({ props }: RenderSlotProps) => (
                  <UnstableRefTab {...props} href="#details">
                    Details
                  </UnstableRefTab>
                ),
              }}
            />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([0, -1]);
    });
  });

  describe('pointer interaction', () => {
    const TwoTabs = defineComponent(
      (props: {
        onValueChange?: (value: Tabs.Tab.Value, eventDetails: Tabs.Root.ChangeEventDetails) => void;
        disabledSecond?: boolean;
      }) =>
        () => (
          <Tabs.Root defaultValue={0} onValueChange={props.onValueChange}>
            <Tabs.List activateOnFocus>
              <Tabs.Tab value={0}>One</Tabs.Tab>
              <Tabs.Tab value={1} disabled={props.disabledSecond}>
                Two
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ),
      { props: ['onValueChange', 'disabledSecond'] },
    );

    it('does not re-commit the value when the active tab is pressed', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(<TwoTabs onValueChange={handleValueChange} />);

      const [firstTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseLeft]', target: firstTab });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
    });

    it('does not activate a disabled tab that is pressed and focused', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(<TwoTabs onValueChange={handleValueChange} disabledSecond />);

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseLeft]', target: secondTab });
      // Disabled tabs stay focusable, and `activateOnFocus` must not select them.
      secondTab.focus();
      await flushMicrotasks();

      expect(secondTab).toHaveFocus();
      expect(handleValueChange).not.toHaveBeenCalled();
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });

    it('does not activate a tab focused by a held secondary-button press', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(<TwoTabs onValueChange={handleValueChange} />);

      const [, secondTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseRight>]', target: secondTab });
      secondTab.focus();
      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });

    it('activates on focus again once a secondary-button press has ended', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(<TwoTabs onValueChange={handleValueChange} />);

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseRight]', target: secondTab });

      expect(handleValueChange).not.toHaveBeenCalled();

      firstTab.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowRight}');

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });

    it('activates on focus again once a secondary-button press is cancelled', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(<TwoTabs onValueChange={handleValueChange} />);

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      await fireEvent.pointerDown(secondTab, { button: 2 });
      await fireEvent.pointerCancel(secondTab);

      firstTab.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowRight}');

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });

    it('VUE-144: removes both document listeners when a tab unmounts during a secondary press', async () => {
      const { unmount } = await render(<TwoTabs />);
      const tab = screen.getByRole('tab', { name: 'Two' });
      const doc = tab.ownerDocument;
      const add = vi.spyOn(doc, 'addEventListener');
      const remove = vi.spyOn(doc, 'removeEventListener');

      tab.dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true }));
      unmount();

      for (const type of ['pointerup', 'pointercancel']) {
        const listeners = add.mock.calls.filter(([name]) => name === type);
        expect(listeners).toHaveLength(1);
        expect(remove.mock.calls).toContainEqual(listeners[0]);
      }
    });

    it('activates on keyboard focus after KeepAlive interrupts a secondary press', async () => {
      const { HeldBranch, hide, show } = createHeldBranch(() => <TwoTabs />, { mounted: true });
      const { user } = await render(<HeldBranch />);
      const [first, second] = screen.getAllByRole('tab');
      second.dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true }));
      await hide();
      await show();

      first.focus();
      await user.keyboard('{ArrowRight}');

      expect(second).toHaveFocus();
      expect(second).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('keyboard activation', () => {
    it.each([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])('activates the focused tab with %s when `activateOnFocus` is false', async (_label, key) => {
      const { user } = await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0}>One</Tabs.Tab>
            <Tabs.Tab value={1}>Two</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowRight}');

      expect(secondTab).toHaveFocus();
      expect(secondTab).toHaveAttribute('aria-selected', 'false');

      await user.keyboard(key);

      expect(secondTab).toHaveAttribute('aria-selected', 'true');
      expect(firstTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('state', () => {
    it.skipIf(isJSDOM)('exposes tab activation direction through the render prop', async () => {
      const tabRenderMock = vi.fn();

      const { setProps } = await render(
        <Tabs.Root modelValue={0}>
          <Tabs.List>
            <Tabs.Tab
              value={0}
              v-slots={{
                render: ({ props, state }: RenderSlotProps & { state: Tabs.Tab.State }) => {
                  tabRenderMock({ value: 0, ...state });
                  return <button {...props}>Tab 0</button>;
                },
              }}
            />
            <Tabs.Tab
              value={1}
              v-slots={{
                render: ({ props, state }: RenderSlotProps & { state: Tabs.Tab.State }) => {
                  tabRenderMock({ value: 1, ...state });
                  return <button {...props}>Tab 1</button>;
                },
              }}
            />
          </Tabs.List>
        </Tabs.Root>,
      );

      tabRenderMock.mockClear();

      await setProps({ modelValue: 1 });

      expect(
        tabRenderMock.mock.calls.some(
          ([state]) =>
            state.value === 1 && state.active === true && state.tabActivationDirection === 'right',
        ),
      ).toBe(true);
    });

    it('sets the state attributes', async () => {
      await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} disabled />
          </Tabs.List>
        </Tabs.Root>,
      );
      const [activeTab, disabledTab] = screen.getAllByRole('tab');

      expect(activeTab).toHaveAttribute('data-active');
      expect(activeTab).not.toHaveAttribute('data-disabled');
      expect(disabledTab).toHaveAttribute('data-disabled');
      expect(disabledTab).not.toHaveAttribute('data-active');
      expect(disabledTab).toHaveAttribute('data-orientation', 'horizontal');
    });
  });

  it('stops the resize observer on the previous tab element', async () => {
    const tag = shallowRef('button');
    await render(() => (
      <Tabs.Root>
        <Tabs.List>
          <Tabs.Tab as={tag.value} nativeButton={tag.value === 'button'} value="one">
            One
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    const previous = screen.getByRole('tab');
    const unobserve = vi.spyOn(ResizeObserver.prototype, 'unobserve');
    onTestFinished(() => unobserve.mockRestore());

    tag.value = 'span';
    await nextTick();
    expect(screen.getByRole('tab')).not.toBe(previous);
    expect(unobserve).toHaveBeenCalledWith(previous);
  });

  it('is not named by its panel while KeepAlive holds a tab that mounted in a held branch', async () => {
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
      <Tabs.Tab key="tab" value="b" id="held-tab" />
    ));
    await render(() => (
      <Tabs.Root defaultValue="b">
        <Tabs.List>
          <Tabs.Tab value="a" />
          <HeldBranch />
        </Tabs.List>
        <Tabs.Panel value="b" keepMounted data-testid="panel" />
      </Tabs.Root>
    ));
    const panel = screen.getByTestId('panel');

    await mountWhileHeld();
    expect(panel).not.toHaveAttribute('aria-labelledby');

    await show();
    expect(panel).toHaveAttribute('aria-labelledby', 'held-tab');
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case of the file can then get a warning about a slot.
  it('throws a descriptive error when rendered outside <Tabs.List>', async () => {
    await expect(
      render(
        <Tabs.Root>
          <Tabs.Tab value="1" />
        </Tabs.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A tab or an indicator of Tabs must be inside <Tabs.List>. Without a list the part has no list element to read and no keyboard navigation. Put the part inside <Tabs.List>.',
    );

    expectSetupErrorWarnings(takeReportedMessages());
  });
});
