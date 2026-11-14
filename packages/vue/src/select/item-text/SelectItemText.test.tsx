import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { Select } from '@vase-ui/vue/select';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';
import type { SelectStore } from '../store';
import { useSelectRootContext } from '../root/SelectRootContext';

describe('<Select.ItemText />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.ItemText />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Positioner>
            <Select.Item value="">{node}</Select.Item>
          </Select.Positioner>
        </Select.Root>,
      );
    },
  }));

  it('gives the text of the first item and of the selected item to the store', async () => {
    let store: SelectStore | undefined;
    const StoreProbe = defineComponent(() => {
      store = useSelectRootContext();
      return () => null;
    });

    await render(
      <Select.Root open defaultValue="b">
        <StoreProbe />
        <Select.Positioner>
          <Select.Item value="a">
            <Select.ItemText data-testid="a">a</Select.ItemText>
          </Select.Item>
          <Select.Item value="b">
            <Select.ItemText data-testid="b">b</Select.ItemText>
          </Select.Item>
        </Select.Positioner>
      </Select.Root>,
    );
    await flushMicrotasks();

    expect(store!.context.firstItemTextRef.value).toBe(screen.getByTestId('a'));
    expect(store!.context.selectedItemTextRef.value).toBe(screen.getByTestId('b'));
  });

  it('throws a descriptive error when rendered outside <Select.Item>', async () => {
    await expect(
      render(
        <Select.Root open>
          <Select.Positioner>
            <Select.ItemText />
          </Select.Positioner>
        </Select.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A text or an indicator of a Select item must be inside <Select.Item>.',
    );
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
