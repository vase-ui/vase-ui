import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { Select } from '@vase-ui/vue/select';
import { createRenderer, describeConformance, flushMicrotasks, screen, waitFor } from '#test-utils';

describe('<Select.ItemIndicator />', () => {
  const { render } = createRenderer();

  const TestComponent = defineComponent({
    props: {
      value: { type: String, required: true },
      keepMounted: { type: Boolean, default: undefined },
    },
    setup: (props) => () => (
      <Select.Root value={props.value} open>
        <Select.Trigger />
        <Select.Positioner>
          <Select.Popup>
            <Select.Item value="a">
              a
              <Select.ItemIndicator keepMounted={props.keepMounted} data-testid="indicator" />
            </Select.Item>
            <Select.Item value="b">b</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Root>
    ),
  });

  describeConformance(<Select.ItemIndicator />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Positioner>
            <Select.Item>{node}</Select.Item>
          </Select.Positioner>
        </Select.Root>,
      );
    },
  }));

  it('settles out of its transition state after the item is deselected', async () => {
    const { user } = await render(
      <Select.Root multiple defaultOpen defaultValue={['a']}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">
                a
                <Select.ItemIndicator keepMounted data-testid="indicator" />
              </Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );
    await flushMicrotasks();

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-selected');

    await user.click(screen.getByRole('option', { name: 'a' }));

    await waitFor(() => {
      expect(indicator).not.toHaveAttribute('data-selected');
    });

    // A kept-mounted indicator must not be left advertising an exit transition once the
    // deselection has finished, or `[data-ending-style]` CSS would stick permanently.
    await waitFor(() => {
      expect(indicator).not.toHaveAttribute('data-ending-style');
    });
  });

  it('mounts only while selected when keepMounted is false', async () => {
    const { setProps } = await render(<TestComponent value="b" />);

    expect(screen.queryByTestId('indicator')).toBe(null);

    await setProps({ value: 'a' });

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-selected');
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator).not.toHaveAttribute('selected');

    await setProps({ value: 'b' });

    expect(screen.queryByTestId('indicator')).toBe(null);

    await setProps({ value: 'a' });

    expect(screen.getByTestId('indicator')).toHaveAttribute('data-selected');
  });

  it('preserves the kept-mounted element across selection changes', async () => {
    const { setProps } = await render(<TestComponent value="b" keepMounted />);
    const indicator = screen.getByTestId('indicator');

    expect(indicator).not.toHaveAttribute('data-selected');

    await setProps({ value: 'a' });

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).toHaveAttribute('data-selected');

    await setProps({ value: 'b' });

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).not.toHaveAttribute('data-selected');
    await waitFor(() => {
      expect(indicator).not.toHaveAttribute('data-ending-style');
    });

    await setProps({ value: 'a' });

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).toHaveAttribute('data-selected');
  });
});
