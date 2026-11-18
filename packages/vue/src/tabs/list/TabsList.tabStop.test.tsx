import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef, Teleport } from 'vue';
import { Tabs } from '@vase-ui/vue/tabs';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';

function readTabindexes() {
  return screen.getAllByRole('tab', { hidden: true }).map((tab) => tab.tabIndex);
}

describe('VUE-54: the tab stop of <Tabs.List /> follows the active tab', () => {
  const { render } = createRenderer();

  it('keeps the tab stop on a focused tab rendered outside its list', async () => {
    const value = shallowRef('first');
    await render(() => (
      <>
        <Tabs.Root modelValue={value.value}>
          <Tabs.List>
            <Tabs.Tab value="first">First</Tabs.Tab>
            <Teleport to="body">
              <Tabs.Tab value="remote">Remote</Tabs.Tab>
            </Teleport>
            <Tabs.Tab value="last">Last</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
        <button>Outside</button>
      </>
    ));
    const remote = screen.getByRole('tab', { name: 'Remote' });
    const last = screen.getByRole('tab', { name: 'Last' });
    remote.focus();
    value.value = 'last';
    await flushMicrotasks();
    expect(remote).toHaveFocus();
    expect([remote.tabIndex, last.tabIndex]).toEqual([0, -1]);
    screen.getByRole('button', { name: 'Outside' }).focus();
    await flushMicrotasks();
    expect([remote.tabIndex, last.tabIndex]).toEqual([-1, 0]);
  });

  it('gives the tab stop to the first of two tabs with the selected value', async () => {
    const value = shallowRef('other');
    await render(() => (
      <Tabs.Root modelValue={value.value}>
        <Tabs.List>
          <Tabs.Tab value="same" />
          <Tabs.Tab value="same" />
          <Tabs.Tab value="other" />
        </Tabs.List>
      </Tabs.Root>
    ));
    expect(readTabindexes()).toEqual([-1, -1, 0]);
    value.value = 'same';
    await flushMicrotasks();
    expect(readTabindexes()).toEqual([0, -1, -1]);
  });

  it('enters the list on the active tab after the focus leaves it, with manual activation', async () => {
    const { user } = await render(
      <Tabs.Root defaultValue={0}>
        <Tabs.List>
          <Tabs.Tab value={0} />
          <Tabs.Tab value={1} />
          <Tabs.Tab value={2} />
        </Tabs.List>
        <Tabs.Panel value={0} />
      </Tabs.Root>,
    );
    const [firstTab, secondTab] = screen.getAllByRole('tab');
    await user.keyboard('{Tab}');
    await user.keyboard('{ArrowRight}');
    expect(secondTab).toHaveFocus();
    expect(readTabindexes()).toEqual([-1, 0, -1]);

    await user.keyboard('{Tab}');
    expect(screen.getByRole('tabpanel')).toHaveFocus();
    expect(readTabindexes()).toEqual([0, -1, -1]);

    await user.keyboard('{Shift>}{Tab}{/Shift}');

    expect(firstTab).toHaveFocus();
    expect(firstTab).toHaveAttribute('aria-selected', 'true');
  });

  it.each([
    { name: 'an enabled tab', tabProps: {} },
    { name: 'a disabled tab', tabProps: { disabled: true } },
    { name: 'a hidden tab', tabProps: { hidden: true } },
  ])(
    'moves the tab stop to the first enabled tab when the value changes from $name to null',
    async ({ tabProps }) => {
      const value = shallowRef<number | null>(2);
      const TestComponent = defineComponent(() => () => (
        <Tabs.Root modelValue={value.value}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled />
            <Tabs.Tab value={1} />
            <Tabs.Tab value={2} {...tabProps} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await render(<TestComponent />);
      expect(readTabindexes()).toEqual([-1, -1, 0]);

      value.value = null;
      await flushMicrotasks();

      expect(readTabindexes()).toEqual([-1, 0, -1]);
    },
  );
});
