import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';
import { REASONS } from '../../internals/reasons';

describe('<Menu.RadioGroup />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.RadioGroup />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  it('renders a div with the `group` role', async () => {
    await render(<Menu.RadioGroup />);
    expect(screen.getByRole('group')).toBeVisible();
  });

  describe('value', () => {
    it('selects an item on a click, and emits valueChange and then update:value', async () => {
      const events: string[] = [];
      const onValueChange = vi.fn(() => events.push('valueChange'));
      const onUpdateValue = vi.fn(() => events.push('update:value'));
      const { user } = await render(
        <Menu.Root open>
          <Menu.RadioGroup
            defaultValue="a"
            onValueChange={onValueChange}
            {...{ 'onUpdate:value': onUpdateValue }}
          >
            <Menu.RadioItem value="a">A</Menu.RadioItem>
            <Menu.RadioItem value="b">B</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Root>,
      );

      const [a, b] = screen.getAllByRole('menuitemradio');
      expect(a).toHaveAttribute('aria-checked', 'true');

      await user.click(b);

      expect(a).toHaveAttribute('aria-checked', 'false');
      expect(b).toHaveAttribute('aria-checked', 'true');
      expect(events).toEqual(['valueChange', 'update:value']);
      expect(onValueChange.mock.lastCall).toEqual(['b', expect.anything()]);
      const details = (
        onValueChange.mock.lastCall as unknown[]
      )[1] as Menu.RadioGroup.ChangeEventDetails;
      expect(details.reason).toBe(REASONS.itemPress);
      expect(onUpdateValue).toHaveBeenLastCalledWith('b');
    });

    it('keeps the value when valueChange cancels the change', async () => {
      const onUpdateValue = vi.fn();
      const { user } = await render(
        <Menu.Root open>
          <Menu.RadioGroup
            defaultValue="a"
            onValueChange={(_: unknown, details: Menu.RadioGroup.ChangeEventDetails) =>
              details.cancel()
            }
            {...{ 'onUpdate:value': onUpdateValue }}
          >
            <Menu.RadioItem value="a">A</Menu.RadioItem>
            <Menu.RadioItem value="b">B</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Root>,
      );

      const [a, b] = screen.getAllByRole('menuitemradio');
      await user.click(b);

      expect(a).toHaveAttribute('aria-checked', 'true');
      expect(b).toHaveAttribute('aria-checked', 'false');
      expect(onUpdateValue).not.toHaveBeenCalled();
    });

    it('follows v-model:value', async () => {
      const value = shallowRef('a');
      const Test = defineComponent(() => () => (
        <Menu.Root open>
          <Menu.RadioGroup
            value={value.value}
            {...{
              'onUpdate:value': (next: string) => {
                value.value = next;
              },
            }}
          >
            <Menu.RadioItem value="a">A</Menu.RadioItem>
            <Menu.RadioItem value="b">B</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Root>
      ));

      const { user } = await render(<Test />);
      const [a, b] = screen.getAllByRole('menuitemradio');

      await user.click(b);
      expect(value.value).toBe('b');
      expect(b).toHaveAttribute('aria-checked', 'true');

      value.value = 'a';
      await flushMicrotasks();
      expect(a).toHaveAttribute('aria-checked', 'true');
      expect(b).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('disables itself and its items', async () => {
    await render(
      <Menu.Root open>
        <Menu.RadioGroup disabled>
          <Menu.RadioItem value="a">A</Menu.RadioItem>
        </Menu.RadioGroup>
      </Menu.Root>,
    );

    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-disabled', 'true');
    expect(group).toHaveAttribute('data-disabled', '');
    expect(screen.getByRole('menuitemradio')).toHaveAttribute('data-disabled', '');
  });

  it('uses the aria-labelledby of the consumer over the id of its label', async () => {
    await render(
      <Menu.Root open>
        <Menu.RadioGroup aria-labelledby="heading">
          <Menu.GroupLabel id="label">Label</Menu.GroupLabel>
        </Menu.RadioGroup>
      </Menu.Root>,
    );

    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'heading');
  });
});
