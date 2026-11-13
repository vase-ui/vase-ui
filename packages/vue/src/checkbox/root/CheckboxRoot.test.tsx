import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createSSRApp, defineComponent, h, onMounted, shallowRef } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import {
  createFormDataSpy,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hiddenInputSizeTests,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';
import CheckboxRootHydration from './CheckboxRootHydration.test.vue';

type User = VaseUIRenderResult['user'];

const HYDRATION_FIXTURE = 'src/checkbox/root/CheckboxRootHydration.test.vue';

// The part follows a reset in a timeout of 0 ms, after the listeners of the event.
// The case that calls this function uses fake timers.
async function settleReset() {
  vi.advanceTimersByTime(0);
  await flushMicrotasks();
}

// The hidden input is the second element with the role: the root comes first.
function getInput() {
  return screen.getAllByRole<HTMLInputElement>('checkbox', { hidden: true })[1];
}

describe('<Checkbox.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Checkbox.Root />, () => ({
    refInstanceof: window.HTMLSpanElement,
    testRenderPropWith: 'span',
    button: true,
    render,
  }));

  hiddenInputSizeTests({
    render,
    createComponent: (props) => <Checkbox.Root {...props} />,
  });

  describe('ARIA attributes', () => {
    it('sets the correct aria attributes', async () => {
      const { setProps } = await render(<Checkbox.Root data-testid="test" required={false} />);

      expect(screen.getByRole('checkbox')).toBe(screen.getByTestId('test'));
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked');
      await setProps({ required: true });
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('extra props', () => {
    it('can override the built-in attributes', async () => {
      const { container } = await render(<Checkbox.Root role="switch" />);
      expect(container.firstElementChild as HTMLElement).toHaveAttribute('role', 'switch');
    });
  });

  describe('id', () => {
    function TestCase(props: {
      checkboxId?: string | undefined;
      checkboxKey?: string | undefined;
      nativeButton: boolean;
    }) {
      const { checkboxId, checkboxKey, nativeButton } = props;

      return (
        <Field.Root>
          <Field.Label data-testid="label">Label</Field.Label>
          <Checkbox.Root
            key={checkboxKey}
            id={checkboxId}
            nativeButton={nativeButton}
            as={nativeButton ? 'button' : undefined}
          />
        </Field.Root>
      );
    }

    function getLabelControl(nativeButton: boolean) {
      return nativeButton
        ? screen.getByRole('checkbox')
        : document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    }

    it.each([false, true])(
      'drops an explicit id when the prop is removed (nativeButton=%s)',
      async (nativeButton) => {
        const { rerender } = await render(
          <TestCase checkboxId="explicit" nativeButton={nativeButton} />,
        );

        const label = screen.getByTestId('label');
        expect(getLabelControl(nativeButton)).toHaveAttribute('id', 'explicit');
        expect(label).toHaveAttribute('for', 'explicit');

        await rerender(<TestCase nativeButton={nativeButton} />);

        const control = getLabelControl(nativeButton);
        expect(control.id).not.toBe('');
        expect(control).not.toHaveAttribute('id', 'explicit');
        expect(label).toHaveAttribute('for', control.id);
      },
    );

    it.each([false, true])(
      'does not reuse an unmounted Checkbox id for a keyed id-less Checkbox (nativeButton=%s)',
      async (nativeButton) => {
        const { rerender } = await render(
          <TestCase checkboxKey="explicit" checkboxId="explicit" nativeButton={nativeButton} />,
        );

        const label = screen.getByTestId('label');
        expect(getLabelControl(nativeButton)).toHaveAttribute('id', 'explicit');
        expect(label).toHaveAttribute('for', 'explicit');

        await rerender(<TestCase checkboxKey="generated" nativeButton={nativeButton} />);

        const control = getLabelControl(nativeButton);
        expect(control.id).not.toBe('');
        expect(control).not.toHaveAttribute('id', 'explicit');
        expect(label).toHaveAttribute('for', control.id);
      },
    );

    // An explicit `id` only reaches the DOM once registration runs, so the server markup carries
    // the provider's generated id on both the label and the control. Rendering `id` right away
    // would instead leave `Field.Label`'s `for` pointing at nothing until hydration.
    it.each([false, true])(
      'defers an explicit id until hydration but keeps Field.Label associated during SSR (nativeButton=%s)',
      async (nativeButton) => {
        const props = { label: 'field', id: 'explicit', nativeButton };
        const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
        // The case acts between the server HTML and the hydration, so it hydrates by hand.
        const container = document.createElement('div');
        document.body.append(container);
        container.innerHTML = serverHtml;
        const getControl = () =>
          nativeButton
            ? container.querySelector<HTMLElement>('[role="checkbox"]')!
            : container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        const getLabel = () => container.querySelector<HTMLElement>('[data-testid="label"]')!;

        const control = getControl();
        expect(control.id).not.toBe('');
        expect(control).not.toHaveAttribute('id', 'explicit');
        expect(getLabel()).toHaveAttribute('for', control.id);

        const app = createSSRApp(CheckboxRootHydration, props);
        onTestFinished(() => {
          app.unmount();
          container.remove();
        });
        app.mount(container);

        await waitFor(() => {
          expect(getControl()).toHaveAttribute('id', 'explicit');
        });
        expect(getControl()).toBe(control);
        expect(getLabel()).toHaveAttribute('for', 'explicit');
        expect(takeReportedMessages()).toEqual([]);
      },
    );
  });

  describe('prop: onClick', () => {
    it.each([false, true])(
      'propagates a single click event to ancestors per user click (nativeButton=%s)',
      async (nativeButton) => {
        const handleParentClick = vi.fn();
        await render(
          <div onClick={handleParentClick}>
            <Checkbox.Root
              nativeButton={nativeButton}
              as={nativeButton ? 'button' : undefined}
              data-testid="checkbox"
            />
          </div>,
        );

        await fireEvent.click(screen.getByTestId('checkbox'));

        expect(handleParentClick).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-checked', 'true');
      },
    );

    it.each([false, true])(
      'does not propagate to ancestors when stopPropagation() is called (nativeButton=%s)',
      async (nativeButton) => {
        const handleParentClick = vi.fn();
        await render(
          <div onClick={handleParentClick}>
            <Checkbox.Root
              nativeButton={nativeButton}
              as={nativeButton ? 'button' : undefined}
              data-testid="checkbox"
              onClick={(event: MouseEvent) => event.stopPropagation()}
            />
          </div>,
        );

        await fireEvent.click(screen.getByTestId('checkbox'));

        expect(handleParentClick).toHaveBeenCalledTimes(0);
        expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-checked', 'true');
      },
    );
  });

  describe('interactions', () => {
    it('tolerates imperative interaction in its ref callback before the hidden input mounts', async () => {
      let inputAtCall: Element | null | undefined;
      let calls = 0;
      const App = defineComponent(() => {
        return () => (
          <Checkbox.Root
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
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
    });

    it('should change its state when clicked', async () => {
      await render(<Checkbox.Root />);
      const [checkbox] = screen.getAllByRole('checkbox');
      // querying it separately since hidden true returns both button and input.
      // without hidden it only returns the button (in the above query)
      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);

      checkbox.click();
      await flushMicrotasks();

      expect(checkbox).toHaveAttribute('aria-checked', 'true');
      expect(input.checked).toBe(true);

      checkbox.click();
      await flushMicrotasks();

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
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
            <Checkbox.Root checked={checked.value} />;
          </div>
        );
      });

      await render(<Test />);
      const [checkbox] = screen.getAllByRole('checkbox');
      const button = screen.getByText('Toggle');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      button.click();
      await flushMicrotasks();

      expect(checkbox).toHaveAttribute('aria-checked', 'true');

      button.click();
      await flushMicrotasks();

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should call onCheckedChange when clicked', async () => {
      const handleChange = vi.fn();
      await render(<Checkbox.Root onCheckedChange={handleChange} />);
      const [checkbox] = screen.getAllByRole('checkbox');

      checkbox.click();
      await flushMicrotasks();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(true);
    });

    it('does not update its state when onCheckedChange cancels the event', async () => {
      const handleChange = vi.fn((_, eventDetails: Checkbox.Root.ChangeEventDetails) => {
        eventDetails.cancel();
      });

      await render(<Checkbox.Root onCheckedChange={handleChange} />);
      const checkbox = screen.getByRole('checkbox');
      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });

      await fireEvent.click(checkbox);

      expect(handleChange.mock.calls.length).toBe(1);
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
    });

    it('should report keyboard modifier event properties when calling onCheckedChange', async () => {
      const handleChange = vi.fn((_checked, eventDetails) => eventDetails);
      const { user } = await render(<Checkbox.Root onCheckedChange={handleChange} />);
      const [checkbox] = screen.getAllByRole('checkbox');

      await user.keyboard('{Shift>}');
      await user.click(checkbox);
      await user.keyboard('{/Shift}');

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.results[0]?.value.event.shiftKey).toBe(true);
    });

    it('should update its state if the underlying input is toggled', async () => {
      await render(<Checkbox.Root />);
      const checkbox = screen.getByRole('checkbox');
      const internalInput = document.querySelector<HTMLInputElement>('input[type="checkbox"]');

      internalInput?.click();
      await flushMicrotasks();

      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('ignores a hidden input click canceled before React handles it', async () => {
      const handleCheckedChange = vi.fn();
      await render(<Checkbox.Root onCheckedChange={handleCheckedChange} />);

      const checkbox = screen.getByRole('checkbox');
      const input = screen.getAllByRole<HTMLInputElement>('checkbox', { hidden: true })[1];
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      event.preventDefault();

      await fireEvent(input, event);

      expect(handleCheckedChange).not.toHaveBeenCalled();
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('can be activated with Space key', async () => {
      const { user } = await render(<Checkbox.Root />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Space]');
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('does not activate with Enter key', async () => {
      const { user } = await render(<Checkbox.Root />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Enter]');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', async () => {
      await render(<Checkbox.Root disabled />);
      expect(screen.getByRole('checkbox')).not.toHaveAttribute('disabled');
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not change its state when clicked', async () => {
      await render(<Checkbox.Root disabled />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      checkbox.click();
      await flushMicrotasks();

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: readOnly', () => {
    it('should have the `aria-readonly` attribute', async () => {
      await render(<Checkbox.Root readOnly />);
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-readonly', 'true');
    });

    it('should not have the aria attribute when `readOnly` is not set', async () => {
      await render(<Checkbox.Root />);
      expect(screen.getAllByRole('checkbox')[0]).not.toHaveAttribute('aria-readonly');
    });

    it('should not change its state when clicked', async () => {
      await render(<Checkbox.Root readOnly />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      checkbox.click();
      await flushMicrotasks();

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should not change its state when its label is clicked', async () => {
      await render(
        <label data-testid="label">
          <Checkbox.Root readOnly />
        </label>,
      );
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      const labelElement = screen.getByTestId('label');

      labelElement.click();
      await flushMicrotasks();

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: indeterminate', () => {
    it('should set the `aria-checked` attribute as "mixed"', async () => {
      await render(<Checkbox.Root indeterminate />);
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'mixed');
    });

    it('should not change its state when clicked', async () => {
      await render(<Checkbox.Root indeterminate />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');

      checkbox.click();
      await flushMicrotasks();

      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    });

    it('should not have the aria attribute when `indeterminate` is not set', async () => {
      await render(<Checkbox.Root />);
      expect(screen.getAllByRole('checkbox')[0]).not.toHaveAttribute('aria-checked', 'mixed');
    });

    it('should not be overridden by `checked` prop', async () => {
      await render(<Checkbox.Root indeterminate checked />);
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'mixed');
    });

    it('sets the native input state when indeterminate', async () => {
      await render(<Checkbox.Root indeterminate />);

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input.indeterminate).toBe(true);
    });

    it('keeps the native input state when checked changes while indeterminate remains', async () => {
      const App = defineComponent(() => {
        const checked = shallowRef(false);
        return () => (
          <Checkbox.Root
            data-testid="button"
            indeterminate
            checked={checked.value}
            onCheckedChange={(next: boolean) => {
              checked.value = next;
            }}
          />
        );
      });

      await render(<App />);

      // Clicking the hidden input natively clears `indeterminate` before toggling.
      await fireEvent.click(screen.getByTestId('button'));

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input.checked).toBe(true);
      expect(input.indeterminate).toBe(true);
    });

    it('sets indeterminate style hooks on the root and indicator', async () => {
      await render(
        <Checkbox.Root indeterminate>
          <Checkbox.Indicator data-testid="indicator" />
        </Checkbox.Root>,
      );

      expect(screen.getByRole('checkbox')).toHaveAttribute('data-indeterminate', '');
      expect(screen.getByTestId('indicator')).toHaveAttribute('data-indeterminate', '');
    });
  });

  it('should update its state if the underlying input is toggled', async () => {
    await render(<Checkbox.Root />);
    const [checkbox] = screen.getAllByRole('checkbox');
    const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
      hidden: true,
    });

    input.click();
    await flushMicrotasks();

    expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  it('should place the style hooks on the root and the indicator', async () => {
    const { setProps } = await render(
      <Checkbox.Root defaultChecked disabled readOnly required>
        <Checkbox.Indicator />
      </Checkbox.Root>,
    );

    const [checkbox] = screen.getAllByRole('checkbox');
    const indicator = checkbox.querySelector('span');

    expect(checkbox).toHaveAttribute('data-checked', '');
    expect(checkbox).not.toHaveAttribute('data-unchecked');

    expect(checkbox).toHaveAttribute('data-disabled', '');
    expect(checkbox).toHaveAttribute('data-readonly', '');
    expect(checkbox).toHaveAttribute('data-required', '');

    expect(indicator).toHaveAttribute('data-checked', '');
    expect(indicator).not.toHaveAttribute('data-unchecked');

    expect(indicator).toHaveAttribute('data-disabled', '');
    expect(indicator).toHaveAttribute('data-readonly', '');
    expect(indicator).toHaveAttribute('data-required', '');

    await setProps({ disabled: false, readOnly: false });
    await fireEvent.click(checkbox);

    expect(checkbox).toHaveAttribute('data-unchecked', '');
    expect(checkbox).not.toHaveAttribute('data-checked');
  });

  it('should set the name attribute only on the input', async () => {
    await render(<Checkbox.Root name="checkbox-name" />);

    const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
      hidden: true,
    });
    expect(input).toHaveAttribute('name', 'checkbox-name');
    expect(screen.getByRole('checkbox')).not.toHaveAttribute('name');
  });

  // flaky with user.click
  describe('with native <label>', () => {
    it('should toggle the checkbox when a wrapping <label> is clicked', async () => {
      await render(
        <label data-testid="label">
          <Checkbox.Root />
          Toggle
        </label>,
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await fireEvent.click(screen.getByTestId('label'));
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should toggle the checkbox when a explicitly linked <label> is clicked', async () => {
      await render(
        <div>
          <label data-testid="label" for="myCheckbox">
            Toggle
          </label>

          <Checkbox.Root id="myCheckbox" />
        </div>,
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await fireEvent.click(screen.getByTestId('label'));
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should associate `id` with the native button when `nativeButton=true`', async () => {
      await render(
        <div>
          <label data-testid="label" for="myCheckbox">
            Toggle
          </label>

          <Checkbox.Root id="myCheckbox" nativeButton as="button" />
        </div>,
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('id', 'myCheckbox');

      const hiddenInputs = screen.getAllByRole<HTMLInputElement>('checkbox', { hidden: true });
      const hiddenInput = hiddenInputs.find((input) => input !== checkbox);
      expect(hiddenInput).not.toBe(undefined);
      expect(hiddenInput).not.toHaveAttribute('id', 'myCheckbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      await fireEvent.click(screen.getByTestId('label'));
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('falls back to the Field control id when id is empty', async () => {
      await render(
        <Field.Root>
          <Field.Label>Label</Field.Label>
          <Checkbox.Root id="" />
        </Field.Root>,
      );

      const label = screen.getByText('Label');
      const input = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      const checkbox = screen.getByRole('checkbox');

      expect(input.id).not.toBe('');
      expect(label).toHaveAttribute('for', input.id);

      await fireEvent.click(label);
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Form', () => {
    it('triggers native HTML validation on submit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="test" data-testid="field">
            <Checkbox.Root required />
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
            <Checkbox.Root data-testid="checkbox" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      const checkbox = screen.getByTestId('checkbox');

      expect(checkbox).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('test');

      await fireEvent.click(checkbox);

      expect(checkbox).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it.skipIf(isJSDOM)(
      'should include the checkbox value in form submission, matching native checkbox behavior',
      async () => {
        const submitSpy = createFormDataSpy('test-checkbox');

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe(null);

        await user.click(checkbox);

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
      },
    );

    it.skipIf(isJSDOM)('submits the form when Enter is pressed while focused', async () => {
      const submitSpy = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return {
          value: formData.get('test-checkbox'),
          submitter: event.submitter,
        };
      });
      const submitClickSpy = vi.fn();

      const { user } = await render(
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-checkbox">
            <Checkbox.Root />
          </Field.Root>
          <button id="submit-button" type="submit" onClick={submitClickSpy}>
            Submit
          </button>
        </Form>,
      );

      const checkbox = screen.getByRole('checkbox');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Enter]');

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value.value).toBe(null);
      expect(submitSpy.mock.results.at(-1)?.value.submitter).toBe(
        screen.getByRole('button', { name: 'Submit' }),
      );
      expect(submitClickSpy.mock.calls.length).toBe(1);
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when the consumer prevents default',
      async () => {
        const submitSpy = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root onKeydown={(event: KeyboardEvent) => event.preventDefault()} />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.mock.calls.length).toBe(0);
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when an ancestor prevents default',
      async () => {
        const submitSpy = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        const keyDownSpy = vi.fn((event: KeyboardEvent) => {
          const defaultPrevented = event.defaultPrevented;
          event.preventDefault();
          return defaultPrevented;
        });

        const { user } = await render(
          <Form onSubmit={submitSpy} onKeydown={keyDownSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(keyDownSpy.mock.results.at(-1)?.value).toBe(false);
        expect(submitSpy.mock.calls.length).toBe(0);
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)('submits the form with Enter when readOnly', async () => {
      const submitSpy = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
        return event.submitter;
      });

      const { user } = await render(
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-checkbox">
            <Checkbox.Root readOnly />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const checkbox = screen.getByRole('checkbox');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Enter]');

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe(
        screen.getByRole('button', { name: 'Submit' }),
      );
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it.skipIf(isJSDOM)(
      'submits the form once with Enter when rendered as a native button',
      async () => {
        const submitSpy = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
          return event.submitter;
        });
        const submitClickSpy = vi.fn();

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root as="button" nativeButton />
            </Field.Root>
            <button type="submit" onClick={submitClickSpy}>
              Submit
            </button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe(
          screen.getByRole('button', { name: 'Submit' }),
        );
        expect(submitClickSpy.mock.calls.length).toBe(1);
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when there is no submit button',
      async () => {
        const submitSpy = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.mock.calls.length).toBe(0);
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when the default button is disabled',
      async () => {
        const submitSpy = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
            <button type="submit" disabled>
              Disabled
            </button>
            <button type="submit">Enabled</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        // getDefaultFormSubmitter intentionally returns the disabled default button;
        // clicking it should be a no-op rather than falling through to a later submitter.
        expect(submitSpy.mock.calls.length).toBe(0);
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      const submitSpy = createFormDataSpy('test-checkbox');

      const { user } = await render(
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Checkbox.Root name="test-checkbox" form="external-form" />
        </>,
      );

      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
    });

    it.skipIf(isJSDOM)(
      'submits to an external form with Enter when `form` is provided',
      async () => {
        const submitSpy = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
          return event.submitter;
        });

        const { user } = await render(
          <>
            <Checkbox.Root name="test-checkbox" form="external-form" />
            <form id="external-form" onSubmit={submitSpy}>
              <button type="submit">Submit</button>
            </form>
          </>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe(screen.getByRole('button'));
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)('submits uncheckedValue to an external form when unchecked', async () => {
      const submitSpy = createFormDataSpy('test-checkbox');

      await render(
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Checkbox.Root name="test-checkbox" form="external-form" uncheckedValue="off" />
        </>,
      );

      await fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('off');
    });

    it.skipIf(isJSDOM)(
      'should include the custom checkbox value in form submission, matching native checkbox behavior',
      async () => {
        const submitSpy = createFormDataSpy('test-checkbox');

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root value="test-value" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe(null);

        await user.click(checkbox);

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('test-value');
      },
    );

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
            <Checkbox.Root />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const customCheckbox = screen.getAllByRole('checkbox')[1];
      const customSubmitButton = screen.getAllByRole('button')[1]!;

      await customUser.click(customSubmitButton);
      expect(customSubmitSpy.mock.results.at(-1)?.value.get).toBe(null);
      expect(customSubmitSpy.mock.results.at(-1)?.value.getAll).toEqual([]);

      await customUser.click(customCheckbox);
      await customUser.click(customSubmitButton);
      expect(customSubmitSpy.mock.results.at(-1)?.value.get).toBe('on');
    });

    it.skipIf(isJSDOM)(
      'should submit uncheckedValue when checkbox is unchecked and uncheckedValue is specified',
      async () => {
        const submitSpy = createFormDataSpy('test-checkbox');

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root uncheckedValue="off" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('off');

        await user.click(checkbox);

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('on');

        await user.click(checkbox);

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(3);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('off');
      },
    );

    it.skipIf(isJSDOM)('does not submit uncheckedValue when disabled', async () => {
      const submitSpy = createFormDataSpy('test-checkbox');

      const { user } = await render(
        <form onSubmit={submitSpy}>
          <Checkbox.Root name="test-checkbox" uncheckedValue="off" disabled />
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe(null);
    });

    it.skipIf(isJSDOM)(
      'should submit custom uncheckedValue when checkbox is unchecked',
      async () => {
        const submitSpy = createFormDataSpy('test-checkbox');

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root uncheckedValue="false" value="true" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('false');

        await user.click(checkbox);

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('true');
      },
    );
  });

  describe('Field', () => {
    it('should receive disabled prop from Field.Root', async () => {
      await render(
        <Field.Root disabled>
          <Checkbox.Root />
        </Field.Root>,
      );

      const [checkbox] = screen.getAllByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    });

    it('should receive name prop from Field.Root', async () => {
      await render(
        <Field.Root name="field-checkbox">
          <Checkbox.Root />
        </Field.Root>,
      );

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input).toHaveAttribute('name', 'field-checkbox');
    });

    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <Checkbox.Root data-testid="button" />
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
          <Checkbox.Root data-testid="button" />
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
            <Checkbox.Root data-testid="button" />
          </Field.Root>,
        );

        const button = screen.getByTestId('button');

        expect(button).not.toHaveAttribute('data-filled');

        await fireEvent.click(button);

        expect(button).toHaveAttribute('data-filled', '');

        await fireEvent.click(button);

        expect(button).not.toHaveAttribute('data-filled');
      });

      it('removes [data-filled] attribute when unchecked after being initially checked', async () => {
        await render(
          <Field.Root>
            <Checkbox.Root data-testid="button" defaultChecked />
          </Field.Root>,
        );

        const button = screen.getByTestId('button');

        expect(button).toHaveAttribute('data-filled');

        await fireEvent.click(button);

        expect(button).not.toHaveAttribute('data-filled', '');
      });

      it('clears [data-filled] when a controlled checkbox remounts unchecked', async () => {
        const App = defineComponent(() => {
          const unchecked = shallowRef(false);
          return () => (
            <Field.Root data-testid="root">
              <Checkbox.Root
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
    });

    it('[data-focused]', async () => {
      await render(
        <Field.Root>
          <Checkbox.Root data-testid="button" />
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
          <Checkbox.Root disabled data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      await fireEvent.focusIn(button);

      expect(button).not.toHaveAttribute('data-focused');
    });

    describe('[data-focused] without a blur event', () => {
      function Checkboxes(props: { firstMounted?: boolean; firstDisabled?: boolean }) {
        const { firstMounted = true, firstDisabled = false } = props;
        return (
          <Field.Root data-testid="root">
            {firstMounted && <Checkbox.Root data-testid="first" disabled={firstDisabled} />}
          </Field.Root>
        );
      }

      it('is removed when the focused checkbox becomes disabled', async () => {
        const { setProps } = await render(<Checkboxes />);

        const button = screen.getByTestId('first');
        button.focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
        expect(button).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused checkbox unmounts', async () => {
        const { setProps } = await render(<Checkboxes />);

        screen.getByTestId('first').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      });

      it('is kept when the checkbox is focused during mount in StrictMode', async () => {
        const FocusOnMount = defineComponent(() => {
          const checkbox = shallowRef<{ element: HTMLElement | null } | null>(null);
          onMounted(() => {
            checkbox.value?.element?.focus();
          });
          return () => (
            <Field.Root data-testid="root">
              <Checkbox.Root ref={checkbox} />
            </Field.Root>
          );
        });

        await render(<FocusOnMount />);
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
      });
    });

    it('[data-invalid]', async () => {
      await render(
        <Field.Root invalid>
          <Checkbox.Root data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).toHaveAttribute('data-invalid', '');
    });

    it('[data-valid]', async () => {
      await render(
        <Field.Root validationMode="onBlur">
          <Checkbox.Root data-testid="button" required />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-valid');
      expect(button).not.toHaveAttribute('data-invalid');

      // Check the checkbox and trigger validation
      await fireEvent.click(button);
      await fireEvent.focusIn(button);
      await fireEvent.focusOut(button);

      expect(button).toHaveAttribute('data-valid', '');
      expect(button).not.toHaveAttribute('data-invalid');
    });

    it('prop: validationMode=onSubmit', async () => {
      await render(
        <Form>
          <Field.Root>
            <Checkbox.Root required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toHaveAttribute('aria-invalid');

      await fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('data-checked', '');
      await fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('data-unchecked', '');
      expect(checkbox).not.toHaveAttribute('aria-invalid');

      await fireEvent.click(screen.getByText('submit'));
      expect(checkbox).toHaveAttribute('aria-invalid', 'true');

      await fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('data-checked', '');
      expect(checkbox).not.toHaveAttribute('aria-invalid');

      await fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('data-unchecked', '');
      expect(checkbox).toHaveAttribute('aria-invalid');

      await fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('data-checked', '');
      expect(checkbox).not.toHaveAttribute('aria-invalid');
    });

    it('props: validationMode=onChange', async () => {
      await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Checkbox.Root data-testid="button" />
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
          <Checkbox.Root />
        </Field.Root>,
      );

      await user.click(screen.getByRole('checkbox'));

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe(true);
    });

    it('revalidates when a controlled value changes externally', async () => {
      const validateSpy = vi.fn((value: unknown) => ((value as boolean) ? 'error' : null));

      const App = defineComponent(() => {
        const checked = shallowRef(false);

        return () => (
          <>
            <Field.Root validationMode="onChange" validate={validateSpy} name="terms">
              <Checkbox.Root
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
          <Checkbox.Root data-testid="button" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('aria-invalid');

      await fireEvent.click(button);
      await fireEvent.focusOut(button);

      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    describe('Field.Label', () => {
      describe('explicit association', () => {
        it('when label and checkbox are siblings', async () => {
          await render(
            <Field.Root>
              <Field.Label>Label</Field.Label>
              <Checkbox.Root />
            </Field.Root>,
          );

          const label = screen.getByText('Label');
          expect(label.getAttribute('id')).not.toBe(null);

          const input = document.querySelector('input[type="checkbox"]');
          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));

          const checkbox = screen.getByRole('checkbox');
          expect(checkbox.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          expect(checkbox).toHaveAttribute('aria-checked', 'false');

          await fireEvent.click(label);
          expect(checkbox).toHaveAttribute('aria-checked', 'true');
        });
      });

      describe('implicit association', () => {
        it('sets `for` on the label', async () => {
          await render(
            <Field.Root>
              <Field.Label data-testid="label">
                <Checkbox.Root />
                OK
              </Field.Label>
            </Field.Root>,
          );

          const label = screen.getByTestId('label');
          const input = document.querySelector('input[type="checkbox"]');
          expect(label.getAttribute('for')).not.toBe(null);
          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));

          const checkbox = screen.getByRole('checkbox');
          expect(label.getAttribute('id')).not.toBe(null);
          expect(checkbox.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));

          expect(checkbox).toHaveAttribute('aria-checked', 'false');
          await fireEvent.click(screen.getByText('OK'));
          expect(checkbox).toHaveAttribute('aria-checked', 'true');
        });
      });
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <Checkbox.Root data-testid="button" aria-describedby="external-description" />
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      const internalInput = screen.getByRole<HTMLInputElement>('checkbox');

      expect(internalInput).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  it('should change state when clicking the checkbox if it has a wrapping label', async () => {
    await render(
      <label data-testid="label">
        <Checkbox.Root />
        Toggle
      </label>,
    );

    const [checkbox] = screen.getAllByRole('checkbox');

    expect(checkbox).toHaveAttribute('aria-checked', 'false');

    await fireEvent.click(checkbox);

    expect(checkbox).toHaveAttribute('aria-checked', 'true');

    await fireEvent.click(checkbox);

    expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });

  it('sets `aria-labelledby` from a sibling label associated with the hidden input', async () => {
    await render(
      <div>
        <label for="checkbox-input">Label</label>
        <Checkbox.Root id="checkbox-input" />
      </div>,
    );

    const label = screen.getByText('Label');
    expect(label.id).not.toBe('');
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-labelledby', label.id);
  });

  it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
    const TestCase = defineComponent(() => {
      const id = shallowRef('checkbox-input-a');

      return () => (
        <>
          <label for="checkbox-input-a">Label A</label>
          <label for="checkbox-input-b">Label B</label>
          <Checkbox.Root id={id.value} />
          <button
            type="button"
            onClick={() => {
              id.value = 'checkbox-input-b';
            }}
          >
            Toggle
          </button>
        </>
      );
    });

    await render(<TestCase />);

    const checkbox = screen.getByRole('checkbox');
    const labelA = screen.getByText('Label A');

    expect(labelA.id).not.toBe('');
    expect(checkbox).toHaveAttribute('aria-labelledby', labelA.id);

    await fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    const labelB = screen.getByText('Label B');

    await waitFor(() => {
      expect(checkbox).toHaveAttribute('aria-labelledby', labelB.id);
    });

    expect(labelB.id).not.toBe('');
    expect(labelB.id).not.toBe(labelA.id);
  });

  it('prefers `aria-label` over an associated label', async () => {
    await render(
      <>
        <label>
          <Checkbox.Root aria-label="lease.pdf" />
          lease.pdf
        </label>
        <Field.Root>
          <Field.Label>
            <Checkbox.Root aria-label="notes.txt" />
            notes.txt
          </Field.Label>
        </Field.Root>
      </>,
    );

    const [nativeLabelled, fieldLabelled] = screen.getAllByRole('checkbox');
    expect(nativeLabelled).not.toHaveAttribute('aria-labelledby');
    expect(nativeLabelled).toHaveAccessibleName('lease.pdf');
    expect(fieldLabelled).not.toHaveAttribute('aria-labelledby');
    expect(fieldLabelled).toHaveAccessibleName('notes.txt');
  });

  it.each(['', ' ', '\n\t '])('ignores a blank `aria-label` (%j)', async (ariaLabel) => {
    await render(
      <>
        <label>
          <Checkbox.Root aria-label={ariaLabel} />
          Native label
        </label>
        <Field.Root>
          <Field.Label>
            <Checkbox.Root aria-label={ariaLabel} />
            Field label
          </Field.Label>
        </Field.Root>
        <label for="blank-aria-label">Sibling label</label>
        <Checkbox.Root id="blank-aria-label" aria-label={ariaLabel} />
      </>,
    );

    const [nativeLabelled, fieldLabelled, siblingLabelled] = screen.getAllByRole('checkbox');
    expect(nativeLabelled).toHaveAccessibleName('Native label');
    expect(fieldLabelled).toHaveAccessibleName('Field label');
    expect(siblingLabelled).toHaveAccessibleName('Sibling label');
  });

  describe.each(['native', 'Field.Label'])('dynamic %s label', (labelType) => {
    function TestCase({
      ariaLabel,
      showLabel = true,
    }: {
      ariaLabel?: string | undefined;
      showLabel?: boolean | undefined;
    }) {
      return (
        <Field.Root>
          {showLabel &&
            (labelType === 'native' ? (
              <label for="dynamic-label">Associated label</label>
            ) : (
              <Field.Label>Associated label</Field.Label>
            ))}
          <Checkbox.Root id="dynamic-label" aria-label={ariaLabel} />
        </Field.Root>
      );
    }

    it('updates the accessible name when `aria-label` is added, cleared, or removed', async () => {
      const { setProps } = await render(<TestCase />);
      const checkbox = screen.getByRole('checkbox');

      expect(checkbox).toHaveAccessibleName('Associated label');

      await setProps({ ariaLabel: 'Custom name' });
      expect(checkbox).toHaveAccessibleName('Custom name');

      await setProps({ ariaLabel: ' \n\t ' });
      expect(checkbox).toHaveAccessibleName('Associated label');

      await setProps({ ariaLabel: 'Custom name' });
      expect(checkbox).toHaveAccessibleName('Custom name');

      await setProps({ ariaLabel: undefined });
      expect(checkbox).toHaveAccessibleName('Associated label');
    });

    it('updates the accessible name when the associated label mounts and unmounts', async () => {
      const { setProps } = await render(<TestCase showLabel={false} />);
      const checkbox = screen.getByRole('checkbox');

      expect(checkbox).toHaveAccessibleName('');

      await setProps({ showLabel: true });
      expect(checkbox).toHaveAccessibleName('Associated label');

      await setProps({ showLabel: false });
      expect(checkbox).toHaveAccessibleName('');
      expect(checkbox).not.toHaveAttribute('aria-labelledby');

      await setProps({ ariaLabel: 'Custom name' });
      expect(checkbox).toHaveAccessibleName('Custom name');

      await setProps({ showLabel: true, ariaLabel: 'Custom name' });
      expect(checkbox).toHaveAccessibleName('Custom name');

      await setProps({ showLabel: false, ariaLabel: 'Custom name' });
      expect(checkbox).toHaveAccessibleName('Custom name');

      await setProps({ showLabel: true, ariaLabel: undefined });
      expect(checkbox).toHaveAccessibleName('Associated label');
    });
  });

  it('can render a native button', async () => {
    const { container, user } = await render(<Checkbox.Root as="button" nativeButton />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
    expect(container.querySelector('button')).toBe(checkbox);

    await user.keyboard('[Tab]');
    expect(checkbox).toHaveFocus();

    await user.keyboard('[Enter]');
    expect(checkbox).toHaveAttribute('aria-checked', 'false');

    await user.keyboard('[Space]');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');

    await user.click(checkbox);
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });

  describe('exposed `inputElement`', () => {
    it('is the hidden input', async () => {
      const checkbox = shallowRef<{ inputElement: HTMLInputElement | null } | null>(null);
      await render(() => <Checkbox.Root ref={checkbox} />);

      expect(checkbox.value?.inputElement).toBe(getInput());
    });
  });

  describe('hidden input size', () => {
    it('keeps the 1px size in the next render of the checkbox', async () => {
      const { container } = await render(<Checkbox.Root required />);
      const input = container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
      input.reportValidity();

      await fireEvent.click(screen.getByRole('checkbox'));

      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
      const { width, height } = input.getBoundingClientRect();
      expect({ width, height }).toEqual({ width: 1, height: 1 });
    });
  });

  describe('v-model:checked', () => {
    it('emits `checkedChange` and then `update:checked`, before the click handler returns', async () => {
      const order: string[] = [];
      await render(
        <Checkbox.Root
          onCheckedChange={(checked: boolean) => order.push(`checkedChange ${checked}`)}
          {...{ 'onUpdate:checked': (checked: boolean) => order.push(`update:checked ${checked}`) }}
        />,
      );

      screen.getByRole('checkbox').click();
      order.push('end of the click');

      expect(order).toEqual(['checkedChange true', 'update:checked true', 'end of the click']);
    });

    it('does not emit `update:checked` for a change that a listener cancels', async () => {
      const handleUpdate = vi.fn();
      await render(
        <Checkbox.Root
          onCheckedChange={(_checked: boolean, details: Checkbox.Root.ChangeEventDetails) =>
            details.cancel()
          }
          {...{ 'onUpdate:checked': handleUpdate }}
        />,
      );

      await fireEvent.click(screen.getByRole('checkbox'));

      expect(handleUpdate).not.toHaveBeenCalled();
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
    });

    it.each([
      {
        name: 'a click on the checkbox',
        act: (user: User) => user.click(screen.getByRole('checkbox')),
      },
      {
        name: 'a click on a label around it',
        act: (user: User) => user.click(screen.getByTestId('label')),
      },
      { name: 'the Space key', act: (user: User) => user.keyboard('[Space]') },
    ])('changes one time for $name', async ({ act }) => {
      const handleChange = vi.fn();
      const { user } = await render(
        <label data-testid="label">
          <Checkbox.Root onCheckedChange={handleChange} />
          Notifications
        </label>,
      );
      screen.getByRole('checkbox').focus();

      await act(user);

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('the hidden input has the state of the checkbox', () => {
    it.each([
      { name: 'a click on the checkbox', act: () => screen.getByRole('checkbox').click() },
      { name: 'a click on the input', act: () => getInput().click() },
      { name: 'a click on a label around it', act: () => screen.getByTestId('label').click() },
    ])('after $name that a listener cancels', async ({ act }) => {
      await render(
        <label data-testid="label">
          <Checkbox.Root
            onCheckedChange={(_checked: boolean, details: Checkbox.Root.ChangeEventDetails) =>
              details.cancel()
            }
          />
        </label>,
      );

      act();
      await flushMicrotasks();

      expect(getInput().checked).toBe(false);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
    });

    it('after a click that the parent of a controlled checkbox does not accept', async () => {
      const handleUpdate = vi.fn();
      await render(<Checkbox.Root checked={false} {...{ 'onUpdate:checked': handleUpdate }} />);

      await fireEvent.click(screen.getByRole('checkbox'));
      await fireEvent.click(screen.getByRole('checkbox'));

      expect(handleUpdate.mock.calls).toEqual([[true], [true]]);
      expect(getInput().checked).toBe(false);
    });

    it.each([
      { name: 'a click on the checkbox', act: () => screen.getByRole('checkbox') },
      { name: 'a click on the input', act: () => getInput() },
    ])('has `indeterminate` again after $name', async ({ act }) => {
      await render(<Checkbox.Root indeterminate />);

      act().click();
      await flushMicrotasks();

      expect(getInput().checked).toBe(true);
      expect(getInput().indeterminate).toBe(true);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
    });

    it.each([
      {
        name: 'a click on the checkbox',
        props: { readOnly: true },
        act: () => screen.getByRole('checkbox'),
      },
      { name: 'a click on the input', props: { readOnly: true }, act: () => getInput() },
      {
        name: 'a click that a listener cancels',
        props: {
          onCheckedChange: (_checked: boolean, details: Checkbox.Root.ChangeEventDetails) =>
            details.cancel(),
        },
        act: () => screen.getByRole('checkbox'),
      },
    ])('keeps `checked` and `indeterminate` after $name', async ({ act, props }) => {
      await render(<Checkbox.Root indeterminate defaultChecked {...props} />);
      expect(getInput().checked).toBe(true);
      expect(getInput().indeterminate).toBe(true);

      act().click();
      await flushMicrotasks();

      expect(getInput().checked).toBe(true);
      expect(getInput().indeterminate).toBe(true);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
    });

    it('has `indeterminate` again after a click that the parent of a controlled checkbox keeps', async () => {
      await render(<Checkbox.Root checked={false} indeterminate />);

      await fireEvent.click(screen.getByRole('checkbox'));

      expect(getInput().checked).toBe(false);
      expect(getInput().indeterminate).toBe(true);
    });

    it('follows a change of `indeterminate`', async () => {
      const { setProps } = await render(<Checkbox.Root />);
      expect(getInput().indeterminate).toBe(false);

      await setProps({ indeterminate: true });

      expect(getInput().indeterminate).toBe(true);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
      expect(screen.getByRole('checkbox')).toHaveAttribute('data-indeterminate', '');
      expect(screen.getByRole('checkbox')).not.toHaveAttribute('data-unchecked');

      await setProps({ indeterminate: false });

      expect(getInput().indeterminate).toBe(false);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole('checkbox')).toHaveAttribute('data-unchecked', '');
      expect(screen.getByRole('checkbox')).not.toHaveAttribute('data-indeterminate');
    });

    it.each([
      {
        name: 'an uncontrolled checkbox',
        props: { defaultChecked: true },
        change: (input: HTMLInputElement) => {
          input.checked = false;
        },
        expected: { checked: true, indeterminate: false },
      },
      {
        name: 'a controlled checkbox',
        props: { checked: true },
        change: (input: HTMLInputElement) => {
          input.checked = false;
        },
        expected: { checked: true, indeterminate: false },
      },
      {
        name: 'an indeterminate checkbox',
        props: { indeterminate: true },
        change: (input: HTMLInputElement) => {
          input.checked = true;
        },
        expected: { checked: false, indeterminate: true },
      },
    ])(
      'after the hydration of $name whose input changed before',
      async ({ props, change, expected }) => {
        const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
        const container = document.createElement('div');
        document.body.append(container);
        container.innerHTML = serverHtml;
        const input = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        // A browser that restores the form state of the page, or a click on a label.
        change(input);

        const app = createSSRApp(CheckboxRootHydration, props);
        onTestFinished(() => {
          app.unmount();
          container.remove();
        });
        app.mount(container);
        await flushMicrotasks();

        expect(container.querySelector('input[type="checkbox"]')).toBe(input);
        expect({ checked: input.checked, indeterminate: input.indeterminate }).toEqual(expected);
        expect(takeReportedMessages()).toEqual([]);
      },
    );

    it('after a `pageshow` event, because a browser can restore the form state after the mount', async () => {
      const handleChange = vi.fn();
      await render(<Checkbox.Root indeterminate onCheckedChange={handleChange} />);
      getInput().checked = true;
      getInput().indeterminate = false;

      window.dispatchEvent(new PageTransitionEvent('pageshow'));

      expect(getInput().checked).toBe(false);
      expect(getInput().indeterminate).toBe(true);

      await fireEvent.click(screen.getByRole('checkbox'));

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
      { name: 'an indeterminate checkbox', props: { indeterminate: true }, off: [], on: ['on'] },
    ])('submits $name', async ({ props, off, on }) => {
      await render(
        <form data-testid="form">
          <Checkbox.Root name="notifications" {...props} />
        </form>,
      );

      expect(getFormData()).toEqual(off);

      await fireEvent.click(screen.getByRole('checkbox'));

      expect(getFormData()).toEqual(on);

      await fireEvent.click(screen.getByRole('checkbox'));

      expect(getFormData()).toEqual(off);
    });

    it.each([
      { name: 'a checkbox with no name', props: { name: undefined } },
      { name: 'a disabled checkbox', props: { disabled: true } },
    ])('submits nothing for $name', async ({ props }) => {
      await render(
        <form data-testid="form">
          <Checkbox.Root name="notifications" defaultChecked uncheckedValue="no" {...props} />
        </form>,
      );

      expect(Array.from(new FormData(screen.getByTestId<HTMLFormElement>('form')))).toEqual([]);
    });

    it('does not submit a required checkbox that is off, and focuses the checkbox', async () => {
      const handleSubmit = vi.fn((event: Event) => event.preventDefault());
      const { user } = await render(
        <form data-testid="form" onSubmit={handleSubmit}>
          <Checkbox.Root name="notifications" required aria-label="Notifications" />
          <button type="submit">Submit</button>
        </form>,
      );
      const input = getInput();

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(input.validity.valueMissing).toBe(true);
      expect(screen.getByRole('checkbox')).toHaveFocus();

      await user.click(screen.getByRole('checkbox'));
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
        'puts an uncontrolled checkbox back to its default, $name',
        async ({ defaultChecked, data }) => {
          const handleChange = vi.fn();
          await render(
            <form data-testid="form">
              <Checkbox.Root
                name="notifications"
                value="yes"
                uncheckedValue="no"
                defaultChecked={defaultChecked}
                onCheckedChange={handleChange}
              />
              <button type="reset">Reset</button>
            </form>,
          );
          const checkbox = screen.getByRole('checkbox');
          await fireEvent.click(checkbox);
          expect(checkbox).toHaveAttribute('aria-checked', String(!defaultChecked));

          await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
          await settleReset();

          expect(checkbox).toHaveAttribute('aria-checked', String(defaultChecked));
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
          name: 'a checkbox whose listener cancels',
          renderForm: () => {
            let cancel = false;
            return () => (
              <form data-testid="form" onReset={() => (cancel = true)}>
                <Checkbox.Root
                  name="notifications"
                  onCheckedChange={(
                    _checked: boolean,
                    details: Checkbox.Root.ChangeEventDetails,
                  ) => {
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
          name: 'a checkbox whose form cancels the reset',
          renderForm: () => () => (
            <form data-testid="form" onReset={(event: Event) => event.preventDefault()}>
              <Checkbox.Root name="notifications" />
            </form>
          ),
        },
        {
          name: 'a checkbox that the window cancels',
          renderForm: () => {
            // The window gets the event after the root node of the checkbox.
            const cancelReset = (event: Event) => event.preventDefault();
            window.addEventListener('reset', cancelReset);
            onTestFinished(() => window.removeEventListener('reset', cancelReset));
            return () => (
              <form data-testid="form">
                <Checkbox.Root name="notifications" />
              </form>
            );
          },
        },
        {
          name: 'a checkbox of another form',
          renderForm: () => () => (
            <div>
              <form data-testid="form" />
              <form id="other" />
              <Checkbox.Root name="notifications" form="other" />
            </div>
          ),
        },
      ])('does not change $name', async ({ renderForm }) => {
        await render(h(defineComponent(renderForm)));
        const checkbox = screen.getByRole('checkbox');
        await fireEvent.click(checkbox);

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(checkbox).toHaveAttribute('aria-checked', 'true');
        expect(getInput().checked).toBe(true);
      });

      it('does not change a controlled checkbox, and emits nothing', async () => {
        const handleChange = vi.fn();
        const handleUpdate = vi.fn();
        const App = defineComponent(() => {
          const checked = shallowRef(false);
          return () => (
            <form data-testid="form">
              <Checkbox.Root
                name="notifications"
                checked={checked.value}
                onCheckedChange={handleChange}
                {...{
                  'onUpdate:checked': (next: boolean) => {
                    handleUpdate(next);
                    checked.value = next;
                  },
                }}
              />
            </form>
          );
        });
        await render(<App />);
        await fireEvent.click(screen.getByRole('checkbox'));
        handleChange.mockClear();
        handleUpdate.mockClear();

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
        expect(getInput().checked).toBe(true);
        expect(handleChange).not.toHaveBeenCalled();
        expect(handleUpdate).not.toHaveBeenCalled();
      });

      it('resets a checkbox outside the form that its `form` prop names', async () => {
        await render(
          <div>
            <form data-testid="form" id="external" />
            <Checkbox.Root name="notifications" form="external" />
          </div>,
        );
        const checkbox = screen.getByRole('checkbox');
        await fireEvent.click(checkbox);
        expect(getFormData()).toEqual(['on']);

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(checkbox).toHaveAttribute('aria-checked', 'false');
        expect(getFormData()).toEqual([]);
      });

      it('does not change `indeterminate`', async () => {
        await render(
          <form data-testid="form">
            <Checkbox.Root name="notifications" indeterminate defaultChecked />
          </form>,
        );
        const input = getInput();
        await fireEvent.click(screen.getByRole('checkbox'));
        expect(input.checked).toBe(false);

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(input.checked).toBe(true);
        expect(input.indeterminate).toBe(true);
        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
      });
    });
  });

  describe('in a field', () => {
    it('takes `disabled` from the item of the field', async () => {
      await render(
        <Field.Root>
          <Field.Item disabled>
            <Checkbox.Root name="notifications" data-testid="checkbox" />
          </Field.Item>
        </Field.Root>,
      );

      expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByTestId('checkbox')).toHaveAttribute('data-disabled');
      expect(getInput().disabled).toBe(true);
    });

    it('leaves a disabled checkbox out of the values of the form', async () => {
      const handleFormSubmit = vi.fn();
      await render(
        <Form data-testid="form" onFormSubmit={handleFormSubmit}>
          <Field.Root name="enabled">
            <Checkbox.Root defaultChecked />
          </Field.Root>
          <Field.Root name="disabled">
            <Checkbox.Root defaultChecked disabled />
          </Field.Root>
        </Form>,
      );

      await fireEvent.submit(screen.getByTestId('form'));

      expect(handleFormSubmit).toHaveBeenCalledTimes(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ enabled: true });
    });

    it('names the messages of its item and of its field', async () => {
      await render(
        <Field.Root>
          <Field.Description data-testid="field-description">Field</Field.Description>
          <Field.Item>
            <Checkbox.Root data-testid="checkbox" />
            <Field.Description data-testid="item-description">Item</Field.Description>
          </Field.Item>
        </Field.Root>,
      );
      const describedBy = `${screen.getByTestId('field-description').id} ${screen.getByTestId('item-description').id}`;

      expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-describedby', describedBy);
      expect(getInput()).toHaveAttribute('aria-describedby', describedBy);
    });

    it('sets [data-touched] when a disabled checkbox loses focus', async () => {
      await render(
        <Field.Root>
          <Checkbox.Root disabled data-testid="button" />
        </Field.Root>,
      );

      await fireEvent.focusIn(screen.getByTestId('button'));
      await fireEvent.focusOut(screen.getByTestId('button'));

      expect(screen.getByTestId('button')).toHaveAttribute('data-touched', '');
    });

    it('leaves out of the validation of the form a checkbox that another form owns', async () => {
      const handleFormSubmit = vi.fn();
      await render(
        <>
          <Form data-testid="form" onFormSubmit={handleFormSubmit}>
            <Field.Root name="terms">
              <Checkbox.Root required form="other" />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
          <form id="other" />
        </>,
      );

      await fireEvent.submit(screen.getByTestId('form'));

      expect(screen.queryByTestId('error')).toBe(null);
      expect(handleFormSubmit).toHaveBeenCalledTimes(1);
    });

    it('stops validating with a checkbox that left the field', async () => {
      const field = shallowRef<{ validate: () => void } | null>(null);
      const App = defineComponent(() => {
        const shown = shallowRef(true);
        return () => (
          <>
            <Field.Root ref={field} name="terms">
              {shown.value && <Checkbox.Root required />}
              <Field.Error data-testid="error" />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                shown.value = false;
              }}
            >
              Hide
            </button>
          </>
        );
      });
      await render(<App />);
      await fireEvent.click(screen.getByRole('button', { name: 'Hide' }));

      field.value?.validate();
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
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
        expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-invalid');
      }

      // The input keeps no message of the field. A required checkbox that is off keeps the message
      // of its native constraint.
      function expectInputConstraint(valueMissing: boolean) {
        const input = getInput();
        expect(input.validity.customError).toBe(false);
        expect(input.validity.valueMissing).toBe(valueMissing);
        expect(Boolean(input.validationMessage)).toBe(valueMissing);
      }

      it.each([
        {
          name: 'a checkbox at its default',
          valueMissing: false,
          renderForm: () => () => (
            <Form data-testid="form">
              <Field.Root
                data-testid="root"
                name="notifications"
                validate={(value) => (value ? null : 'Tick it')}
              >
                <Checkbox.Root aria-label="Notifications" />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          ),
          makeInvalid: submitForm,
        },
        {
          name: 'a required checkbox at its default',
          valueMissing: true,
          renderForm: () => () => (
            <Form data-testid="form">
              <Field.Root data-testid="root" name="notifications">
                <Checkbox.Root aria-label="Notifications" required />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          ),
          makeInvalid: submitForm,
        },
        {
          name: 'the form for a checkbox at its default',
          valueMissing: false,
          renderForm: () => () => (
            <Form data-testid="form" errors={{ notifications: 'Server error' }}>
              <Field.Root data-testid="root" name="notifications">
                <Checkbox.Root aria-label="Notifications" />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          ),
          makeInvalid: undefined,
        },
        {
          name: 'a controlled checkbox',
          valueMissing: false,
          renderForm: () => {
            const checked = shallowRef(false);
            return () => (
              <Form data-testid="form">
                <Field.Root
                  data-testid="root"
                  name="notifications"
                  validate={(value) => (value ? null : 'Tick it')}
                >
                  <Checkbox.Root
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

        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
        expectNeutralField();
        expectInputConstraint(valueMissing);
      });

      it('VUE-21: clears the error of a checkbox whose listener cancels the reset, and validates the next click', async () => {
        const validate = vi.fn((value: unknown) => (value ? 'Untick it' : null));
        await render(
          <Form data-testid="form">
            <Field.Root data-testid="root" name="notifications" validate={validate}>
              <Checkbox.Root
                aria-label="Notifications"
                onCheckedChange={(_checked: boolean, details: Checkbox.Root.ChangeEventDetails) => {
                  if (details.event.type === 'reset') {
                    details.cancel();
                  }
                }}
              />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        await fireEvent.click(screen.getByRole('checkbox'));
        await submitForm();
        expect(screen.getByTestId('error')).toHaveTextContent('Untick it');

        await resetForm();

        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
        expect(validate).toHaveBeenCalledTimes(1);
        expectNeutralField();
        expectInputConstraint(false);

        await fireEvent.click(screen.getByRole('checkbox'));

        expect(validate).toHaveBeenCalledTimes(2);
        expect(validate.mock.lastCall?.[0]).toBe(false);
        expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');
      });

      it('VUE-21: clears the error when the reset unticks the checkbox, does not validate it, and validates the next click', async () => {
        const validate = vi.fn((value: unknown) => (value ? 'Untick it' : null));
        await render(
          <Form data-testid="form">
            <Field.Root
              data-testid="root"
              name="notifications"
              validate={validate}
              validationMode="onChange"
            >
              <Checkbox.Root aria-label="Notifications" />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        await fireEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByTestId('error')).toHaveTextContent('Untick it');

        await resetForm();

        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
        expect(validate).toHaveBeenCalledTimes(1);
        expectNeutralField();
        expectInputConstraint(false);

        await fireEvent.click(screen.getByRole('checkbox'));

        expect(validate).toHaveBeenCalledTimes(2);
        expect(validate.mock.lastCall?.[0]).toBe(true);
        expect(screen.getByTestId('error')).toHaveTextContent('Untick it');
      });

      it('VUE-21: shows no error when the reset unticks a required checkbox that was valid', async () => {
        const validate = vi.fn();
        const { container } = await render(
          <Form data-testid="form">
            <Field.Root data-testid="root" name="notifications" validate={validate}>
              <Checkbox.Root aria-label="Notifications" required />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        // Firefox loads the page again for a valid submit that no listener prevents.
        container.addEventListener('submit', (event) => event.preventDefault());
        await fireEvent.click(screen.getByRole('checkbox'));
        await submitForm();
        expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');
        expect(validate).toHaveBeenCalledTimes(1);

        await resetForm();

        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
        expect(validate).toHaveBeenCalledTimes(1);
        expectNeutralField();
        expectInputConstraint(true);
      });

      it('VUE-21: removes the validity mark that a change gave to a field with an error of the form', async () => {
        await render(
          <Form data-testid="form" errors={{ notifications: 'Server error' }}>
            <Field.Root data-testid="root" name="notifications">
              <Checkbox.Root aria-label="Notifications" />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        await fireEvent.click(screen.getByRole('checkbox'));
        expect(screen.queryByTestId('error')).toBe(null);
        expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');

        await resetForm();

        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
        expectNeutralField();
      });
    });
  });

  describe('Enter with a real key press', () => {
    it('lets a keydown listener of an ancestor read `defaultPrevented` as `false`, and stop the submit', async () => {
      const handleSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
      const handleKeydown = vi.fn((event: KeyboardEvent) => {
        const defaultPrevented = event.defaultPrevented;
        event.preventDefault();
        return defaultPrevented;
      });
      await render(
        <Form onSubmit={handleSubmit} onKeydown={handleKeydown}>
          <Checkbox.Root />
          <button type="submit">Submit</button>
        </Form>,
      );
      screen.getByRole('checkbox').focus();

      await userEvent.keyboard('{Enter}');
      await flushMicrotasks();

      expect(handleKeydown.mock.results.at(-1)?.value).toBe(false);
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('gives the event back with its own `defaultPrevented` and `preventDefault` removed', async () => {
      let keydownEvent: KeyboardEvent | undefined;
      await render(
        <div
          onKeydown={(event: KeyboardEvent) => {
            keydownEvent = event;
          }}
        >
          <Checkbox.Root />
        </div>,
      );
      screen.getByRole('checkbox').focus();

      await userEvent.keyboard('{Enter}');

      // The checkbox prevented the default of the browser, and the event reads that again.
      await waitFor(() => {
        expect(keydownEvent?.defaultPrevented).toBe(true);
      });
      expect(Object.hasOwn(keydownEvent!, 'defaultPrevented')).toBe(false);
      expect(Object.hasOwn(keydownEvent!, 'preventDefault')).toBe(false);
    });

    it('clicks the submit button when no listener prevents the default', async () => {
      const handleSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
      const handleKeydown = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
      await render(
        <Form onSubmit={handleSubmit} onKeydown={handleKeydown}>
          <Checkbox.Root />
          <button type="submit">Submit</button>
        </Form>,
      );
      screen.getByRole('checkbox').focus();

      await userEvent.keyboard('{Enter}');
      await flushMicrotasks();

      expect(handleKeydown.mock.results.at(-1)?.value).toBe(false);
      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('server-side rendering', () => {
    it.each([
      { name: 'a checkbox that is off', props: {}, indeterminate: false },
      {
        name: 'a checkbox that is on',
        props: { defaultChecked: true, name: 'notifications' },
        indeterminate: false,
      },
      { name: 'an indeterminate checkbox', props: { indeterminate: true }, indeterminate: true },
      {
        name: 'a label of the provider before it',
        props: { label: 'before' },
        indeterminate: false,
      },
      { name: 'a label of the provider after it', props: { label: 'after' }, indeterminate: false },
      { name: 'a checkbox in a native label', props: { label: 'native' }, indeterminate: false },
      {
        name: 'a native button',
        props: { label: 'before', nativeButton: true },
        indeterminate: false,
      },
    ])('hydrates $name with no mismatch', async ({ props, indeterminate }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      const { container } = await hydrate(CheckboxRootHydration, { serverHtml, props });

      expect(
        container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.indeterminate,
      ).toBe(indeterminate);
    });
  });
});
