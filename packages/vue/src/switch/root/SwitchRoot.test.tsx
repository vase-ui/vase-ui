import { afterEach, beforeEach, expect, vi, describe, it, onTestFinished } from 'vitest';
import { KeepAlive, createSSRApp, defineComponent, h, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { Switch } from '@vase-ui/vue/switch';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import FormScope from '../../../test/fixtures/FormScope.vue';
import SwitchRootHydration from './SwitchRootHydration.test.vue';

type User = VaseUIRenderResult['user'];

function createFormDataSpy(name: string) {
  return vi.fn((event: Event) => {
    event.preventDefault();
    return new FormData(event.currentTarget as HTMLFormElement).get(name);
  });
}

// The part follows a reset in a timeout of 0 ms, after the listeners of the event.
// The case that calls this function uses fake timers.
async function settleReset() {
  vi.advanceTimersByTime(0);
  await flushMicrotasks();
}

describe('<Switch.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Switch.Root />, () => ({
    refInstanceof: window.HTMLSpanElement,
    testRenderPropWith: 'span',
    button: true,
    render,
  }));

  describe('hidden input size', () => {
    it('grows from zero size to an on-screen 1px box when reported invalid', async () => {
      const { container } = await render(<Switch.Root required />);
      const input = container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
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

    it('keeps the 1px size in the next render of the switch', async () => {
      const { container } = await render(<Switch.Root required />);
      const input = container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
      input.reportValidity();

      await fireEvent.click(screen.getByRole('switch'));

      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
      const { width, height } = input.getBoundingClientRect();
      expect({ width, height }).toEqual({ width: 1, height: 1 });
    });
  });

  describe('interactions', () => {
    it('tolerates imperative interaction in its ref callback before the hidden input mounts', async () => {
      let inputAtCall: Element | null | undefined;
      let calls = 0;
      const App = defineComponent(() => {
        return () => (
          <Switch.Root
            v-slots={{
              render: ({ props }: { props: Record<string, any> }) => (
                <span
                  {...props}
                  ref={(element: any) => {
                    props.ref(element);
                    if (element && calls === 0) {
                      calls += 1;
                      inputAtCall = element.parentElement.querySelector('input');
                      element.focus();
                      element.blur();
                      element.click();
                    }
                  }}
                />
              ),
            }}
          />
        );
      });
      await render(<App />);
      expect(inputAtCall).toBe(null);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });

    it('should change its state when clicked', async () => {
      await render(<Switch.Root />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      switchElement.click();
      await flushMicrotasks();

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should update its state when changed from outside', async () => {
      const Test = defineComponent(() => {
        const checked = shallowRef(false);
        return () => (
          <div>
            <button
              onClick={() => {
                checked.value = !checked.value;
              }}
            >
              Toggle
            </button>
            <Switch.Root checked={checked.value} />;
          </div>
        );
      });

      await render(<Test />);
      const switchElement = screen.getByRole('switch');
      const button = screen.getByText('Toggle');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      button.click();
      await flushMicrotasks();

      expect(switchElement).toHaveAttribute('aria-checked', 'true');

      button.click();
      await flushMicrotasks();

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it('should update its state if the underlying input is toggled', async () => {
      await render(<Switch.Root />);
      const switchElement = screen.getByRole('switch');
      const internalInput = screen.getByRole('checkbox', { hidden: true });

      internalInput.click();
      await flushMicrotasks();

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('ignores a hidden input click canceled before React handles it', async () => {
      const handleCheckedChange = vi.fn();
      await render(<Switch.Root onCheckedChange={handleCheckedChange} />);

      const switchElement = screen.getByRole('switch');
      const input = screen.getByRole('checkbox', { hidden: true });
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      event.preventDefault();

      await fireEvent(input, event);

      expect(handleCheckedChange).not.toHaveBeenCalled();
      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it.each([{ key: 'Enter' }, { key: 'Space' }])(
      'can be activated with $key key',
      async ({ key }) => {
        const { user } = await render(<Switch.Root />);

        const switchEl = screen.getByRole('switch');
        expect(switchEl).toHaveAttribute('aria-checked', 'false');

        await user.keyboard('[Tab]');
        expect(switchEl).toHaveFocus();

        await user.keyboard(`[${key}]`);
        expect(switchEl).toHaveAttribute('aria-checked', 'true');
      },
    );
  });

  describe('extra props', () => {
    it('should override the built-in attributes', async () => {
      await render(<Switch.Root role="checkbox" data-testid="switch" />);
      expect(screen.getByTestId('switch')).toHaveAttribute('role', 'checkbox');
    });

    it('sets `aria-labelledby` from a sibling label associated with the hidden input', async () => {
      await render(
        <div>
          <label for="switch-input">Label</label>
          <Switch.Root id="switch-input" />
        </div>,
      );

      const label = screen.getByText('Label');
      expect(label.id).not.toBe('');
      expect(screen.getByRole('switch')).toHaveAttribute('aria-labelledby', label.id);
    });

    it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
      const TestCase = defineComponent(() => {
        const id = shallowRef('switch-input-a');

        return () => (
          <>
            <label for="switch-input-a">Label A</label>
            <label for="switch-input-b">Label B</label>
            <Switch.Root id={id.value} />
            <button
              type="button"
              onClick={() => {
                id.value = 'switch-input-b';
              }}
            >
              Toggle
            </button>
          </>
        );
      });

      await render(<TestCase />);

      const switchEl = screen.getByRole('switch');
      const labelA = screen.getByText('Label A');

      expect(labelA.id).not.toBe('');
      expect(switchEl).toHaveAttribute('aria-labelledby', labelA.id);

      await fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

      const labelB = screen.getByText('Label B');

      await waitFor(() => {
        expect(switchEl).toHaveAttribute('aria-labelledby', labelB.id);
      });
      expect(labelB.id).not.toBe('');
      expect(labelB.id).not.toBe(labelA.id);
    });

    it('prefers `aria-label` over a native label around the switch', async () => {
      await render(
        <label>
          <Switch.Root aria-label="Wi-Fi" />
          Wi-Fi
        </label>,
      );
      const nativeLabelled = screen.getByRole('switch');
      expect(nativeLabelled).not.toHaveAttribute('aria-labelledby');
      expect(nativeLabelled).toHaveAccessibleName('Wi-Fi');
    });
  });

  describe('prop: onCheckedChange', () => {
    it('should call onCheckedChange when clicked', async () => {
      const handleChange = vi.fn();
      await render(<Switch.Root onCheckedChange={handleChange} />);
      const switchElement = screen.getByRole('switch');

      switchElement.click();
      await flushMicrotasks();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(true);
    });

    it('should report keyboard modifier event properties when calling onCheckedChange', async () => {
      const handleChange = vi.fn((_checked, eventDetails) => eventDetails);
      const { user } = await render(<Switch.Root onCheckedChange={handleChange} />);
      const switchElement = screen.getByRole('switch');

      await user.keyboard('{Shift>}');
      await user.click(switchElement);
      await user.keyboard('{/Shift}');

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.results[0]?.value.event.shiftKey).toBe(true);
    });

    it('does not change state when canceled via a root click', async () => {
      const { user } = await render(
        <Field.Root>
          <Switch.Root
            data-testid="button"
            onCheckedChange={(_checked: boolean, eventDetails: Switch.Root.ChangeEventDetails) =>
              eventDetails.cancel()
            }
          />
        </Field.Root>,
      );

      const switchElement = screen.getByTestId('button');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      await user.click(switchElement);

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
      expect(switchElement).not.toHaveAttribute('data-dirty');
      expect(switchElement).not.toHaveAttribute('data-filled');
    });

    it('does not change state when canceled via a hidden input click', async () => {
      const { user } = await render(
        <Field.Root>
          <Switch.Root
            data-testid="button"
            onCheckedChange={(_checked: boolean, eventDetails: Switch.Root.ChangeEventDetails) =>
              eventDetails.cancel()
            }
          />
        </Field.Root>,
      );

      const switchElement = screen.getByTestId('button');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      await user.click(input);

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
      expect(switchElement).not.toHaveAttribute('data-dirty');
      expect(switchElement).not.toHaveAttribute('data-filled');
    });
  });

  describe('prop: onClick', () => {
    it('should call onClick when clicked', async () => {
      const handleClick = vi.fn();
      await render(<Switch.Root onClick={handleClick} />);
      const switchElement = screen.getByRole('switch');

      switchElement.click();
      await flushMicrotasks();

      expect(handleClick.mock.calls.length).toBe(1);
    });

    it.each([false, true])(
      'propagates a single click event to ancestors per user click (nativeButton=%s)',
      async (nativeButton) => {
        const handleParentClick = vi.fn();
        await render(
          <div onClick={handleParentClick}>
            <Switch.Root nativeButton={nativeButton} as={nativeButton ? 'button' : undefined} />
          </div>,
        );

        await fireEvent.click(screen.getByRole('switch'));

        expect(handleParentClick).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
      },
    );

    it.each([false, true])(
      'does not propagate to ancestors when stopPropagation() is called (nativeButton=%s)',
      async (nativeButton) => {
        const handleParentClick = vi.fn();
        await render(
          <div onClick={handleParentClick}>
            <Switch.Root
              nativeButton={nativeButton}
              as={nativeButton ? 'button' : undefined}
              onClick={(event: MouseEvent) => event.stopPropagation()}
            />
          </div>,
        );

        await fireEvent.click(screen.getByRole('switch'));

        expect(handleParentClick).toHaveBeenCalledTimes(0);
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
      },
    );
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', async () => {
      await render(<Switch.Root disabled />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('disabled');
      expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not have the `disabled` attribute when `disabled` is not set', async () => {
      await render(<Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('disabled');
    });

    it('should not change its state when clicked', async () => {
      await render(<Switch.Root disabled />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      switchElement.click();
      await flushMicrotasks();

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: readOnly', () => {
    it('should have the `aria-readonly` attribute', async () => {
      await render(<Switch.Root readOnly />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-readonly', 'true');
    });

    it('should not have the aria attribute when `readOnly` is not set', async () => {
      await render(<Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('aria-readonly');
    });

    it('should not change its state when clicked', async () => {
      await render(<Switch.Root readOnly />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      switchElement.click();
      await flushMicrotasks();

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it('should not change its state when its label is clicked', async () => {
      await render(
        <label data-testid="label">
          <Switch.Root readOnly />
        </label>,
      );
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      const labelElement = screen.getByTestId('label');

      labelElement.click();
      await flushMicrotasks();

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: required', () => {
    it('should have the `aria-required` attribute', async () => {
      await render(<Switch.Root required />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-required', 'true');
    });

    it('should not have the aria attribute when `required` is not set', async () => {
      await render(<Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('aria-required');
    });
  });

  describe('prop: inputRef', () => {
    it('should be able to access the native input', async () => {
      const instance = shallowRef<any>(null);
      await render(() => <Switch.Root ref={instance} />);
      const internalInput = screen.getByRole('checkbox', { hidden: true });
      expect(instance.value.inputElement).toBe(internalInput);
    });
  });

  it('should place the style hooks on the root and the thumb', async () => {
    const { setProps } = await render(
      <Switch.Root defaultChecked disabled readOnly required>
        <Switch.Thumb data-testid="thumb" />
      </Switch.Root>,
    );

    const switchElement = screen.getByRole('switch');
    const thumb = screen.getByTestId('thumb');

    expect(switchElement).toHaveAttribute('data-checked', '');
    expect(switchElement).toHaveAttribute('data-disabled', '');
    expect(switchElement).toHaveAttribute('data-readonly', '');
    expect(switchElement).toHaveAttribute('data-required', '');

    expect(thumb).toHaveAttribute('data-checked', '');
    expect(thumb).toHaveAttribute('data-disabled', '');
    expect(thumb).toHaveAttribute('data-readonly', '');
    expect(thumb).toHaveAttribute('data-required', '');

    await setProps({ disabled: false, readOnly: false });
    await fireEvent.click(switchElement);

    expect(switchElement).toHaveAttribute('data-unchecked', '');
    expect(switchElement).not.toHaveAttribute('data-checked');

    expect(thumb).toHaveAttribute('data-unchecked', '');
    expect(thumb).not.toHaveAttribute('data-checked');
  });

  it('should set the name attribute only on the input', async () => {
    await render(<Switch.Root name="switch-name" />);

    const switchElement = screen.getByRole('switch');
    const input = screen.getByRole('checkbox', { hidden: true });

    expect(input).toHaveAttribute('name', 'switch-name');
    expect(switchElement).not.toHaveAttribute('name');
  });

  it('should not set the value attribute by default', async () => {
    await render(<Switch.Root />);

    const input = screen.getByRole('checkbox', { hidden: true });

    expect(input).not.toHaveAttribute('value');
  });

  it('should set the value attribute only on the input', async () => {
    await render(<Switch.Root value="1" />);

    const switchElement = screen.getByRole('switch');
    const input = screen.getByRole('checkbox', { hidden: true });

    expect(input).toHaveAttribute('value', '1');
    expect(switchElement).not.toHaveAttribute('value');
  });

  describe('with native <label>', () => {
    it('should toggle the switch when a wrapping <label> is clicked', async () => {
      const { user } = await render(
        <label data-testid="label">
          <Switch.Root />
          Toggle
        </label>,
      );

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await user.click(screen.getByTestId('label'));
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should toggle the switch when a explicitly linked <label> is clicked', async () => {
      const { user } = await render(
        <div>
          <label data-testid="label" for="mySwitch">
            Toggle
          </label>

          <Switch.Root id="mySwitch" />
        </div>,
      );

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await user.click(screen.getByTestId('label'));
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should associate `id` with the native button when `nativeButton=true`', async () => {
      const { user } = await render(
        <div>
          <label data-testid="label" for="mySwitch">
            Toggle
          </label>

          <Switch.Root id="mySwitch" nativeButton as="button" />
        </div>,
      );

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('id', 'mySwitch');

      const hiddenInput = screen.getByRole('checkbox', { hidden: true });
      expect(hiddenInput).not.toHaveAttribute('id', 'mySwitch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      await user.click(screen.getByTestId('label'));
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Form', () => {
    it.skipIf(isJSDOM)(
      'should include the switch value in form submission, matching native checkbox behavior',
      async () => {
        const submitSpy = createFormDataSpy('test-switch');

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-switch">
              <Switch.Root />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const switchElement = screen.getByRole('switch');
        const submitButton = screen.getByRole('button')!;

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe(null);

        await user.click(switchElement);
        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
      },
    );

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      const submitSpy = createFormDataSpy('test-switch');

      const { user } = await render(
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Switch.Root name="test-switch" form="external-form" />
        </>,
      );

      await user.click(screen.getByRole('switch'));
      await user.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
    });

    it.skipIf(isJSDOM)('submits uncheckedValue to an external form when off', async () => {
      const submitSpy = createFormDataSpy('test-switch');

      await render(
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Switch.Root name="test-switch" form="external-form" uncheckedValue="off" />
        </>,
      );

      await fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('off');
    });

    it.skipIf(isJSDOM)('does not submit uncheckedValue when disabled', async () => {
      const submitSpy = createFormDataSpy('test-switch');

      const { user } = await render(
        <form onSubmit={submitSpy}>
          <Switch.Root name="test-switch" uncheckedValue="off" disabled />
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe(null);
    });

    it.skipIf(isJSDOM)('matches native checkbox form submission behavior', async () => {
      const nativeSubmitSpy = vi.fn((event: Event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return {
          get: formData.get('native'),
          getAll: formData.getAll('native'),
        };
      });

      const customSubmitSpy = vi.fn((event: Event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return {
          get: formData.get('custom'),
          getAll: formData.getAll('custom'),
        };
      });

      const { user: nativeUser } = await render(
        <form onSubmit={nativeSubmitSpy}>
          <input type="checkbox" name="native" />
          <button type="submit">Submit</button>
        </form>,
      );

      const nativeCheckbox = screen.getByRole('checkbox');
      const nativeSubmitButton = screen.getByRole('button')!;

      await nativeUser.click(nativeSubmitButton);
      expect(nativeSubmitSpy.mock.results.at(-1)?.value.get).toBe(null);
      expect(nativeSubmitSpy.mock.results.at(-1)?.value.getAll).toEqual([]);

      await nativeUser.click(nativeCheckbox);
      await nativeUser.click(nativeSubmitButton);
      expect(nativeSubmitSpy.mock.results.at(-1)?.value.get).toBe('on');

      const { user: customUser } = await render(
        <Form onSubmit={customSubmitSpy}>
          <Field.Root name="custom">
            <Switch.Root />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const customSwitch = screen.getByRole('switch');
      const customSubmitButton = screen.getAllByRole('button')[1]!;

      await customUser.click(customSubmitButton);
      expect(customSubmitSpy.mock.results.at(-1)?.value.get).toBe(null);
      expect(customSubmitSpy.mock.results.at(-1)?.value.getAll).toEqual([]);

      await customUser.click(customSwitch);
      await customUser.click(customSubmitButton);
      expect(customSubmitSpy.mock.results.at(-1)?.value.get).toBe('on');
    });

    it.skipIf(isJSDOM)(
      'should submit uncheckedValue when switch is off and uncheckedValue is specified',
      async () => {
        const submitSpy = createFormDataSpy('test-switch');

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-switch">
              <Switch.Root uncheckedValue="off" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const switchElement = screen.getByRole('switch');
        const submitButton = screen.getByRole('button')!;

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('off');

        await user.click(switchElement);
        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('on');

        await user.click(switchElement);
        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(3);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('off');
      },
    );

    it.skipIf(isJSDOM)('should submit custom uncheckedValue when switch is off', async () => {
      const submitSpy = createFormDataSpy('test-switch');

      const { user } = await render(
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-switch">
            <Switch.Root uncheckedValue="false" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const switchElement = screen.getByRole('switch');
      const submitButton = screen.getByRole('button')!;

      await user.click(submitButton);

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('false');

      await user.click(switchElement);
      await user.click(submitButton);

      expect(submitSpy.mock.calls.length).toBe(2);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
    });

    it.skipIf(isJSDOM)(
      'submits custom value and uncheckedValue across an off/on/off cycle',
      async () => {
        const submitSpy = createFormDataSpy('test-switch');

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-switch">
              <Switch.Root value="yes" uncheckedValue="no" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const switchElement = screen.getByRole('switch');
        const submitButton = screen.getByRole('button')!;

        await user.click(submitButton);
        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('no');

        await user.click(switchElement);
        await user.click(submitButton);
        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('yes');

        await user.click(switchElement);
        await user.click(submitButton);
        expect(submitSpy.mock.calls.length).toBe(3);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('no');
      },
    );

    it('triggers native HTML validation on submit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="test">
            <Switch.Root name="switch" required />
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

    it('clears external errors on change', async () => {
      await render(
        <Form
          errors={{
            test: 'test',
          }}
        >
          <Field.Root name="test" data-testid="field">
            <Switch.Root data-testid="switch" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      const switchElement = screen.getByTestId('switch');

      expect(switchElement).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('test');

      await fireEvent.click(switchElement);

      expect(switchElement).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });
  });

  describe('Field', () => {
    it('should receive disabled prop from Field.Root', async () => {
      await render(
        <Field.Root disabled>
          <Switch.Root />
        </Field.Root>,
      );

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-disabled');
    });

    it('should receive name prop from Field.Root', async () => {
      await render(
        <Field.Root name="field-switch">
          <Switch.Root />
        </Field.Root>,
      );

      const input = screen.getByRole('checkbox', { hidden: true });
      expect(input).toHaveAttribute('name', 'field-switch');
    });

    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      await fireEvent.focusIn(button);
      await fireEvent.focusOut(button);

      expect(button).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      await render(
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-dirty');

      await fireEvent.click(button);

      expect(button).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when checked after being initially unchecked', async () => {
        await render(
          <Field.Root>
            <Switch.Root data-testid="button" />
          </Field.Root>,
        );

        const button = screen.getByTestId('button');

        expect(button).not.toHaveAttribute('data-filled');

        await fireEvent.click(button);

        expect(button).toHaveAttribute('data-filled', '');

        await fireEvent.click(button);

        expect(button).not.toHaveAttribute('data-filled');
      });

      it('clears [data-filled] when a controlled switch remounts unchecked', async () => {
        const App = defineComponent(() => {
          const unchecked = shallowRef(false);
          return () => (
            <Field.Root data-testid="root">
              <Switch.Root
                key={String(unchecked.value)}
                checked={!unchecked.value}
                onCheckedChange={() => {}}
              />
              <button
                type="button"
                onClick={() => {
                  unchecked.value = true;
                }}
              >
                clear
              </button>
            </Field.Root>
          );
        });

        await render(<App />);

        const root = screen.getByTestId('root');
        expect(root).toHaveAttribute('data-filled', '');

        await fireEvent.click(screen.getByText('clear'));

        expect(root).not.toHaveAttribute('data-filled');
      });

      it('removes [data-filled] attribute when unchecked after being initially checked', async () => {
        await render(
          <Field.Root>
            <Switch.Root data-testid="button" defaultChecked />
          </Field.Root>,
        );

        const button = screen.getByTestId('button');

        expect(button).toHaveAttribute('data-filled');

        await fireEvent.click(button);

        expect(button).not.toHaveAttribute('data-filled', '');
      });
    });

    it('[data-focused]', async () => {
      await render(
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-focused');

      await fireEvent.focusIn(button);

      expect(button).toHaveAttribute('data-focused', '');

      await fireEvent.focusOut(button);

      expect(button).not.toHaveAttribute('data-focused');
    });

    it('does not set [data-focused] when disabled', async () => {
      await render(
        <Field.Root>
          <Switch.Root disabled data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      await fireEvent.focusIn(button);

      expect(button).not.toHaveAttribute('data-focused');
    });

    describe('[data-focused] without a blur event', () => {
      function Switches(props: { firstMounted?: boolean; firstDisabled?: boolean }) {
        const { firstMounted = true, firstDisabled = false } = props;
        return (
          <Field.Root data-testid="root">
            {firstMounted && <Switch.Root data-testid="first" disabled={firstDisabled} />}
          </Field.Root>
        );
      }

      it('is removed when the focused switch becomes disabled', async () => {
        const { setProps } = await render(<Switches />);

        const button = screen.getByTestId('first');
        button.focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
        expect(button).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
        expect(button).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused switch unmounts', async () => {
        const { setProps } = await render(<Switches />);

        screen.getByTestId('first').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      });
    });

    it('prop: validationMode=onSubmit', async () => {
      await render(
        <Form>
          <Field.Root>
            <Switch.Root required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const button = screen.getByRole('switch');
      expect(button).not.toHaveAttribute('aria-invalid');

      await fireEvent.click(screen.getByText('submit'));
      expect(button).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).not.toBe(null);

      await fireEvent.click(button);
      expect(button).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);

      await fireEvent.click(button);
      expect(button).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).not.toBe(null);
    });

    it('prop: validationMode=onChange', async () => {
      await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Switch.Root data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('aria-invalid');

      await fireEvent.click(button);

      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    it('validates once when changed by the user', async () => {
      const validate = vi.fn();

      const { user } = await render(
        <Field.Root validationMode="onChange" validate={validate}>
          <Switch.Root />
        </Field.Root>,
      );

      await user.click(screen.getByRole('switch'));

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe(true);
    });

    it('revalidates when a controlled value changes externally', async () => {
      const validateSpy = vi.fn((value: unknown) => ((value as boolean) ? 'error' : null));

      const App = defineComponent(() => {
        const checked = shallowRef(false);

        return () => (
          <>
            <Field.Root validationMode="onChange" validate={validateSpy} name="newsletters">
              <Switch.Root
                data-testid="button"
                checked={checked.value}
                onCheckedChange={(next: boolean) => {
                  checked.value = next;
                }}
              />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                checked.value = !checked.value;
              }}
            >
              Toggle externally
            </button>
          </>
        );
      });

      await render(<App />);

      const button = screen.getByTestId('button');
      const toggle = screen.getByText('Toggle externally');

      expect(button).not.toHaveAttribute('aria-invalid');
      const initialCallCount = validateSpy.mock.calls.length;

      await fireEvent.click(toggle);

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toBe(true);
      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onBlur', async () => {
      await render(
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Switch.Root data-testid="button" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('aria-invalid');

      await fireEvent.click(button);
      await fireEvent.focusOut(button);

      expect(button).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('can render a native button', async () => {
    const { container, user } = await render(<Switch.Root as="button" nativeButton />);

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'false');
    expect(container.querySelector('button')).toBe(switchEl);

    await user.keyboard('[Tab]');
    expect(switchEl).toHaveFocus();

    await user.keyboard('[Enter]');
    expect(switchEl).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('[Space]');
    expect(switchEl).toHaveAttribute('aria-checked', 'false');

    await user.click(switchEl);
    expect(switchEl).toHaveAttribute('aria-checked', 'true');
  });

  describe('v-model:checked', () => {
    it('emits `checkedChange` and then `update:checked`, before the click handler returns', async () => {
      const order: string[] = [];
      await render(
        <Switch.Root
          onCheckedChange={(checked: boolean) => order.push(`checkedChange ${checked}`)}
          {...{ 'onUpdate:checked': (checked: boolean) => order.push(`update:checked ${checked}`) }}
        />,
      );

      screen.getByRole('switch').click();
      order.push('end of the click');

      expect(order).toEqual(['checkedChange true', 'update:checked true', 'end of the click']);
    });

    it('does not emit `update:checked` for a change that a listener cancels', async () => {
      const handleUpdate = vi.fn();
      await render(
        <Switch.Root
          onCheckedChange={(_checked: boolean, details: Switch.Root.ChangeEventDetails) =>
            details.cancel()
          }
          {...{ 'onUpdate:checked': handleUpdate }}
        />,
      );

      await fireEvent.click(screen.getByRole('switch'));

      expect(handleUpdate).not.toHaveBeenCalled();
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });

    it.each([
      {
        name: 'a click on the switch',
        act: (user: User) => user.click(screen.getByRole('switch')),
      },
      {
        name: 'a click on a label around it',
        act: (user: User) => user.click(screen.getByTestId('label')),
      },
      { name: 'the Space key', act: (user: User) => user.keyboard('[Space]') },
      { name: 'the Enter key', act: (user: User) => user.keyboard('[Enter]') },
    ])('changes one time for $name', async ({ act }) => {
      const handleChange = vi.fn();
      const { user } = await render(
        <label data-testid="label">
          <Switch.Root onCheckedChange={handleChange} />
          Notifications
        </label>,
      );
      screen.getByRole('switch').focus();

      await act(user);

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('the hidden input has the state of the switch', () => {
    function getInput() {
      return screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });
    }

    it.each([
      { name: 'a click on the switch', act: () => screen.getByRole('switch').click() },
      { name: 'a click on the input', act: () => getInput().click() },
      { name: 'a click on a label around it', act: () => screen.getByTestId('label').click() },
    ])('after $name that a listener cancels', async ({ act }) => {
      await render(
        <label data-testid="label">
          <Switch.Root
            onCheckedChange={(_checked: boolean, details: Switch.Root.ChangeEventDetails) =>
              details.cancel()
            }
          />
        </label>,
      );

      act();
      await flushMicrotasks();

      expect(getInput().checked).toBe(false);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });

    it('after a click that the parent of a controlled switch does not accept', async () => {
      const handleUpdate = vi.fn();
      await render(<Switch.Root checked={false} {...{ 'onUpdate:checked': handleUpdate }} />);

      await fireEvent.click(screen.getByRole('switch'));
      await fireEvent.click(screen.getByRole('switch'));

      expect(handleUpdate.mock.calls).toEqual([[true], [true]]);
      expect(getInput().checked).toBe(false);
    });

    it.each([
      { name: 'an uncontrolled switch', props: { defaultChecked: true } },
      { name: 'a controlled switch', props: { checked: true } },
    ])('after the hydration of $name whose input changed before', async ({ props }) => {
      const serverHtml = await renderOnServer(
        'src/switch/root/SwitchRootHydration.test.vue',
        props,
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const input = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      expect(input.checked).toBe(true);
      // A browser that restores the form state of the page, or a click on a label.
      input.checked = false;

      const app = createSSRApp(SwitchRootHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);
      await flushMicrotasks();

      expect(container.querySelector('input[type="checkbox"]')).toBe(input);
      expect(input.checked).toBe(true);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('after a `pageshow` event, because a browser can restore the form state after the mount', async () => {
      const handleChange = vi.fn();
      await render(<Switch.Root onCheckedChange={handleChange} />);
      getInput().checked = true;

      window.dispatchEvent(new PageTransitionEvent('pageshow'));

      expect(getInput().checked).toBe(false);

      await fireEvent.click(screen.getByRole('switch'));

      expect(handleChange.mock.calls.map(([checked]) => checked)).toEqual([true]);
    });
  });

  describe('in a native form', () => {
    function getFormData(name = 'notifications') {
      return new FormData(screen.getByTestId<HTMLFormElement>('form')).getAll(name);
    }

    it.each([
      { name: 'the default values', props: {}, off: [], on: ['on'] },
      { name: '`value`', props: { value: 'yes' }, off: [], on: ['yes'] },
      {
        name: '`value` and `uncheckedValue`',
        props: { value: 'yes', uncheckedValue: 'no' },
        off: ['no'],
        on: ['yes'],
      },
    ])('submits $name', async ({ props, off, on }) => {
      await render(
        <form data-testid="form">
          <Switch.Root name="notifications" {...props} />
        </form>,
      );

      expect(getFormData()).toEqual(off);

      await fireEvent.click(screen.getByRole('switch'));

      expect(getFormData()).toEqual(on);
    });

    it.each([
      { name: 'a switch with no name', props: { name: undefined } },
      { name: 'a disabled switch', props: { disabled: true } },
    ])('submits nothing for $name', async ({ props }) => {
      await render(
        <form data-testid="form">
          <Switch.Root name="notifications" defaultChecked uncheckedValue="no" {...props} />
        </form>,
      );

      expect(Array.from(new FormData(screen.getByTestId<HTMLFormElement>('form')))).toEqual([]);
    });

    it('does not submit a required switch that is off, and focuses the switch', async () => {
      const handleSubmit = vi.fn((event: Event) => event.preventDefault());
      const { user } = await render(
        <form data-testid="form" onSubmit={handleSubmit}>
          <Switch.Root name="notifications" required aria-label="Notifications" />
          <button type="submit">Submit</button>
        </form>,
      );
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(input.validity.valueMissing).toBe(true);
      expect(screen.getByRole('switch')).toHaveFocus();

      await user.click(screen.getByRole('switch'));
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    describe('BUG-6206: a native reset', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it.each([
        { name: 'on', defaultChecked: true, data: ['yes'] },
        { name: 'off', defaultChecked: false, data: ['no'] },
      ])(
        'puts an uncontrolled switch back to its default, $name',
        async ({ defaultChecked, data }) => {
          const handleChange = vi.fn();
          await render(
            <form data-testid="form">
              <Switch.Root
                name="notifications"
                value="yes"
                uncheckedValue="no"
                defaultChecked={defaultChecked}
                onCheckedChange={handleChange}
              />
              <button type="reset">Reset</button>
            </form>,
          );
          const switchElement = screen.getByRole('switch');
          await fireEvent.click(switchElement);
          expect(switchElement).toHaveAttribute('aria-checked', String(!defaultChecked));

          await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
          await settleReset();

          expect(switchElement).toHaveAttribute('aria-checked', String(defaultChecked));
          expect(getFormData()).toEqual(data);
          expect(handleChange).toHaveBeenCalledTimes(2);
          expect(handleChange.mock.lastCall?.[0]).toBe(defaultChecked);
          expect(handleChange.mock.lastCall?.[1].event.type).toBe('reset');

          // A reset with nothing to change.
          await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
          await settleReset();

          expect(handleChange).toHaveBeenCalledTimes(2);
        },
      );

      it.each([
        {
          name: 'a controlled switch',
          renderForm: () => {
            const checked = shallowRef(false);
            return () => (
              <form data-testid="form">
                <Switch.Root
                  name="notifications"
                  checked={checked.value}
                  {...{ 'onUpdate:checked': (next: boolean) => (checked.value = next) }}
                />
              </form>
            );
          },
        },
        {
          name: 'a switch whose listener cancels',
          renderForm: () => {
            let cancel = false;
            return () => (
              <form data-testid="form" onReset={() => (cancel = true)}>
                <Switch.Root
                  name="notifications"
                  onCheckedChange={(_checked: boolean, details: Switch.Root.ChangeEventDetails) => {
                    if (cancel) {
                      details.cancel();
                    }
                  }}
                />
              </form>
            );
          },
        },
        {
          name: 'a switch whose form cancels the reset',
          renderForm: () => () => (
            <form data-testid="form" onReset={(event: Event) => event.preventDefault()}>
              <Switch.Root name="notifications" />
            </form>
          ),
        },
        {
          name: 'a switch whose window cancels the reset',
          renderForm: () => {
            // The window gets the event after the root node of the switch.
            const cancelReset = (event: Event) => event.preventDefault();
            window.addEventListener('reset', cancelReset);
            onTestFinished(() => window.removeEventListener('reset', cancelReset));
            return () => (
              <form data-testid="form">
                <Switch.Root name="notifications" />
              </form>
            );
          },
        },
        {
          name: 'a switch of another form',
          renderForm: () => () => (
            <div>
              <form data-testid="form" />
              <form id="other" />
              <Switch.Root name="notifications" form="other" />
            </div>
          ),
        },
      ])('does not change $name', async ({ renderForm }) => {
        await render(h(defineComponent(renderForm)));
        const switchElement = screen.getByRole('switch');
        await fireEvent.click(switchElement);

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(switchElement).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole<HTMLInputElement>('checkbox', { hidden: true }).checked).toBe(true);
      });

      it('resets a switch outside the form that its `form` prop names', async () => {
        await render(
          <div>
            <form data-testid="form" id="external" />
            <Switch.Root name="notifications" form="external" />
          </div>,
        );
        const switchElement = screen.getByRole('switch');
        await fireEvent.click(switchElement);
        expect(getFormData()).toEqual(['on']);

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(switchElement).toHaveAttribute('aria-checked', 'false');
        expect(getFormData()).toEqual([]);
      });
    });
  });

  describe('in a field', () => {
    function getStateAttributes(testId: string) {
      return Array.from(screen.getByTestId(testId).attributes, ({ name }) => name)
        .filter((name) => /^data-(touched|dirty|filled|focused|disabled)$/.test(name))
        .sort();
    }

    it('gives its state to the field and takes the state of the field', async () => {
      const handleChange = vi.fn();
      const { user } = await render(
        <FormScope data-testid="form">
          <FieldScope data-testid="root" onValidationChange={handleChange}>
            <Switch.Root name="own" data-testid="switch" aria-label="Notifications" />
          </FieldScope>
        </FormScope>,
      );

      expect(getStateAttributes('root')).toEqual([]);
      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', 'own');

      await user.click(screen.getByTestId('switch'));

      expect(getStateAttributes('root')).toEqual(['data-dirty', 'data-filled', 'data-focused']);
      expect(getStateAttributes('switch')).toEqual(['data-dirty', 'data-filled', 'data-focused']);
      expect(handleChange.mock.calls).toEqual([[true, false]]);

      screen.getByTestId('switch').blur();
      await flushMicrotasks();

      expect(getStateAttributes('switch')).toEqual(['data-dirty', 'data-filled', 'data-touched']);

      await user.click(screen.getByTestId('switch'));

      expect(getStateAttributes('root')).toEqual(['data-focused', 'data-touched']);
    });

    it('takes `name` and `disabled` from the field', async () => {
      await render(
        <FormScope data-testid="form">
          <FieldScope name="field" disabled>
            <Switch.Root name="own" data-testid="switch" aria-label="Notifications" />
          </FieldScope>
        </FormScope>,
      );
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      expect(input.name).toBe('field');
      expect(input.disabled).toBe(true);
      expect(screen.getByTestId('switch')).toHaveAttribute('aria-disabled', 'true');
      expect(getStateAttributes('switch')).toEqual(['data-disabled']);
      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', '');
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
        expect(screen.getByRole('switch')).not.toHaveAttribute('aria-invalid');
      }

      // The input keeps no message of the field. A required switch that is off keeps the message of
      // its native constraint.
      function expectInputConstraint(valueMissing: boolean) {
        const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });
        expect(input.validity.customError).toBe(false);
        expect(input.validity.valueMissing).toBe(valueMissing);
        expect(Boolean(input.validationMessage)).toBe(valueMissing);
      }

      it.each([
        {
          name: 'a switch at its default',
          valueMissing: false,
          renderForm: () => () => (
            <Form data-testid="form">
              <Field.Root
                data-testid="root"
                name="notifications"
                validate={(value) => (value ? null : 'Turn it on')}
              >
                <Switch.Root aria-label="Notifications" />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          ),
          makeInvalid: submitForm,
        },
        {
          name: 'a required switch at its default',
          valueMissing: true,
          renderForm: () => () => (
            <Form data-testid="form">
              <Field.Root data-testid="root" name="notifications">
                <Switch.Root aria-label="Notifications" required />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          ),
          makeInvalid: submitForm,
        },
        {
          name: 'the form for a switch at its default',
          valueMissing: false,
          renderForm: () => () => (
            <Form data-testid="form" errors={{ notifications: 'Server error' }}>
              <Field.Root data-testid="root" name="notifications">
                <Switch.Root aria-label="Notifications" />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          ),
          makeInvalid: undefined,
        },
        {
          name: 'a controlled switch',
          valueMissing: false,
          renderForm: () => {
            const checked = shallowRef(false);
            return () => (
              <Form data-testid="form">
                <Field.Root
                  data-testid="root"
                  name="notifications"
                  validate={(value) => (value ? null : 'Turn it on')}
                >
                  <Switch.Root
                    aria-label="Notifications"
                    checked={checked.value}
                    {...{ 'onUpdate:checked': (next: boolean) => (checked.value = next) }}
                  />
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

        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
        expectNeutralField();
        expectInputConstraint(valueMissing);
      });

      it('VUE-21: clears the error of a switch whose listener cancels the reset, and validates the next click', async () => {
        const validate = vi.fn((value: unknown) => (value ? 'Turn it off' : null));
        await render(
          <Form data-testid="form">
            <Field.Root data-testid="root" name="notifications" validate={validate}>
              <Switch.Root
                aria-label="Notifications"
                onCheckedChange={(_checked: boolean, details: Switch.Root.ChangeEventDetails) => {
                  if (details.event.type === 'reset') {
                    details.cancel();
                  }
                }}
              />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        await fireEvent.click(screen.getByRole('switch'));
        await submitForm();
        expect(screen.getByTestId('error')).toHaveTextContent('Turn it off');

        await resetForm();

        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
        expect(validate).toHaveBeenCalledTimes(1);
        expectNeutralField();
        expectInputConstraint(false);

        await fireEvent.click(screen.getByRole('switch'));

        expect(validate).toHaveBeenCalledTimes(2);
        expect(validate.mock.lastCall?.[0]).toBe(false);
        expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');
      });

      it('VUE-21: clears the error when the reset turns the switch off, does not validate it, and validates the next click', async () => {
        const validate = vi.fn((value: unknown) => (value ? 'Turn it off' : null));
        await render(
          <Form data-testid="form">
            <Field.Root
              data-testid="root"
              name="notifications"
              validate={validate}
              validationMode="onChange"
            >
              <Switch.Root aria-label="Notifications" />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        await fireEvent.click(screen.getByRole('switch'));
        expect(screen.getByTestId('error')).toHaveTextContent('Turn it off');

        await resetForm();

        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
        expect(validate).toHaveBeenCalledTimes(1);
        expectNeutralField();
        expectInputConstraint(false);

        await fireEvent.click(screen.getByRole('switch'));

        expect(validate).toHaveBeenCalledTimes(2);
        expect(validate.mock.lastCall?.[0]).toBe(true);
        expect(screen.getByTestId('error')).toHaveTextContent('Turn it off');
      });

      it('VUE-21: shows no error when the reset turns off a required switch that was valid', async () => {
        const validate = vi.fn();
        const { container } = await render(
          <Form data-testid="form">
            <Field.Root data-testid="root" name="notifications" validate={validate}>
              <Switch.Root aria-label="Notifications" required />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        // Firefox loads the page again for a valid submit that no listener prevents.
        container.addEventListener('submit', (event) => event.preventDefault());
        await fireEvent.click(screen.getByRole('switch'));
        await submitForm();
        expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');
        expect(validate).toHaveBeenCalledTimes(1);

        await resetForm();

        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
        expect(validate).toHaveBeenCalledTimes(1);
        expectNeutralField();
        expectInputConstraint(true);
      });

      it('VUE-21: removes the validity mark that a change gave to a field with an error of the form', async () => {
        await render(
          <Form data-testid="form" errors={{ notifications: 'Server error' }}>
            <Field.Root data-testid="root" name="notifications">
              <Switch.Root aria-label="Notifications" />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        await fireEvent.click(screen.getByRole('switch'));
        expect(screen.queryByTestId('error')).toBe(null);
        expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');

        await resetForm();

        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
        expectNeutralField();
      });
    });
  });

  describe('server-side rendering', () => {
    it.each([
      { name: 'a switch that is off', props: {} },
      { name: 'a switch that is on', props: { defaultChecked: true, name: 'notifications' } },
      {
        name: 'a switch with an unchecked value',
        props: { name: 'notifications', uncheckedValue: 'no' },
      },
      { name: 'a label of the provider before it', props: { label: 'before' } },
      { name: 'a label of the provider after it', props: { label: 'after' } },
      { name: 'a switch in a native label', props: { label: 'native' } },
      { name: 'a native button', props: { label: 'before', nativeButton: true } },
      {
        name: 'a disabled, read-only, required switch',
        props: { disabled: true, readOnly: true, required: true },
      },
    ])('hydrates $name with no mismatch', async ({ props }) => {
      const serverHtml = await renderOnServer(
        'src/switch/root/SwitchRootHydration.test.vue',
        props,
      );

      await hydrate(SwitchRootHydration, { serverHtml, props });
    });

    it('names a hydrated switch with the native label around it', async () => {
      const props = { label: 'native' };
      const serverHtml = await renderOnServer(
        'src/switch/root/SwitchRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(SwitchRootHydration, { serverHtml, props });

      const label = container.querySelector('[data-testid="label"]')!;
      expect(label.id).not.toBe('');
      expect(container.querySelector('[role="switch"]')).toHaveAttribute(
        'aria-labelledby',
        label.id,
      );
    });

    it.each([
      { name: 'before the switch', label: 'before' as const },
      { name: 'after the switch', label: 'after' as const },
    ])(
      'names the switch with a label of the provider $name in the server HTML',
      async ({ label }) => {
        const props = { label };
        const serverHtml = await renderOnServer(
          'src/switch/root/SwitchRootHydration.test.vue',
          props,
        );

        // A `<template>` element parses the HTML with no side effect.
        const template = document.createElement('template');
        template.innerHTML = serverHtml;
        const serverLabelId = template.content.querySelector('[data-testid="label"]')!.id;
        expect(serverLabelId).not.toBe('');
        expect(
          template.content.querySelector('[role="switch"]')?.getAttribute('aria-labelledby'),
        ).toBe(serverLabelId);

        const { container } = await hydrate(SwitchRootHydration, { serverHtml, props });

        expect(container.querySelector('[role="switch"]')).toHaveAttribute(
          'aria-labelledby',
          serverLabelId,
        );
      },
    );
  });

  describe('KeepAlive', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps its state, and a reset of the form does not change a switch that is not shown', async () => {
      const App = defineComponent({
        props: { shown: { type: Boolean, default: true } },
        setup(props) {
          return () => (
            <form data-testid="form">
              <KeepAlive>
                {props.shown ? <Switch.Root key="switch" name="notifications" /> : null}
              </KeepAlive>
            </form>
          );
        },
      });
      const { setProps } = await render(<App />);
      const form = screen.getByTestId<HTMLFormElement>('form');
      await fireEvent.click(screen.getByRole('switch'));

      await setProps({ shown: false });

      expect(new FormData(form).getAll('notifications')).toEqual([]);

      form.reset();
      await settleReset();
      await setProps({ shown: true });

      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
      expect(new FormData(form).getAll('notifications')).toEqual(['on']);

      form.reset();
      await settleReset();

      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });
  });
});
