import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  computed,
  createSSRApp,
  defineComponent,
  h,
  KeepAlive,
  onMounted,
  onUpdated,
  shallowRef,
  Teleport,
  watch,
} from 'vue';
import type { VNode, VNodeChild } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Form } from '@vase-ui/vue/form';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import {
  createFormDataSpy,
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  heldMountFormResetTests,
  heldMountListTests,
  hydrate,
  hydrateAfter,
  isJSDOM,
  mockPageBeforeLoad,
  removedPartHydrationTests,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import RadioGroupBeforeHydration from './RadioGroupBeforeHydration.test.vue';
import RadioGroupFieldHydration from './RadioGroupFieldHydration.test.vue';
import RadioGroupHydration from './RadioGroupHydration.test.vue';

const HYDRATION_FIXTURE = 'src/radio-group/RadioGroupHydration.test.vue';
const FIELD_HYDRATION_FIXTURE = 'src/radio-group/RadioGroupFieldHydration.test.vue';
const BEFORE_HYDRATION_FIXTURE = 'src/radio-group/RadioGroupBeforeHydration.test.vue';

type RadioGroupInstance = { inputElement: HTMLInputElement | null };

function getInputs() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
}

function getInput(testId: string) {
  return screen.getByTestId(testId).nextElementSibling as HTMLInputElement;
}

const Placeholder = defineComponent(() => () => <span data-testid="placeholder" />);

function renderRadios() {
  return (
    <>
      <Radio.Root value="a" data-testid="a" />
      <Radio.Root value="b" data-testid="b" />
      <Radio.Root value="c" data-testid="c" />
    </>
  );
}

