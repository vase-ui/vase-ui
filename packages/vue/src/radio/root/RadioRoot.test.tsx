import { expect, onTestFinished, vi, describe, it } from 'vitest';
import { createSSRApp, defineComponent, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import RadioGroupHydration from '../../radio-group/RadioGroupHydration.test.vue';

describe('<Radio.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Radio.Root value="" />, () => ({
    refInstanceof: window.HTMLSpanElement,
    testRenderPropWith: 'span',
    button: true,
    render,
  }));

  describe('hidden input size', () => {
    it('grows from zero size to an on-screen 1px box when reported invalid', async () => {
      const { container } = await render(
        <RadioGroup required>
          <Radio.Root value="a" />
        </RadioGroup>,
      );
      const input = container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
      // An unnamed radio is never missing a value, so the case fails it as a field does.
      input.setCustomValidity('Invalid');
      expect(input.validity.valid).toBe(false);
      const rect = () => {
        const { top, width, height } = input.getBoundingClientRect();
        return { top, width, height };
      };
      expect(rect()).toEqual({ top: 0, width: 0, height: 0 });
      input.reportValidity();
      await flushMicrotasks();
      expect(rect()).toEqual({ top: 0, width: 1, height: 1 });
    });

    it('keeps the 1px size in the next render of the radio', async () => {
      const { container } = await render(
        <RadioGroup required>
          <Radio.Root value="a" data-testid="radio" />
        </RadioGroup>,
      );
      const input = container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
      input.setCustomValidity('Invalid');
      input.reportValidity();

      await fireEvent.click(screen.getByTestId('radio'));

      expect(screen.getByTestId('radio')).toHaveAttribute('aria-checked', 'true');
      const { width, height } = input.getBoundingClientRect();
      expect({ width, height }).toEqual({ width: 1, height: 1 });
    });
  });

  it('sets checked and unchecked data attributes', async () => {
    await render(
      <RadioGroup defaultValue="checked">
        <Radio.Root value="checked" data-testid="checked" />
        <Radio.Root value="unchecked" data-testid="unchecked" />
      </RadioGroup>,
    );

    expect(screen.getByTestId('checked')).toHaveAttribute('data-checked');
    expect(screen.getByTestId('checked')).not.toHaveAttribute('data-unchecked');
    expect(screen.getByTestId('unchecked')).toHaveAttribute('data-unchecked');
    expect(screen.getByTestId('unchecked')).not.toHaveAttribute('data-checked');
  });

  it('does not forward `value` prop', async () => {
    await render(
      <RadioGroup>
        <Radio.Root value="test" data-testid="radio-root" />
      </RadioGroup>,
    );

    expect(screen.getByTestId('radio-root')).not.toHaveAttribute('value');
  });

  it('allows `null` value', async () => {
    await render(
      <RadioGroup>
        <Radio.Root value={null} data-testid="radio-null" />
        <Radio.Root value="a" data-testid="radio-a" />
      </RadioGroup>,
    );

    const radioNull = screen.getByTestId('radio-null');
    const radioA = screen.getByTestId('radio-a');
    await fireEvent.click(radioNull);
    expect(radioNull).toHaveAttribute('aria-checked', 'true');
    await fireEvent.click(radioA);
    expect(radioNull).toHaveAttribute('aria-checked', 'false');
  });

  it('associates `id` with the native button when `nativeButton=true`', async () => {
    await render(
      <div>
        <label data-testid="label" for="myRadio">
          A
        </label>

        <RadioGroup defaultValue="b">
          <Radio.Root value="a" id="myRadio" nativeButton as="button" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>
      </div>,
    );

    const radioA = screen.getByTestId('a');
    expect(radioA).toHaveAttribute('id', 'myRadio');

    const hiddenInput = radioA.nextElementSibling as HTMLInputElement | null;
    expect(hiddenInput?.tagName).toBe('INPUT');
    expect(hiddenInput).not.toHaveAttribute('id', 'myRadio');

    expect(radioA).toHaveAttribute('aria-checked', 'false');
    await fireEvent.click(screen.getByTestId('label'));
    expect(radioA).toHaveAttribute('aria-checked', 'true');
  });

  it('sets `aria-labelledby` from a sibling label associated with the hidden input', async () => {
    await render(
      <div>
        <label for="radio-input">Label</label>
        <RadioGroup>
          <Radio.Root value="a" id="radio-input" />
        </RadioGroup>
      </div>,
    );

    const label = screen.getByText('Label');
    expect(label.id).not.toBe('');
    expect(screen.getByRole('radio')).toHaveAttribute('aria-labelledby', label.id);
  });

  it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
    const TestCase = defineComponent(() => {
      const id = shallowRef('radio-input-a');

      return () => (
        <>
          <label for="radio-input-a">Label A</label>
          <label for="radio-input-b">Label B</label>
          <RadioGroup>
            <Radio.Root value="a" id={id.value} />
          </RadioGroup>
          <button
            type="button"
            onClick={() => {
              id.value = 'radio-input-b';
            }}
          >
            Toggle
          </button>
        </>
      );
    });

    await render(<TestCase />);

    const radio = screen.getByRole('radio');
    const labelA = screen.getByText('Label A');

    expect(labelA.id).not.toBe('');
    expect(radio).toHaveAttribute('aria-labelledby', labelA.id);

    await fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    const labelB = screen.getByText('Label B');

    await waitFor(() => {
      expect(radio).toHaveAttribute('aria-labelledby', labelB.id);
    });
    expect(labelB.id).not.toBe('');
    expect(labelB.id).not.toBe(labelA.id);
  });

  it('prefers `aria-label` over an associated label', async () => {
    await render(
      <RadioGroup>
        <label>
          <Radio.Root value="a" aria-label="Apple" />
          Apple
        </label>
      </RadioGroup>,
    );

    const radio = screen.getByRole('radio');
    expect(radio).not.toHaveAttribute('aria-labelledby');
    expect(radio).toHaveAccessibleName('Apple');
  });

  describe('prop: onClick', () => {
    it.each([false, true])(
      'propagates a single click event to ancestors per user click (nativeButton=%s)',
      async (nativeButton) => {
        const handleParentClick = vi.fn();
        await render(
          <RadioGroup>
            <div onClick={handleParentClick}>
              <Radio.Root
                value="a"
                nativeButton={nativeButton}
                as={nativeButton ? 'button' : undefined}
                data-testid="radio"
              />
            </div>
          </RadioGroup>,
        );

        await fireEvent.click(screen.getByTestId('radio'));

        expect(handleParentClick).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('radio')).toHaveAttribute('aria-checked', 'true');
      },
    );

    it.each([false, true])(
      'does not propagate to ancestors when stopPropagation() is called (nativeButton=%s)',
      async (nativeButton) => {
        const handleParentClick = vi.fn();
        await render(
          <RadioGroup>
            <div onClick={handleParentClick}>
              <Radio.Root
                value="a"
                nativeButton={nativeButton}
                as={nativeButton ? 'button' : undefined}
                data-testid="radio"
                onClick={(event: MouseEvent) => event.stopPropagation()}
              />
            </div>
          </RadioGroup>,
        );

        await fireEvent.click(screen.getByTestId('radio'));

        expect(handleParentClick).toHaveBeenCalledTimes(0);
        expect(screen.getByTestId('radio')).toHaveAttribute('aria-checked', 'true');
      },
    );

    it('does not propagate a click to ancestors when selecting with arrow keys', async () => {
      const handleParentClick = vi.fn();
      const { user } = await render(
        <div onClick={handleParentClick}>
          <RadioGroup defaultValue="a">
            <Radio.Root value="a" data-testid="radio-a" />
            <Radio.Root value="b" data-testid="radio-b" />
          </RadioGroup>
        </div>,
      );

      await user.click(screen.getByTestId('radio-a'));
      handleParentClick.mockClear();

      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('radio-b')).toHaveAttribute('aria-checked', 'true');
      expect(handleParentClick).toHaveBeenCalledTimes(0);
    });
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', async () => {
      await render(
        <RadioGroup>
          <Radio.Root value="a" disabled data-testid="radio" />
        </RadioGroup>,
      );

      const radio = screen.getByTestId('radio');
      expect(radio).not.toHaveAttribute('disabled');
      expect(radio).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not acquire the field focused state when focused programmatically', async () => {
      await render(
        <Field.Root data-testid="field">
          <Radio.Root value="a" disabled data-testid="radio" />
        </Field.Root>,
      );

      const radio = screen.getByTestId('radio');

      radio.focus();
      await flushMicrotasks();

      expect(radio).toHaveFocus();
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
    });

    it('keeps the tab stop on a checked radio that is disabled', async () => {
      await render(
        <RadioGroup defaultValue="a">
          <Radio.Root value="a" disabled data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>,
      );

      expect(screen.getByTestId('a')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('b')).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('prop: readOnly', () => {
    it('acquires the field focused state on focus', async () => {
      await render(
        <Field.Root data-testid="field">
          <Radio.Root value="a" readOnly data-testid="radio" />
        </Field.Root>,
      );

      screen.getByTestId('radio').focus();
      await flushMicrotasks();

      expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
    });
  });

  describe('the hidden input has the state of the radio', () => {
    function getInputs() {
      return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    }

    it.each([
      { name: 'a click on the radio', act: () => screen.getByTestId('radio').click() },
      { name: 'a click on the input', act: () => getInputs()[0].click() },
      { name: 'a click on a label around it', act: () => screen.getByTestId('label').click() },
    ])('after $name that a listener cancels', async ({ act }) => {
      await render(
        <RadioGroup
          onValueChange={(_value: string, details: RadioGroup.ChangeEventDetails) =>
            details.cancel()
          }
        >
          <label data-testid="label">
            <Radio.Root value="a" data-testid="radio" />
          </label>
        </RadioGroup>,
      );

      act();
      await flushMicrotasks();

      expect(getInputs()[0].checked).toBe(false);
      expect(screen.getByTestId('radio')).toHaveAttribute('aria-checked', 'false');
    });

    it.each([
      { name: 'a group with a name', groupName: 'fruit' },
      { name: 'a group with no name', groupName: undefined },
    ])('after a click that the parent of $name does not accept', async ({ groupName }) => {
      const handleUpdate = vi.fn();
      await render(
        <RadioGroup value="a" name={groupName} {...{ 'onUpdate:value': handleUpdate }}>
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>,
      );

      await fireEvent.click(screen.getByTestId('b'));

      expect(handleUpdate.mock.calls).toEqual([['b']]);
      expect(getInputs().map((input) => input.checked)).toEqual([true, false]);
    });

    it('after the hydration of HTML whose inputs changed before', async () => {
      const props = { defaultValue: 'b' };
      const serverHtml = await renderOnServer(
        'src/radio-group/RadioGroupHydration.test.vue',
        props,
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const inputs = getInputs();
      expect(inputs.map((input) => input.checked)).toEqual([false, true, false]);
      // A browser that restores the form state of the page.
      inputs[0].checked = true;
      inputs[1].checked = false;

      const app = createSSRApp(RadioGroupHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);
      await flushMicrotasks();

      expect(getInputs()).toEqual(inputs);
      expect(inputs.map((input) => input.checked)).toEqual([false, true, false]);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('after a `pageshow` event, because a browser can restore the form state after the mount', async () => {
      const handleChange = vi.fn();
      await render(
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="radio" />
        </RadioGroup>,
      );
      getInputs()[0].checked = true;

      window.dispatchEvent(new PageTransitionEvent('pageshow'));

      expect(getInputs()[0].checked).toBe(false);

      await fireEvent.click(screen.getByTestId('radio'));

      expect(handleChange.mock.calls.map(([value]) => value)).toEqual(['a']);
    });

    it.each([
      { name: 'is not checked', value: 'a', checked: false },
      { name: 'is checked', value: '', checked: true },
    ])('after a click on a radio with no group that $name', async ({ value, checked }) => {
      await render(<Radio.Root value={value} data-testid="radio" />);

      await fireEvent.click(screen.getByTestId('radio'));
      getInputs()[0].click();
      await flushMicrotasks();

      expect(getInputs()[0].checked).toBe(checked);
    });

    it('after a click on the label of a read-only radio', async () => {
      await render(
        <RadioGroup>
          <label data-testid="label">
            <Radio.Root value="a" readOnly />
          </label>
        </RadioGroup>,
      );

      screen.getByTestId('label').click();
      await flushMicrotasks();

      expect(getInputs()[0].checked).toBe(false);
    });
  });

  describe('in a native label', () => {
    it('emits `valueChange` one time for a click on the radio, also when the parent keeps its value', async () => {
      const handleChange = vi.fn();
      await render(
        <RadioGroup value="a" onValueChange={handleChange}>
          <label>
            <Radio.Root value="b" data-testid="radio" />B
          </label>
        </RadioGroup>,
      );

      await fireEvent.click(screen.getByTestId('radio'));

      expect(handleChange).toHaveBeenCalledTimes(1);
    });
  });

  it('does not emit `valueChange` for a click on the checked radio', async () => {
    const handleChange = vi.fn();
    await render(
      <RadioGroup defaultValue="a" onValueChange={handleChange}>
        <Radio.Root value="a" data-testid="radio" />
      </RadioGroup>,
    );

    await fireEvent.click(screen.getByTestId('radio'));
    document.querySelector<HTMLInputElement>('input[type="radio"]')!.click();
    await flushMicrotasks();

    expect(handleChange).not.toHaveBeenCalled();
  });
});
