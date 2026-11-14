import { expect, vi, describe, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef, Transition } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
import { Tabs } from '@vase-ui/vue/tabs';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
  within,
} from '#test-utils';
import TabsRootHydration from './TabsRootHydration.test.vue';

const HYDRATION_FIXTURE = 'src/tabs/root/TabsRootHydration.test.vue';

type RenderSlotProps = { props: Record<string, unknown> };

function readTabindexes(root: ParentNode) {
  return ['a', 'b', 'c'].map((testId) =>
    root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('tabindex'),
  );
}

describe('<Tabs.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Tabs.Root value={0} />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('prop: children', () => {
    it('should accept a null child', async () => {
      await render(
        <Tabs.Root value={0}>
          {null}
          <Tabs.List>
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getAllByRole('tab')).toHaveLength(1);
    });

    it('should support empty children', async () => {
      const { container } = await render(<Tabs.Root value={1} />);

      // Vue puts empty text nodes around the content of a slot, so the matcher cannot tell.
      expect(container.firstElementChild!.innerHTML).toBe('');
    });

    it('puts the selected child in tab order', async () => {
      const { setProps } = await render(
        <Tabs.Root value={1}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([-1, 0]);

      await setProps({ value: 0 });

      expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([0, -1]);
    });

    it('sets the aria-labelledby attribute on tab panels to the corresponding tab id', async () => {
      await render(
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0" />
            <Tabs.Tab value="tab-1" id="explicit-tab-id-1" />
            <Tabs.Tab value="tab-2" />
            <Tabs.Tab value="tab-3" id="explicit-tab-id-3" />
          </Tabs.List>
          <Tabs.Panel value="tab-1" keepMounted />
          <Tabs.Panel value="tab-0" keepMounted />
          <Tabs.Panel value="tab-2" keepMounted />
          <Tabs.Panel value="tab-3" keepMounted />
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabPanels[0]).toHaveAttribute('aria-labelledby', tabs[1].id);
      expect(tabPanels[1]).toHaveAttribute('aria-labelledby', tabs[0].id);
      expect(tabPanels[2]).toHaveAttribute('aria-labelledby', tabs[2].id);
      expect(tabPanels[3]).toHaveAttribute('aria-labelledby', tabs[3].id);
    });

    it('sets the aria-controls attribute on tabs to the corresponding tab panel id', async () => {
      await render(
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0" />
            <Tabs.Tab value="tab-1" id="explicit-tab-id-1" />
            <Tabs.Tab value="tab-2" />
            <Tabs.Tab value="tab-3" id="explicit-tab-id-3" />
          </Tabs.List>
          <Tabs.Panel value="tab-1" keepMounted />
          <Tabs.Panel value="tab-0" keepMounted />
          <Tabs.Panel value="tab-2" keepMounted />
          <Tabs.Panel value="tab-3" keepMounted />
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabs[0]).toHaveAttribute('aria-controls', tabPanels[1].id);
      expect(tabs[1]).toHaveAttribute('aria-controls', tabPanels[0].id);
      expect(tabs[2]).toHaveAttribute('aria-controls', tabPanels[2].id);
      expect(tabs[3]).toHaveAttribute('aria-controls', tabPanels[3].id);
    });

    it('sets aria-controls on the first tab when no value is provided', async () => {
      await render(
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted />
          <Tabs.Panel value={1} keepMounted />
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabs[0]).toHaveAttribute('aria-controls', tabPanels[0].id);
      expect(tabs[1]).toHaveAttribute('aria-controls', tabPanels[1].id);
      expect(tabPanels[0]).toHaveAttribute('aria-labelledby', tabs[0].id);
      expect(tabPanels[1]).toHaveAttribute('aria-labelledby', tabs[1].id);
    });

    it('syncs aria-controls to the mounted tab panel when keepMounted is false', async () => {
      const { user } = await render(
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0">Tab 0</Tabs.Tab>
            <Tabs.Tab value="tab-1">Tab 1</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="tab-0">Panel 0</Tabs.Panel>
          <Tabs.Panel value="tab-1">Panel 1</Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      const [firstTabPanel] = screen.getAllByRole('tabpanel');

      expect(tabs[0]).toHaveAttribute('aria-controls', firstTabPanel.id);
      expect(tabs[1]).not.toHaveAttribute('aria-controls');

      await user.click(tabs[1]);

      await waitFor(() => {
        expect(tabs[1]).toHaveAttribute('aria-controls', screen.getByText('Panel 1').id);
      });

      const [secondTabPanel] = screen.getAllByRole('tabpanel');
      expect(secondTabPanel).toHaveTextContent('Panel 1');
      expect(tabs[0]).not.toHaveAttribute('aria-controls');
    });

    it('cleans and replaces panel registrations in Strict Mode', async () => {
      const App = defineComponent(() => {
        const panel = shallowRef({ id: 'panel-a', mounted: true, value: 'a' });

        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                panel.value = { id: 'panel-b', mounted: true, value: 'b' };
              }}
            >
              replace
            </button>
            <button
              type="button"
              onClick={() => {
                panel.value = { ...panel.value, mounted: false };
              }}
            >
              unmount
            </button>
            <button
              type="button"
              onClick={() => {
                panel.value = { id: 'panel-c', mounted: true, value: 'b' };
              }}
            >
              remount
            </button>
            <Tabs.Root value="a">
              <Tabs.List>
                <Tabs.Tab value="a">A</Tabs.Tab>
                <Tabs.Tab value="b">B</Tabs.Tab>
              </Tabs.List>
              {panel.value.mounted && (
                <Tabs.Panel key={panel.value.id} value={panel.value.value} keepMounted />
              )}
            </Tabs.Root>
          </>
        );
      });

      const { user } = await render(<App />);
      const [tabA, tabB] = screen.getAllByRole('tab');

      expect(tabA).toHaveAttribute(
        'aria-controls',
        screen.getByRole('tabpanel', { hidden: true }).id,
      );
      expect(tabB).not.toHaveAttribute('aria-controls');

      await user.click(screen.getByRole('button', { name: 'replace' }));
      expect(tabA).not.toHaveAttribute('aria-controls');
      expect(tabB).toHaveAttribute(
        'aria-controls',
        screen.getByRole('tabpanel', { hidden: true }).id,
      );

      await user.click(screen.getByRole('button', { name: 'unmount' }));
      expect(tabA).not.toHaveAttribute('aria-controls');
      expect(tabB).not.toHaveAttribute('aria-controls');

      await user.click(screen.getByRole('button', { name: 'remount' }));
      expect(tabA).not.toHaveAttribute('aria-controls');
      expect(tabB).toHaveAttribute(
        'aria-controls',
        screen.getByRole('tabpanel', { hidden: true }).id,
      );
    });
  });

  describe('prop: value', () => {
    it('should pass selected prop to children', async () => {
      const tabs = (
        <Tabs.Root value={1}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      );

      await render(tabs);
      const tabElements = screen.getAllByRole('tab');
      expect(tabElements[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabElements[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should support values of different types', async () => {
      const tabValues = [0, '1', { value: 2 }, () => 3, Symbol('4'), /5/];

      await render(
        <Tabs.Root>
          <Tabs.List>
            {tabValues.map((value, index) => (
              <Tabs.Tab key={index} value={value} />
            ))}
          </Tabs.List>
          {tabValues.map((value, index) => (
            <Tabs.Panel key={index} value={value} keepMounted />
          ))}
        </Tabs.Root>,
      );

      const tabElements = screen.getAllByRole('tab');
      const tabPanelElements = screen.getAllByRole('tabpanel', { hidden: true });

      for (let index = 0; index < tabValues.length; index += 1) {
        expect(tabPanelElements[index]).toHaveAttribute('aria-labelledby', tabElements[index].id);

        await fireEvent.click(tabElements[index]);

        expect(tabElements[index]).toHaveAttribute('aria-selected', 'true');
        expect(tabPanelElements[index]).not.toHaveAttribute('hidden');
      }
    });

    it('should support a function as the default value', async () => {
      const functionValue = () => 1;

      await render(
        <Tabs.Root defaultValue={functionValue}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={functionValue} />
          </Tabs.List>
        </Tabs.Root>,
      );

      const tabElements = screen.getAllByRole('tab');
      expect(tabElements[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('disabled tabs', () => {
    it('should select the second tab when the first one is disabled', async () => {
      await render(
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Disabled tab
            </Tabs.Tab>
            <Tabs.Tab value={1}>Enabled tab</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Disabled panel
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Enabled panel
          </Tabs.Panel>
        </Tabs.Root>,
      );

      const [disabledTab, enabledTab] = screen.getAllByRole('tab');
      const [disabledPanel, enabledPanel] = screen.getAllByRole('tabpanel', { hidden: true });

      expect(disabledTab).toHaveAttribute('aria-selected', 'false');
      expect(enabledTab).toHaveAttribute('aria-selected', 'true');
      expect(disabledPanel).toHaveAttribute('hidden');
      expect(enabledPanel).not.toHaveAttribute('hidden');
      expect(enabledPanel).toHaveTextContent('Enabled panel');
    });

    it('should select the third tab when first two tabs are disabled', async () => {
      await render(
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled data-testid="tab-0">
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled data-testid="tab-1">
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2} data-testid="tab-2">
              Tab 2
            </Tabs.Tab>
            <Tabs.Tab value={3} data-testid="tab-3">
              Tab 3
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0}>Panel 0</Tabs.Panel>
          <Tabs.Panel value={1}>Panel 1</Tabs.Panel>
          <Tabs.Panel value={2}>Panel 2</Tabs.Panel>
          <Tabs.Panel value={3}>Panel 3</Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');

      // The first non-disabled tab (tab 2) should be selected
      expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[3]).toHaveAttribute('aria-selected', 'false');
    });

    it('should still honor explicit defaultValue even if it points to a disabled tab', async () => {
      await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled data-testid="tab-0">
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} data-testid="tab-1">
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2} data-testid="tab-2">
              Tab 2
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0}>Panel 0</Tabs.Panel>
          <Tabs.Panel value={1}>Panel 1</Tabs.Panel>
          <Tabs.Panel value={2}>Panel 2</Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');

      // The explicitly set disabled tab should be selected
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('continues honoring an initially disabled explicit defaultValue after defaultValue changes', async () => {
      const { setProps } = await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await setProps({ defaultValue: 1 });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain(
        'Vase UI: A component is changing the default value state of an uncontrolled Tabs after being initialized.',
      );

      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('should still honor explicit value prop even if it points to a disabled tab', async () => {
      await render(
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled data-testid="tab-0">
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} data-testid="tab-1">
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2} data-testid="tab-2">
              Tab 2
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0}>Panel 0</Tabs.Panel>
          <Tabs.Panel value={1}>Panel 1</Tabs.Panel>
          <Tabs.Panel value={2}>Panel 2</Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');

      // The explicitly set disabled tab should be selected
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not set tabIndex=0 on disabled tabs when they are programmatically selected', async () => {
      const { setProps } = await render(
        <Tabs.Root value={1}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0}>Panel 0</Tabs.Panel>
          <Tabs.Panel value={1}>Panel 1</Tabs.Panel>
          <Tabs.Panel value={2}>Panel 2</Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');

      // Initially, tab 1 is selected and should be highlighted (tabIndex=0)
      expect(tabs[1]).toHaveAttribute('tabindex', '0');
      expect(tabs[0]).toHaveAttribute('tabindex', '-1');
      expect(tabs[2]).toHaveAttribute('tabindex', '-1');

      // Programmatically select the disabled tab 0
      await setProps({ value: 0 });
      await flushMicrotasks();

      // The disabled tab should be selected but NOT highlighted (tabIndex should remain -1)
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveAttribute('tabindex', '-1');

      // The previously highlighted tab should retain the highlight
      expect(tabs[1]).toHaveAttribute('tabindex', '0');
    });

    it('does not select any tab when all tabs are disabled', async () => {
      await render(
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2} disabled>
              Tab 2
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 0
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 1
          </Tabs.Panel>
          <Tabs.Panel value={2} keepMounted>
            Panel 2
          </Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      const panels = screen.getAllByRole('tabpanel', { hidden: true });

      // No tab should be selected
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');

      // All panels should be hidden
      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).toHaveAttribute('hidden');
      expect(panels[2]).toHaveAttribute('hidden');
    });
  });

  describe('prop: onValueChange', () => {
    it('when `activateOnFocus = true` should call onValueChange on pointerdown', async () => {
      const handleChange = vi.fn();
      const handlePointerDown = vi.fn();
      const { user } = await render(
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List activateOnFocus>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} onPointerdown={handlePointerDown} />
          </Tabs.List>
        </Tabs.Root>,
      );

      await user.pointer({ keys: '[MouseLeft>]', target: screen.getAllByRole('tab')[1] });
      expect(handleChange.mock.calls.length).toBe(1);
      expect(handlePointerDown.mock.calls.length).toBe(1);
    });

    it.skipIf(isJSDOM)('should call onValueChange when clicking', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      await fireEvent.click(screen.getAllByRole('tab')[1]);
      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('right');
    });

    it('should not call onValueChange on non-main button clicks', async () => {
      const handleChange = vi.fn();

      const { user } = await render(
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      // React ignores a `click` event that has `button: 2`. A browser sends no `click` for the
      // secondary button, so the case presses it for real.
      await user.pointer({ keys: '[MouseRight]', target: screen.getAllByRole('tab')[1] });
      expect(handleChange.mock.calls.length).toBe(0);
    });

    it('should not call onValueChange when already active', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      await fireEvent.click(screen.getAllByRole('tab')[0]);
      expect(handleChange.mock.calls.length).toBe(0);
    });

    it('when `activateOnFocus = true` should call onValueChange if an unactive tab gets focused', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List activateOnFocus>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab] = screen.getAllByRole('tab');

      firstTab.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
    });

    it('when `activateOnFocus = false` should not call onValueChange if an unactive tab gets focused', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root value={1} onValueChange={handleChange}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab] = screen.getAllByRole('tab');

      firstTab.focus();
      await flushMicrotasks();

      expect(handleChange.mock.calls.length).toBe(0);
    });

    it('calls onValueChange when auto-selecting the first tab on mount', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(0);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange with the selected value when the implicit default matches a later tab', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(0);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the implicit first tab is disabled', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not cancel automatic value changes', async () => {
      const handleChange = vi.fn(
        (_value: Tabs.Tab.Value, eventDetails: Tabs.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      await render(
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].event).toBeInstanceOf(Event);
      expect(handleChange.mock.calls[0][1].event.type).toBe('vase-ui');
      expect(handleChange.mock.calls[0][1].trigger).toBe(undefined);
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not move an uncontrolled selection when a user-initiated change is canceled', async () => {
      const handleChange = vi.fn(
        (_value: Tabs.Tab.Value, eventDetails: Tabs.Root.ChangeEventDetails) => {
          if (eventDetails.reason === 'none') {
            eventDetails.cancel();
          }
        },
      );

      const { user } = await render(
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      await user.click(tabs[1]);

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('none');
      // The canceled click must not commit the new value in an uncontrolled root.
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onValueChange with null when all tabs are initially disabled', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(null);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not emit missing when an enabled tab appears after all tabs were disabled', async () => {
      const handleChange = vi.fn();
      const TestComponent = defineComponent(
        (props: { enableSecond: boolean }) => () => (
          <Tabs.Root onValueChange={handleChange}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1} disabled={!props.enableSecond}>
                Tab 1
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['enableSecond'] },
      );

      const { setProps } = await render(<TestComponent enableSecond={false} />);

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(null);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');

      await setProps({ enableSecond: true });

      expect(handleChange.mock.calls.length).toBe(1);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not call onValueChange on initial render when defaultValue is provided', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root defaultValue={1} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(0);

      const tabs = screen.getAllByRole('tab');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not call onValueChange on initial render when defaultValue is null', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root defaultValue={null} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(0);

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('treats defaultValue={undefined} as an implicit default when the first tab is disabled', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root defaultValue={undefined} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the selected tab becomes disabled', async () => {
      const handleChange = vi.fn();
      const TestComponent = defineComponent(
        (props: { disableFirst: boolean }) => () => (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled={props.disableFirst}>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
              <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['disableFirst'] },
      );

      const { setProps } = await render(<TestComponent disableFirst={false} />);

      await setProps({ disableFirst: true });

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledExactlyOnceWith(
          1,
          expect.objectContaining({ reason: 'disabled', activationDirection: 'none' }),
        );
      });

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when an explicit disabled default becomes disabled again', async () => {
      const handleChange = vi.fn();
      const TestComponent = defineComponent(
        (props: { disableFirst: boolean }) => () => (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled={props.disableFirst}>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['disableFirst'] },
      );

      const { setProps } = await render(<TestComponent disableFirst />);

      expect(handleChange.mock.calls.length).toBe(0);
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');

      await setProps({ disableFirst: false });

      expect(handleChange.mock.calls.length).toBe(0);
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');

      await setProps({ disableFirst: true });

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledExactlyOnceWith(
          1,
          expect.objectContaining({ reason: 'disabled' }),
        );
      });
      expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the selected tab becomes disabled with keepMounted panels', async () => {
      const handleChange = vi.fn();
      const TestComponent = defineComponent(
        (props: { disableFirst: boolean }) => () => (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled={props.disableFirst}>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value={0} keepMounted>
              Panel 0
            </Tabs.Panel>
            <Tabs.Panel value={1} keepMounted>
              Panel 1
            </Tabs.Panel>
          </Tabs.Root>
        ),
        { props: ['disableFirst'] },
      );

      const { setProps } = await render(<TestComponent disableFirst={false} />);

      await setProps({ disableFirst: true });

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledExactlyOnceWith(
          1,
          expect.objectContaining({ reason: 'disabled' }),
        );
      });

      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
    });

    it('calls onValueChange when the selected tab is removed', async () => {
      const handleChange = vi.fn();
      const TestComponent = defineComponent(
        (props: { showFirstTab: boolean }) => () => (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List>
              {props.showFirstTab && <Tabs.Tab value={0}>Tab 0</Tabs.Tab>}
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
              <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['showFirstTab'] },
      );

      const { setProps } = await render(<TestComponent showFirstTab />);

      await setProps({ showFirstTab: false });

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledExactlyOnceWith(
          1,
          expect.objectContaining({ reason: 'missing' }),
        );
      });

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveTextContent('Tab 1');
      expect(tabs[0]).toHaveAttribute('tabindex', '0');
    });

    it('calls onValueChange with null when the selected tab is removed and no tabs remain', async () => {
      const handleChange = vi.fn();
      const TestComponent = defineComponent(
        (props: { showTab: boolean }) => () => (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List>{props.showTab && <Tabs.Tab value={0}>Tab 0</Tabs.Tab>}</Tabs.List>
            <Tabs.Panel value={0} keepMounted>
              Panel 0
            </Tabs.Panel>
          </Tabs.Root>
        ),
        { props: ['showTab'] },
      );

      const { setProps } = await render(<TestComponent showTab />);

      expect(screen.getByRole('tabpanel')).not.toHaveAttribute('hidden');

      await setProps({ showTab: false });

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledExactlyOnceWith(
          null,
          expect.objectContaining({ reason: 'missing' }),
        );
      });

      expect(screen.queryAllByRole('tab').length).toBe(0);
      expect(screen.getByRole('tabpanel', { hidden: true })).toHaveAttribute('hidden');
    });

    it('calls onValueChange with null when a populated tab list is replaced by an empty one', async () => {
      const handleChange = vi.fn();
      const TestComponent = defineComponent(
        (props: { empty: boolean }) => () => (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List key={props.empty ? 'empty' : 'populated'}>
              {!props.empty && <Tabs.Tab value={0}>Tab 0</Tabs.Tab>}
            </Tabs.List>
            <Tabs.Panel value={0} keepMounted>
              Panel 0
            </Tabs.Panel>
          </Tabs.Root>
        ),
        { props: ['empty'] },
      );

      const { setProps } = await render(<TestComponent empty={false} />);

      expect(screen.getByRole('tabpanel')).not.toHaveAttribute('hidden');

      await setProps({ empty: true });

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          null,
          expect.objectContaining({ reason: 'missing' }),
        );
      });

      const panel = screen.getByRole('tabpanel', { hidden: true });
      expect(panel).toHaveAttribute('hidden');
      expect(panel).not.toHaveAttribute('aria-labelledby');
    });

    it('calls onValueChange when an explicit defaultValue points at a tab that is never present', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledExactlyOnceWith(
          1,
          expect.objectContaining({ reason: 'missing' }),
        );
      });

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not emit a second change when the fallback resolves to the current value', async () => {
      const handleValueChange = vi.fn();

      // Tabs can transiently share a value while a dynamic list is reordered.
      // Duplicate values are not a supported configuration and this test makes
      // no claim about the resulting DOM state; it only pins that the automatic
      // fallback settles instead of re-emitting.
      //
      // The implicit default (`0`) matches no tab, so the root falls back to the
      // first enabled tab. The disabled tab shares that value, so the selection
      // still looks disabled on the next pass and must not be re-committed.
      await render(
        <Tabs.Root onValueChange={handleValueChange}>
          <Tabs.List>
            <Tabs.Tab value="a" disabled>
              Stale duplicate
            </Tabs.Tab>
            <Tabs.Tab value="a">A</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.calls[0][0]).toBe('a');
      expect(handleValueChange.mock.calls[0][1].reason).toBe('initial');
    });

    it('does not call onValueChange when a controlled selected tab becomes disabled', async () => {
      const handleChange = vi.fn();
      const TestComponent = defineComponent(
        (props: { disableFirst: boolean }) => () => (
          <Tabs.Root value={0} onValueChange={handleChange}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled={props.disableFirst}>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['disableFirst'] },
      );

      const { setProps } = await render(<TestComponent disableFirst={false} />);

      await setProps({ disableFirst: true });

      expect(handleChange.mock.calls.length).toBe(0);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('keeps a roving focus entry point when a controlled selected tab is removed', async () => {
      const handleChange = vi.fn();
      const TestComponent = defineComponent(
        (props: { showLastTab: boolean }) => () => (
          <>
            <button type="button">Before</button>
            <Tabs.Root value={2} onValueChange={handleChange}>
              <Tabs.List>
                <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
                <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
                {props.showLastTab && <Tabs.Tab value={2}>Tab 2</Tabs.Tab>}
              </Tabs.List>
            </Tabs.Root>
          </>
        ),
        { props: ['showLastTab'] },
      );

      const { setProps, user } = await render(<TestComponent showLastTab />);

      await setProps({ showLastTab: false });

      expect(handleChange).not.toHaveBeenCalled();
      const [firstTab, secondTab] = screen.getAllByRole('tab');
      expect(firstTab).toHaveAttribute('aria-selected', 'false');
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
      expect([firstTab.tabIndex, secondTab.tabIndex]).toEqual([0, -1]);

      screen.getByRole('button', { name: 'Before' }).focus();
      await flushMicrotasks();
      await user.tab();

      expect(firstTab).toHaveFocus();

      await user.keyboard('{ArrowRight}');

      expect(secondTab).toHaveFocus();
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: orientation', () => {
    it('does not add aria-orientation by default', async () => {
      await render(
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Root />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getByRole('tablist')).not.toHaveAttribute('aria-orientation');
    });

    it('adds the proper aria-orientation when vertical', async () => {
      await render(
        <Tabs.Root value={0} orientation="vertical">
          <Tabs.List>
            <Tabs.Root />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    });
  });

  describe('pointer navigation', () => {
    it('selects the clicked tab', async () => {
      const { user } = await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 3</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 1
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 2
          </Tabs.Panel>
          <Tabs.Panel value={2} keepMounted>
            Panel 3
          </Tabs.Panel>
        </Tabs.Root>,
      );

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      await user.click(tab2);

      const panels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
      expect(panels[2]).toHaveAttribute('hidden');
    });

    it('does not select the clicked disabled tab', async () => {
      const { user } = await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0}>Tab 1</Tabs.Tab>
            <Tabs.Tab disabled value={1}>
              Tab 2
            </Tabs.Tab>
            <Tabs.Tab value={2}>Tab 3</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 1
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 2
          </Tabs.Panel>
          <Tabs.Panel value={2} keepMounted>
            Panel 3
          </Tabs.Panel>
        </Tabs.Root>,
      );

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      await user.click(tab2);

      const panels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(panels[0]).not.toHaveAttribute('hidden');
      expect(panels[1]).toHaveAttribute('hidden');
      expect(panels[2]).toHaveAttribute('hidden');
    });
  });

  describe('keyboard navigation when focus is on a tab', () => {
    const keyboardNavigationCases = [
      {
        name: 'horizontal ltr',
        orientation: 'horizontal',
        direction: 'ltr',
        previousItemKey: 'ArrowLeft',
        nextItemKey: 'ArrowRight',
      },
      {
        name: 'horizontal rtl',
        orientation: 'horizontal',
        direction: 'rtl',
        previousItemKey: 'ArrowRight',
        nextItemKey: 'ArrowLeft',
      },
      {
        name: 'vertical',
        orientation: 'vertical',
        direction: undefined,
        previousItemKey: 'ArrowUp',
        nextItemKey: 'ArrowDown',
      },
    ] as const;

    describe.each(keyboardNavigationCases)(
      'when focus is on a tab element in a $name tablist',
      ({ orientation, direction, previousItemKey, nextItemKey }) => {
        describe(`${previousItemKey}`, () => {
          describe('with `activateOnFocus = false`', () => {
            it('moves focus to the last tab without activating it if focus is on the first tab', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root
                    onValueChange={handleChange}
                    orientation={orientation as Tabs.Root.Props['orientation']}
                    value={0}
                  >
                    <Tabs.List activateOnFocus={false} onKeydown={handleKeyDown}>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [firstTab, , lastTab] = screen.getAllByRole('tab');
              firstTab.focus();
              await flushMicrotasks();

              await fireEvent.keyDown(firstTab, { key: previousItemKey });
              await flushMicrotasks();

              expect(lastTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to the previous tab without activating it', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root
                    onValueChange={handleChange}
                    orientation={orientation as Tabs.Root.Props['orientation']}
                    value={1}
                  >
                    <Tabs.List activateOnFocus={false} onKeydown={handleKeyDown}>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [firstTab, secondTab] = screen.getAllByRole('tab');
              secondTab.focus();
              await flushMicrotasks();

              await fireEvent.keyDown(secondTab, { key: previousItemKey });
              await flushMicrotasks();

              expect(firstTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to a disabled tab without activating it', async () => {
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root orientation={orientation as Tabs.Root.Props['orientation']} value={2}>
                    <Tabs.List activateOnFocus={false} onKeydown={handleKeyDown}>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} disabled />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [, disabledTab, lastTab] = screen.getAllByRole('tab');
              lastTab.focus();
              await flushMicrotasks();

              await fireEvent.keyDown(lastTab, { key: previousItemKey });
              await flushMicrotasks();

              expect(disabledTab).toHaveFocus();
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });
          });

          describe('with `activateOnFocus = true`', () => {
            it('moves focus to the last tab while activating it if focus is on the first tab', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root
                    onValueChange={handleChange}
                    orientation={orientation as Tabs.Root.Props['orientation']}
                    value={0}
                  >
                    <Tabs.List onKeydown={handleKeyDown} activateOnFocus>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [firstTab, , lastTab] = screen.getAllByRole('tab');
              firstTab.focus();
              await flushMicrotasks();

              await fireEvent.keyDown(firstTab, { key: previousItemKey });
              await flushMicrotasks();

              expect(lastTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(1);
              expect(handleChange.mock.calls[0][0]).toBe(2);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to the previous tab while activating it', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root
                    onValueChange={handleChange}
                    orientation={orientation as Tabs.Root.Props['orientation']}
                    value={1}
                  >
                    <Tabs.List onKeydown={handleKeyDown} activateOnFocus>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [firstTab, secondTab] = screen.getAllByRole('tab');
              secondTab.focus();
              await flushMicrotasks();

              await fireEvent.keyDown(secondTab, { key: previousItemKey });
              await flushMicrotasks();

              expect(firstTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(1);
              expect(handleChange.mock.calls[0][0]).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });
          });

          it('moves focus to a disabled tab without activating it', async () => {
            const handleKeyDown = vi.fn();

            await render(
              <DirectionProvider direction={direction as TextDirection}>
                <Tabs.Root orientation={orientation as Tabs.Root.Props['orientation']} value={2}>
                  <Tabs.List onKeydown={handleKeyDown}>
                    <Tabs.Tab value={0} />
                    <Tabs.Tab value={1} disabled />
                    <Tabs.Tab value={2} />
                  </Tabs.List>
                </Tabs.Root>
              </DirectionProvider>,
            );

            const [, disabledTab, lastTab] = screen.getAllByRole('tab');
            lastTab.focus();
            await flushMicrotasks();

            await fireEvent.keyDown(lastTab, { key: previousItemKey });
            await flushMicrotasks();

            expect(disabledTab).toHaveFocus();
            expect(handleKeyDown.mock.calls.length).toBe(1);
            expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
          });
        });

        describe(`${nextItemKey}`, () => {
          describe('with `activateOnFocus = false`', () => {
            it('moves focus to the first tab without activating it if focus is on the last tab', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root
                    onValueChange={handleChange}
                    orientation={orientation as Tabs.Root.Props['orientation']}
                    value={2}
                  >
                    <Tabs.List activateOnFocus={false} onKeydown={handleKeyDown}>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [firstTab, , lastTab] = screen.getAllByRole('tab');
              lastTab.focus();
              await flushMicrotasks();

              await fireEvent.keyDown(lastTab, { key: nextItemKey });
              await flushMicrotasks();

              expect(firstTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to the next tab without activating it', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root
                    onValueChange={handleChange}
                    orientation={orientation as Tabs.Root.Props['orientation']}
                    value={1}
                  >
                    <Tabs.List activateOnFocus={false} onKeydown={handleKeyDown}>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [, secondTab, lastTab] = screen.getAllByRole('tab');
              secondTab.focus();
              await flushMicrotasks();

              await fireEvent.keyDown(secondTab, { key: nextItemKey });
              await flushMicrotasks();

              expect(lastTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to a disabled tab without activating it', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root
                    onValueChange={handleChange}
                    orientation={orientation as Tabs.Root.Props['orientation']}
                    value={0}
                  >
                    <Tabs.List activateOnFocus={false} onKeydown={handleKeyDown}>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} disabled />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [firstTab, disabledTab, thirdTab] = screen.getAllByRole('tab');
              firstTab.focus();
              await flushMicrotasks();

              await fireEvent.keyDown(firstTab, { key: nextItemKey });
              await flushMicrotasks();

              expect(disabledTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);

              await fireEvent.keyDown(disabledTab, { key: nextItemKey });
              await flushMicrotasks();
              expect(thirdTab).toHaveFocus();
            });
          });

          describe('with `activateOnFocus = true`', () => {
            it('moves focus to the first tab while activating it if focus is on the last tab', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root
                    onValueChange={handleChange}
                    orientation={orientation as Tabs.Root.Props['orientation']}
                    value={2}
                  >
                    <Tabs.List onKeydown={handleKeyDown} activateOnFocus>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [firstTab, , lastTab] = screen.getAllByRole('tab');
              lastTab.focus();
              await flushMicrotasks();

              await fireEvent.keyDown(lastTab, { key: nextItemKey });
              await flushMicrotasks();

              expect(firstTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(1);
              expect(handleChange.mock.calls[0][0]).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to the next tab while activating it', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root
                    onValueChange={handleChange}
                    orientation={orientation as Tabs.Root.Props['orientation']}
                    value={1}
                  >
                    <Tabs.List onKeydown={handleKeyDown} activateOnFocus>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [, secondTab, lastTab] = screen.getAllByRole('tab');
              secondTab.focus();
              await flushMicrotasks();

              await fireEvent.keyDown(secondTab, { key: nextItemKey });
              await flushMicrotasks();

              expect(lastTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(1);
              expect(handleChange.mock.calls[0][0]).toBe(2);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });
          });

          it('moves focus to a disabled tab without activating it', async () => {
            const handleChange = vi.fn();
            const handleKeyDown = vi.fn();

            await render(
              <DirectionProvider direction={direction as TextDirection}>
                <Tabs.Root
                  onValueChange={handleChange}
                  orientation={orientation as Tabs.Root.Props['orientation']}
                  value={0}
                >
                  <Tabs.List onKeydown={handleKeyDown}>
                    <Tabs.Tab value={0} />
                    <Tabs.Tab value={1} disabled />
                    <Tabs.Tab value={2} />
                  </Tabs.List>
                </Tabs.Root>
              </DirectionProvider>,
            );

            const [firstTab, disabledTab, thirdTab] = screen.getAllByRole('tab');
            firstTab.focus();
            await flushMicrotasks();

            await fireEvent.keyDown(firstTab, { key: nextItemKey });
            await flushMicrotasks();

            expect(disabledTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(0);
            expect(handleKeyDown.mock.calls.length).toBe(1);
            expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);

            await fireEvent.keyDown(disabledTab, { key: nextItemKey });
            await flushMicrotasks();
            expect(thirdTab).toHaveFocus();
          });
        });

        describe('modifier keys', () => {
          it.each([
            { modifierKey: 'Shift' },
            { modifierKey: 'Control' },
            { modifierKey: 'Alt' },
            { modifierKey: 'Meta' },
          ])(
            'does not move focus when modifier key: $modifierKey is pressed',
            async ({ modifierKey }) => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();
              const { user } = await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root
                    onValueChange={handleChange}
                    orientation={orientation as Tabs.Root.Props['orientation']}
                    value={0}
                  >
                    <Tabs.List onKeydown={handleKeyDown}>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [firstTab] = screen.getAllByRole('tab');

              await user.keyboard('[Tab]');
              expect(firstTab).toHaveFocus();

              await user.keyboard(`{${modifierKey}>}{${nextItemKey}}`);
              expect(firstTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(2);

              await user.keyboard(`{${modifierKey}>}{${previousItemKey}}`);
              expect(firstTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(4);
            },
          );
        });
      },
    );

    describe('when focus is on a tab regardless of orientation', () => {
      describe('Home', () => {
        it('when `activateOnFocus = false`, moves focus to the first tab without activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          await render(
            <Tabs.Root onValueChange={handleChange} value={2}>
              <Tabs.List activateOnFocus={false} onKeydown={handleKeyDown}>
                <Tabs.Tab value={0} />
                <Tabs.Tab value={1} />
                <Tabs.Tab value={2} />
              </Tabs.List>
            </Tabs.Root>,
          );

          const [firstTab, , lastTab] = screen.getAllByRole('tab');
          lastTab.focus();
          await flushMicrotasks();

          await fireEvent.keyDown(lastTab, { key: 'Home' });
          await flushMicrotasks();

          expect(firstTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(0);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        it('when `activateOnFocus = true`, moves focus to the first tab while activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          await render(
            <Tabs.Root onValueChange={handleChange} value={2}>
              <Tabs.List onKeydown={handleKeyDown} activateOnFocus>
                <Tabs.Tab value={0} />
                <Tabs.Tab value={1} />
                <Tabs.Tab value={2} />
              </Tabs.List>
            </Tabs.Root>,
          );

          const [firstTab, , lastTab] = screen.getAllByRole('tab');
          lastTab.focus();
          await flushMicrotasks();

          await fireEvent.keyDown(lastTab, { key: 'Home' });
          await flushMicrotasks();

          expect(firstTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(1);
          expect(handleChange.mock.calls[0][0]).toBe(0);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        it.each([{ activateOnFocus: false }, { activateOnFocus: true }])(
          'when `activateOnFocus = $activateOnFocus`, moves focus to a disabled tab without activating it',
          async ({ activateOnFocus: activateOnFocusProp }) => {
            const handleChange = vi.fn();
            const handleKeyDown = vi.fn();

            await render(
              <Tabs.Root onValueChange={handleChange} value={2}>
                <Tabs.List activateOnFocus={activateOnFocusProp} onKeydown={handleKeyDown}>
                  <Tabs.Tab value={0} disabled />
                  <Tabs.Tab value={1} />
                  <Tabs.Tab value={2} />
                </Tabs.List>
              </Tabs.Root>,
            );

            const [disabledTab, , lastTab] = screen.getAllByRole('tab');
            lastTab.focus();
            await flushMicrotasks();

            await fireEvent.keyDown(lastTab, { key: 'Home' });
            await flushMicrotasks();

            expect(disabledTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(0);
            expect(handleKeyDown.mock.calls.length).toBe(1);
            expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
          },
        );
      });

      describe('End', () => {
        it('when `activateOnFocus = false`, moves focus to the last tab without activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          await render(
            <Tabs.Root onValueChange={handleChange} value={0}>
              <Tabs.List activateOnFocus={false} onKeydown={handleKeyDown}>
                <Tabs.Tab value={0} />
                <Tabs.Tab value={1} />
                <Tabs.Tab value={2} />
              </Tabs.List>
            </Tabs.Root>,
          );

          const [firstTab, , lastTab] = screen.getAllByRole('tab');
          firstTab.focus();
          await flushMicrotasks();

          await fireEvent.keyDown(firstTab, { key: 'End' });
          await flushMicrotasks();

          expect(lastTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(0);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        it('when `activateOnFocus = true`, moves focus to the last tab while activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          await render(
            <Tabs.Root onValueChange={handleChange} value={0}>
              <Tabs.List onKeydown={handleKeyDown} activateOnFocus>
                <Tabs.Tab value={0} />
                <Tabs.Tab value={1} />
                <Tabs.Tab value={2} />
              </Tabs.List>
            </Tabs.Root>,
          );

          const [firstTab, , lastTab] = screen.getAllByRole('tab');
          firstTab.focus();
          await flushMicrotasks();

          await fireEvent.keyDown(firstTab, { key: 'End' });
          await flushMicrotasks();

          expect(lastTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(1);
          expect(handleChange.mock.calls[0][0]).toBe(2);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        it.each([{ activateOnFocus: false }, { activateOnFocus: true }])(
          'when `activateOnFocus = $activateOnFocus`, moves focus to a disabled tab without activating it',
          async ({ activateOnFocus: activateOnFocusProp }) => {
            const handleChange = vi.fn();
            const handleKeyDown = vi.fn();

            await render(
              <Tabs.Root onValueChange={handleChange} value={0}>
                <Tabs.List activateOnFocus={activateOnFocusProp} onKeydown={handleKeyDown}>
                  <Tabs.Tab value={0} />
                  <Tabs.Tab value={1} />
                  <Tabs.Tab value={2} disabled />
                </Tabs.List>
              </Tabs.Root>,
            );

            const [firstTab, , disabledTab] = screen.getAllByRole('tab');
            firstTab.focus();
            await flushMicrotasks();

            await fireEvent.keyDown(firstTab, { key: 'End' });
            await flushMicrotasks();

            expect(disabledTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(0);
            expect(handleKeyDown.mock.calls.length).toBe(1);
            expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
          },
        );
      });
    });

    it('should allow to focus first tab when there are no active tabs', async () => {
      await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('tabIndex'))).toEqual([
        '0',
        '-1',
      ]);
    });
  });

  describe('highlight synchronization on external value change relative to focus', () => {
    it.each([true, false])(
      'keeps controlled async activation and focus aligned with activateOnFocus=%s',
      async (activateOnFocus) => {
        const onValueChange = vi.fn();

        const App = defineComponent(() => {
          const value = shallowRef(0);
          return () => (
            <Tabs.Root
              value={value.value}
              onValueChange={(nextValue) => {
                onValueChange(nextValue);
                void Promise.resolve().then(() => {
                  value.value = nextValue;
                });
              }}
            >
              <Tabs.List activateOnFocus={activateOnFocus}>
                <Tabs.Tab value={0}>First</Tabs.Tab>
                <Tabs.Tab value={1} disabled>
                  Disabled
                </Tabs.Tab>
                <Tabs.Tab value={2}>Third</Tabs.Tab>
              </Tabs.List>
            </Tabs.Root>
          );
        });

        const { user } = await render(<App />);
        const [firstTab, disabledTab, thirdTab] = screen.getAllByRole('tab');

        firstTab.focus();
        await flushMicrotasks();
        await user.keyboard('{ArrowRight}');
        expect(disabledTab).toHaveFocus();
        expect(firstTab).toHaveAttribute('aria-selected', 'true');

        await user.keyboard('{ArrowRight}');
        expect(thirdTab).toHaveFocus();

        // Without activateOnFocus, focusing the tab must not select it until Enter is pressed.
        expect(onValueChange.mock.calls).toEqual(activateOnFocus ? [[2]] : []);
        if (!activateOnFocus) {
          await user.keyboard('{Enter}');
        }

        await waitFor(() => expect(thirdTab).toHaveAttribute('aria-selected', 'true'));
        expect(thirdTab).toHaveFocus();
        expect(onValueChange).toHaveBeenCalledWith(2);
      },
    );

    it('when focus is outside the tablist, highlight follows the new active tab (tabIndex=0 moves)', async () => {
      const { setProps } = await render(
        <Tabs.Root value={0}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab, secondTab, thirdTab] = screen.getAllByRole('tab');

      expect(firstTab.tabIndex).toBe(0);

      await setProps({ value: 2 });
      await flushMicrotasks();

      expect(firstTab.tabIndex).toBe(-1);
      expect(secondTab.tabIndex).toBe(-1);
      expect(thirdTab.tabIndex).toBe(0);

      await setProps({ value: 1 });
      await flushMicrotasks();

      expect(firstTab.tabIndex).toBe(-1);
      expect(secondTab.tabIndex).toBe(0);
      expect(thirdTab.tabIndex).toBe(-1);
    });

    it('when focus is inside the tablist, highlight stays put on external change and arrow keys continue from the focused tab', async () => {
      const { setProps } = await render(
        <Tabs.Root value={0}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 3</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab, secondTab, thirdTab] = screen.getAllByRole('tab');

      firstTab.focus();
      await flushMicrotasks();
      expect(firstTab).toHaveProperty('tabIndex', 0);

      await setProps({ value: 2 });
      await flushMicrotasks();

      // Highlight should not change (still on first tab), but selection did
      expect(firstTab.tabIndex).toBe(0);
      expect(secondTab.tabIndex).toBe(-1);
      expect(thirdTab.tabIndex).toBe(-1);
      expect(firstTab).toHaveAttribute('aria-selected', 'false');
      expect(thirdTab).toHaveAttribute('aria-selected', 'true');

      // Arrow navigation should continue from the highlighted tab
      await fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(secondTab).toHaveFocus();
      // Selection remains the externally-set tab since activateOnFocus=false
      expect(thirdTab).toHaveAttribute('aria-selected', 'true');
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('activation direction', () => {
    // The render function of Base UI returns nothing. A `#render` slot of Vue returns an element.
    function recordPanelState(panelRenderMock: (state: unknown) => void, value: unknown) {
      return {
        render: ({ props, state }: RenderSlotProps & { state: Tabs.Panel.State }) => {
          panelRenderMock({ value, ...state });
          return <div {...props} />;
        },
      };
    }

    async function waitForSettledPanelTransitions() {
      await flushMicrotasks();
      // One frame lets panel transition work scheduled during the click settle,
      // and the second frame lets any resulting Vue update commit before the
      // next click assertion starts observing new render calls.
      await waitSingleFrame();
      await waitSingleFrame();
    }

    function getFirstPanelRenderStateByValue(
      panelRenderMock: ReturnType<typeof vi.fn>,
      value: any,
    ) {
      return panelRenderMock.mock.calls.find(([state]) => state.value === value)?.[0];
    }

    // A vertical list needs tabs that stack.
    function renderTwoTabs(
      root: {
        value: number | null;
        orientation?: Tabs.Root.Orientation;
        onValueChange?: (value: Tabs.Tab.Value, eventDetails: Tabs.Root.ChangeEventDetails) => void;
      },
      tabStyle?: { display: string },
    ) {
      return render(
        <Tabs.Root data-testid="root" {...root}>
          <Tabs.List>
            <Tabs.Tab value={0} style={tabStyle} />
            <Tabs.Tab value={1} style={tabStyle} />
          </Tabs.List>
        </Tabs.Root>,
      );
    }

    it('should set the `data-activation-direction` attribute on the tabs root with orientation=horizontal', async () => {
      const panelRenderMock = vi.fn();
      const { user } = await render(
        <Tabs.Root data-testid="root">
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} v-slots={recordPanelState(panelRenderMock, 0)} />
          <Tabs.Panel value={1} v-slots={recordPanelState(panelRenderMock, 1)} />
        </Tabs.Root>,
      );

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      const [tab1, tab2] = screen.getAllByRole('tab');

      expect(root).toHaveAttribute('data-activation-direction', 'none');
      await user.click(tab2);

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 1)).toEqual(
        expect.objectContaining({ value: 1, tabActivationDirection: 'right' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'right');

      await waitForSettledPanelTransitions();
      panelRenderMock.mockClear();

      await user.click(tab1);

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 0)).toEqual(
        expect.objectContaining({ value: 0, tabActivationDirection: 'left' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'left');
    });

    it('should set the `data-activation-direction` attribute on the tabs root with orientation=vertical', async () => {
      const panelRenderMock = vi.fn();
      const { user } = await render(
        <Tabs.Root data-testid="root" orientation="vertical">
          <Tabs.List>
            <Tabs.Tab value={0} style={{ display: 'block' }} />
            <Tabs.Tab value={1} style={{ display: 'block' }} />
          </Tabs.List>
          <Tabs.Panel value={0} v-slots={recordPanelState(panelRenderMock, 0)} />
          <Tabs.Panel value={1} v-slots={recordPanelState(panelRenderMock, 1)} />
        </Tabs.Root>,
      );

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      const [tab1, tab2] = screen.getAllByRole('tab');

      expect(root).toHaveAttribute('data-activation-direction', 'none');
      await user.click(tab2);

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 1)).toEqual(
        expect.objectContaining({ value: 1, tabActivationDirection: 'down' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'down');

      await waitForSettledPanelTransitions();
      panelRenderMock.mockClear();

      await user.click(tab1);

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 0)).toEqual(
        expect.objectContaining({ value: 0, tabActivationDirection: 'up' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'up');
    });

    it('should update `data-activation-direction` on programmatic value changes with orientation=horizontal', async () => {
      const panelRenderMock = vi.fn();
      const { setProps } = await render(
        <Tabs.Root data-testid="root" value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} v-slots={recordPanelState(panelRenderMock, 0)} />
          <Tabs.Panel value={1} v-slots={recordPanelState(panelRenderMock, 1)} />
        </Tabs.Root>,
      );

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      const tabs = screen.getAllByRole('tab');
      expect(root).toHaveAttribute('data-activation-direction', 'none');
      expect(tabs[0]).toHaveAttribute('data-activation-direction', 'none');

      await setProps({ value: 1 });

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 1)).toEqual(
        expect.objectContaining({ value: 1, tabActivationDirection: 'right' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'right');
      expect(tabs[1]).toHaveAttribute('data-activation-direction', 'right');

      panelRenderMock.mockClear();

      await setProps({ value: 0 });

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 0)).toEqual(
        expect.objectContaining({ value: 0, tabActivationDirection: 'left' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'left');
      expect(tabs[0]).toHaveAttribute('data-activation-direction', 'left');
    });

    it('should update `data-activation-direction` on programmatic value changes with orientation=vertical', async () => {
      const panelRenderMock = vi.fn();
      const { setProps } = await render(
        <Tabs.Root data-testid="root" value={0} orientation="vertical">
          <Tabs.List>
            <Tabs.Tab value={0} style={{ display: 'block' }} />
            <Tabs.Tab value={1} style={{ display: 'block' }} />
          </Tabs.List>
          <Tabs.Panel value={0} v-slots={recordPanelState(panelRenderMock, 0)} />
          <Tabs.Panel value={1} v-slots={recordPanelState(panelRenderMock, 1)} />
        </Tabs.Root>,
      );

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      const tabs = screen.getAllByRole('tab');
      expect(root).toHaveAttribute('data-activation-direction', 'none');
      expect(tabs[0]).toHaveAttribute('data-activation-direction', 'none');

      await setProps({ value: 1 });

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 1)).toEqual(
        expect.objectContaining({ value: 1, tabActivationDirection: 'down' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'down');
      expect(tabs[1]).toHaveAttribute('data-activation-direction', 'down');

      panelRenderMock.mockClear();

      await setProps({ value: 0 });

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 0)).toEqual(
        expect.objectContaining({ value: 0, tabActivationDirection: 'up' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'up');
      expect(tabs[0]).toHaveAttribute('data-activation-direction', 'up');
    });

    it('keeps activation direction none after automatic disabled fallback', async () => {
      const TestComponent = defineComponent(
        (props: { disableFirst: boolean }) => () => (
          <Tabs.Root data-testid="root" defaultValue={0}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled={props.disableFirst}>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value={0}>Panel 0</Tabs.Panel>
            <Tabs.Panel value={1}>Panel 1</Tabs.Panel>
          </Tabs.Root>
        ),
        { props: ['disableFirst'] },
      );

      const { setProps } = await render(<TestComponent disableFirst={false} />);

      await setProps({ disableFirst: true });

      await waitFor(() => {
        expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
      });
      expect(screen.getByTestId('root')).toHaveAttribute('data-activation-direction', 'none');
    });

    it('resets `data-activation-direction` when the selection is cleared and restored', async () => {
      const { setProps } = await render(
        <Tabs.Root data-testid="root" value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
            <Tabs.Indicator data-testid="indicator" />
          </Tabs.List>
        </Tabs.Root>,
      );

      const root = screen.getByTestId('root');

      await setProps({ value: 1 });
      expect(root).toHaveAttribute('data-activation-direction', 'right');

      // Clearing the selection is not a directional transition.
      await setProps({ value: null });
      expect(root).toHaveAttribute('data-activation-direction', 'none');
      expect(screen.queryByTestId('indicator')).toBe(null);

      // Neither is selecting a tab again from a cleared state.
      await setProps({ value: 0 });
      expect(root).toHaveAttribute('data-activation-direction', 'none');
      expect(screen.getByTestId('indicator')).not.toBe(null);
    });

    it('should update `data-activation-direction` on programmatic change after a canceled click', async () => {
      const { user, setProps } = await render(
        <Tabs.Root
          data-testid="root"
          value={0}
          onValueChange={(_value, eventDetails) => {
            eventDetails.cancel();
          }}
        >
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} />
          <Tabs.Panel value={1} />
        </Tabs.Root>,
      );

      const root = screen.getByTestId('root');
      const [, tab2] = screen.getAllByRole('tab');

      // Click is canceled — value stays at 0
      await user.click(tab2);
      expect(root).toHaveAttribute('data-activation-direction', 'none');

      // A later programmatic change should still compute direction correctly
      await setProps({ value: 1 });

      expect(root).toHaveAttribute('data-activation-direction', 'right');
    });

    it('should update `data-activation-direction` on programmatic change after a controlled parent ignores click', async () => {
      const { user, setProps } = await render(
        <Tabs.Root data-testid="root" value={0} onValueChange={() => {}}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} />
          <Tabs.Panel value={1} />
        </Tabs.Root>,
      );

      const root = screen.getByTestId('root');
      const [, tab2] = screen.getAllByRole('tab');

      // Click fires onValueChange but parent doesn't update value
      await user.click(tab2);

      // A later programmatic change should still compute direction correctly
      await setProps({ value: 1 });

      expect(root).toHaveAttribute('data-activation-direction', 'right');
    });

    it('should compute correct direction when adding and selecting a new tab in one controlled update', async () => {
      const panelRenderMock = vi.fn();
      const DynamicTabs = defineComponent(() => {
        const tabs = shallowRef([0, 1]);
        const value = shallowRef(0);

        return () => (
          <div>
            <button
              type="button"
              onClick={() => {
                tabs.value = [0, 1, 2];
                value.value = 2;
              }}
            >
              Add and Select
            </button>
            <Tabs.Root data-testid="root" value={value.value}>
              <Tabs.List>
                {tabs.value.map((tab) => (
                  <Tabs.Tab key={tab} value={tab} />
                ))}
              </Tabs.List>
              {tabs.value.map((tab) => (
                <Tabs.Panel
                  key={tab}
                  value={tab}
                  v-slots={recordPanelState(panelRenderMock, tab)}
                />
              ))}
            </Tabs.Root>
          </div>
        );
      });

      const { user } = await render(<DynamicTabs />);

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('data-activation-direction', 'none');

      await user.click(screen.getByText('Add and Select'));

      expect(panelRenderMock.mock.calls.find(([state]) => state.value === 2)?.[0]).toEqual(
        expect.objectContaining({ value: 2, tabActivationDirection: 'right' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'right');
    });

    it('should compute correct direction on final render when adding and selecting a new tab in one controlled update with out of order string values', async () => {
      const panelRenderMock = vi.fn();
      const DynamicTabs = defineComponent(() => {
        const tabs = shallowRef(['Overview', 'Projects']);
        const value = shallowRef('Overview');

        return () => (
          <div>
            <button
              type="button"
              onClick={() => {
                tabs.value = ['Overview', 'Projects', 'Account'];
                value.value = 'Account';
              }}
            >
              Add and Select
            </button>
            <Tabs.Root data-testid="root" value={value.value}>
              <Tabs.List>
                {tabs.value.map((tab) => (
                  <Tabs.Tab key={tab} value={tab} />
                ))}
              </Tabs.List>
              {tabs.value.map((tab) => (
                <Tabs.Panel
                  key={tab}
                  value={tab}
                  v-slots={recordPanelState(panelRenderMock, tab)}
                />
              ))}
            </Tabs.Root>
          </div>
        );
      });

      const { user } = await render(<DynamicTabs />);

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('data-activation-direction', 'none');

      await user.click(screen.getByText('Add and Select'));

      expect(panelRenderMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ tabActivationDirection: 'right' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'right');
    });

    it('gives a tab its direction in its first render after the value changes', async () => {
      const renders: string[] = [];
      const { setProps } = await render(
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab
              value={1}
              stateClass={(state) => {
                renders.push(`${state.active} ${state.tabActivationDirection}`);
                return '';
              }}
            />
          </Tabs.List>
        </Tabs.Root>,
      );
      renders.length = 0;

      await setProps({ value: 1 });

      expect(renders[0]).toBe('true right');
    });

    it('computes the direction with the new orientation when the value and the orientation change together', async () => {
      const { setProps } = await renderTwoTabs(
        { value: 0, orientation: 'horizontal' },
        { display: 'block' },
      );

      await setProps({ value: 1, orientation: 'vertical' });

      expect(screen.getByTestId('root')).toHaveAttribute('data-activation-direction', 'down');
    });

    it('sets no direction for a canceled click or a cleared value, and sets it for a later change', async () => {
      const { user, setProps } = await renderTwoTabs({
        value: 0,
        onValueChange: (_value, eventDetails) => eventDetails.cancel(),
      });
      const root = screen.getByTestId('root');

      await user.click(screen.getAllByRole('tab')[1]);
      expect(root).toHaveAttribute('data-activation-direction', 'none');

      await setProps({ value: 1 });
      expect(root).toHaveAttribute('data-activation-direction', 'right');

      await setProps({ value: null });
      expect(root).toHaveAttribute('data-activation-direction', 'none');

      await setProps({ value: 0 });
      expect(root).toHaveAttribute('data-activation-direction', 'none');
    });

    it('sets the direction none when an automatic fallback changes the value', async () => {
      const TestComponent = defineComponent(
        (props: { disableSecond: boolean }) => () => (
          <Tabs.Root data-testid="root" defaultValue={0}>
            <Tabs.List>
              <Tabs.Tab value={0} />
              <Tabs.Tab value={1} disabled={props.disableSecond} />
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['disableSecond'] },
      );
      const { user, setProps } = await render(<TestComponent disableSecond={false} />);
      await user.click(screen.getAllByRole('tab')[1]);
      expect(screen.getByTestId('root')).toHaveAttribute('data-activation-direction', 'right');

      await setProps({ disableSecond: true });
      await flushMicrotasks();

      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('root')).toHaveAttribute('data-activation-direction', 'none');
    });
  });

  describe('nested tabs', () => {
    it('keeps a nested root independent from the one hosting its panel', async () => {
      const { user } = await render(
        <Tabs.Root defaultValue="outer-1">
          <Tabs.List data-testid="outer-list">
            <Tabs.Tab value="outer-1">Outer 1</Tabs.Tab>
            <Tabs.Tab value="outer-2">Outer 2</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="outer-1" data-testid="outer-panel-1">
            <Tabs.Root defaultValue="inner-1">
              <Tabs.List data-testid="inner-list">
                <Tabs.Tab value="inner-1">Inner 1</Tabs.Tab>
                <Tabs.Tab value="inner-2">Inner 2</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="inner-1">Inner panel 1</Tabs.Panel>
              <Tabs.Panel value="inner-2">Inner panel 2</Tabs.Panel>
            </Tabs.Root>
          </Tabs.Panel>
          <Tabs.Panel value="outer-2">Outer panel 2</Tabs.Panel>
        </Tabs.Root>,
      );

      const [outerTab1, outerTab2] = within(screen.getByTestId('outer-list')).getAllByRole('tab');
      const [innerTab1, innerTab2] = within(screen.getByTestId('inner-list')).getAllByRole('tab');

      const outerPanel1 = screen.getByTestId('outer-panel-1');
      const innerPanel1 = screen.getByText('Inner panel 1');

      // Each root wires its own tabs and panels together.
      expect(outerTab1).toHaveAttribute('aria-controls', outerPanel1.id);
      expect(innerTab1).toHaveAttribute('aria-controls', innerPanel1.id);
      expect(innerPanel1).toHaveAttribute('aria-labelledby', innerTab1.id);

      // Arrow keys within the nested list stay within the nested list.
      innerTab1.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowRight}');

      expect(innerTab2).toHaveFocus();
      expect(innerTab2).toHaveAttribute('aria-selected', 'false');

      await user.keyboard('{Enter}');

      expect(innerTab2).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Inner panel 2')).not.toHaveAttribute('hidden');
      expect(outerTab1).toHaveAttribute('aria-selected', 'true');
      expect(outerTab2).toHaveAttribute('aria-selected', 'false');

      // Selecting an outer tab unmounts the nested root along with its panel.
      await user.click(outerTab2);

      expect(screen.queryByTestId('inner-list')).toBe(null);
      expect(screen.getByText('Outer panel 2')).not.toHaveAttribute('hidden');
    });
  });

  describe('events', () => {
    it('emits valueChange and then update:value, and a canceled change emits no update:value', async () => {
      const calls: string[] = [];
      let cancel = false;
      const { user } = await render(
        <Tabs.Root
          onValueChange={(value, eventDetails) => {
            calls.push(`valueChange ${value} ${eventDetails.reason}`);
            if (cancel) {
              eventDetails.cancel();
            }
          }}
          {...{ 'onUpdate:value': (value: number) => calls.push(`update:value ${value}`) }}
        >
          <Tabs.List>
            <Tabs.Tab value={0} disabled />
            <Tabs.Tab value={1} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>,
      );
      const tabs = screen.getAllByRole('tab');

      // The first tab is disabled, so the root selects the second tab. That change is automatic.
      expect(calls).toEqual(['valueChange 1 initial', 'update:value 1']);

      calls.length = 0;
      await user.click(tabs[2]);
      expect(calls).toEqual(['valueChange 2 none', 'update:value 2']);

      calls.length = 0;
      cancel = true;
      await user.click(tabs[1]);
      expect(calls).toEqual(['valueChange 1 none']);
    });
  });

  describe('removal of the last tab', () => {
    it('emits valueChange with null when the last tab leaves with a Transition', async () => {
      const handleChange = vi.fn();
      let finishLeave = () => {};
      const TestComponent = defineComponent(
        (props: { visible: boolean }) => () => (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List>
              <Transition
                css={false}
                onLeave={(_element: Element, done: () => void) => {
                  finishLeave = done;
                }}
              >
                {props.visible ? <Tabs.Tab value={0} /> : null}
              </Transition>
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['visible'] },
      );
      const { setProps } = await render(<TestComponent visible />);
      const tab = screen.getByRole('tab');

      await setProps({ visible: false });

      // The element stays in the document until the Transition ends, but the tab part is gone.
      expect(tab).toBeInTheDocument();
      expect(handleChange.mock.calls.map(([value, { reason }]) => [value, reason])).toEqual([
        [null, 'missing'],
      ]);

      finishLeave();
      await flushMicrotasks();

      expect(tab).not.toBeInTheDocument();
      expect(handleChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('KeepAlive', () => {
    const Other = defineComponent(() => () => <span />);

    it('keeps the selection when KeepAlive takes the root out of the document and back', async () => {
      const handleChange = vi.fn();
      const Inner = defineComponent(() => () => (
        <Tabs.Root defaultValue={1} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));
      const App = defineComponent(
        (props: { visible: boolean }) => () => (
          <KeepAlive>{props.visible ? <Inner /> : <Other />}</KeepAlive>
        ),
        { props: ['visible'] },
      );
      const { setProps } = await render(<App visible />);
      const tabs = screen.getAllByRole('tab');

      await setProps({ visible: false });
      await flushMicrotasks();
      await setProps({ visible: true });
      await flushMicrotasks();

      expect(handleChange).not.toHaveBeenCalled();
      expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    });

    it('keeps the selection when KeepAlive takes the list out of the document and back', async () => {
      const handleChange = vi.fn();
      const Inner = defineComponent(() => () => (
        <Tabs.List>
          <Tabs.Tab value={0} />
          <Tabs.Tab value={1} />
        </Tabs.List>
      ));
      const App = defineComponent(
        (props: { visible: boolean }) => () => (
          <Tabs.Root defaultValue={1} onValueChange={handleChange}>
            <KeepAlive>{props.visible ? <Inner /> : <Other />}</KeepAlive>
          </Tabs.Root>
        ),
        { props: ['visible'] },
      );
      const { setProps } = await render(<App visible />);
      const tabs = screen.getAllByRole('tab');

      await setProps({ visible: false });
      await flushMicrotasks();
      await setProps({ visible: true });
      await flushMicrotasks();

      expect(handleChange).not.toHaveBeenCalled();
      expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    });
  });

  describe('ids of tabs and panels', () => {
    it('gives the tab and the panel of one value the id of each other, and the panels an index', async () => {
      const TestComponent = defineComponent(
        (props: { showPanelA: boolean }) => () => (
          <Tabs.Root defaultValue="a">
            <Tabs.Panel value="b" id="panel-b" keepMounted />
            <Tabs.List>
              <Tabs.Tab value="a" id="tab-a" />
              <Tabs.Tab value="b" id="tab-b" />
            </Tabs.List>
            {props.showPanelA && <Tabs.Panel value="a" id="panel-a" />}
          </Tabs.Root>
        ),
        { props: ['showPanelA'] },
      );
      const { setProps } = await render(<TestComponent showPanelA />);
      const [tabA, tabB] = screen.getAllByRole('tab');
      const [panelB, panelA] = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabA).toHaveAttribute('aria-controls', 'panel-a');
      expect(tabB).toHaveAttribute('aria-controls', 'panel-b');
      expect(panelB).toHaveAttribute('aria-labelledby', 'tab-b');
      expect(panelA).toHaveAttribute('aria-labelledby', 'tab-a');
      // The tabs have a list of their own, so they do not count as panels.
      expect([panelB, panelA].map((panel) => panel.getAttribute('data-index'))).toEqual(['0', '1']);

      await setProps({ showPanelA: false });

      expect(tabA).not.toHaveAttribute('aria-controls');
      expect(tabB).toHaveAttribute('aria-controls', 'panel-b');
    });

    it('names the first tab of a value on its panel, and the last panel of a value on its tab', async () => {
      const TestComponent = defineComponent(
        (props: { showEarlierPanel: boolean }) => () => (
          <Tabs.Root defaultValue="a">
            <Tabs.List>
              <Tabs.Tab value="a" id="first" />
              <Tabs.Tab value="a" id="second" />
            </Tabs.List>
            {props.showEarlierPanel && <Tabs.Panel value="a" id="earlier" />}
            <Tabs.Panel value="a" id="later" />
          </Tabs.Root>
        ),
        { props: ['showEarlierPanel'] },
      );
      const { setProps } = await render(<TestComponent showEarlierPanel />);
      const [firstTab] = screen.getAllByRole('tab');

      expect(screen.getAllByRole('tabpanel')[1]).toHaveAttribute('aria-labelledby', 'first');
      expect(firstTab).toHaveAttribute('aria-controls', 'later');

      await setProps({ showEarlierPanel: false });

      expect(firstTab).toHaveAttribute('aria-controls', 'later');
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'the implicit default, strings', props: {}, server: 0, client: 0 },
      {
        name: 'the implicit default, first disabled',
        props: { firstDisabled: true },
        server: 1,
        client: 1,
      },
      { name: 'an explicit default value', props: { defaultValue: 'b' }, server: 1, client: 1 },
      {
        name: 'a value of null, first disabled',
        props: { value: null, firstDisabled: true },
        server: 0,
        client: 0,
      },
      {
        name: 'a default value of null, first disabled',
        props: { defaultValue: null, firstDisabled: true },
        server: 0,
        client: 0,
      },
      // A server cannot tell that the value names no tab. The first tab takes the tab stop at the mount.
      { name: 'a value that names no tab', props: { value: 'zzz' }, server: undefined, client: 0 },
    ] as const)(
      'gives the tab stop of the server HTML and of the client for $name',
      async ({ props, server, client }) => {
        const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
        const template = document.createElement('template');
        template.innerHTML = serverHtml;
        const tabStops = (index: number | undefined) =>
          [0, 1, 2].map((tab) => (tab === index ? '0' : '-1'));
        expect(readTabindexes(template.content)).toEqual(tabStops(server));

        const { container } = await hydrate(TabsRootHydration, { serverHtml, props });

        expect(readTabindexes(container)).toEqual(tabStops(client));
      },
    );

    it('gives a tab the id of a panel that comes after the list when the client has mounted', async () => {
      const props = { defaultValue: 'a', panel: 'after' };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(
        template.content.querySelector('[data-testid="a"]')?.getAttribute('aria-controls'),
      ).toBeNull();

      const { container } = await hydrate(TabsRootHydration, { serverHtml, props });

      expect(container.querySelector('[data-testid="a"]')).toHaveAttribute(
        'aria-controls',
        'panel-a',
      );
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  describe('useTabsRootContext', () => {
    it('throws when a part is outside Tabs.Root', async () => {
      await expect(render(<Tabs.List />)).rejects.toThrow(
        'Vase UI: A part of Tabs must be inside <Tabs.Root>. Without a root the part has no value and no orientation. Put the part inside <Tabs.Root>.',
      );

      // Vue also warns about the error of `setup`.
      expect(takeReportedMessages()).toEqual([
        expect.stringContaining('Unhandled error during execution of setup function'),
      ]);
    });
  });
});
