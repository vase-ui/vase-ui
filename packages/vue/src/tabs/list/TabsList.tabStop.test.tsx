import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Tabs } from '@vase-ui/vue/tabs';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';

function readTabindexes() {
  return screen.getAllByRole('tab').map((tab) => tab.tabIndex);
}

describe('VUE-51: the tab stop of <Tabs.List /> follows the active tab', () => {
  const { render } = createRenderer();

  it('moves the tab stop to the active tab when the focus leaves the list, with manual activation', async () => {
    await render(
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
    firstTab.focus();
    await flushMicrotasks();
    await fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
    await flushMicrotasks();
    expect(secondTab).toHaveFocus();
    expect(readTabindexes()).toEqual([-1, 0, -1]);

    screen.getByRole('tabpanel').focus();
    await flushMicrotasks();

    expect(firstTab).toHaveAttribute('aria-selected', 'true');
    expect(readTabindexes()).toEqual([0, -1, -1]);
  });

  it('moves the tab stop to the first enabled tab when the value becomes null', async () => {
    const value = shallowRef<number | null>(2);
    const TestComponent = defineComponent(() => () => (
      <Tabs.Root value={value.value}>
        <Tabs.List>
          <Tabs.Tab value={0} disabled />
          <Tabs.Tab value={1} />
          <Tabs.Tab value={2} />
        </Tabs.List>
      </Tabs.Root>
    ));
    await render(<TestComponent />);
    expect(readTabindexes()).toEqual([-1, -1, 0]);

    value.value = null;
    await flushMicrotasks();

    expect(readTabindexes()).toEqual([-1, 0, -1]);
  });
});
