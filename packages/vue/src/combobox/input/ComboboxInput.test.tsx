import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
} from '#test-utils';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import * as Combobox from '../index.parts';

describe('<Combobox.Input />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Input />, () => ({
    refInstanceof: window.HTMLInputElement,
    render(node) {
      return render(<Combobox.Root>{node}</Combobox.Root>);
    },
  }));

  describe('prop: disabled', () => {
    it('should render aria-disabled attribute when disabled', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Input disabled data-testid="input" />
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('disabled');
    });

    it('should inherit disabled state from ComboboxRoot', async () => {
      await render(
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('disabled');
    });

    it('should inherit disabled state from Field.Root', async () => {
      await render(
        <Field.Root disabled>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('disabled');
    });

    it('should prioritize local disabled over root disabled', async () => {
      await render(
        <Combobox.Root disabled={false}>
          <Combobox.Input disabled data-testid="input" />
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('disabled');
    });
  });

  describe('prop: readOnly', () => {
    it('should render aria-readonly and readonly attributes when readOnly', async () => {
      await render(
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-readonly', 'true');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('prop: required', () => {
    it('sets aria-required attribute when required', async () => {
      await render(
        <Combobox.Root required>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('interaction behavior', () => {
    it('pressing Home moves caret to start', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      input.focus();
      await user.type(input, 'banana');
      expect(input.value).toBe('banana');

      await user.keyboard('{Home}');

      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(0);
    });

    it('pressing End moves caret to end', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      input.focus();
      await user.type(input, 'apple');
      expect(input.value).toBe('apple');

      await user.keyboard('{End}');

      expect(input.selectionStart).toBe(input.value.length);
      expect(input.selectionEnd).toBe(input.value.length);
    });

    it.skipIf(isJSDOM)(
      'scrolls to the start and end when pressing Home/End on overflowing input',
      async () => {
        const { user } = await render(
          <Combobox.Root>
            <Combobox.Input style={{ width: '64px', fontSize: '20px' }} />
          </Combobox.Root>,
        );

        const input = screen.getByRole<HTMLInputElement>('combobox');
        input.focus();

        await user.type(input, 'this is a very long combobox value');

        expect(input.scrollWidth).toBeGreaterThan(input.clientWidth);

        const expectedScroll = input.scrollWidth - input.clientWidth;

        expect(expectedScroll).toBeGreaterThan(0);

        input.scrollLeft = expectedScroll;
        input.setSelectionRange(input.value.length, input.value.length);

        await user.keyboard('{Home}');
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe(0);
        expect(input.scrollLeft).toBe(0);

        await user.keyboard('{End}');
        expect(input.selectionStart).toBe(input.value.length);
        expect(input.selectionEnd).toBe(input.value.length);
        expect(Math.abs(input.scrollLeft - expectedScroll)).toBeLessThanOrEqual(2);
      },
    );

    it('preserves caret position when controlled and inserting in the middle', async () => {
      const Controlled = defineComponent(() => {
        const value = shallowRef('');
        return () => (
          <Combobox.Root
            inputValue={value.value}
            onInputValueChange={(next: string) => {
              value.value = next;
            }}
          >
            <Combobox.Input />
          </Combobox.Root>
        );
      });

      const { user } = await render(<Controlled />);

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'abcd');
      expect(input.value).toBe('abcd');

      // Move caret left twice to position after "ab"
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);

      await user.keyboard('xxx');
      expect(input.value).toBe('abxxxcd');
      expect(input.selectionStart).toBe(5);
      expect(input.selectionEnd).toBe(5);

      await user.keyboard('y');
      expect(input.value).toBe('abxxxycd');
      expect(input.selectionStart).toBe(6);
      expect(input.selectionEnd).toBe(6);
    });

    it('clears a closed multiple value on Escape and stops propagation', async () => {
      const onValueChange = vi.fn();
      const onOuterKeyDown = vi.fn();
      const { user } = await render(
        <div onKeydown={onOuterKeyDown}>
          <Combobox.Root multiple defaultValue={['apple']} onValueChange={onValueChange}>
            <Combobox.Input />
          </Combobox.Root>
        </div>,
      );

      screen.getByRole('combobox').focus();
      await user.keyboard('{Escape}');

      expect(onValueChange).toHaveBeenCalledWith([], expect.anything());
      expect(onOuterKeyDown).not.toHaveBeenCalled();
    });

    it('lets Escape propagate when a closed multiple value is already empty', async () => {
      const onOuterKeyDown = vi.fn();
      const { user } = await render(
        <div onKeydown={onOuterKeyDown}>
          <Combobox.Root multiple defaultValue={[]}>
            <Combobox.Input />
          </Combobox.Root>
        </div>,
      );

      screen.getByRole('combobox').focus();
      await user.keyboard('{Escape}');

      expect(onOuterKeyDown).toHaveBeenCalled();
    });

    it('lets Escape propagate from a closed inline combobox', async () => {
      const onOuterKeyDown = vi.fn();
      const { user } = await render(
        <div onKeydown={onOuterKeyDown}>
          <Combobox.Root inline defaultValue="apple">
            <Combobox.Input />
          </Combobox.Root>
        </div>,
      );

      screen.getByRole('combobox').focus();
      await user.keyboard('{Escape}');

      expect(onOuterKeyDown).toHaveBeenCalled();
    });
  });

  describe('Vue form of the input', () => {
    const cities = ['Malmö', 'Malta', 'Oslo'];

    function getInput() {
      return screen.getByRole<HTMLInputElement>('combobox');
    }

    async function type(text: string, inputType: string | undefined = 'insertText') {
      await fireEvent.input(getInput(), { target: { value: text }, inputType });
      await flushMicrotasks();
    }

    it('keeps the composed text when the input renders during a composition', async () => {
      const handleInputValueChange = vi.fn();
      const handleOpenChange = vi.fn();
      await render(
        <Combobox.Root
          items={cities}
          onInputValueChange={handleInputValueChange}
          onOpenChange={handleOpenChange}
        >
          <Combobox.Input />
          <ComboboxListPart />
        </Combobox.Root>,
      );

      await fireEvent.compositionStart(getInput());
      // The composed text opens the popup, and the input renders for the new open state.
      await type('ma', undefined);

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      expect(getInput()).toHaveAttribute('aria-expanded', 'true');
      expect(getInput().value).toBe('ma');
      expect(handleInputValueChange).toHaveBeenCalledTimes(0);
    });

    it('gives the text at compositionend', async () => {
      const handleInputValueChange = vi.fn();
      await render(
        <Combobox.Root items={cities} onInputValueChange={handleInputValueChange}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      await fireEvent.compositionStart(getInput());
      await type('ma', undefined);
      await fireEvent.compositionEnd(getInput());
      // WebKit sends the last `input` event of a composition after `compositionend`.
      await type('ma', undefined);

      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('ma');
      expect(handleInputValueChange.mock.lastCall?.[1].reason).toBe('input-change');
      expect(handleInputValueChange.mock.lastCall?.[1].event.type).toBe('compositionend');
    });

    it('shows a new input value of the root during a composition', async () => {
      const value = shallowRef<string | null>(null);
      await render(() => (
        <Combobox.Root items={cities} value={value.value}>
          <Combobox.Input />
        </Combobox.Root>
      ));

      await fireEvent.compositionStart(getInput());
      await type('ma', undefined);
      value.value = 'Malta';
      await flushMicrotasks();

      expect(getInput().value).toBe('Malta');
    });

    it('handles a change event only for a new value', async () => {
      const handleInputValueChange = vi.fn();
      await render(
        <Combobox.Root items={cities} onInputValueChange={handleInputValueChange}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      await type('ma');
      await fireEvent.change(getInput());

      expect(handleInputValueChange).toHaveBeenCalledTimes(1);

      getInput().value = 'mal';
      await fireEvent.change(getInput());

      expect(handleInputValueChange).toHaveBeenCalledTimes(2);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('mal');
    });

    it('writes the state back when the consumer keeps the input value', async () => {
      await render(
        <Combobox.Root items={cities} inputValue="Oslo">
          <Combobox.Input />
        </Combobox.Root>,
      );

      await type('Osl');

      expect(getInput().value).toBe('Oslo');
    });

    it('clears the single value when the text is empty', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Combobox.Root items={cities} defaultValue="Oslo" onValueChange={handleValueChange}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      await type('');

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toBe(null);
      expect(handleValueChange.mock.lastCall?.[1].reason).toBe('input-clear');
    });

    it('closes for an empty text when a press on the input does not open', async () => {
      const handleOpenChange = vi.fn();
      await render(
        <Combobox.Root items={cities} openOnInputClick={false} onOpenChange={handleOpenChange}>
          <Combobox.Input />
          <ComboboxListPart />
        </Combobox.Root>,
      );

      await type('ma');
      expect(getInput()).toHaveAttribute('aria-expanded', 'true');

      await type('');

      expect(getInput()).toHaveAttribute('aria-expanded', 'false');
      expect(handleOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(handleOpenChange.mock.lastCall?.[1].reason).toBe('input-clear');
    });

    it('the dismiss button closes with the reason close-press', async () => {
      const handleOpenChange = vi.fn();
      await render(
        <Combobox.Root items={cities} onOpenChange={handleOpenChange}>
          <Combobox.Input />
          <ComboboxListPart />
        </Combobox.Root>,
      );

      expect(screen.queryByRole('button', { name: 'Dismiss' })).toBe(null);

      await type('ma');
      const dismiss = screen.getByRole('button', { name: 'Dismiss' });
      expect(dismiss.nextElementSibling).toBe(getInput());

      await fireEvent.click(dismiss);

      expect(getInput()).toHaveAttribute('aria-expanded', 'false');
      expect(handleOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(handleOpenChange.mock.lastCall?.[1].reason).toBe('close-press');
    });
  });
});