// The group follows a reset in a timeout of 0 ms, after the listeners of the event and the updates
// that they start. The case that calls this function uses fake timers.
async function settleReset() {
  await flushMicrotasks();
  vi.advanceTimersByTime(0);
  await flushMicrotasks();
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

  heldMountListTests({
    render,
    renderList: (withLastItem) => (
      <RadioGroup defaultValue="a">
        <Radio.Root value="a" aria-label="a" />
        {withLastItem ? <Radio.Root value="b" aria-label="b" /> : null}
      </RadioGroup>
    ),
    async check(user) {
      screen.getByRole('radio', { name: 'a' }).focus();
      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: 'b' })).toHaveFocus();
      });
      expect(screen.getByRole('radio', { name: 'b' })).toHaveAttribute('aria-checked', 'true');
    },
  });

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

  it('should place the style hooks on the root and subcomponents', async () => {
    await render(
      <RadioGroup defaultValue="1" disabled readOnly required>
        <Radio.Root value="1" data-testid="item">
          <Radio.Indicator data-testid="indicator" />
        </Radio.Root>
      </RadioGroup>,
    );

    const root = screen.getByRole('radiogroup');
    const item = screen.getByTestId('item');
    const indicator = screen.getByTestId('indicator');

    expect(root).toHaveAttribute('data-disabled', '');
    expect(root).toHaveAttribute('data-readonly', '');
    expect(root).toHaveAttribute('data-required', '');

    expect(item).toHaveAttribute('data-checked', '');
    expect(item).toHaveAttribute('data-disabled', '');
    expect(item).toHaveAttribute('data-readonly', '');
    expect(item).toHaveAttribute('data-required', '');

    expect(indicator).toHaveAttribute('data-checked', '');
    expect(indicator).toHaveAttribute('data-disabled', '');
    expect(indicator).toHaveAttribute('data-readonly', '');
    expect(indicator).toHaveAttribute('data-required', '');
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

  it('allows reading inputRef.current in an effect', async () => {
    let observedValue: string | null = null;

    const App = defineComponent(() => {
      const group = shallowRef<RadioGroupInstance | null>(null);

      onMounted(() => {
        observedValue = group.value?.inputElement?.value ?? null;
      });

      return () => (
        <RadioGroup ref={group} defaultValue="a">
          <Radio.Root value="a" />
          <Radio.Root value="b" />
        </RadioGroup>
      );
    });

    await render(<App />);

    expect(observedValue).toBe('a');
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
          <RadioGroup ref={group} modelValue={value.value}>
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

  it('exposes the first enabled input when the value becomes null after the exposed radio unmounts', async () => {
    const showSecond = shallowRef(true);
    const value = shallowRef<string | null>('b');
    const group = shallowRef<RadioGroupInstance | null>(null);
    await render(() => (
      <RadioGroup ref={group} modelValue={value.value}>
        <Radio.Root value="a" data-testid="radio-a" />
        {showSecond.value && <Radio.Root value="b" data-testid="radio-b" />}
      </RadioGroup>
    ));
    const inputA = getInput('radio-a');
    const inputB = getInput('radio-b');

    expect(group.value?.inputElement).toBe(inputB);

    showSecond.value = false;
    await flushMicrotasks();

    expect(group.value?.inputElement).toBe(null);

    value.value = null;
    await flushMicrotasks();

    expect(group.value?.inputElement).toBe(inputA);
  });

  it('keeps inputElement null after the exposed radio unmounts when another radio becomes disabled', async () => {
    const showFirst = shallowRef(true);
    const disabled = shallowRef(false);
    const group = shallowRef<RadioGroupInstance | null>(null);
    await render(() => (
      <RadioGroup ref={group}>
        {showFirst.value && <Radio.Root value="a" data-testid="radio-a" />}
        <Radio.Root value="b" data-testid="radio-b" />
        <Radio.Root value="c" data-testid="radio-c" disabled={disabled.value} />
      </RadioGroup>
    ));

    expect(group.value?.inputElement).toBe(getInput('radio-a'));

    showFirst.value = false;
    await flushMicrotasks();

    expect(group.value?.inputElement).toBe(null);

    disabled.value = true;
    await flushMicrotasks();

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
    ] satisfies {
      direction: TextDirection;
      horizontalNextKey: string;
      horizontalPrevKey: string;
    }[])('direction: $direction', ({ direction, horizontalNextKey, horizontalPrevKey }) => {
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
          <RadioGroup modelValue="b">
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

  describe('style hooks', () => {
    it('should apply data-checked and data-unchecked to radio root and indicator', async () => {
      await render(
        <RadioGroup>
          <Radio.Root value="a" data-testid="a">
            <Radio.Indicator keepMounted data-testid="indicator-a" />
          </Radio.Root>
          <Radio.Root value="b" data-testid="b">
            <Radio.Indicator keepMounted data-testid="indicator-b" />
          </Radio.Root>
        </RadioGroup>,
      );

      const a = screen.getByTestId('a');
      const b = screen.getByTestId('b');
      const indicatorA = screen.getByTestId('indicator-a');
      const indicatorB = screen.getByTestId('indicator-b');

      expect(a).toHaveAttribute('data-unchecked', '');
      expect(indicatorA).toHaveAttribute('data-unchecked', '');

      expect(b).toHaveAttribute('data-unchecked', '');
      expect(indicatorB).toHaveAttribute('data-unchecked', '');

      await fireEvent.click(a);

      expect(a).toHaveAttribute('data-checked', '');
      expect(indicatorA).toHaveAttribute('data-checked', '');

      expect(b).toHaveAttribute('data-unchecked', '');
      expect(indicatorB).toHaveAttribute('data-unchecked', '');

      await fireEvent.click(b);

      expect(a).toHaveAttribute('data-unchecked', '');
      expect(indicatorA).toHaveAttribute('data-unchecked', '');

      expect(b).toHaveAttribute('data-checked', '');
      expect(indicatorB).toHaveAttribute('data-checked', '');

      await fireEvent.click(a);

      expect(a).toHaveAttribute('data-checked', '');
      expect(indicatorA).toHaveAttribute('data-checked', '');

      expect(b).toHaveAttribute('data-unchecked', '');
      expect(indicatorB).toHaveAttribute('data-unchecked', '');
    });
  });

  it('does not forward `value` prop', async () => {
    await render(
      <RadioGroup modelValue="test" data-testid="radio-group">
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

  describe('Field', () => {
    it('passes the `name` prop to the radio input', async () => {
      await render(
        <Field.Root name="test" data-testid="field">
          <RadioGroup name="group">
            <Field.Item>
              <Radio.Root value="a" data-testid="item" />
            </Field.Item>
          </RadioGroup>
        </Field.Root>,
      );

      const radio = screen.getByTestId('item');
      const input = radio.nextElementSibling as HTMLInputElement;

      expect(input).toHaveAttribute('name', 'test');
    });

    describe('[data-focused] without a blur event', () => {
      function Groups(props: { firstMounted?: boolean; firstDisabled?: boolean }) {
        const { firstMounted = true, firstDisabled = false } = props;
        return (
          <Field.Root data-testid="field">
            {firstMounted && (
              <RadioGroup data-testid="first" disabled={firstDisabled}>
                <Radio.Root value="a" data-testid="first-radio" />
              </RadioGroup>
            )}
          </Field.Root>
        );
      }

      it('is removed when the focused group becomes disabled', async () => {
        const { setProps } = await render(<Groups />);

        screen.getByTestId('first-radio').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused group unmounts', async () => {
        const { setProps } = await render(<Groups />);

        screen.getByTestId('first-radio').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });

      it('is kept when a previously focused radio unmounts after focus moves to a sibling', async () => {
        function TestCase(props: { firstMounted?: boolean }) {
          const { firstMounted = true } = props;
          return (
            <Field.Root data-testid="field">
              <RadioGroup>
                {firstMounted && <Radio.Root key="first" value="a" data-testid="first-radio" />}
                <Radio.Root key="second" value="b" data-testid="second-radio" />
              </RadioGroup>
            </Field.Root>
          );
        }

        const { setProps } = await render(<TestCase />);
        const first = screen.getByTestId('first-radio');
        const second = screen.getByTestId('second-radio');

        first.focus();
        await flushMicrotasks();
        second.focus();
        await flushMicrotasks();

        expect(second).toHaveFocus();
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(second).toHaveFocus();
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
      });

      it('is removed when the focused radio unmounts but its group remains', async () => {
        function TestCase(props: { firstMounted?: boolean }) {
          const { firstMounted = true } = props;
          return (
            <Field.Root data-testid="field">
              <RadioGroup>
                {firstMounted && <Radio.Root value="a" data-testid="first-radio" />}
                <Radio.Root value="b" />
              </RadioGroup>
            </Field.Root>
          );
        }

        const { setProps } = await render(<TestCase />);

        screen.getByTestId('first-radio').focus();
        await flushMicrotasks();
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });

      it('is not acquired when focus lands on a disabled radio', async () => {
        await render(
          <Field.Root data-testid="field">
            <RadioGroup>
              <Radio.Root value="a" disabled data-testid="disabled-radio" />
              <Radio.Root value="b" />
            </RadioGroup>
          </Field.Root>,
        );

        screen.getByTestId('disabled-radio').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('disabled-radio')).toHaveFocus();
        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });

      it('is not reacquired when a radio disabled while focused is refocused', async () => {
        function TestCase(props: { firstDisabled?: boolean }) {
          const { firstDisabled = false } = props;
          return (
            <Field.Root data-testid="field">
              <RadioGroup>
                <Radio.Root value="a" disabled={firstDisabled} data-testid="first-radio" />
                <Radio.Root value="b" />
              </RadioGroup>
            </Field.Root>
          );
        }

        const { setProps } = await render(<TestCase />);
        const first = screen.getByTestId('first-radio');

        first.focus();
        await flushMicrotasks();
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });
        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');

        first.blur();
        await flushMicrotasks();
        first.focus();
        await flushMicrotasks();

        expect(first).toHaveFocus();
        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });

      it('is reacquired when a radio that kept focus while disabled is re-enabled', async () => {
        function TestCase(props: { firstDisabled?: boolean }) {
          const { firstDisabled = false } = props;
          return (
            <Field.Root data-testid="field">
              <RadioGroup>
                <Radio.Root value="a" disabled={firstDisabled} data-testid="first-radio" />
                <Radio.Root value="b" />
              </RadioGroup>
            </Field.Root>
          );
        }

        const { setProps } = await render(<TestCase />);
        const first = screen.getByTestId('first-radio');

        first.focus();
        await flushMicrotasks();

        await setProps({ firstDisabled: true });
        expect(first).toHaveFocus();
        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');

        await setProps({ firstDisabled: false });
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
      });

      it('is not acquired when a radio inherits disabled from Field.Item', async () => {
        await render(
          <Field.Root data-testid="field">
            <RadioGroup>
              <Field.Item disabled>
                <Radio.Root value="a" data-testid="disabled-radio" />
              </Field.Item>
              <Field.Item>
                <Radio.Root value="b" />
              </Field.Item>
            </RadioGroup>
          </Field.Root>,
        );

        screen.getByTestId('disabled-radio').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });

      it('is reacquired when an arrow key moves focus from a disabled radio to an enabled sibling', async () => {
        function TestCase(props: { firstDisabled?: boolean }) {
          const { firstDisabled = false } = props;
          return (
            <Field.Root data-testid="field">
              <RadioGroup>
                <Radio.Root value="a" disabled={firstDisabled} data-testid="first-radio" />
                <Radio.Root value="b" data-testid="second-radio" />
              </RadioGroup>
            </Field.Root>
          );
        }

        const { setProps, user } = await render(<TestCase />);
        const first = screen.getByTestId('first-radio');
        const second = screen.getByTestId('second-radio');

        first.focus();
        await flushMicrotasks();
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });
        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');

        await user.keyboard('{ArrowDown}');

        expect(second).toHaveFocus();
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
      });
    });

    describe('Field.Root', () => {
      it('should receive disabled prop from Field.Root', async () => {
        await render(
          <Field.Root disabled>
            <RadioGroup>
              <Field.Item>
                <Radio.Root value="a" data-testid="radio" />
              </Field.Item>
            </RadioGroup>
          </Field.Root>,
        );

        const radioGroup = screen.getByRole('radiogroup');
        const radio = screen.getByTestId('radio');

        expect(radioGroup).toHaveAttribute('aria-disabled', 'true');
        expect(radioGroup).toHaveAttribute('data-disabled');
        expect(radio).toHaveAttribute('aria-disabled', 'true');
        expect(radio).toHaveAttribute('data-disabled');
      });

      it('should receive name prop from Field.Root', async () => {
        await render(
          <Field.Root name="field-radio">
            <RadioGroup modelValue="a">
              <Field.Item>
                <Radio.Root value="a" data-testid="radio" />
              </Field.Item>
            </RadioGroup>
          </Field.Root>,
        );

        const radio = screen.getByTestId('radio');
        const input = radio.nextElementSibling as HTMLInputElement;

        expect(input).toHaveAttribute('name', 'field-radio');
      });

      it('revalidates when the controlled value changes externally', async () => {
        const validateSpy = vi.fn((value: unknown) => ((value as string) === 'b' ? 'error' : null));

        const App = defineComponent(() => {
          const value = shallowRef('a');

          return () => (
            <>
              <Field.Root validationMode="onChange" validate={validateSpy} name="choices">
                <RadioGroup
                  modelValue={value.value}
                  onValueChange={(nextValue) => {
                    value.value = nextValue as string;
                  }}
                >
                  <Field.Item>
                    <Radio.Root value="a" data-testid="radio" />
                  </Field.Item>
                  <Field.Item>
                    <Radio.Root value="b" data-testid="radio" />
                  </Field.Item>
                </RadioGroup>
              </Field.Root>
              <button
                type="button"
                onClick={() => {
                  value.value = 'b';
                }}
              >
                Select externally
              </button>
            </>
          );
        });

        await render(<App />);

        const radioGroup = screen.getByRole('radiogroup');
        const toggle = screen.getByText('Select externally');

        expect(radioGroup).not.toHaveAttribute('aria-invalid');
        const initialCallCount = validateSpy.mock.calls.length;

        await fireEvent.click(toggle);

        expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
        expect(validateSpy.mock.lastCall?.[0]).toBe('b');
        expect(radioGroup).toHaveAttribute('aria-invalid', 'true');
      });
    });

    describe('Field.Label', () => {
      it('associates implicitly', async () => {
        const changeSpy = vi.fn((newValue) => newValue);
        await render(
          <Field.Root name="options">
            <RadioGroup onValueChange={changeSpy}>
              <Field.Item>
                <Field.Label data-testid="label">
                  <Radio.Root value="apple" />
                  Apple
                </Field.Label>
              </Field.Item>
              <Field.Item>
                <Field.Label data-testid="label">
                  <Radio.Root value="banana" />
                  Banana
                </Field.Label>
              </Field.Item>
            </RadioGroup>
          </Field.Root>,
        );

        const labels = screen.getAllByTestId('label');
        expect(labels.length).toBe(2);
        labels.forEach((label) => {
          expect(label).toHaveAttribute('for');
        });

        await fireEvent.click(screen.getByText('Apple'));
        expect(changeSpy.mock.calls.length).toBe(1);
        expect(changeSpy.mock.results.at(-1)?.value).toBe('apple');
      });

      it('associates explicitly', async () => {
        const changeSpy = vi.fn((newValue) => newValue);
        await render(
          <Field.Root name="options">
            <RadioGroup onValueChange={changeSpy}>
              <Field.Item>
                <Radio.Root value="apple" />
                <Field.Label data-testid="label">Apple</Field.Label>
                <Field.Description data-testid="description">
                  An apple is the round, edible fruit of an apple tree
                </Field.Description>
              </Field.Item>
              <Field.Item>
                <Radio.Root value="banana" />
                <Field.Label data-testid="label">Banana</Field.Label>
                <Field.Description data-testid="description">
                  A banana is an elongated, edible fruit
                </Field.Description>
              </Field.Item>
            </RadioGroup>
          </Field.Root>,
        );

        const radios = screen.getAllByRole('radio');
        const labels = screen.getAllByTestId('label');
        const descriptions = screen.getAllByTestId('description');
        const inputs = document.querySelectorAll('input[type="radio"]');

        radios.forEach((radio, index) => {
          const label = labels[index];
          const description = descriptions[index];
          const input = inputs[index];

          expect(label.getAttribute('for')).not.toBe(null);
          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));
          expect(description.getAttribute('id')).not.toBe(null);
          expect(description.getAttribute('id')).toBe(radio.getAttribute('aria-describedby'));
        });

        await fireEvent.click(screen.getByText('Banana'));
        expect(changeSpy.mock.results.at(-1)?.value).toBe('banana');
      });
    });

    describe('Field.Description', () => {
      it('links the group and individual radios', async () => {
        await render(
          <Field.Root name="apple">
            <RadioGroup defaultValue={[]} aria-describedby="external-description">
              <Field.Description data-testid="group-description">
                Group description
              </Field.Description>
              <Field.Item>
                <Field.Label>
                  <Radio.Root value="fuji-apple" aria-describedby="radio-description" />
                  Fuji
                </Field.Label>
              </Field.Item>
            </RadioGroup>
          </Field.Root>,
        );

        const groupDescription = screen.getByTestId('group-description');
        const groupDescriptionId = groupDescription.getAttribute('id');
        expect(groupDescriptionId).not.toBe(null);
        expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toContain(
          groupDescriptionId,
        );
        expect(screen.getByRole('radio').getAttribute('aria-describedby')).toContain(
          groupDescriptionId,
        );
        expect(screen.getByRole('radio')).toHaveAttribute(
          'aria-describedby',
          `radio-description ${groupDescriptionId}`,
        );
        expect(screen.getByRole('radiogroup')).toHaveAttribute(
          'aria-describedby',
          `external-description ${groupDescriptionId}`,
        );
      });
    });

    describe('prop: validationMode', () => {
      it('onSubmit', async () => {
        const { user } = await render(
          <Form>
            <Field.Root
              validate={(val) => {
                if (val === 'a') {
                  return 'custom error a';
                }

                if (val === 'c') {
                  return 'custom error c';
                }
                return null;
              }}
            >
              <RadioGroup>
                <Radio.Root value="a" data-testid="item" />
                <Radio.Root value="b" data-testid="item" />
                <Radio.Root value="c" data-testid="item" />
              </RadioGroup>
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const radioGroup = screen.getByRole('radiogroup');
        const [radioA, radioB, radioC] = screen.getAllByTestId('item');
        expect(radioGroup).not.toHaveAttribute('aria-invalid');

        await user.click(radioA);
        expect(radioA).toHaveAttribute('data-checked', '');
        expect(radioGroup).not.toHaveAttribute('aria-invalid');

        await user.click(radioC);
        expect(radioC).toHaveAttribute('data-checked', '');
        expect(radioGroup).not.toHaveAttribute('aria-invalid');

        await user.click(screen.getByText('submit'));
        expect(radioGroup).toHaveAttribute('aria-invalid');

        await user.click(radioB);
        expect(radioB).toHaveAttribute('data-checked', '');
        expect(radioGroup).not.toHaveAttribute('aria-invalid');
      });

      it('onBlur validates only when focus leaves the group', async () => {
        const validate = vi.fn((value) => (value === 'a' ? 'error' : null));

        await render(
          <>
            <Field.Root validationMode="onBlur" validate={validate}>
              <RadioGroup defaultValue="a">
                <Radio.Root value="a" data-testid="radio-a" />
                <Radio.Root value="b" data-testid="radio-b" />
              </RadioGroup>
            </Field.Root>
            <button type="button">Outside</button>
          </>,
        );

        const group = screen.getByRole('radiogroup');
        const radioA = screen.getByTestId('radio-a');
        const radioB = screen.getByTestId('radio-b');

        await fireEvent.focusIn(radioA);
        await fireEvent.focusOut(group, { relatedTarget: radioB });

        expect(validate).not.toHaveBeenCalled();

        await fireEvent.focusOut(group, { relatedTarget: screen.getByText('Outside') });

        expect(validate).toHaveBeenCalledTimes(1);
        expect(validate.mock.calls[0][0]).toBe('a');
        expect(group).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('Fieldset', () => {
    it('keeps inputRef available after an ancestor fieldset is enabled', async () => {
      const group = shallowRef<RadioGroupInstance | null>(null);

      const App = defineComponent(() => {
        const disabled = shallowRef(true);

        return () => (
          <>
            <fieldset disabled={disabled.value}>
              <RadioGroup ref={group}>
                <Radio.Root value="a" data-testid="radio-a" />
              </RadioGroup>
            </fieldset>
            <button
              type="button"
              onClick={() => {
                disabled.value = false;
              }}
            >
              Enable
            </button>
          </>
        );
      });

      await render(<App />);

      const input = screen.getByTestId('radio-a').nextElementSibling as HTMLInputElement;

      await fireEvent.click(screen.getByText('Enable'));

      expect(group.value?.inputElement).toBe(input);
    });

    it('labels the radio group from the fieldset legend', async () => {
      await render(
        <Field.Root name="test">
          <Fieldset.Root as={RadioGroup}>
            <Fieldset.Legend>Legend</Fieldset.Legend>
            <Field.Item>
              <Radio.Root value="a" />
            </Field.Item>
          </Fieldset.Root>
        </Field.Root>,
      );

      const legend = screen.getByText('Legend');
      const radioGroup = screen.getByRole('radiogroup');

      expect(radioGroup.getAttribute('aria-labelledby')).toBe(legend.getAttribute('id'));
    });

    it('updates label precedence without retaining replaced or unmounted IDs', async () => {
      const App = defineComponent(() => {
        const explicit = shallowRef(true);
        const fieldLabel = shallowRef<'field-label-a' | 'field-label-b'>('field-label-a');
        const showFieldLabel = shallowRef(true);
        const legend = shallowRef<'legend-a' | 'legend-b'>('legend-a');
        const showLegend = shallowRef(true);

        return () => {
          const explicitLabelProps = explicit.value ? { 'aria-labelledby': 'explicit-label' } : {};

          return (
            <>
              <span id="explicit-label">Explicit label</span>
              <Field.Root name="choice">
                {showFieldLabel.value && (
                  <Field.Label
                    key={fieldLabel.value}
                    id={fieldLabel.value}
                    as="span"
                    nativeLabel={false}
                  >
                    Field label
                  </Field.Label>
                )}
                <Fieldset.Root>
                  {showLegend.value && (
                    <Fieldset.Legend key={legend.value} id={legend.value}>
                      Legend
                    </Fieldset.Legend>
                  )}
                  <RadioGroup {...explicitLabelProps}>
                    <Radio.Root value="a" />
                  </RadioGroup>
                </Fieldset.Root>
              </Field.Root>
              <button
                type="button"
                onClick={() => {
                  explicit.value = false;
                }}
              >
                remove explicit
              </button>
              <button
                type="button"
                onClick={() => {
                  fieldLabel.value = 'field-label-b';
                  showFieldLabel.value = true;
                }}
              >
                mount field replacement
              </button>
              <button
                type="button"
                onClick={() => {
                  showFieldLabel.value = false;
                }}
              >
                remove field label
              </button>
              <button
                type="button"
                onClick={() => {
                  legend.value = 'legend-b';
                  showLegend.value = true;
                }}
              >
                mount legend replacement
              </button>
              <button
                type="button"
                onClick={() => {
                  showLegend.value = false;
                }}
              >
                remove legend
              </button>
            </>
          );
        };
      });

      const { user } = await render(<App />);
      const radioGroup = screen.getByRole('radiogroup');

      expect(radioGroup).toHaveAttribute('aria-labelledby', 'explicit-label');

      await user.click(screen.getByRole('button', { name: 'remove explicit' }));
      expect(radioGroup).toHaveAttribute('aria-labelledby', 'field-label-a');

      await user.click(screen.getByRole('button', { name: 'remove field label' }));
      expect(radioGroup).toHaveAttribute('aria-labelledby', 'legend-a');

      await user.click(screen.getByRole('button', { name: 'mount field replacement' }));
      expect(radioGroup).toHaveAttribute('aria-labelledby', 'field-label-b');

      await user.click(screen.getByRole('button', { name: 'remove field label' }));
      expect(radioGroup).toHaveAttribute('aria-labelledby', 'legend-a');

      await user.click(screen.getByRole('button', { name: 'remove legend' }));
      expect(radioGroup).not.toHaveAttribute('aria-labelledby');

      await user.click(screen.getByRole('button', { name: 'mount legend replacement' }));
      expect(radioGroup).toHaveAttribute('aria-labelledby', 'legend-b');

      await user.click(screen.getByRole('button', { name: 'remove legend' }));
      expect(radioGroup).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('Form', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      const submitSpy = createFormDataSpy('group');

      await render(
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <RadioGroup name="group" form="external-form" defaultValue="b">
            <Radio.Root value="a" />
            <Radio.Root value="b" />
          </RadioGroup>
        </>,
      );

      await fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('b');
    });

    it('triggers native HTML validation on submit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="test" data-testid="field">
            <RadioGroup name="group" required>
              <Field.Item>
                <Radio.Root value="a" data-testid="item" />
              </Field.Item>
            </RadioGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const submit = screen.getByText('Submit');

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(submit);

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });

    it('submits null to onFormSubmit when no radio is selected', async () => {
      const handleSubmit = vi.fn();

      await render(
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="test">
            <RadioGroup name="group">
              <Radio.Root value="a" data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls.length).toBe(1);
      expect(handleSubmit.mock.calls[0][0]).toEqual({ test: null });
    });

    it('unblocks submission after every radio in the group unmounts', async () => {
      const handleSubmit = vi.fn();

      const App = defineComponent(() => {
        const mounted = shallowRef(true);

        return () => (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="choice">
              <RadioGroup required>{mounted.value && <Radio.Root value="a" />}</RadioGroup>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                mounted.value = false;
              }}
            >
              Remove
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByText('Submit'));
      expect(handleSubmit).not.toHaveBeenCalled();

      await user.click(screen.getByText('Remove'));
      await user.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ choice: null });
    });

    it('runs the custom validator after every radio in the group unmounts', async () => {
      const handleSubmit = vi.fn();
      const validate = vi.fn(() => 'always invalid');

      const App = defineComponent(() => {
        const mounted = shallowRef(true);

        return () => (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="choice" validate={validate}>
              <RadioGroup>{mounted.value && <Radio.Root value="a" />}</RadioGroup>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                mounted.value = false;
              }}
            >
              Remove
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByText('Remove'));
      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('error')).toHaveTextContent('always invalid');
    });

    it('excludes a disabled selected radio from onFormSubmit to match native form data', async () => {
      const handleSubmit = vi.fn();

      const App = defineComponent(() => {
        const disabled = shallowRef(false);

        return () => (
          <Form onFormSubmit={handleSubmit} data-testid="form">
            <Field.Root name="test">
              <RadioGroup name="group" defaultValue="a">
                <Radio.Root value="a" disabled={disabled.value} data-testid="item-a" />
                <Radio.Root value="b" data-testid="item-b" />
              </RadioGroup>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                disabled.value = true;
              }}
            >
              Disable
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      await render(<App />);

      await fireEvent.click(screen.getByText('Disable'));

      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(new FormData(form).get('test')).toBe(null);

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls[0][0]).toEqual({ test: null });
    });

    it('includes a selected radio again when it is re-enabled before form submission', async () => {
      const handleSubmit = vi.fn();

      const App = defineComponent(() => {
        const disabled = shallowRef(false);

        return () => (
          <Form onFormSubmit={handleSubmit} data-testid="form">
            <Field.Root name="test">
              <RadioGroup name="group" defaultValue="a">
                <Radio.Root value="a" disabled={disabled.value} data-testid="item-a" />
                <Radio.Root value="b" data-testid="item-b" />
              </RadioGroup>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                disabled.value = !disabled.value;
              }}
            >
              Toggle disabled
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      await render(<App />);

      const form = screen.getByTestId('form') as HTMLFormElement;

      await fireEvent.click(screen.getByText('Toggle disabled'));
      expect(new FormData(form).get('test')).toBe(null);

      await fireEvent.click(screen.getByText('Toggle disabled'));
      expect(new FormData(form).get('test')).toBe('a');

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls[0][0]).toEqual({ test: 'a' });
    });

    it('excludes an initially disabled selected radio from onFormSubmit to match native form data', async () => {
      const handleSubmit = vi.fn();

      await render(
        <Form onFormSubmit={handleSubmit} data-testid="form">
          <Field.Root name="test">
            <RadioGroup name="group" defaultValue="a">
              <Radio.Root value="a" disabled data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(new FormData(form).get('test')).toBe(null);

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls[0][0]).toEqual({ test: null });
    });

    it.skipIf(isJSDOM)(
      'projects an enabled selected radio, matching native form data',
      async () => {
        const handleSubmit = vi.fn();

        await render(
          <Form onFormSubmit={handleSubmit} data-testid="form">
            <Field.Root name="choice">
              <RadioGroup defaultValue="a">
                <Radio.Root value="a" data-testid="item-a" />
                <Radio.Root value="b" data-testid="item-b" />
              </RadioGroup>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const form = screen.getByTestId('form') as HTMLFormElement;
        expect(new FormData(form).getAll('choice')).toEqual(['a']);

        await fireEvent.click(screen.getByText('Submit'));

        expect(handleSubmit.mock.calls[0][0]).toEqual({ choice: 'a' });
      },
    );

    it.skipIf(isJSDOM)(
      'includes a selected radio after its ancestor fieldset is enabled',
      async () => {
        const handleSubmit = vi.fn();

        const App = defineComponent(() => {
          const disabled = shallowRef(true);

          return () => (
            <Form onFormSubmit={handleSubmit} data-testid="form">
              <fieldset disabled={disabled.value}>
                <Field.Root name="choice">
                  <RadioGroup defaultValue="a">
                    <Radio.Root value="a" />
                    <Radio.Root value="b" />
                  </RadioGroup>
                </Field.Root>
              </fieldset>
              <button
                type="button"
                onClick={() => {
                  disabled.value = false;
                }}
              >
                Enable
              </button>
              <button type="submit">Submit</button>
            </Form>
          );
        });

        await render(<App />);

        const form = screen.getByTestId('form') as HTMLFormElement;
        expect(new FormData(form).getAll('choice')).toEqual([]);

        await fireEvent.click(screen.getByText('Enable'));
        expect(new FormData(form).getAll('choice')).toEqual(['a']);

        await fireEvent.click(screen.getByText('Submit'));
        expect(handleSubmit.mock.calls[0][0]).toEqual({ choice: 'a' });
      },
    );

    it.skipIf(isJSDOM)('omits a radio associated to another form via the `form` prop', async () => {
      const handleSubmit = vi.fn();

      await render(
        <>
          <form id="external-form" />
          <Form onFormSubmit={handleSubmit} data-testid="form">
            <Field.Root name="choice">
              <RadioGroup form="external-form" defaultValue="a">
                <Radio.Root value="a" data-testid="item-a" />
                <Radio.Root value="b" data-testid="item-b" />
              </RadioGroup>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        </>,
      );

      const form = screen.getByTestId('form') as HTMLFormElement;
      // The radio is associated to #external-form, so this form excludes it natively.
      expect(new FormData(form).getAll('choice')).toEqual([]);

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls[0][0]).toEqual({ choice: null });
    });

    it.skipIf(isJSDOM)(
      'includes a context-portaled radio without native form association in onFormSubmit',
      async () => {
        const handleSubmit = vi.fn();
        const portalContainer = document.createElement('div');
        document.body.append(portalContainer);

        await render(
          <Form onFormSubmit={handleSubmit} data-testid="form">
            <Field.Root name="choice">
              <RadioGroup defaultValue="a">
                <Teleport to={portalContainer}>
                  <Radio.Root value="a" />
                </Teleport>
              </RadioGroup>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const form = screen.getByTestId('form') as HTMLFormElement;
        // Native submission omits the portaled radio since it has no DOM form association.
        expect(new FormData(form).getAll('choice')).toEqual([]);

        await fireEvent.click(screen.getByText('Submit'));

        // Field registration is context-driven, so the portaled radio still projects its value
        // into `onFormSubmit`, like other field controls.
        expect(handleSubmit.mock.calls[0][0]).toEqual({ choice: 'a' });
        portalContainer.remove();
      },
    );

    it('includes a group fully portaled outside the form element in onFormSubmit', async () => {
      const handleSubmit = vi.fn();
      const portalContainer = document.createElement('div');
      document.body.append(portalContainer);

      await render(
        <Form onFormSubmit={handleSubmit}>
          <Teleport to={portalContainer}>
            <Field.Root name="choice">
              <RadioGroup defaultValue="a">
                <Radio.Root value="a" />
                <Radio.Root value="b" />
              </RadioGroup>
            </Field.Root>
          </Teleport>
          <button type="submit">Submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls[0][0]).toEqual({ choice: 'a' });
      portalContainer.remove();
    });

    it.skipIf(isJSDOM)(
      'submits null when the selected radio in a required group is disabled, matching native validity',
      async () => {
        const handleSubmit = vi.fn();

        await render(
          <Form onFormSubmit={handleSubmit} data-testid="form">
            <Field.Root name="choice">
              <RadioGroup required defaultValue="a">
                <Radio.Root value="a" disabled data-testid="item-a" />
                <Radio.Root value="b" data-testid="item-b" />
              </RadioGroup>
              <Field.Error match="valueMissing" data-testid="error">
                required
              </Field.Error>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const form = screen.getByTestId('form') as HTMLFormElement;
        expect(new FormData(form).getAll('choice')).toEqual([]);

        await fireEvent.click(screen.getByText('Submit'));

        // Natively, a disabled checked radio still satisfies its radio group's `valueMissing`
        // constraint even though its value is not submitted.
        expect(screen.queryByTestId('error')).toBe(null);
        expect(handleSubmit.mock.calls[0][0]).toEqual({ choice: null });
      },
    );

    it('clears required validation when a value is selected', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="test" data-testid="field">
            <RadioGroup name="group" required data-testid="group">
              <Radio.Root value="a" data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(screen.queryByTestId('error')).toBe(null);

      const group = screen.getByTestId('group');
      const radioA = screen.getByTestId('item-a');
      const radioB = screen.getByTestId('item-b');

      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('error')).toHaveTextContent('required');
      expect(group).toHaveAttribute('aria-invalid', 'true');
      expect(radioA).toHaveAttribute('aria-invalid', 'true');
      expect(radioB).toHaveAttribute('aria-invalid', 'true');

      await user.click(radioB);

      expect(screen.queryByTestId('error')).toBe(null);
      expect(group).not.toHaveAttribute('aria-invalid', 'true');
      expect(radioA).not.toHaveAttribute('aria-invalid', 'true');
      expect(radioB).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('validates when inputRef is a function', async () => {
      const group = shallowRef<RadioGroupInstance | null>(null);
      const { user } = await render(() => (
        <Form>
          <Field.Root name="test">
            <RadioGroup ref={group} name="group" required>
              <Radio.Root value="a" data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Submit'));

      expect(group.value?.inputElement).not.toBe(null);
      expect(screen.getByTestId('error')).toHaveTextContent('required');
    });

    it('focuses the first enabled radio when all radios start disabled', async () => {
      const App = defineComponent(() => {
        const disabled = shallowRef(true);

        return () => (
          <Form>
            <Field.Root name="test">
              <RadioGroup name="group" required>
                <Radio.Root value="a" disabled={disabled.value} data-testid="item-a" />
                <Radio.Root value="b" disabled={disabled.value} data-testid="item-b" />
              </RadioGroup>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                disabled.value = false;
              }}
            >
              Enable
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByText('Enable'));

      const radioA = screen.getByTestId('item-a');

      await user.click(screen.getByText('Submit'));

      expect(document.activeElement).toBe(radioA);
    });

    it.skipIf(isJSDOM)(
      'validates and focuses the first radio after its ancestor fieldset is enabled',
      async () => {
        const App = defineComponent(() => {
          const disabled = shallowRef(true);

          return () => (
            <Form>
              <fieldset disabled={disabled.value}>
                <Field.Root name="test">
                  <RadioGroup required>
                    <Radio.Root value="a" data-testid="item-a" />
                    <Radio.Root value="b" />
                  </RadioGroup>
                  <Field.Error match="valueMissing">required</Field.Error>
                </Field.Root>
              </fieldset>
              <button
                type="button"
                onClick={() => {
                  disabled.value = false;
                }}
              >
                Enable
              </button>
              <button type="submit">Submit</button>
            </Form>
          );
        });

        const { user } = await render(<App />);

        await user.click(screen.getByText('Enable'));
        await user.click(screen.getByText('Submit'));

        expect(screen.getByText('required')).toBeVisible();
        expect(screen.getByTestId('item-a')).toHaveFocus();
      },
    );

    it('clears external errors on change', async () => {
      await render(
        <Form
          errors={{
            test: 'test',
          }}
        >
          <Field.Root name="test" data-testid="field">
            <RadioGroup data-testid="radio-group">
              <Field.Item>
                <Radio.Root value="a" data-testid="item-a" />
              </Field.Item>
              <Field.Item>
                <Radio.Root value="b" data-testid="item-b" />
              </Field.Item>
            </RadioGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      const itemA = screen.getByTestId('item-a');
      const radioGroup = screen.getByTestId('radio-group');

      expect(screen.queryByTestId('error')).toHaveTextContent('test');

      await fireEvent.click(itemA);

      expect(screen.queryByTestId('error')).toBe(null);
      expect(radioGroup).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('appends the id attribute of the error to aria-describedby of individual radios', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="test" data-testid="field">
            <RadioGroup name="group" required>
              <Field.Item>
                <Radio.Root value="a" />
                <Field.Description>description</Field.Description>
              </Field.Item>
            </RadioGroup>
            <Field.Error match="valueMissing" data-testid="error" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Submit'));

      const error = screen.getByTestId('error');
      const radio = screen.getByRole('radio');
      const description = screen.getByText('description');
      expect(radio.getAttribute('aria-describedby')).toContain(error.getAttribute('id'));
      expect(radio.getAttribute('aria-describedby')).toContain(description.getAttribute('id'));
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

  describe('v-model', () => {
    // The sync watcher logs each write of the parent value, so `calls` shows the order of the two
    // events.
    function createModelApp(calls: string[], model: { value: string }, cancel = false) {
      return defineComponent(() => {
        watch(
          () => model.value,
          (value) => {
            calls.push(`update:modelValue ${value}`);
          },
          { flush: 'sync' },
        );

        return () => (
          <RadioGroup
            v-model={model.value}
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

    it('emits `valueChange` and then `update:modelValue`, before the click handler returns', async () => {
      const calls: string[] = [];
      const model = shallowRef('a');
      const App = createModelApp(calls, model);
      await render(<App />);

      screen.getByTestId('b').click();
      calls.push('end of the click');

      expect(calls).toEqual(['valueChange b', 'update:modelValue b', 'end of the click']);
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

    it('emits no `update:modelValue` and keeps the parent value when a listener cancels the change', async () => {
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
    function getFormData() {
      return new FormData(screen.getByTestId<HTMLFormElement>('form')).getAll('fruit');
    }

    it.each([
      { name: 'the default value', props: { defaultValue: 'b' } },
      { name: 'the controlled value', props: { modelValue: 'b' } },
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

    it('submits the value of the radio whose label the user clicks', async () => {
      await render(
        <form data-testid="form">
          <RadioGroup name="fruit">
            <label data-testid="apple-label">
              <Radio.Root value="apple" />
              Apple
            </label>
            <div>
              <label data-testid="banana-label" for="banana">
                Banana
              </label>
              <Radio.Root value="banana" id="banana" />
            </div>
          </RadioGroup>
        </form>,
      );

      await fireEvent.click(screen.getByTestId('apple-label'));

      expect(getFormData()).toEqual(['apple']);
      expect(getInputs().map((input) => input.checked)).toEqual([true, false]);

      await fireEvent.click(screen.getByTestId('banana-label'));

      expect(getFormData()).toEqual(['banana']);
      expect(getInputs().map((input) => input.checked)).toEqual([false, true]);
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

    describe('BUG-6206: a native reset', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      // Each radio shows its state on its element and on its input.
      function expectChecked(checked: boolean[]) {
        expect(getInputs().map((input) => input.checked)).toEqual(checked);
        expect(
          ['a', 'b', 'c'].map((testId) => screen.getByTestId(testId).getAttribute('aria-checked')),
        ).toEqual(checked.map(String));
      }

      it.each([
        { name: 'a value', defaultValue: 'a', data: ['a'], checked: [true, false, false] },
        { name: 'no value', defaultValue: undefined, data: [], checked: [false, false, false] },
      ])(
        'puts an uncontrolled group back to its default, $name',
        async ({ defaultValue, data, checked }) => {
          const handleChange = vi.fn();
          await render(
            <form data-testid="form">
              <RadioGroup name="fruit" defaultValue={defaultValue} onValueChange={handleChange}>
                {renderRadios()}
              </RadioGroup>
              <button type="reset">Reset</button>
            </form>,
          );
          await fireEvent.click(screen.getByTestId('c'));
          expect(getFormData()).toEqual(['c']);

          await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
          await settleReset();

          expectChecked(checked);
          expect(getFormData()).toEqual(data);
          expect(handleChange).toHaveBeenCalledTimes(2);
          expect(handleChange.mock.lastCall?.[0]).toBe(defaultValue);
          expect(handleChange.mock.lastCall?.[1].event.type).toBe('reset');

          // A reset with nothing to change.
          await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
          await settleReset();

          expect(handleChange).toHaveBeenCalledTimes(2);
          expectChecked(checked);
        },
      );

      it.each([
        {
          name: 'a group whose listener cancels',
          renderForm: () => () => (
            <form data-testid="form">
              <RadioGroup
                name="fruit"
                onValueChange={(_value: string, details: RadioGroup.ChangeEventDetails) => {
                  if (details.event.type === 'reset') {
                    details.cancel();
                  }
                }}
              >
                {renderRadios()}
              </RadioGroup>
            </form>
          ),
        },
        {
          name: 'a group whose form cancels the reset',
          renderForm: () => () => (
            <form data-testid="form" onReset={(event: Event) => event.preventDefault()}>
              <RadioGroup name="fruit">{renderRadios()}</RadioGroup>
            </form>
          ),
        },
        {
          name: 'a group that the window cancels',
          renderForm: () => {
            // The window gets the event after the root node of the group.
            const cancelReset = (event: Event) => event.preventDefault();
            window.addEventListener('reset', cancelReset);
            onTestFinished(() => window.removeEventListener('reset', cancelReset));
            return () => (
              <form data-testid="form">
                <RadioGroup name="fruit">{renderRadios()}</RadioGroup>
              </form>
            );
          },
        },
        {
          name: 'a group of another form',
          renderForm: () => () => (
            <div>
              <form data-testid="form" />
              <form id="other" />
              <RadioGroup name="fruit" form="other">
                {renderRadios()}
              </RadioGroup>
            </div>
          ),
        },
      ])('does not change $name', async ({ renderForm }) => {
        await render(h(defineComponent(renderForm)));
        await fireEvent.click(screen.getByTestId('c'));

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expectChecked([false, false, true]);
      });

      it('does not change a controlled group, and emits nothing', async () => {
        const handleChange = vi.fn();
        const handleUpdate = vi.fn();
        const App = defineComponent(() => {
          const value = shallowRef('a');
          return () => (
            <form data-testid="form">
              <RadioGroup
                name="fruit"
                modelValue={value.value}
                onValueChange={handleChange}
                {...{
                  'onUpdate:modelValue': (next: string) => {
                    handleUpdate(next);
                    value.value = next;
                  },
                }}
              >
                {renderRadios()}
              </RadioGroup>
            </form>
          );
        });
        await render(<App />);
        await fireEvent.click(screen.getByTestId('c'));
        handleChange.mockClear();
        handleUpdate.mockClear();

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expectChecked([false, false, true]);
        expect(handleChange).not.toHaveBeenCalled();
        expect(handleUpdate).not.toHaveBeenCalled();
      });

      it('emits one `valueChange` for one reset, also when a listener cancels it', async () => {
        const handleChange = vi.fn(
          (_value: string | undefined, details: RadioGroup.ChangeEventDetails) => {
            if (details.event.type === 'reset') {
              details.cancel();
            }
          },
        );
        await render(
          <form data-testid="form">
            <RadioGroup name="fruit" onValueChange={handleChange}>
              {renderRadios()}
            </RadioGroup>
          </form>,
        );
        await fireEvent.click(screen.getByTestId('c'));

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(
          handleChange.mock.calls.map(([value, details]) => [value, details.event.type]),
        ).toEqual([
          ['c', 'click'],
          [undefined, 'reset'],
        ]);
      });

      it('follows each reset of the form, not only the first', async () => {
        const handleChange = vi.fn();
        await render(
          <form data-testid="form">
            <RadioGroup name="fruit" defaultValue="a" onValueChange={handleChange}>
              {renderRadios()}
            </RadioGroup>
          </form>,
        );

        await fireEvent.click(screen.getByTestId('c'));
        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();
        await fireEvent.click(screen.getByTestId('b'));
        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expectChecked([true, false, false]);
        expect(getFormData()).toEqual(['a']);
        expect(handleChange).toHaveBeenCalledTimes(4);
        expect(handleChange.mock.lastCall?.[0]).toBe('a');
        expect(handleChange.mock.lastCall?.[1].event.type).toBe('reset');
      });

      it('exposes the first enabled input when a reset leaves the group with no value', async () => {
        const group = shallowRef<RadioGroupInstance | null>(null);
        await render(() => (
          <form data-testid="form">
            <RadioGroup ref={group} name="fruit">
              {renderRadios()}
            </RadioGroup>
          </form>
        ));
        const inputs = getInputs();

        await fireEvent.click(screen.getByTestId('c'));
        expect(group.value?.inputElement).toBe(inputs[2]);

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(group.value?.inputElement).toBe(inputs[0]);
      });

      it('resets a group outside the form that its `form` prop names', async () => {
        await render(
          <div>
            <form data-testid="form" id="external" />
            <RadioGroup name="fruit" form="external" defaultValue="a">
              {renderRadios()}
            </RadioGroup>
          </div>,
        );
        await fireEvent.click(screen.getByTestId('c'));
        expect(getFormData()).toEqual(['c']);

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expectChecked([true, false, false]);
        expect(getFormData()).toEqual(['a']);
      });

      it('removes `data-filled` and `data-dirty` of the field when the group goes back to no value', async () => {
        await render(
          <form data-testid="form">
            <Field.Root name="fruit" data-testid="root">
              <RadioGroup>{renderRadios()}</RadioGroup>
            </Field.Root>
          </form>,
        );
        await fireEvent.click(screen.getByTestId('c'));

        expect(screen.getByTestId('root')).toHaveAttribute('data-filled');
        expect(screen.getByTestId('root')).toHaveAttribute('data-dirty');

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-filled');
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-dirty');
      });
    });

    heldMountFormResetTests({
      render,
      renderControl: () => (
        <RadioGroup name="fruit" defaultValue="a">
          {renderRadios()}
        </RadioGroup>
      ),
      change: () => fireEvent.click(screen.getByTestId('b')),
      readState: () =>
        screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-checked')),
      defaultState: ['true', 'false', 'false'],
      changedState: ['false', 'true', 'false'],
    });
  });

  describe('VUE-21: a native reset clears the error of the field', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function submitForm() {
      return fireEvent.submit(screen.getByTestId('form'));
    }

    async function resetForm() {
      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();
    }

    // The field is neutral, as after a reset of `Field.Control`.
    function expectNeutralField() {
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-valid');
      expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-invalid');
    }

    // The inputs keep no message of the field. A required group with no value keeps the message of
    // its native constraint.
    function expectInputConstraint(valueMissing: boolean) {
      for (const input of getInputs()) {
        expect(input.validity.customError).toBe(false);
        expect(input.validity.valueMissing).toBe(valueMissing);
        expect(Boolean(input.validationMessage)).toBe(valueMissing);
      }
    }

    it.each([
      {
        name: 'a group at its default',
        valueMissing: false,
        renderForm: () => () => (
          <Form data-testid="form">
            <Field.Root
              data-testid="root"
              name="fruit"
              validate={(value) => (value ? null : 'Pick one')}
            >
              <RadioGroup>{renderRadios()}</RadioGroup>
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        ),
        makeInvalid: submitForm,
      },
      {
        name: 'a required group at its default',
        valueMissing: true,
        renderForm: () => () => (
          <Form data-testid="form">
            <Field.Root data-testid="root" name="fruit">
              <RadioGroup required>{renderRadios()}</RadioGroup>
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        ),
        makeInvalid: submitForm,
      },
      {
        name: 'the form for a group at its default',
        valueMissing: false,
        renderForm: () => () => (
          <Form data-testid="form" errors={{ fruit: 'Server error' }}>
            <Field.Root data-testid="root" name="fruit">
              <RadioGroup>{renderRadios()}</RadioGroup>
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        ),
        makeInvalid: undefined,
      },
      {
        name: 'a controlled group',
        valueMissing: false,
        renderForm: () => {
          const value = shallowRef<string | null>(null);
          return () => (
            <Form data-testid="form">
              <Field.Root
                data-testid="root"
                name="fruit"
                validate={(next) => (next ? null : 'Pick one')}
              >
                <RadioGroup
                  modelValue={value.value}
                  {...{ 'onUpdate:modelValue': (next: string | null) => (value.value = next) }}
                >
                  {renderRadios()}
                </RadioGroup>
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          );
        },
        makeInvalid: submitForm,
      },
    ])('VUE-21: clears the error of $name', async ({ renderForm, makeInvalid, valueMissing }) => {
      await render(h(defineComponent(renderForm)));
      await makeInvalid?.();
      expect(screen.getByTestId('error')).toBeInTheDocument();

      await resetForm();

      expect(getInputs().map((input) => input.checked)).toEqual([false, false, false]);
      expectNeutralField();
      expectInputConstraint(valueMissing);
    });

    it('VUE-21: clears the error of a group whose listener cancels the reset, and validates the next click', async () => {
      const validate = vi.fn((value: unknown) => (value === 'b' ? 'Not b' : null));
      await render(
        <Form data-testid="form">
          <Field.Root data-testid="root" name="fruit" validate={validate}>
            <RadioGroup
              onValueChange={(_value: string, details: RadioGroup.ChangeEventDetails) => {
                if (details.event.type === 'reset') {
                  details.cancel();
                }
              }}
            >
              {renderRadios()}
            </RadioGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      await fireEvent.click(screen.getByTestId('b'));
      await submitForm();
      expect(screen.getByTestId('error')).toHaveTextContent('Not b');

      await resetForm();

      expect(screen.getByTestId('b')).toHaveAttribute('aria-checked', 'true');
      expect(validate).toHaveBeenCalledTimes(1);
      expectNeutralField();
      expectInputConstraint(false);

      await fireEvent.click(screen.getByTestId('c'));

      expect(validate).toHaveBeenCalledTimes(2);
      expect(validate.mock.lastCall?.[0]).toBe('c');
      expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');
    });

    it('VUE-21: clears the error when the reset empties the group, does not validate it, and validates the next click', async () => {
      const validate = vi.fn((value: unknown) => (value ? 'Pick none' : null));
      const handleValidity = vi.fn();
      await render(
        <Form data-testid="form">
          <Field.Root data-testid="root" name="fruit" validate={validate} validationMode="onChange">
            <RadioGroup>{renderRadios()}</RadioGroup>
            <Field.Error data-testid="error" />
            <Field.Validity v-slots={{ default: handleValidity }} />
          </Field.Root>
        </Form>,
      );
      await fireEvent.click(screen.getByTestId('b'));
      expect(screen.getByTestId('error')).toHaveTextContent('Pick none');
      expect(handleValidity.mock.lastCall?.[0].value).toBe('b');

      await resetForm();

      expect(getInputs().map((input) => input.checked)).toEqual([false, false, false]);
      expect(validate).toHaveBeenCalledTimes(1);
      // The field holds `null` for a group with no value, as before the first change.
      expect(handleValidity.mock.lastCall?.[0].value).toBe(null);
      expectNeutralField();
      expectInputConstraint(false);

      await fireEvent.click(screen.getByTestId('c'));

      expect(validate).toHaveBeenCalledTimes(2);
      expect(validate.mock.lastCall?.[0]).toBe('c');
      expect(screen.getByTestId('error')).toHaveTextContent('Pick none');
    });

    it('VUE-21: shows no error when the reset empties a required group that was valid', async () => {
      const validate = vi.fn();
      const { container } = await render(
        <Form data-testid="form">
          <Field.Root data-testid="root" name="fruit" validate={validate}>
            <RadioGroup required>{renderRadios()}</RadioGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      // Firefox loads the page again for a valid submit that no listener prevents.
      container.addEventListener('submit', (event) => event.preventDefault());
      await fireEvent.click(screen.getByTestId('b'));
      await submitForm();
      expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');
      expect(validate).toHaveBeenCalledTimes(1);

      await resetForm();

      expect(getInputs().map((input) => input.checked)).toEqual([false, false, false]);
      expect(validate).toHaveBeenCalledTimes(1);
      expectNeutralField();
      expectInputConstraint(true);
    });

    it('VUE-21: removes the validity mark that a change gave to a field with an error of the form', async () => {
      await render(
        <Form data-testid="form" errors={{ fruit: 'Server error' }}>
          <Field.Root data-testid="root" name="fruit">
            <RadioGroup>{renderRadios()}</RadioGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      await fireEvent.click(screen.getByTestId('b'));
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');

      await resetForm();

      expect(getInputs().map((input) => input.checked)).toEqual([false, false, false]);
      expectNeutralField();
    });

    it('VUE-21: gives the field the value `null` when the reset leaves a group with no value', async () => {
      const handleValidity = vi.fn();
      await render(
        <Form data-testid="form" errors={{ fruit: 'Server error' }}>
          <Field.Root data-testid="root" name="fruit">
            <RadioGroup>{renderRadios()}</RadioGroup>
            <Field.Validity v-slots={{ default: handleValidity }} />
          </Field.Root>
        </Form>,
      );

      await resetForm();

      expect(handleValidity.mock.lastCall?.[0].value).toBe(null);
    });

    it('VUE-21: clears the error of a group whose radios are all disabled', async () => {
      await render(
        <Form data-testid="form" errors={{ fruit: 'Server error' }}>
          <Field.Root data-testid="root" name="fruit">
            <RadioGroup>
              <Radio.Root value="a" disabled />
              <Radio.Root value="b" disabled />
            </RadioGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      expect(screen.getByTestId('error')).toBeInTheDocument();

      await resetForm();

      expectNeutralField();
    });

    it('VUE-21: clears the error of a controlled group when a listener of the form changes its value', async () => {
      const App = defineComponent(() => {
        const value = shallowRef('a');
        return () => (
          <Form data-testid="form" onReset={() => (value.value = 'a')}>
            <Field.Root
              data-testid="root"
              name="fruit"
              validate={(next) => (next === 'a' ? null : 'Pick a')}
            >
              <RadioGroup
                modelValue={value.value}
                {...{ 'onUpdate:modelValue': (next: string) => (value.value = next) }}
              >
                {renderRadios()}
              </RadioGroup>
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        );
      });
      await render(<App />);
      await fireEvent.click(screen.getByTestId('c'));
      await submitForm();
      expect(screen.getByTestId('error')).toHaveTextContent('Pick a');

      await resetForm();

      expect(getInputs().map((input) => input.checked)).toEqual([true, false, false]);
      expectNeutralField();
    });
  });

  describe('BUG-1425: a required group with no value after blur', () => {
    function renderGroup(validationMode?: Form.ValidationMode) {
      return render(
        <div>
          <Field.Root name="fruit" validationMode={validationMode} data-testid="root">
            <RadioGroup required>
              <Radio.Root value="a" data-testid="a" />
              <Radio.Root value="b" data-testid="b" />
            </RadioGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="button">After</button>
        </div>,
      );
    }

    it('is invalid when the focus leaves the group, with no change before', async () => {
      const { user } = await renderGroup('onBlur');
      const group = screen.getByRole('radiogroup');

      screen.getByTestId('a').focus();
      screen.getByTestId('b').focus();
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
      expect(group).not.toHaveAttribute('aria-invalid');

      await user.tab();

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(screen.getByTestId('error')).toHaveTextContent('required');
      expect(group).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('a')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('root')).toHaveAttribute('data-touched', '');
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-dirty');
    });

    it('is valid again when the user picks a radio', async () => {
      const { user } = await renderGroup('onBlur');

      screen.getByTestId('a').focus();
      await user.tab();

      expect(screen.getByTestId('error')).toBeInTheDocument();

      await user.click(screen.getByTestId('b'));

      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-invalid');
      expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');
    });

    it('stays valid when the focus leaves the group, with the default validation mode', async () => {
      const { user } = await renderGroup();

      screen.getByTestId('a').focus();
      await user.tab();

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(screen.getByTestId('root')).toHaveAttribute('data-touched', '');
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('a radio that mounts and unmounts', () => {
    function createApp() {
      const mounted = shallowRef(false);
      const group = shallowRef<RadioGroupInstance | null>(null);
      const handleSubmit = vi.fn();
      const App = defineComponent(() => () => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruit">
            <RadioGroup ref={group} required>
              {mounted.value && <Radio.Root value="a" data-testid="a" />}
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      return { App, mounted, group, handleSubmit };
    }

    it('gives its input to the group and the field when it mounts, and takes the input back when it unmounts', async () => {
      const { App, mounted, group, handleSubmit } = createApp();
      const { user } = await render(<App />);

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(group.value?.inputElement).toBe(null);
      expect(handleSubmit).toHaveBeenCalledTimes(1);

      mounted.value = true;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(screen.getByTestId('a').nextElementSibling);

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('a')).toHaveFocus();

      mounted.value = false;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).toHaveBeenCalledTimes(2);
    });
  });

  describe('KeepAlive', () => {
    // The group stays active. `KeepAlive` hides and shows its radios.
    function createApp(getGroupProps: () => { defaultValue?: string; modelValue?: string }) {
      const visible = shallowRef(true);
      const group = shallowRef<RadioGroupInstance | null>(null);
      const handleSubmit = vi.fn();
      const Radios = defineComponent(() => () => (
        <>
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
          <Radio.Root value="c" data-testid="c" />
        </>
      ));
      const App = defineComponent(() => () => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruit">
            <RadioGroup ref={group} required {...getGroupProps()}>
              <KeepAlive>{visible.value ? <Radios /> : <Placeholder />}</KeepAlive>
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      return { App, visible, group, handleSubmit };
    }

    it('takes the inputs of deactivated radios out of the group and the form, and gives them back when the radios activate', async () => {
      const { App, visible, group, handleSubmit } = createApp(() => ({ defaultValue: 'a' }));
      const { user } = await render(<App />);
      const inputA = getInput('a');

      expect(group.value?.inputElement).toBe(inputA);

      visible.value = false;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruit: null });

      visible.value = true;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(inputA);

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).toHaveBeenCalledTimes(2);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruit: 'a' });
    });

    it('exposes no held input in an `onUpdated` hook of the update that deactivates the radios', async () => {
      const visible = shallowRef(true);
      const group = shallowRef<RadioGroupInstance | null>(null);
      const exposedInputs: (HTMLInputElement | null)[] = [];
      const Radios = defineComponent(() => renderRadios);
      const App = defineComponent(() => {
        onUpdated(() => {
          exposedInputs.push(group.value?.inputElement ?? null);
        });
        return () => {
          // A read in the slot would update only the group, and `onUpdated` would not run.
          const isVisible = visible.value;
          return (
            <RadioGroup ref={group} defaultValue="a">
              <KeepAlive>{isVisible ? <Radios /> : <Placeholder />}</KeepAlive>
            </RadioGroup>
          );
        };
      });
      await render(<App />);

      visible.value = false;
      await flushMicrotasks();

      expect(exposedInputs).toEqual([null]);
    });

    it('does not let the inputs of deactivated radios block the form', async () => {
      const { App, visible, handleSubmit } = createApp(() => ({}));
      const { user } = await render(<App />);

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).not.toHaveBeenCalled();

      visible.value = false;
      await flushMicrotasks();
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('exposes and focuses the first radio when the radios activate', async () => {
      const { App, visible, group } = createApp(() => ({}));
      const { user } = await render(<App />);
      const inputA = getInput('a');

      visible.value = false;
      await flushMicrotasks();
      visible.value = true;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(inputA);

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(screen.getByTestId('a')).toHaveFocus();
    });

    it('does not give the group the input of a radio that is deactivated when the value changes', async () => {
      const value = shallowRef('a');
      const { App, visible, group } = createApp(() => ({ modelValue: value.value }));
      await render(<App />);
      const inputA = getInput('a');
      const inputB = getInput('b');

      expect(group.value?.inputElement).toBe(inputA);

      visible.value = false;
      await flushMicrotasks();

      value.value = 'b';
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(null);

      visible.value = true;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(inputB);
    });

    it.each([
      { name: 'b after a', before: false, first: 'a' },
      { name: 'b before a', before: true, first: 'b' },
    ])('keeps a radio that mounts while held out of the form: $name', async ({ before, first }) => {
      const group = shallowRef<RadioGroupInstance | null>(null);
      const handleSubmit = vi.fn();
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
        () => <Radio.Root key="b" value="b" data-testid="b" />,
        {
          renderBranch: (part) => (
            <>
              {before ? part : null}
              <Radio.Root key="a" value="a" data-testid="a" />
              {before ? null : part}
            </>
          ),
        },
      );
      const App = defineComponent(() => () => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruit">
            <RadioGroup ref={group} required>
              <HeldBranch />
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      const { user } = await render(<App />);

      await mountWhileHeld();

      expect(group.value?.inputElement).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);

      await show();

      expect(group.value?.inputElement).toBe(getInput(first));

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(first)).toHaveFocus();
    });

    // A radio that mounts in a held group registers its input, because the group is held too.
    it('focuses the first radio when KeepAlive shows a held group', async () => {
      const handleSubmit = vi.fn();
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
        () => <Radio.Root key="b" value="b" data-testid="b" />,
        {
          renderBranch: (part) => (
            <RadioGroup required>
              <Radio.Root key="a" value="a" data-testid="a" />
              {part}
            </RadioGroup>
          ),
        },
      );
      const App = defineComponent(() => () => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruit">
            <HeldBranch />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      const { user } = await render(<App />);

      await mountWhileHeld();
      await show();
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('a')).toHaveFocus();
    });

    it('keeps inputElement null when a radio mounts in a held branch after the exposed radio unmounted', async () => {
      const showFirst = shallowRef(true);
      const group = shallowRef<RadioGroupInstance | null>(null);
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <Radio.Root value="c" data-testid="c" />
      ));
      await render(() => (
        <RadioGroup ref={group}>
          {showFirst.value ? <Radio.Root key="a" value="a" data-testid="a" /> : null}
          <Radio.Root key="b" value="b" data-testid="b" />
          <HeldBranch />
        </RadioGroup>
      ));

      expect(group.value?.inputElement).toBe(getInput('a'));

      showFirst.value = false;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(null);

      await mountWhileHeld();

      expect(group.value?.inputElement).toBe(null);

      await show();

      expect(group.value?.inputElement).toBe(getInput('b'));
    });
  });

  describe('VUE-81: the state that the input got before the hydration', () => {
    async function hydratePressed(
      props: Record<string, unknown>,
      change: (serverContainer: HTMLElement) => void,
    ) {
      const serverHtml = await renderOnServer(BEFORE_HYDRATION_FIXTURE, props);
      const { container } = await hydrateAfter(RadioGroupBeforeHydration, {
        serverHtml,
        props,
        before: change,
      });
      await flushMicrotasks();
      return within(container);
    }

    function pressLabel(testId: string) {
      return (serverContainer: HTMLElement) => {
        within(serverContainer).getByTestId(testId).click();
      };
    }

    function getCheckedStates(fixture: ReturnType<typeof within>) {
      return ['a', 'b', 'c'].map((value) => ({
        input: (fixture.getByTestId(value).nextElementSibling as HTMLInputElement).checked,
        radio: fixture.getByTestId(value).getAttribute('aria-checked'),
      }));
    }

    it('takes the pressed radio of a named controlled group', async () => {
      const fixture = await hydratePressed(
        { mode: 'model', named: true, value: 'a' },
        pressLabel('label-c'),
      );

      expect(fixture.getByTestId('model').textContent).toBe('c');
      expect(fixture.getByTestId('changes').textContent).toBe('c (vase-ui)');
      expect(getCheckedStates(fixture)).toEqual([
        { input: false, radio: 'false' },
        { input: false, radio: 'false' },
        { input: true, radio: 'true' },
      ]);
    });

    it('VUE-81: takes an unnamed radio pressed before the previously selected one in document order', async () => {
      const fixture = await hydratePressed({ value: 'c' }, pressLabel('label-a'));

      expect(fixture.getByTestId('changes').textContent).toBe('a (vase-ui)');
      expect(getCheckedStates(fixture)).toEqual([
        { input: true, radio: 'true' },
        { input: false, radio: 'false' },
        { input: false, radio: 'false' },
      ]);
    });

    it('keeps the value of a parent that keeps it', async () => {
      const fixture = await hydratePressed(
        { mode: 'keeps', named: true, value: 'a' },
        pressLabel('label-c'),
      );

      expect(fixture.getByTestId('changes').textContent).toBe('c (vase-ui)');
      expect(getCheckedStates(fixture)).toEqual([
        { input: true, radio: 'true' },
        { input: false, radio: 'false' },
        { input: false, radio: 'false' },
      ]);
    });

    it('takes the pressed radio with a changed text control between', async () => {
      const fixture = await hydratePressed(
        { mode: 'model', named: true, value: 'a', textBetween: true },
        (serverContainer) => {
          within(serverContainer).getByTestId<HTMLInputElement>('text').value = 'hello';
          within(serverContainer).getByTestId('label-c').click();
        },
      );

      expect(fixture.getByTestId('model').textContent).toBe('c');
      expect(fixture.getByTestId('text-model').textContent).toBe('hello');
      expect(fixture.getByTestId('changes').textContent).toBe('c (vase-ui)');
      expect(getCheckedStates(fixture)[2]).toEqual({ input: true, radio: 'true' });
    });

    it('marks its field dirty after a press before the hydration', async () => {
      const fixture = await hydratePressed({ mode: 'field', value: 'a' }, pressLabel('label-b'));
      expect(fixture.getByTestId('field')).toHaveAttribute('data-dirty', '');

      await fireEvent.click(fixture.getByTestId('a'));

      expect(fixture.getByTestId('a')).toHaveAttribute('aria-checked', 'true');
      expect(fixture.getByTestId('field')).not.toHaveAttribute('data-dirty');
    });

    it.each([
      { name: 'read-only', props: { readOnly: true } },
      { name: 'disabled', props: { disabled: true } },
    ])('takes nothing while it is $name', async ({ props }) => {
      const fixture = await hydratePressed(
        { named: true, value: 'a', ...props },
        (serverContainer) => {
          (
            within(serverContainer).getByTestId('c').nextElementSibling as HTMLInputElement
          ).checked = true;
        },
      );

      expect(fixture.getByTestId('changes').textContent).toBe('');
      expect(getCheckedStates(fixture)).toEqual([
        { input: true, radio: 'true' },
        { input: false, radio: 'false' },
        { input: false, radio: 'false' },
      ]);
    });

    it('keeps a client state that differs from the server HTML', async () => {
      const serverHtml = await renderOnServer(BEFORE_HYDRATION_FIXTURE, {
        named: true,
        value: 'a',
      });
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      // The client props differ from the server props, so `hydrateAfter` would throw on the
      // mismatch. Vue does not write `checked` when it hydrates.
      const app = createSSRApp(RadioGroupBeforeHydration, { named: true, value: 'b' });
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);
      await flushMicrotasks();

      // Vue does not correct the attributes of a mismatch, so the case reads the inputs.
      const fixture = within(container);
      expect(getCheckedStates(fixture).map(({ input }) => input)).toEqual([false, true, false]);
      expect(fixture.getByTestId('changes').textContent).toBe('');
      // Vue writes `Hydration completed but contains mismatches.` one time for each page, so only the
      // first mismatch of a test file has it.
      const messages = takeReportedMessages().filter(
        (message) => message !== 'console.error: Hydration completed but contains mismatches.',
      );
      expect(messages).toEqual([
        expect.stringMatching(
          /^console\.warn: .*Hydration attribute mismatch[\s\S]*server: checked/,
        ),
        expect.stringMatching(
          /^console\.warn: .*Hydration attribute mismatch[\s\S]*client: checked/,
        ),
        expect.stringMatching(/^console\.warn: .*Hydration text content mismatch/),
      ]);
    });
  });

  describe('VUE-81: the form state that the browser restores', () => {
    it('takes the checked input at a `pageshow` event', async () => {
      const { container } = await render(
        <RadioGroupBeforeHydration mode="model" named value="a" />,
      );
      const fixture = within(container);
      (fixture.getByTestId('c').nextElementSibling as HTMLInputElement).checked = true;

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(fixture.getByTestId('model').textContent).toBe('c');
      expect(fixture.getByTestId('changes').textContent).toBe('c (pageshow)');
      expect(fixture.getByTestId('c')).toHaveAttribute('aria-checked', 'true');
    });

    it('takes the checked input at the activation after a page show while KeepAlive held the group', async () => {
      const showPage = mockPageBeforeLoad();
      const { HeldBranch, hide, show } = createHeldBranch(
        () => <RadioGroupBeforeHydration mode="model" named value="a" />,
        { mounted: true },
      );
      const { container } = await render(<HeldBranch />);
      const fixture = within(container);
      (fixture.getByTestId('c').nextElementSibling as HTMLInputElement).checked = true;

      await hide();
      showPage();
      await show();
      await flushMicrotasks();

      expect(fixture.getByTestId('model').textContent).toBe('c');
      expect(fixture.getByTestId('changes').textContent).toBe('c (vase-ui)');
      expect(fixture.getByTestId('c')).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('VUE-78: the first radio in the document', () => {
    it('exposes and focuses a radio that mounts before the other radios', async () => {
      const extra = shallowRef(false);
      const group = shallowRef<RadioGroupInstance | null>(null);
      const handleSubmit = vi.fn();
      const App = defineComponent(() => () => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruit">
            <RadioGroup ref={group} required>
              {extra.value ? <Radio.Root key="b" value="b" data-testid="b" /> : null}
              <Radio.Root key="a" value="a" data-testid="a" />
              <Radio.Root key="c" value="c" data-testid="c" />
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      const { user } = await render(<App />);

      extra.value = true;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(getInput('b'));

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('b')).toHaveFocus();
    });

    it('updates a computed of inputElement when a radio mounts before the other radios', async () => {
      const extra = shallowRef(false);
      const group = shallowRef<RadioGroupInstance | null>(null);
      const exposedInput = computed(() => group.value?.inputElement);
      await render(() => (
        <RadioGroup ref={group}>
          {extra.value ? <Radio.Root key="b" value="b" data-testid="b" /> : null}
          <Radio.Root key="a" value="a" data-testid="a" />
        </RadioGroup>
      ));

      expect(exposedInput.value).toBe(getInput('a'));

      extra.value = true;
      await flushMicrotasks();

      expect(exposedInput.value).toBe(getInput('b'));
    });

    it('exposes and focuses the first radio after a keyed move', async () => {
      const order = shallowRef(['a', 'b']);
      const group = shallowRef<RadioGroupInstance | null>(null);
      const handleSubmit = vi.fn();
      const App = defineComponent(() => () => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruit">
            <RadioGroup ref={group} required>
              {order.value.map((value) => (
                <Radio.Root key={value} value={value} data-testid={value} />
              ))}
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      const { user } = await render(<App />);

      expect(group.value?.inputElement).toBe(getInput('a'));

      order.value = ['b', 'a'];
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(getInput('b'));

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('b')).toHaveFocus();
    });

    it.each([
      { name: 'keeps the first radio when another radio', removed: 'a', exposed: 'b' },
      { name: 'gives null when the first radio', removed: 'b', exposed: null },
    ])('$name unmounts after a keyed move', async ({ removed, exposed }) => {
      const order = shallowRef(['a', 'b']);
      const group = shallowRef<RadioGroupInstance | null>(null);
      await render(() => (
        <RadioGroup ref={group}>
          {order.value.map((value) => (
            <Radio.Root key={value} value={value} data-testid={value} />
          ))}
        </RadioGroup>
      ));
      order.value = ['b', 'a'];
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(getInput('b'));

      order.value = ['b', 'a'].filter((value) => value !== removed);
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(exposed === null ? null : getInput(exposed));
    });

    it('focuses a radio of a branch that KeepAlive shows before a radio outside it', async () => {
      const visible = shallowRef(true);
      const handleSubmit = vi.fn();
      const Radios = defineComponent(() => () => (
        <>
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </>
      ));
      const App = defineComponent(() => () => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruit">
            <RadioGroup required>
              <KeepAlive>{visible.value ? <Radios /> : <Placeholder />}</KeepAlive>
              <Radio.Root value="x" data-testid="x" />
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      const { user } = await render(<App />);

      visible.value = false;
      await flushMicrotasks();
      visible.value = true;
      await flushMicrotasks();
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('a')).toHaveFocus();
    });

    it('exposes the first enabled input when the value becomes null', async () => {
      const extra = shallowRef(false);
      const value = shallowRef<string | null>('a');
      const group = shallowRef<RadioGroupInstance | null>(null);
      const App = defineComponent(() => () => (
        <RadioGroup ref={group} modelValue={value.value}>
          {extra.value ? <Radio.Root key="b" value="b" data-testid="b" /> : null}
          <Radio.Root key="a" value="a" data-testid="a" />
        </RadioGroup>
      ));
      await render(<App />);

      extra.value = true;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(getInput('a'));

      value.value = null;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(getInput('b'));
    });

    it('focuses the first radio for an error of the form', async () => {
      const extra = shallowRef(false);
      const errors = shallowRef<Form.Props['errors']>({});
      const App = defineComponent(() => () => (
        <Form
          errors={errors.value}
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault();
            errors.value = { fruit: 'server error' };
          }}
        >
          <Field.Root name="fruit">
            <RadioGroup>
              {extra.value ? <Radio.Root key="b" value="b" data-testid="b" /> : null}
              <Radio.Root key="a" value="a" data-testid="a" />
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      const { user } = await render(<App />);

      extra.value = true;
      await flushMicrotasks();
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await flushMicrotasks();

      expect(screen.getByTestId('b')).toHaveFocus();
    });
  });

  describe('VUE-101: the input of a disabled radio', () => {
    it.each<{
      name: string;
      value: string | undefined;
      group: boolean;
      radios: string[];
      expected: string | null;
    }>([
      { name: 'the checked radio', value: 'b', group: false, radios: ['b'], expected: 'a' },
      { name: 'each radio', value: undefined, group: false, radios: ['a', 'b'], expected: null },
      {
        name: 'the group with no value',
        value: undefined,
        group: true,
        radios: [],
        expected: null,
      },
      { name: 'the group with a value', value: 'b', group: true, radios: [], expected: null },
    ])(
      'gives the input of a group that mounts disabled when $name becomes disabled',
      async ({ value, group, radios, expected }) => {
        const disabled = shallowRef(false);
        const changedGroup = shallowRef<RadioGroupInstance | null>(null);
        const mountedGroup = shallowRef<RadioGroupInstance | null>(null);
        const renderGroup = (
          groupRef: typeof changedGroup,
          prefix: string,
          isDisabled: boolean,
        ) => (
          <RadioGroup ref={groupRef} defaultValue={value} disabled={group && isDisabled}>
            {['a', 'b'].map((radio) => (
              <Radio.Root
                key={radio}
                value={radio}
                data-testid={`${prefix}-${radio}`}
                disabled={isDisabled && radios.includes(radio)}
              />
            ))}
          </RadioGroup>
        );
        await render(() => (
          <>
            {renderGroup(changedGroup, 'changed', disabled.value)}
            {renderGroup(mountedGroup, 'mounted', true)}
          </>
        ));
        const expectedInput = (prefix: string) =>
          expected === null ? null : getInput(`${prefix}-${expected}`);

        expect(changedGroup.value?.inputElement).toBe(getInput(`changed-${value ?? 'a'}`));

        disabled.value = true;
        await flushMicrotasks();

        expect(mountedGroup.value?.inputElement).toBe(expectedInput('mounted'));
        expect(changedGroup.value?.inputElement).toBe(expectedInput('changed'));
      },
    );

    it('updates a computed of inputElement when the checked radio becomes disabled', async () => {
      const disabled = shallowRef(false);
      const group = shallowRef<RadioGroupInstance | null>(null);
      const exposedInput = computed(() => group.value?.inputElement);
      await render(() => (
        <RadioGroup ref={group} defaultValue="b">
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" disabled={disabled.value} />
        </RadioGroup>
      ));

      expect(exposedInput.value).toBe(getInput('b'));

      disabled.value = true;
      await flushMicrotasks();

      expect(exposedInput.value).toBe(getInput('a'));
    });

    it('focuses an enabled radio through inputElement after the checked radio becomes disabled', async () => {
      const disabled = shallowRef(false);
      const group = shallowRef<RadioGroupInstance | null>(null);
      await render(() => (
        <RadioGroup ref={group} defaultValue="b">
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" disabled={disabled.value} />
        </RadioGroup>
      ));

      disabled.value = true;
      await flushMicrotasks();

      expect(screen.getByTestId('a')).not.toHaveFocus();

      group.value?.inputElement?.focus();

      expect(screen.getByTestId('a')).toHaveFocus();
    });

    it.each<{
      name: string;
      value: string | undefined;
      expected: string | null;
      layout: (group: (children: VNodeChild) => VNode) => VNode;
    }>([
      {
        name: 'the fieldset holds the group',
        value: 'b',
        expected: null,
        layout: (group) => (
          <fieldset disabled>
            {group([
              <Radio.Root value="a" data-testid="a" />,
              <Radio.Root value="b" data-testid="b" />,
            ])}
          </fieldset>
        ),
      },
      {
        name: 'the fieldset holds the checked radio',
        value: 'b',
        expected: 'a',
        layout: (group) =>
          group([
            <Radio.Root value="a" data-testid="a" />,
            <fieldset disabled>
              <Radio.Root value="b" data-testid="b" />
            </fieldset>,
          ]),
      },
      {
        name: 'the fieldset holds the first radio',
        value: undefined,
        expected: 'b',
        layout: (group) =>
          group([
            <fieldset disabled>
              <Radio.Root value="a" data-testid="a" />
            </fieldset>,
            <Radio.Root value="b" data-testid="b" />,
          ]),
      },
      {
        name: 'the legend holds the first radio',
        value: 'b',
        expected: 'a',
        layout: (group) =>
          group(
            <fieldset disabled>
              <legend>
                <Radio.Root value="a" data-testid="a" />
              </legend>
              <Radio.Root value="b" data-testid="b" />
            </fieldset>,
          ),
      },
    ])(
      'skips an input that a disabled fieldset disables when $name',
      async ({ value, expected, layout }) => {
        const group = shallowRef<RadioGroupInstance | null>(null);
        await render(() =>
          layout((children) => (
            <RadioGroup ref={group} defaultValue={value}>
              {children}
            </RadioGroup>
          )),
        );

        expect(group.value?.inputElement).toBe(expected === null ? null : getInput(expected));
      },
    );

    it('focuses an enabled radio through inputElement when a disabled fieldset holds the checked radio', async () => {
      const group = shallowRef<RadioGroupInstance | null>(null);
      await render(() => (
        <RadioGroup ref={group} defaultValue="b">
          <Radio.Root value="a" data-testid="a" />
          <fieldset disabled>
            <Radio.Root value="b" data-testid="b" />
          </fieldset>
        </RadioGroup>
      ));

      expect(screen.getByTestId('a')).not.toHaveFocus();

      group.value?.inputElement?.focus();

      expect(screen.getByTestId('a')).toHaveFocus();
    });

    it('gives the first input after a fieldset is enabled when a radio unmounted while it was disabled', async () => {
      const disabled = shallowRef(true);
      const showLast = shallowRef(true);
      const group = shallowRef<RadioGroupInstance | null>(null);
      await render(() => (
        <fieldset disabled={disabled.value}>
          <RadioGroup ref={group}>
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
            {showLast.value && <Radio.Root value="c" data-testid="c" />}
          </RadioGroup>
        </fieldset>
      ));

      showLast.value = false;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(null);

      disabled.value = false;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(getInput('a'));
    });

    it('gives the first input after a fieldset is enabled when the value became null in it after an unmount', async () => {
      const disabled = shallowRef(false);
      const showSecond = shallowRef(true);
      const value = shallowRef<string | null>('b');
      const group = shallowRef<RadioGroupInstance | null>(null);
      await render(() => (
        <fieldset disabled={disabled.value}>
          <RadioGroup ref={group} modelValue={value.value}>
            <Radio.Root value="a" data-testid="a" />
            {showSecond.value && <Radio.Root value="b" data-testid="b" />}
          </RadioGroup>
        </fieldset>
      ));

      expect(group.value?.inputElement).toBe(getInput('b'));

      showSecond.value = false;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(null);

      disabled.value = true;
      value.value = null;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(null);

      disabled.value = false;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(getInput('a'));
    });

    it('gives a radio that mounted in a disabled fieldset after an unmount when the fieldset is enabled', async () => {
      const disabled = shallowRef(false);
      const showFirst = shallowRef(true);
      const group = shallowRef<RadioGroupInstance | null>(null);
      await render(() => (
        <fieldset disabled={disabled.value}>
          <RadioGroup ref={group}>
            {showFirst.value && <Radio.Root value="a" data-testid="a" />}
            <Radio.Root value="b" data-testid="b" />
          </RadioGroup>
        </fieldset>
      ));

      expect(group.value?.inputElement).toBe(getInput('a'));

      showFirst.value = false;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(null);

      // Vue patches the children of an element before its props. In one flush, the radio would thus
      // mount in an enabled fieldset.
      disabled.value = true;
      await flushMicrotasks();
      showFirst.value = true;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(null);

      disabled.value = false;
      await flushMicrotasks();

      expect(group.value?.inputElement).toBe(getInput('a'));
    });
  });

  describe('hydration', () => {
    removedPartHydrationTests({
      file: FIELD_HYDRATION_FIXTURE,
      component: RadioGroupFieldHydration,
      cases: [
        {
          name: 'a removed label',
          props: { defaultValue: 'a', laterRemovedAtMount: true },
          selector: '[data-testid="group"]',
          attribute: 'aria-labelledby',
          serverValue: 'label-a',
          clientValue: null,
        },
        {
          name: 'a removed description',
          props: { defaultValue: 'a', laterRemovedAtMount: true },
          selector: '[data-testid="group"]',
          attribute: 'aria-describedby',
          serverValue: 'desc-a',
          clientValue: null,
        },
      ],
    });

    it('exposes the checked input in an `onMounted` hook of the hydration', async () => {
      const props = { defaultValue: 'b' };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      const mountedInputs: (HTMLInputElement | null)[] = [];

      await hydrate(RadioGroupHydration, {
        serverHtml,
        props: { ...props, onMount: (input: HTMLInputElement | null) => mountedInputs.push(input) },
      });

      // `hydrate` mounts the fixture on the client first, so the last call comes from the hydration.
      expect(mountedInputs.at(-1)).toBe(getInput('b'));
    });
  });

  describe('VUE-112: a disabled fieldset', () => {
    // A radio has no size of its own, and Playwright clicks only an element that has a size.
    const radioStyle = 'display:inline-block;width:20px;height:20px';

    function renderRadio(value: string) {
      return <Radio.Root key={value} value={value} data-testid={value} style={radioStyle} />;
    }

    function isShownDisabled(element: Element) {
      const isAriaDisabled = element.getAttribute('aria-disabled') === 'true';
      expect(element.hasAttribute('data-disabled')).toBe(isAriaDisabled);
      return isAriaDisabled;
    }

    function readDisabled(testIds: string[]) {
      return testIds.map((testId) => isShownDisabled(screen.getByTestId(testId)));
    }

    function renderBetweenButtons(content: VNodeChild) {
      return (
        <>
          <button type="button" data-testid="before">
            before
          </button>
          {content}
          <button type="button" data-testid="after">
            after
          </button>
        </>
      );
    }

    it.each<{ name: string; content: () => VNode; radios: boolean[]; group: boolean }>([
      {
        name: 'the fieldset holds the group',
        content: () => (
          <fieldset disabled>
            <RadioGroup data-testid="group">{['a', 'b', 'c'].map(renderRadio)}</RadioGroup>
          </fieldset>
        ),
        radios: [true, true, true],
        group: true,
      },
      {
        name: 'the fieldset holds one radio',
        content: () => (
          <RadioGroup data-testid="group">
            {renderRadio('a')}
            <fieldset disabled>{renderRadio('b')}</fieldset>
            {renderRadio('c')}
          </RadioGroup>
        ),
        radios: [false, true, false],
        group: false,
      },
      {
        name: 'the first legend holds a radio',
        content: () => (
          <RadioGroup data-testid="group">
            <fieldset disabled>
              <legend>{renderRadio('a')}</legend>
              {renderRadio('b')}
            </fieldset>
            {renderRadio('c')}
          </RadioGroup>
        ),
        radios: [false, true, false],
        group: false,
      },
      {
        name: 'an outer fieldset is disabled',
        content: () => (
          <fieldset disabled>
            <fieldset>
              <RadioGroup data-testid="group">{['a', 'b', 'c'].map(renderRadio)}</RadioGroup>
            </fieldset>
          </fieldset>
        ),
        radios: [true, true, true],
        group: true,
      },
      {
        name: 'Fieldset.Root has no Field.Root',
        content: () => (
          <Fieldset.Root disabled>
            <RadioGroup data-testid="group">{['a', 'b', 'c'].map(renderRadio)}</RadioGroup>
          </Fieldset.Root>
        ),
        radios: [true, true, true],
        group: true,
      },
    ])('shows the disabled state when $name', async ({ content, radios, group }) => {
      await render(() => content());

      expect(readDisabled(['a', 'b', 'c'])).toEqual(radios);
      expect(readDisabled(['group'])).toEqual([group]);
    });

    it('keeps the value when the user presses or selects a radio in a disabled fieldset', async () => {
      const handleValueChange = vi.fn();
      await render(() => (
        <fieldset disabled>
          <RadioGroup onValueChange={handleValueChange}>
            {['a', 'b', 'c'].map(renderRadio)}
          </RadioGroup>
        </fieldset>
      ));

      await userEvent.click(screen.getByTestId('a'), { force: true });
      screen.getByTestId('b').focus();
      expect(screen.getByTestId('b')).toHaveFocus();
      await userEvent.keyboard(' ');
      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('a')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByTestId('b')).toHaveAttribute('aria-checked', 'false');
    });

    it('takes the group out of the tab order when a disabled fieldset holds it', async () => {
      await render(() =>
        renderBetweenButtons(
          <fieldset disabled>
            <RadioGroup defaultValue="b">{['a', 'b', 'c'].map(renderRadio)}</RadioGroup>
          </fieldset>,
        ),
      );

      screen.getByTestId('before').focus();
      await userEvent.keyboard('{Tab}');

      expect(screen.getByTestId('after')).toHaveFocus();
    });

    it('keeps the tab stop on the checked radio when a disabled fieldset holds it', async () => {
      await render(() =>
        renderBetweenButtons(
          <RadioGroup defaultValue="b">
            {renderRadio('a')}
            <fieldset disabled>{renderRadio('b')}</fieldset>
            {renderRadio('c')}
          </RadioGroup>,
        ),
      );

      screen.getByTestId('before').focus();
      await userEvent.keyboard('{Tab}');

      expect(screen.getByTestId('b')).toHaveFocus();
    });

    it('skips a radio in a disabled fieldset with the arrow keys', async () => {
      await render(() => (
        <RadioGroup defaultValue="a">
          {renderRadio('a')}
          <fieldset disabled>{renderRadio('b')}</fieldset>
          {renderRadio('c')}
        </RadioGroup>
      ));

      screen.getByTestId('a').focus();
      await userEvent.keyboard('{ArrowDown}');

      expect(screen.getByTestId('c')).toHaveFocus();
      expect(screen.getByTestId('c')).toHaveAttribute('aria-checked', 'true');
    });

    it('follows a fieldset that becomes disabled and then enabled', async () => {
      const disabled = shallowRef(false);
      const handleValueChange = vi.fn();
      await render(() => (
        <fieldset disabled={disabled.value}>
          <RadioGroup data-testid="group" onValueChange={handleValueChange}>
            {['a', 'b'].map(renderRadio)}
          </RadioGroup>
        </fieldset>
      ));

      disabled.value = true;
      await flushMicrotasks();

      expect(readDisabled(['group', 'a', 'b'])).toEqual([true, true, true]);

      disabled.value = false;
      await flushMicrotasks();

      expect(readDisabled(['group', 'a', 'b'])).toEqual([false, false, false]);

      await userEvent.click(screen.getByTestId('a'));

      expect(handleValueChange).toHaveBeenCalledTimes(1);
    });

    it('follows a move of the group into a disabled fieldset', async () => {
      const outside = document.createElement('div');
      document.body.append(outside);
      onTestFinished(() => outside.remove());
      const inFieldset = shallowRef(false);
      await render(() => (
        <fieldset disabled>
          <Teleport to={outside} disabled={inFieldset.value}>
            <RadioGroup data-testid="group">{renderRadio('a')}</RadioGroup>
          </Teleport>
        </fieldset>
      ));

      expect(readDisabled(['group', 'a'])).toEqual([false, false]);

      inFieldset.value = true;
      await flushMicrotasks();

      expect(readDisabled(['group', 'a'])).toEqual([true, true]);
    });

    it('follows a disabled fieldset in a shadow root', async () => {
      const host = document.createElement('div');
      const container = document.createElement('div');
      host.attachShadow({ mode: 'open' }).append(container);
      document.body.append(host);
      onTestFinished(() => host.remove());
      const disabled = shallowRef(false);
      await render(() => (
        <Teleport to={container}>
          <fieldset disabled={disabled.value}>
            <RadioGroup data-testid="group">{renderRadio('a')}</RadioGroup>
          </fieldset>
        </Teleport>
      ));

      disabled.value = true;
      await flushMicrotasks();

      expect(within(container).getByTestId('group')).toHaveAttribute('aria-disabled', 'true');
      expect(within(container).getByTestId('a')).toHaveAttribute('aria-disabled', 'true');
    });

    it('follows a fieldset in a shadow root after a move into that shadow root', async () => {
      const host = document.createElement('div');
      const fieldset = document.createElement('fieldset');
      host.attachShadow({ mode: 'open' }).append(fieldset);
      document.body.append(host);
      onTestFinished(() => host.remove());
      const inShadowRoot = shallowRef(false);
      await render(() => (
        <Teleport to={fieldset} disabled={!inShadowRoot.value}>
          <RadioGroup data-testid="group">{renderRadio('a')}</RadioGroup>
        </Teleport>
      ));

      inShadowRoot.value = true;
      await flushMicrotasks();
      fieldset.disabled = true;
      await flushMicrotasks();

      expect(within(fieldset).getByTestId('group')).toHaveAttribute('aria-disabled', 'true');
      expect(within(fieldset).getByTestId('a')).toHaveAttribute('aria-disabled', 'true');
    });

    it('follows a fieldset around a group that mounted while KeepAlive held it', async () => {
      const disabled = shallowRef(false);
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <RadioGroup data-testid="group">{renderRadio('a')}</RadioGroup>
      ));
      await render(() => (
        <fieldset disabled={disabled.value}>
          <HeldBranch />
        </fieldset>
      ));

      await mountWhileHeld();
      await show();
      disabled.value = true;
      await flushMicrotasks();

      expect(readDisabled(['group', 'a'])).toEqual([true, true]);
    });

    it('keeps the disabled state of a group while KeepAlive holds it', async () => {
      const disabled = shallowRef(true);
      const { HeldBranch, hide, show } = createHeldBranch(
        () => <RadioGroup data-testid="group">{renderRadio('a')}</RadioGroup>,
        { mounted: true },
      );
      await render(() => (
        <fieldset disabled={disabled.value}>
          <HeldBranch />
        </fieldset>
      ));
      const heldElements = [screen.getByTestId('group'), screen.getByTestId('a')];

      await hide();

      expect(heldElements.map(isShownDisabled)).toEqual([true, true]);

      disabled.value = false;
      await show();

      expect(readDisabled(['group', 'a'])).toEqual([false, false]);
    });

    it('leaves a group in a disabled fieldset out of the form values', async () => {
      const handleSubmit = vi.fn();
      await render(() => (
        <Form onFormSubmit={handleSubmit} data-testid="form">
          <fieldset disabled>
            <Field.Root name="choice">
              <RadioGroup defaultValue="a">{['a', 'b'].map(renderRadio)}</RadioGroup>
            </Field.Root>
          </fieldset>
          <button type="submit">Submit</button>
        </Form>
      ));

      expect(new FormData(screen.getByTestId('form') as HTMLFormElement).getAll('choice')).toEqual(
        [],
      );

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls[0]?.[0]).toEqual({});
    });
  });

  describe('VUE-113: the tab stop of a radio that becomes disabled', () => {
    function renderGroup(
      disabled: () => string[],
      options: { defaultValue?: string; nativeButton?: boolean } = {},
    ) {
      return defineComponent(() => () => (
        <div>
          <button type="button" data-testid="before" />
          <RadioGroup defaultValue={options.defaultValue}>
            {['a', 'b', 'c'].map((value) => (
              <Radio.Root
                key={value}
                value={value}
                nativeButton={options.nativeButton}
                as={options.nativeButton ? 'button' : undefined}
                data-testid={value}
                disabled={disabled().includes(value)}
              />
            ))}
          </RadioGroup>
          <button type="button" data-testid="after" />
        </div>
      ));
    }

    it('moves the tab stop off a radio that becomes disabled in a group with no value', async () => {
      const disabled = shallowRef<string[]>([]);
      const Group = renderGroup(() => disabled.value);
      await render(<Group />);

      disabled.value = ['a'];
      await flushMicrotasks();
      screen.getByTestId('before').focus();
      await userEvent.keyboard('{Tab}');

      expect(screen.getByTestId('b')).toHaveFocus();
    });

    it('moves the tab stop off a radio that a disabled fieldset holds in a group with no value', async () => {
      await render(() => (
        <div>
          <button type="button" data-testid="before" />
          <RadioGroup>
            <fieldset disabled>
              <Radio.Root value="a" data-testid="a" />
            </fieldset>
            <Radio.Root value="b" data-testid="b" />
            <Radio.Root value="c" data-testid="c" />
          </RadioGroup>
        </div>
      ));

      screen.getByTestId('before').focus();
      await userEvent.keyboard('{Tab}');

      expect(screen.getByTestId('b')).toHaveFocus();
    });

    it('moves the tab stop off a radio that becomes disabled while it has the focus', async () => {
      const disabled = shallowRef<string[]>([]);
      const Group = renderGroup(() => disabled.value);
      await render(<Group />);
      screen.getByTestId('before').focus();
      await userEvent.keyboard('{Tab}');
      expect(screen.getByTestId('a')).toHaveFocus();

      disabled.value = ['a'];
      await flushMicrotasks();
      await userEvent.keyboard('{Tab}');
      expect(screen.getByTestId('after')).toHaveFocus();
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');

      expect(screen.getByTestId('b')).toHaveFocus();
    });

    // A disabled native button cannot get focus, so the checked radio does not keep the tab stop.
    it.each([
      { name: 'is disabled at the mount', disabledAtMount: true },
      { name: 'becomes disabled', disabledAtMount: false },
    ])(
      'moves the tab stop off a checked native button radio that $name',
      async ({ disabledAtMount }) => {
        const disabled = shallowRef<string[]>(disabledAtMount ? ['b'] : []);
        const Group = renderGroup(() => disabled.value, { defaultValue: 'b', nativeButton: true });
        await render(<Group />);

        disabled.value = ['b'];
        await flushMicrotasks();
        screen.getByTestId('before').focus();
        await userEvent.keyboard('{Tab}');

        expect(screen.getByTestId('a')).toHaveFocus();
      },
    );
  });
});
