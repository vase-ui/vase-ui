import { describe, expect, it, vi } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import { createRenderer, fireEvent, screen } from '#test-utils';
import { recordInputWrites } from '../../test/recordInputWrites';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { Switch } from '@vase-ui/vue/switch';

describe('useCheckedInput', () => {
  const { render } = createRenderer();

  it.each(['checkbox', 'radio', 'switch'] as const)(
    'forwards focus and one modified click, then submits the accepted %s value',
    async (kind) => {
      const selected = shallowRef(false);
      let accepts = false;
      const ancestorClick = vi.fn();
      const change = vi.fn(
        (_value: unknown, details: { event: Event }) => details.event as MouseEvent,
      );
      const update = () => {
        if (accepts) selected.value = true;
      };
      const Root = kind === 'switch' ? Switch.Root : Checkbox.Root;
      const { container } = await render(() => (
        <div onClick={ancestorClick}>
          <form id="choices" />
          {kind === 'radio' ? (
            <RadioGroup
              form="choices"
              name="choice"
              modelValue={selected.value ? 'b' : 'a'}
              onValueChange={change}
              onUpdate:modelValue={update}
            >
              <Radio.Root value="a" />
              <Radio.Root value="b" data-testid="control" />
            </RadioGroup>
          ) : (
            <Root
              form="choices"
              name="choice"
              value="b"
              uncheckedValue="a"
              modelValue={selected.value}
              onCheckedChange={change}
              onUpdate:modelValue={update}
              data-testid="control"
            />
          )}
        </div>
      ));
      const control = screen.getByTestId('control');
      const input = container.querySelector<HTMLInputElement>('input[value="b"]')!;
      const form = container.querySelector('form')!;
      input.focus();
      expect(control).toHaveFocus();

      for (const accepted of [false, false, true]) {
        accepts = accepted;
        await fireEvent.click(control, {
          altKey: true,
          ctrlKey: true,
          metaKey: true,
          shiftKey: true,
        });
        const event = change.mock.results.at(-1)?.value;
        expect(event).toMatchObject({ altKey: true, ctrlKey: true, metaKey: true, shiftKey: true });
        expect(event?.target).toBe(input);
        expect(input.checked).toBe(accepted);
        expect(control).toHaveAttribute('aria-checked', String(accepted));
        expect(new FormData(form).getAll('choice')).toEqual([accepted ? 'b' : 'a']);
      }
      expect(change).toHaveBeenCalledTimes(3);
      expect(ancestorClick.mock.calls.map(([event]) => event.target)).toEqual([
        control,
        control,
        control,
      ]);
    },
  );

  it('restores only the checked properties changed by a click', async () => {
    const { container } = await render(<Checkbox.Root modelValue={false} indeterminate />);
    const input = container.querySelector('input')!;
    const checked = recordInputWrites(input, 'checked');
    const mixed = recordInputWrites(input, 'indeterminate');

    input.click();
    await nextTick();
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await nextTick();

    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(true);
    expect(checked).toEqual([false]);
    expect(mixed).toEqual([true]);
  });
});
