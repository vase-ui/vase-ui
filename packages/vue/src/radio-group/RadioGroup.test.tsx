import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef, watch } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
import { Field } from '@vase-ui/vue/field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import {
  createFormDataSpy,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
} from '#test-utils';
import RadioGroupFieldHydration from './RadioGroupFieldHydration.test.vue';
import RadioGroupHydration from './RadioGroupHydration.test.vue';

const HYDRATION_FIXTURE = 'src/radio-group/RadioGroupHydration.test.vue';
const FIELD_HYDRATION_FIXTURE = 'src/radio-group/RadioGroupFieldHydration.test.vue';

type RadioGroupInstance = { inputElement: HTMLInputElement | null };

function getInputs() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
}

function readTabindexes(root: ParentNode) {
  return ['a', 'b', 'c'].map(
    (testId) => root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('tabindex') ?? null,
  );
}

function readFilled(root: ParentNode) {
  return ['label', 'description'].map((testId) =>
    root.querySelector(`[data-testid="${testId}"]`)?.hasAttribute('data-filled'),
  );
}

// A `<template>` element parses the HTML with no side effect.
function parse(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

describe('<RadioGroup />', () => {
  const { render } = createRenderer();

  describeConformance(<RadioGroup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  describe('extra props', () => {
    it('can override the built-in attributes', async () => {
      const { container } = await render(<RadioGroup role="switch" />);
      expect(container.firstElementChild as HTMLElement).toHaveAttribute('role', 'switch');
    });
  });

  describe('prop: id', () => {
    it('is forwarded to the root element', async () => {
      await render(<RadioGroup id="group-id" />);

      expect(screen.getByRole('radiogroup')).toHaveAttribute('id', 'group-id');
    });
  });

  describe('prop: onValueChange', () => {
    it('should call onValueChange when an item is clicked', async () => {
      const handleChange = vi.fn();
      await render(
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="item" />
        </RadioGroup>,
      );

      const item = screen.getByTestId('item');

      await fireEvent.click(item);

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe('a');
    });

    it('should report keyboard modifier event properties when calling onCheckedChange', async () => {
      const handleChange = vi.fn((_value, eventDetails) => eventDetails);

      const { user } = await render(
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="item" />
        </RadioGroup>,
      );

      const item = screen.getByTestId('item');

      await user.keyboard('{Shift>}');
      await user.click(item);
      await user.keyboard('{/Shift}');

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.results[0]?.value.event.shiftKey).toBe(true);
    });

    it('should select an item with Space on keyup', async () => {
      const handleChange = vi.fn();
      const { user } = await render(
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="item" />
        </RadioGroup>,
      );

      const item = screen.getByTestId('item');

      item.focus();
      await flushMicrotasks();

      await user.keyboard('[Space>]');

      expect(handleChange).not.toHaveBeenCalled();

      await user.keyboard('[/Space]');

      expect(handleChange).toHaveBeenCalledOnce();
      expect(handleChange).toHaveBeenLastCalledWith('a', expect.anything());
    });

    it('should not select an item with Enter', async () => {
      const handleChange = vi.fn();
      const { user } = await render(
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="item" />
        </RadioGroup>,
      );

      const item = screen.getByTestId('item');

      item.focus();
      await flushMicrotasks();

      await user.keyboard('[Enter]');

      expect(handleChange).not.toHaveBeenCalled();
      expect(item).toHaveAttribute('aria-checked', 'false');
    });

    it('does not change state when canceled via a root click', async () => {
      const { user } = await render(
        <Field.Root>
          <RadioGroup onValueChange={(_, eventDetails) => eventDetails.cancel()}>
            <Radio.Root value="a" data-testid="item" />
          </RadioGroup>
        </Field.Root>,
      );

      const group = screen.getByRole('radiogroup');
      const item = screen.getByTestId('item');
      const input = document.querySelector<HTMLInputElement>('input[type="radio"]');

      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(input?.checked).toBe(false);
      expect(group).not.toHaveAttribute('data-touched');
      expect(group).not.toHaveAttribute('data-dirty');
      expect(group).not.toHaveAttribute('data-filled');
    });

    it('does not change state when canceled via a hidden input click', async () => {
      const { user } = await render(
        <Field.Root>
          <RadioGroup onValueChange={(_, eventDetails) => eventDetails.cancel()}>
            <Radio.Root value="a" data-testid="item" />
          </RadioGroup>
        </Field.Root>,
      );

      const group = screen.getByRole('radiogroup');
      const item = screen.getByTestId('item');
      const input = document.querySelector<HTMLInputElement>('input[type="radio"]');

      expect(input).not.toBe(null);
      if (!input) {
        return;
      }

      await user.click(input);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
      expect(group).not.toHaveAttribute('data-touched');
      expect(group).not.toHaveAttribute('data-dirty');
      expect(group).not.toHaveAttribute('data-filled');
    });

    it('does not change state when canceled via arrow key navigation', async () => {
      const { user } = await render(
        <Field.Root>
          <RadioGroup onValueChange={(_, eventDetails) => eventDetails.cancel()}>
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
          </RadioGroup>
        </Field.Root>,
      );

      const group = screen.getByRole('radiogroup');
      const a = screen.getByTestId('a');
      const b = screen.getByTestId('b');
      const inputs = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');

      a.focus();
      await flushMicrotasks();

      await user.keyboard('{ArrowDown}');

      expect(b).toHaveFocus();
      expect(a).toHaveAttribute('aria-checked', 'false');
      expect(b).toHaveAttribute('aria-checked', 'false');
      expect(inputs[0]?.checked).toBe(false);
      expect(inputs[1]?.checked).toBe(false);
      expect(group).not.toHaveAttribute('data-touched');
      expect(group).not.toHaveAttribute('data-dirty');
      expect(group).not.toHaveAttribute('data-filled');
    });
  });

  describe('prop: disabled', () => {
    it('should have the `aria-disabled` attribute', async () => {
      await render(
        <RadioGroup disabled>
          <Radio.Root value="a" />
        </RadioGroup>,
      );
      expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('radio')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('radio')).toHaveAttribute('data-disabled');
      const input = document.querySelector('input[type="radio"]');
      expect(input).toHaveAttribute('disabled');
    });

    it('should not have the aria attribute when `disabled` is not set', async () => {
      await render(<RadioGroup />);
      expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-disabled');
    });

    it('should not change its state when clicked', async () => {
      await render(
        <RadioGroup disabled>
          <Radio.Root value="" data-testid="item" />
        </RadioGroup>,
      );

      const item = screen.getByTestId('item');

      expect(item).toHaveAttribute('aria-checked', 'false');

      await fireEvent.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
    });

    it('is not a tab stop when the whole group is disabled', async () => {
      const { user } = await render(
        <div>
          <button type="button">Before</button>
          <RadioGroup disabled>
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
          </RadioGroup>
          <button type="button">After</button>
        </div>,
      );

      expect(screen.getByTestId('a')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('b')).toHaveAttribute('tabindex', '-1');

      await user.tab();
      expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('lets a tabIndex prop override the disabled group tab index', async () => {
      await render(
        <RadioGroup disabled>
          <Radio.Root value="a" tabindex={0} data-testid="a" />
        </RadioGroup>,
      );

      expect(screen.getByTestId('a')).toHaveAttribute('tabindex', '0');
    });
  });

  describe('prop: readOnly', () => {
    it('should have the `aria-readonly` attribute', async () => {
      await render(<RadioGroup readOnly />);
      const group = screen.getByRole('radiogroup');
      expect(group).toHaveAttribute('aria-readonly', 'true');
    });

    it('should not have the aria attribute when `readOnly` is not set', async () => {
      await render(<RadioGroup />);
      const group = screen.getByRole('radiogroup');
      expect(group).not.toHaveAttribute('aria-readonly');
    });

    it('should not change its state when clicked', async () => {
      await render(
        <RadioGroup readOnly>
          <Radio.Root value="" data-testid="item" />
        </RadioGroup>,
      );

      const item = screen.getByTestId('item');

      expect(item).toHaveAttribute('aria-checked', 'false');

      await fireEvent.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('should update its state if the underlying input is toggled', async () => {
    await render(
      <RadioGroup data-testid="root">
        <Radio.Root value="" data-testid="item" />
      </RadioGroup>,
    );

    const group = screen.getByTestId('root');
    const item = screen.getByTestId('item');

    const input = group.querySelector<HTMLInputElement>('input')!;

    await fireEvent.click(input);

    expect(item).toHaveAttribute('aria-checked', 'true');
  });

  it('should set the name attribute on each radio input', async () => {
    await render(
      <RadioGroup name="radio-group">
        <Radio.Root value="a" data-testid="radio" />
      </RadioGroup>,
    );
    const radio = screen.getByTestId('radio');
    const input = radio.nextElementSibling as HTMLInputElement;

    expect(input).toHaveAttribute('name', 'radio-group');
    expect(input).toHaveAttribute('value', 'a');
  });

  it('points inputRef to the checked radio input when present', async () => {
    const group = shallowRef<RadioGroupInstance | null>(null);

    await render(() => (
      <RadioGroup ref={group} defaultValue="a">
        <Radio.Root value="a" data-testid="radio-a" />
        <Radio.Root value="b" data-testid="radio-b" />
      </RadioGroup>
    ));

    const radioA = screen.getByTestId('radio-a');
    const radioB = screen.getByTestId('radio-b');
    const inputA = radioA.nextElementSibling as HTMLInputElement;
    const inputB = radioB.nextElementSibling as HTMLInputElement;

    expect(group.value?.inputElement).toBe(inputA);

    await fireEvent.click(radioB);

    expect(group.value?.inputElement).toBe(inputB);
  });

  it('detaches inputRef when an initially disabled radio is enabled and then unmounted', async () => {
    const group = shallowRef<RadioGroupInstance | null>(null);
    const { rerender } = await render(() => (
      <RadioGroup ref={group}>
        <Radio.Root value="a" disabled />
      </RadioGroup>
    ));
    expect(group.value?.inputElement).toBe(null);

    await rerender(() => (
      <RadioGroup ref={group}>
        <Radio.Root value="a" />
      </RadioGroup>
    ));
    expect(group.value?.inputElement).toHaveAttribute('value', 'a');

    await rerender(() => <RadioGroup ref={group} />);
    expect(group.value?.inputElement).toBe(null);
  });

  it('skips disabled radios when assigning inputRef', async () => {
    const group = shallowRef<RadioGroupInstance | null>(null);

    await render(() => (
      <RadioGroup ref={group}>
        <Radio.Root value="a" disabled data-testid="radio-a" />
        <Radio.Root value="b" data-testid="radio-b" />
      </RadioGroup>
    ));

    const inputB = (screen.getByTestId('radio-b').nextElementSibling ??
      null) as HTMLInputElement | null;

    expect(group.value?.inputElement).toBe(inputB);
  });

  it('points inputRef to the first radio input when nativeButton wraps a button', async () => {
    const group = shallowRef<RadioGroupInstance | null>(null);

    await render(() => (
      <RadioGroup ref={group}>
        <Radio.Root
          nativeButton
          value="a"
          v-slots={{
            render: ({ props }: { props: Record<string, any> }) => (
              <label>
                <button {...props} data-testid="radio-a" />
                <span>Label A</span>
              </label>
            ),
          }}
        />
        <Radio.Root
          nativeButton
          value="b"
          v-slots={{
            render: ({ props }: { props: Record<string, any> }) => (
              <label>
                <button {...props} data-testid="radio-b" />
                <span>Label B</span>
              </label>
            ),
          }}
        />
      </RadioGroup>
    ));

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(inputs.length).toBe(2);
    expect(group.value?.inputElement).toBe(inputs[0]);
  });

  it('keeps inputRef pointing to the first radio when the value is cleared', async () => {
    const group = shallowRef<RadioGroupInstance | null>(null);

    const App = defineComponent(() => {
      const value = shallowRef<null | string>('a');

      return () => (
        <>
          <RadioGroup ref={group} value={value.value}>
            <Radio.Root value="a" data-testid="radio-a" />
            <Radio.Root value="b" data-testid="radio-b" />
          </RadioGroup>
          <button
            type="button"
            onClick={() => {
              value.value = null;
            }}
          >
            Clear
          </button>
        </>
      );
    });

    await render(<App />);

    const radioA = screen.getByTestId('radio-a');
    const inputA = radioA.nextElementSibling as HTMLInputElement;

    expect(group.value?.inputElement).toBe(inputA);

    await fireEvent.click(screen.getByText('Clear'));

    expect(group.value?.inputElement).toBe(inputA);
  });

  it('detaches inputRef when its current radio unmounts', async () => {
    const group = shallowRef<RadioGroupInstance | null>(null);

    const App = defineComponent(() => {
      const showFirst = shallowRef(true);

      return () => (
        <>
          <RadioGroup ref={group}>
            {showFirst.value && <Radio.Root value="a" data-testid="radio-a" />}
            <Radio.Root value="b" data-testid="radio-b" />
          </RadioGroup>
          <button
            type="button"
            onClick={() => {
              showFirst.value = false;
            }}
          >
            Remove first
          </button>
        </>
      );
    });

    await render(<App />);

    const inputA = screen.getByTestId('radio-a').nextElementSibling as HTMLInputElement;

    expect(group.value?.inputElement).toBe(inputA);

    await fireEvent.click(screen.getByText('Remove first'));

    expect(group.value?.inputElement).toBe(null);
  });

  it('detaches inputRef when a radio selected after mount unmounts', async () => {
    const group = shallowRef<RadioGroupInstance | null>(null);

    const App = defineComponent(() => {
      const showSecond = shallowRef(true);

      return () => (
        <>
          <RadioGroup ref={group}>
            <Radio.Root value="a" data-testid="radio-a" />
            {showSecond.value && <Radio.Root value="b" data-testid="radio-b" />}
          </RadioGroup>
          <button
            type="button"
            onClick={() => {
              showSecond.value = false;
            }}
          >
            Remove second
          </button>
        </>
      );
    });

    await render(<App />);

    const inputA = screen.getByTestId('radio-a').nextElementSibling as HTMLInputElement;
    const inputB = screen.getByTestId('radio-b').nextElementSibling as HTMLInputElement;

    expect(group.value?.inputElement).toBe(inputA);

    await fireEvent.click(screen.getByTestId('radio-b'));
    expect(group.value?.inputElement).toBe(inputB);

    await fireEvent.click(screen.getByText('Remove second'));
    expect(group.value?.inputElement).toBe(null);
  });

  it.skipIf(isJSDOM)(
    'should return null when no radio is selected (matching native behavior)',
    async () => {
      const submitSpy = createFormDataSpy('test-group');
      await render(
        <form onSubmit={submitSpy}>
          <RadioGroup name="test-group">
            <Radio.Root value="option-a" />
            <Radio.Root value="option-b" />
          </RadioGroup>
          <button type="submit">Submit</button>
        </form>,
      );

      const submitButton = screen.getByRole('button');
      submitButton.click();

      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe(null);
    },
  );

  it.skipIf(isJSDOM)('should return null in form data when no radio is selected', async () => {
    await render(
      <form data-testid="form">
        <RadioGroup name="group">
          <Radio.Root value="a" />
          <Radio.Root value="b" />
          <Radio.Root value="c" />
        </RadioGroup>
      </form>,
    );

    const form = screen.getByTestId('form') as HTMLFormElement;
    const formData = new FormData(form);
    expect(formData.get('group')).toBe(null);
  });

  it.skipIf(isJSDOM)('should include selected radio value in form data', async () => {
    await render(
      <form data-testid="form">
        <RadioGroup name="group">
          <Radio.Root value="a" data-testid="radio-a" />
          <Radio.Root value="b" />
          <Radio.Root value="c" />
        </RadioGroup>
      </form>,
    );

    const radio = screen.getByTestId('radio-a');
    const form = screen.getByTestId('form') as HTMLFormElement;

    radio.click();
    await flushMicrotasks();

    const formData = new FormData(form);
    expect(formData.get('group')).toBe('a');
  });

  it('should automatically select radio upon navigation', async () => {
    const { user } = await render(
      <Field.Root>
        <RadioGroup>
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>
      </Field.Root>,
    );

    const group = screen.getByRole('radiogroup');
    const a = screen.getByTestId('a');
    const b = screen.getByTestId('b');

    a.focus();
    await flushMicrotasks();

    expect(group).not.toHaveAttribute('data-touched');
    expect(a).toHaveAttribute('aria-checked', 'false');

    await user.keyboard('{ArrowDown}');

    expect(a).toHaveAttribute('aria-checked', 'false');

    expect(b).toHaveFocus();
    expect(b).toHaveAttribute('aria-checked', 'true');
    expect(group).toHaveAttribute('data-touched', '');
  });

  describe('should manage arrow key navigation', () => {
    it.each(['metaKey', 'ctrlKey', 'altKey', 'single'])(
      'does not select on refocus after an ignored arrow (%s)',
      async (scenario) => {
        const onValueChange = vi.fn();

        const { user } = await render(
          <>
            <RadioGroup onValueChange={onValueChange}>
              <Radio.Root value="a" aria-label="A" />
              <Radio.Root value="b" aria-label="B" disabled={scenario === 'single'} />
            </RadioGroup>
            <button>Outside</button>
          </>,
        );

        const radio = screen.getByRole('radio', { name: 'A' });

        radio.focus();
        await flushMicrotasks();

        await fireEvent.keyDown(radio, {
          key: 'ArrowDown',
          ...(scenario === 'single' ? {} : { [scenario]: true }),
        });

        expect(radio).toHaveFocus();
        expect(radio).toHaveAttribute('aria-checked', 'false');

        await user.tab();

        expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();

        await user.tab({ shift: true });

        expect(radio).toHaveFocus();
        expect(radio).toHaveAttribute('aria-checked', 'false');
        expect(onValueChange).not.toHaveBeenCalled();
      },
    );

    describe.each([
      { direction: 'ltr', horizontalNextKey: 'ArrowRight', horizontalPrevKey: 'ArrowLeft' },
      { direction: 'rtl', horizontalNextKey: 'ArrowLeft', horizontalPrevKey: 'ArrowRight' },
    ] satisfies Array<{
      direction: TextDirection;
      horizontalNextKey: string;
      horizontalPrevKey: string;
    }>)('direction: $direction', ({ direction, horizontalNextKey, horizontalPrevKey }) => {
      it.skipIf(isJSDOM && direction === 'rtl')('moves focus with arrow keys and Tab', async () => {
        const { user } = await render(
          <DirectionProvider direction={direction}>
            <button data-testid="before" />
            <RadioGroup>
              <Radio.Root value="a" data-testid="a" />
              <Radio.Root value="b" data-testid="b" />
              <Radio.Root value="c" data-testid="c" />
            </RadioGroup>
            <button data-testid="after" />
          </DirectionProvider>,
        );

        const a = screen.getByTestId('a');
        const b = screen.getByTestId('b');
        const c = screen.getByTestId('c');
        const after = screen.getByTestId('after');

        a.focus();
        await flushMicrotasks();

        expect(a).toHaveFocus();

        await user.keyboard('{ArrowDown}');

        expect(b).toHaveFocus();

        await user.keyboard('{ArrowDown}');

        expect(c).toHaveFocus();

        await user.keyboard('{ArrowDown}');

        expect(a).toHaveFocus();

        await user.keyboard('{ArrowUp}');

        expect(c).toHaveFocus();

        await user.keyboard('{ArrowUp}');

        expect(b).toHaveFocus();

        await user.keyboard('{ArrowUp}');

        expect(a).toHaveFocus();

        await user.keyboard(`{${horizontalPrevKey}}`);

        expect(c).toHaveFocus();

        await user.keyboard(`{${horizontalNextKey}}`);

        expect(a).toHaveFocus();

        await user.tab();

        expect(after).toHaveFocus();

        await user.tab({ shift: true });

        expect(a).toHaveFocus();

        await user.keyboard(`{${horizontalPrevKey}}`);

        expect(c).toHaveFocus();

        await user.tab({ shift: true });
        await user.tab();

        expect(c).toHaveFocus();
      });

      describe('modifier keys', () => {
        it.skipIf(isJSDOM && direction === 'rtl')(
          'when Shift is pressed arrow keys move focus normally',
          async () => {
            const { user } = await render(
              <DirectionProvider direction={direction}>
                <RadioGroup>
                  <Radio.Root value="a" data-testid="a" />
                  <Radio.Root value="b" data-testid="b" />
                  <Radio.Root value="c" data-testid="c" />
                </RadioGroup>
              </DirectionProvider>,
            );

            const a = screen.getByTestId('a');
            const b = screen.getByTestId('b');
            const c = screen.getByTestId('c');

            await user.keyboard('{Tab}');
            expect(a).toHaveFocus();

            await user.keyboard(`{Shift>}{${horizontalNextKey}}`);
            expect(b).toHaveFocus();

            await user.keyboard('{Shift>}{ArrowDown}');
            expect(c).toHaveFocus();
          },
        );
      });
    });
  });

  describe('item removal', () => {
    it('moves the tab stop to the checked radio when the highlighted radio is removed', async () => {
      function App({ showLast }: { showLast: boolean }) {
        return (
          <RadioGroup value="b">
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
            {showLast && <Radio.Root value="c" data-testid="c" />}
          </RadioGroup>
        );
      }

      const { setProps, user } = await render(<App showLast />);

      screen.getByTestId('b').focus();
      await flushMicrotasks();

      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('c')).toHaveAttribute('tabindex', '0');

      await setProps({ showLast: false });

      expect(screen.getByTestId('a')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('b')).toHaveAttribute('tabindex', '0');
    });
  });

  it('does not forward `value` prop', async () => {
    await render(
      <RadioGroup value="test" data-testid="radio-group">
        <Radio.Root value="" />
      </RadioGroup>,
    );

    expect(screen.getByTestId('radio-group')).not.toHaveAttribute('value');
  });

  it('sets tabIndex=0 to the correct element initially', async () => {
    await render(
      <RadioGroup defaultValue="b">
        <Radio.Root value="a" data-testid="radio-a" />
        <Radio.Root value="b" data-testid="radio-b" />
      </RadioGroup>,
    );

    const radioA = screen.getByTestId('radio-a');
    const radioB = screen.getByTestId('radio-b');

    expect(radioA).not.toHaveAttribute('tabindex', '0');
    expect(radioB).toHaveAttribute('tabindex', '0');
  });

  describe('with native <label>', () => {
    it('associates implicitly', async () => {
      const changeSpy = vi.fn((newValue) => newValue);
      await render(
        <RadioGroup onValueChange={changeSpy}>
          <label data-testid="label">
            <Radio.Root value="apple" />
            Apple
          </label>

          <label data-testid="label">
            <Radio.Root value="banana" />
            Banana
          </label>
        </RadioGroup>,
      );

      const [label1, label2] = screen.getAllByTestId('label');

      await fireEvent.click(label1);
      expect(changeSpy.mock.calls.length).toBe(1);
      expect(changeSpy.mock.results.at(-1)?.value).toBe('apple');

      await fireEvent.click(label2);
      expect(changeSpy.mock.calls.length).toBe(2);
      expect(changeSpy.mock.results.at(-1)?.value).toBe('banana');
    });

    it('associates explicitly', async () => {
      const changeSpy = vi.fn((newValue) => newValue);
      await render(
        <RadioGroup onValueChange={changeSpy}>
          <div>
            <label data-testid="label" for="RadioA">
              Apple
            </label>
            <Radio.Root value="apple" id="RadioA" />
          </div>

          <div>
            <label data-testid="label" for="RadioB">
              Banana
            </label>
            <Radio.Root value="banana" id="RadioB" />
          </div>
        </RadioGroup>,
      );

      const [label1, label2] = screen.getAllByTestId('label');

      await fireEvent.click(label1);
      expect(changeSpy.mock.calls.length).toBe(1);
      expect(changeSpy.mock.results.at(-1)?.value).toBe('apple');

      await fireEvent.click(label2);
      expect(changeSpy.mock.calls.length).toBe(2);
      expect(changeSpy.mock.results.at(-1)?.value).toBe('banana');
    });
  });

  describe('VUE-2: hydration', () => {
    it('hydrates a group with a value on the second radio with no mismatch and keeps the tab stop', async () => {
      const props = { defaultValue: 'b' };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      expect(readTabindexes(parse(serverHtml))).toEqual(['-1', '0', '-1']);

      const { container } = await hydrate(RadioGroupHydration, { serverHtml, props });

      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);
    });

    it.each([
      { name: 'that a radio has', defaultValue: 'b', filled: true },
      { name: 'that no radio has', defaultValue: 'z', filled: true },
      { name: '`null` that a radio has', defaultValue: null, filled: false },
    ])(
      'hydrates a group with a value $name in a field with no mismatch and the filled state of the label and the description after it',
      async ({ defaultValue, filled }) => {
        const props = { defaultValue };
        const serverHtml = await renderOnServer(FIELD_HYDRATION_FIXTURE, props);

        expect(readFilled(parse(serverHtml))).toEqual([filled, filled]);

        await hydrate(RadioGroupFieldHydration, { serverHtml, props });
      },
    );
  });

  describe('v-model:value', () => {
    // The sync watcher logs each write of the parent value, so `calls` shows the order of the two
    // events.
    function createModelApp(calls: string[], model: { value: string }, cancel = false) {
      return defineComponent(() => {
        watch(
          () => model.value,
          (value) => {
            calls.push(`update:value ${value}`);
          },
          { flush: 'sync' },
        );

        return () => (
          <RadioGroup
            v-model:value={model.value}
            onValueChange={(value: string, eventDetails: RadioGroup.ChangeEventDetails) => {
              calls.push(`valueChange ${value}`);
              if (cancel) {
                eventDetails.cancel();
              }
            }}
          >
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
          </RadioGroup>
        );
      });
    }

    it('emits `valueChange` and then `update:value`, before the click handler returns', async () => {
      const calls: string[] = [];
      const model = shallowRef('a');
      const App = createModelApp(calls, model);
      await render(<App />);

      screen.getByTestId('b').click();
      calls.push('end of the click');

      expect(calls).toEqual(['valueChange b', 'update:value b', 'end of the click']);
    });

    it('writes the value to the parent and shows the value that the parent writes', async () => {
      const model = shallowRef('a');
      const App = createModelApp([], model);
      await render(<App />);

      await fireEvent.click(screen.getByTestId('b'));

      expect(model.value).toBe('b');
      expect(screen.getByTestId('a')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByTestId('b')).toHaveAttribute('aria-checked', 'true');

      model.value = 'a';
      await flushMicrotasks();

      expect(screen.getByTestId('a')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('b')).toHaveAttribute('aria-checked', 'false');
      expect(getInputs().map((input) => input.checked)).toEqual([true, false]);
    });

    it('emits no `update:value` and keeps the parent value when a listener cancels the change', async () => {
      const calls: string[] = [];
      const model = shallowRef('a');
      const App = createModelApp(calls, model, true);
      await render(<App />);

      await fireEvent.click(screen.getByTestId('b'));

      expect(calls).toEqual(['valueChange b']);
      expect(model.value).toBe('a');
      expect(screen.getByTestId('a')).toHaveAttribute('aria-checked', 'true');
      expect(getInputs().map((input) => input.checked)).toEqual([true, false]);
    });
  });

  describe('in a native form', () => {
    function getFormData(name = 'fruit') {
      return new FormData(screen.getByTestId<HTMLFormElement>('form')).getAll(name);
    }

    it.each([
      { name: 'the default value', props: { defaultValue: 'b' } },
      { name: 'the controlled value', props: { value: 'b' } },
    ])('submits $name of the group', async ({ props }) => {
      await render(
        <form data-testid="form">
          <RadioGroup name="fruit" {...props}>
            <Radio.Root value="a" />
            <Radio.Root value="b" />
            <Radio.Root value="c" />
          </RadioGroup>
        </form>,
      );

      expect(getFormData()).toEqual(['b']);
    });

    it('submits one entry, the value of the radio that the user checked last', async () => {
      await render(
        <form data-testid="form">
          <RadioGroup name="fruit">
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
            <Radio.Root value="c" data-testid="c" />
          </RadioGroup>
        </form>,
      );

      await fireEvent.click(screen.getByTestId('a'));
      expect(getFormData()).toEqual(['a']);

      await fireEvent.click(screen.getByTestId('c'));
      expect(getFormData()).toEqual(['c']);
    });

    it.each([
      { name: 'a disabled group', groupDisabled: true, radioDisabled: false },
      { name: 'a checked radio that is disabled', groupDisabled: false, radioDisabled: true },
    ])('submits nothing for $name', async ({ groupDisabled, radioDisabled }) => {
      await render(
        <form data-testid="form">
          <RadioGroup name="fruit" defaultValue="b" disabled={groupDisabled}>
            <Radio.Root value="a" />
            <Radio.Root value="b" disabled={radioDisabled} />
          </RadioGroup>
        </form>,
      );

      expect(getFormData()).toEqual([]);
    });

    it('does not submit a required group with no value, and focuses its first radio', async () => {
      const handleSubmit = vi.fn((event: Event) => event.preventDefault());
      const { user } = await render(
        <form data-testid="form" onSubmit={handleSubmit}>
          <RadioGroup name="fruit" required>
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
          </RadioGroup>
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(getInputs().map((input) => input.validity.valueMissing)).toEqual([true, true]);
      expect(screen.getByTestId('a')).toHaveFocus();

      await user.click(screen.getByTestId('b'));
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(getFormData()).toEqual(['b']);
    });

    it('submits to an external form when `form` is provided', async () => {
      const submitSpy = createFormDataSpy('fruit');
      const { user } = await render(
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <RadioGroup name="fruit" form="external-form">
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
          </RadioGroup>
        </>,
      );

      await user.click(screen.getByTestId('b'));
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('b');
    });

    it('gives one `valueChange` and one checked input for one arrow key in a named group', async () => {
      const handleChange = vi.fn();
      const { user } = await render(
        <form data-testid="form">
          <RadioGroup name="fruit" defaultValue="a" onValueChange={handleChange}>
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
            <Radio.Root value="c" data-testid="c" />
          </RadioGroup>
        </form>,
      );

      screen.getByTestId('a').focus();
      await flushMicrotasks();

      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('b')).toHaveFocus();
      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.calls[0][0]).toBe('b');
      expect(getInputs().map((input) => input.checked)).toEqual([false, true, false]);
      expect(getFormData()).toEqual(['b']);
    });
  });
});
