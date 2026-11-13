import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, h, KeepAlive, ref, shallowRef, Teleport, watch } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
} from '#test-utils';
import CheckboxGroupHydration from './CheckboxGroupHydration.test.vue';

type FieldRootInstance = InstanceType<typeof Field.Root>;
type FormInstance = { element: HTMLFormElement | null };

const HYDRATION_FIXTURE = 'src/checkbox-group/CheckboxGroupHydration.test.vue';

// A container that a case gives to a `Teleport`. The container leaves the document with the case.
function createPortalContainer() {
  const container = document.createElement('div');
  document.body.append(container);
  onTestFinished(() => container.remove());
  return container;
}

// The part follows a reset in a timeout of 0 ms, after the listeners of the event.
// The cases that call this function use fake timers.
async function settleReset() {
  vi.advanceTimersByTime(0);
  await flushMicrotasks();
}

// The hidden inputs of the checkboxes, in the order of the document.
function getInputs() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
}

describe('<CheckboxGroup />', () => {
  const { render } = createRenderer();

  describeConformance(<CheckboxGroup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  describe('prop: id', () => {
    it('is forwarded to the root element', async () => {
      await render(<CheckboxGroup id="group-id" />);

      expect(screen.getByRole('group')).toHaveAttribute('id', 'group-id');
    });
  });

  describe('prop: value', () => {
    it('should control the value', async () => {
      const App = defineComponent(() => {
        const value = shallowRef(['red']);
        return () => (
          <CheckboxGroup
            value={value.value}
            onValueChange={(nextValue: string[]) => {
              value.value = nextValue;
            }}
          >
            <Checkbox.Root name="red" data-testid="red" />
            <Checkbox.Root name="green" data-testid="green" />
            <Checkbox.Root name="blue" data-testid="blue" />
          </CheckboxGroup>
        );
      });

      await render(<App />);

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      await fireEvent.click(green);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      await fireEvent.click(blue);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'true');

      await fireEvent.click(green);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'true');
    });

    it('supports an empty string item value', async () => {
      const App = defineComponent(() => {
        const value = shallowRef(['']);
        return () => (
          <CheckboxGroup
            value={value.value}
            onValueChange={(nextValue: string[]) => {
              value.value = nextValue;
            }}
          >
            <Checkbox.Root value="" data-testid="empty" />
            <Checkbox.Root value="other" data-testid="other" />
          </CheckboxGroup>
        );
      });

      await render(<App />);

      const empty = screen.getByTestId('empty');
      const other = screen.getByTestId('other');

      expect(empty).toHaveAttribute('aria-checked', 'true');
      expect(other).toHaveAttribute('aria-checked', 'false');

      await fireEvent.click(empty);

      expect(empty).toHaveAttribute('aria-checked', 'false');
    });

    it('treats a controlled value that becomes undefined as an empty array', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const App = defineComponent(() => {
        const value = shallowRef<string[] | undefined>(['red']);
        return () => (
          <>
            <CheckboxGroup value={value.value}>
              <Checkbox.Root value="red" data-testid="red" />
            </CheckboxGroup>
            <button
              type="button"
              onClick={() => {
                value.value = undefined;
              }}
            >
              Clear
            </button>
          </>
        );
      });

      try {
        await render(<App />);

        expect(screen.getByTestId('red')).toHaveAttribute('aria-checked', 'true');

        await fireEvent.click(screen.getByText('Clear'));

        expect(screen.getByTestId('red')).toHaveAttribute('aria-checked', 'false');
      } finally {
        consoleError.mockRestore();
      }
    });
  });

  describe('prop: onValueChange', () => {
    it('should be called when the value changes', async () => {
      const handleValueChange = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef<string[]>([]);
        return () => (
          <CheckboxGroup
            value={value.value}
            onValueChange={(nextValue: string[]) => {
              value.value = nextValue;
              handleValueChange(nextValue);
            }}
          >
            <Checkbox.Root name="red" data-testid="red" />
            <Checkbox.Root name="green" data-testid="green" />
            <Checkbox.Root name="blue" data-testid="blue" />
          </CheckboxGroup>
        );
      });

      await render(<App />);

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      await fireEvent.click(red);

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);

      await fireEvent.click(green);

      expect(handleValueChange.mock.calls.length).toBe(2);
      expect(handleValueChange.mock.calls[1][0]).toEqual(['red', 'green']);

      await fireEvent.click(blue);

      expect(handleValueChange.mock.calls.length).toBe(3);
      expect(handleValueChange.mock.calls[2][0]).toEqual(['red', 'green', 'blue']);
    });

    it('should treat an omitted defaultValue as an empty array', async () => {
      const handleValueChange = vi.fn();

      await render(
        <CheckboxGroup onValueChange={handleValueChange}>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>,
      );

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');

      await fireEvent.click(red);

      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);

      await fireEvent.click(green);

      expect(handleValueChange.mock.calls[1][0]).toEqual(['red', 'green']);

      await fireEvent.click(red);

      expect(handleValueChange.mock.calls[2][0]).toEqual(['green']);
    });

    it('does not update the group when onValueChange cancels the event', async () => {
      const handleValueChange = vi.fn(
        (_value: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      await render(
        <CheckboxGroup onValueChange={handleValueChange}>
          <Checkbox.Root value="red" data-testid="red" />
          <Checkbox.Root value="green" data-testid="green" />
        </CheckboxGroup>,
      );

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');

      await fireEvent.click(red);

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);
      expect(red).toHaveAttribute('aria-checked', 'false');
      expect(green).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: defaultValue', () => {
    it('treats null as an empty array', async () => {
      // @ts-expect-error Simulates a JavaScript consumer passing an unsupported value.
      const group = <CheckboxGroup defaultValue={null} />;

      await render(group);

      expect(screen.getByRole('group')).toBeInTheDocument();
    });

    it('should set the initial value', async () => {
      await render(
        <CheckboxGroup defaultValue={['red']}>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>,
      );

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      await fireEvent.click(green);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: disabled', () => {
    it('disables all checkboxes when `true`', async () => {
      await render(
        <CheckboxGroup disabled>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>,
      );

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-disabled', 'true');
      expect(green).toHaveAttribute('aria-disabled', 'true');
      expect(blue).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not disable all checkboxes when `false`', async () => {
      await render(
        <CheckboxGroup disabled={false}>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>,
      );

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).not.toHaveAttribute('aria-disabled', 'true');
      expect(green).not.toHaveAttribute('aria-disabled', 'true');
      expect(blue).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('takes precedence over individual checkboxes', async () => {
      await render(
        <CheckboxGroup disabled>
          <Checkbox.Root name="red" data-testid="red" disabled={false} />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>,
      );

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-disabled', 'true');
      expect(green).toHaveAttribute('aria-disabled', 'true');
      expect(blue).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Field', () => {
    it('[data-dirty]', async () => {
      await render(
        <Field.Root name="fruits">
          <CheckboxGroup defaultValue={['apple']}>
            <Field.Item>
              <Checkbox.Root value="apple" data-testid="apple" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="banana" data-testid="banana" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const group = screen.getByRole('group');
      const banana = screen.getByTestId('banana');

      expect(group).not.toHaveAttribute('data-dirty');

      await fireEvent.click(banana);

      expect(group).toHaveAttribute('data-dirty', '');

      await fireEvent.click(banana);

      expect(group).not.toHaveAttribute('data-dirty');
    });

    it('[data-filled] follows the group value even without a matching rendered checkbox', async () => {
      await render(
        <Field.Root name="fruits">
          <CheckboxGroup defaultValue={['cherry']}>
            <Field.Item>
              <Checkbox.Root value="apple" data-testid="apple" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const group = screen.getByRole('group');
      const apple = screen.getByTestId('apple');

      expect(group).toHaveAttribute('data-filled', '');

      await fireEvent.click(apple);
      await fireEvent.click(apple);

      expect(group).toHaveAttribute('data-filled', '');
    });

    it('keeps a required error while another required checkbox in the group is unchecked', async () => {
      const { user } = await render(
        <Form onSubmit={(event: SubmitEvent) => event.preventDefault()}>
          <Field.Root name="protocols">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="http" data-testid="checkbox" required />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="https" data-testid="checkbox" required />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const checkboxes = screen.getAllByTestId('checkbox');

      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // Checking only one of the two required checkboxes must not clear the error.
      await user.click(checkboxes[1]);
      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await user.click(checkboxes[0]);
      await user.click(screen.getByText('submit'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('ignores a disabled required checkbox when validating the group', async () => {
      const { user } = await render(
        <Form onSubmit={(event: SubmitEvent) => event.preventDefault()}>
          <Field.Root name="protocols">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="https" data-testid="cb-enabled" required />
              </Field.Item>
              {/* Mounted last so it would otherwise win the shared input ref. */}
              <Field.Item>
                <Checkbox.Root value="http" data-testid="cb-disabled" required disabled />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // A disabled checkbox is exempt from constraint validation, so checking the only
      // enabled required checkbox is enough to satisfy the field.
      await user.click(screen.getByTestId('cb-enabled'));
      await user.click(screen.getByText('submit'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('keeps validating the remaining required checkbox after a checked sibling unmounts', async () => {
      const App = defineComponent(() => {
        const showHttps = shallowRef(true);
        return () => (
          <Form onSubmit={(event: SubmitEvent) => event.preventDefault()}>
            <Field.Root name="protocols">
              <CheckboxGroup defaultValue={[]}>
                <Field.Item>
                  <Checkbox.Root value="http" data-testid="checkbox-http" required />
                </Field.Item>
                {showHttps.value && (
                  <Field.Item>
                    <Checkbox.Root value="https" data-testid="checkbox-https" required />
                  </Field.Item>
                )}
              </CheckboxGroup>
              <Field.Error match="valueMissing" data-testid="error">
                required
              </Field.Error>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                showHttps.value = false;
              }}
            >
              remove
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // Check `https` (the last-mounted input), then unmount it. Only the registry can keep
      // validating the still-unchecked `http`.
      await user.click(screen.getByTestId('checkbox-https'));
      await user.click(screen.getByText('remove'));
      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // Checking the remaining required checkbox satisfies the field.
      await user.click(screen.getByTestId('checkbox-http'));
      await user.click(screen.getByText('submit'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('validationMode=onChange keeps the error until every required checkbox is ticked', async () => {
      const { user } = await render(
        <Field.Root name="protocols" validationMode="onChange">
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" required />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" required />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error match="valueMissing" data-testid="error">
            required
          </Field.Error>
        </Field.Root>,
      );

      expect(screen.queryByTestId('error')).toBe(null);

      // Ticking the second (last-mounted) checkbox must not clear the requirement on the first.
      await user.click(screen.getByTestId('cb-https'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await user.click(screen.getByTestId('cb-http'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('validationMode=onBlur keeps the error until every required checkbox is ticked', async () => {
      const { user } = await render(
        <Field.Root name="protocols" validationMode="onBlur">
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" required />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" required />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error match="valueMissing" data-testid="error">
            required
          </Field.Error>
        </Field.Root>,
      );

      await user.click(screen.getByTestId('cb-https'));
      expect(screen.queryByTestId('error')).toBe(null);

      await fireEvent.focusOut(screen.getByTestId('cb-https'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await user.click(screen.getByTestId('cb-http'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('does not leave a stale custom error when toggling checkboxes in a group', async () => {
      const validateSpy = vi.fn((value: unknown) =>
        (value as string[]).length < 2 ? 'pick two' : null,
      );
      await render(
        <Field.Root name="protocols" validationMode="onChange" validate={validateSpy}>
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const http = screen.getByTestId('cb-http');
      const https = screen.getByTestId('cb-https');

      await fireEvent.click(http);
      expect(http).toHaveAttribute('aria-invalid', 'true');

      // Selecting both clears the field-level error; no stale custom validation result should keep
      // the group invalid.
      await fireEvent.click(https);
      expect(http).not.toHaveAttribute('aria-invalid');
      expect(https).not.toHaveAttribute('aria-invalid');

      // Unticking one brings the real error back (not a phantom from a prior commit).
      await fireEvent.click(http);
      expect(https).toHaveAttribute('aria-invalid', 'true');
    });

    it('clears custom validity from disabled registered inputs when the group becomes valid', async () => {
      const App = defineComponent(() => {
        const disabled = shallowRef(false);
        const value = shallowRef<string[]>([]);
        const validate = (nextValue: unknown) =>
          (nextValue as string[]).length < 2 ? 'pick two' : null;

        return () => (
          <Field.Root name="protocols" validationMode="onChange" validate={validate}>
            <CheckboxGroup
              value={value.value}
              onValueChange={(nextValue: string[]) => {
                value.value = nextValue;
              }}
            >
              <Field.Item>
                <Checkbox.Root value="http" data-testid="cb-http" disabled={disabled.value} />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="https" data-testid="cb-https" />
              </Field.Item>
            </CheckboxGroup>
            <button
              type="button"
              onClick={() => {
                disabled.value = true;
              }}
            >
              disable
            </button>
          </Field.Root>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByTestId('cb-http'));

      const httpInput = document.querySelector<HTMLInputElement>(
        'input[type="checkbox"][value="http"]',
      );
      expect(httpInput?.validity.customError).toBe(true);

      await user.click(screen.getByText('disable'));
      await user.click(screen.getByTestId('cb-https'));

      expect(httpInput?.validity.customError).toBe(false);
    });

    it('prop: validationMode=onSubmit', async () => {
      const validateSpy = vi.fn((value: unknown) => {
        const v = value as string[];
        if (v.length === 0) {
          return 'custom error 1';
        }
        if (v.length < 2) {
          return 'custom error 2';
        }
        if (v.includes('two')) {
          return 'custom error 3';
        }
        return null;
      });
      const { user } = await render(
        <Form>
          <Field.Root validate={validateSpy} name="test">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="one" data-testid="checkbox" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="two" data-testid="checkbox" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="three" data-testid="checkbox" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, checkbox2, checkbox3] = checkboxes;
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      await user.click(checkbox2);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      await user.click(screen.getByText('submit'));
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid'));

      await user.click(checkbox1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two', 'one']);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid'));
      await user.click(checkbox2);
      await user.click(checkbox3);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['one', 'three']);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
    });

    it('prop: validationMode=onChange', async () => {
      const validateSpy = vi.fn((value: unknown) => {
        const v = value as string[];
        return v.includes('one') ? 'error' : null;
      });
      await render(
        <Field.Root validationMode="onChange" validate={validateSpy} name="apple">
          <CheckboxGroup defaultValue={['one']}>
            <Field.Item>
              <Checkbox.Root value="one" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="two" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="three" data-testid="checkbox" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, checkbox2, checkbox3] = checkboxes;

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      await fireEvent.click(checkbox1);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual([]);

      await fireEvent.click(checkbox2);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      expect(validateSpy.mock.calls.length).toBe(2);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two']);

      await fireEvent.click(checkbox1);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
      expect(validateSpy.mock.calls.length).toBe(3);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two', 'one']);

      await fireEvent.click(checkbox3);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });

    it('revalidates when the controlled value changes externally', async () => {
      const validateSpy = vi.fn((value: unknown) => {
        const values = value as string[];
        return values.includes('one') ? 'error' : null;
      });

      const App = defineComponent(() => {
        const selected = shallowRef<string[]>([]);

        return () => (
          <>
            <Field.Root validationMode="onChange" validate={validateSpy} name="apple">
              <CheckboxGroup value={selected.value}>
                <Field.Item>
                  <Checkbox.Root value="one" data-testid="checkbox" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="two" data-testid="checkbox" />
                </Field.Item>
              </CheckboxGroup>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                selected.value = ['one'];
              }}
            >
              Select externally
            </button>
          </>
        );
      });

      await render(<App />);

      const checkboxes = screen.getAllByTestId('checkbox');
      const toggle = screen.getByText('Select externally');

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      const initialCallCount = validateSpy.mock.calls.length;

      await fireEvent.click(toggle);

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['one']);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });

    it('prop: validationMode=onBlur', async () => {
      const validateSpy = vi.fn((value: unknown) => {
        const v = value as string[];
        return v.includes('one') ? 'error' : null;
      });
      await render(
        <Field.Root validationMode="onBlur" validate={validateSpy} name="apple">
          <CheckboxGroup defaultValue={['one']}>
            <Field.Item>
              <Checkbox.Root value="one" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="two" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="three" data-testid="checkbox" />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, , checkbox3] = checkboxes;

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      await fireEvent.click(checkbox1);
      expect(validateSpy.mock.calls.length).toBe(0);
      await fireEvent.focusOut(checkbox1);
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual([]);

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      await fireEvent.click(checkbox3);
      expect(validateSpy.mock.calls.length).toBe(1);
      await fireEvent.focusOut(checkbox3);
      expect(validateSpy.mock.calls.length).toBe(2);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['three']);

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      await fireEvent.click(checkbox1);
      expect(validateSpy.mock.calls.length).toBe(2);
      await fireEvent.focusOut(checkbox1);
      expect(validateSpy.mock.calls.length).toBe(3);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['three', 'one']);

      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });
  });

  describe('Field.Label', () => {
    // `expectedCount` is required: a set of unique ids is trivially unique when it is empty,
    // so a regression that drops every id would otherwise pass.
    function expectUniqueIds(expectedCount: number) {
      const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
      expect(ids).toHaveLength(expectedCount);
      expect(new Set(ids).size).toBe(ids.length);
    }

    it.each([false, true])(
      'keeps ids unique without allValues in a shared Field.Root (nativeButton=%s)',
      async (nativeButton) => {
        const checkboxProps = { nativeButton, as: nativeButton ? 'button' : undefined };

        await render(
          <Field.Root name="apples">
            <Field.Label>Apples</Field.Label>
            <CheckboxGroup>
              <Checkbox.Root value="fuji" {...checkboxProps} />
              <Checkbox.Root value="gala" {...checkboxProps} />
            </CheckboxGroup>
          </Field.Root>,
        );

        expectUniqueIds(nativeButton ? 3 : 5);
      },
    );

    it('implicit association', async () => {
      const changeSpy = vi.fn();
      await render(
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="fuji-apple" />
                Fuji
              </Field.Label>
            </Field.Item>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="gala-apple" />
                Gala
              </Field.Label>
            </Field.Item>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="granny-smith-apple" onCheckedChange={changeSpy} />
                Granny Smith
              </Field.Label>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const labels = screen.getAllByTestId('label');
      const inputs = document.querySelectorAll('input[type="checkbox"]');

      checkboxes.forEach((checkbox, index) => {
        const label = labels[index];
        const input = inputs[index];

        expect(label.getAttribute('for')).not.toBe(null);
        expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
        expect(label.getAttribute('id')).not.toBe(null);
        expect(label.getAttribute('id')).toBe(checkbox.getAttribute('aria-labelledby'));
      });

      await fireEvent.click(labels[2]);
      expect(changeSpy.mock.calls.length).toBe(1);
    });

    it('explicit association', async () => {
      const changeSpy = vi.fn();

      await render(
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
            <Field.Item>
              <Checkbox.Root value="fuji-apple" />
              <Field.Label data-testid="label">Fuji</Field.Label>
              <Field.Description data-testid="description">
                A fuji apple is the round, edible fruit of an apple tree
              </Field.Description>
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="gala-apple" onCheckedChange={changeSpy} />
              <Field.Label data-testid="label">Gala</Field.Label>
              <Field.Description data-testid="description">
                A gala apple is the round, edible fruit of an apple tree
              </Field.Description>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const labels = screen.getAllByTestId('label');
      const descriptions = screen.getAllByTestId('description');
      const inputs = document.querySelectorAll('input[type="checkbox"]');

      checkboxes.forEach((checkbox, index) => {
        const label = labels[index];
        const description = descriptions[index];
        const input = inputs[index];

        expect(label.getAttribute('for')).not.toBe(null);
        expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
        expect(label.getAttribute('id')).not.toBe(null);
        expect(label.getAttribute('id')).toBe(checkbox.getAttribute('aria-labelledby'));
        expect(description.getAttribute('id')).not.toBe(null);
        expect(description.getAttribute('id')).toBe(checkbox.getAttribute('aria-describedby'));
      });

      await fireEvent.click(screen.getByText('Gala'));
      expect(changeSpy.mock.calls.length).toBe(1);
    });
  });

  describe('Field.Description', () => {
    it('links the group and individual checkboxes', async () => {
      await render(
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={[]} aria-describedby="external-description">
            <Field.Description data-testid="group-description">Group description</Field.Description>
            <Field.Item>
              <Field.Label>
                <Checkbox.Root value="fuji-apple" aria-describedby="checkbox-description" />
                Fuji
              </Field.Label>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const groupDescription = screen.getByTestId('group-description');
      const groupDescriptionId = groupDescription.getAttribute('id');
      expect(groupDescriptionId).not.toBe(null);
      expect(screen.getByRole('group').getAttribute('aria-describedby')).toContain(
        groupDescriptionId,
      );
      expect(screen.getByRole('checkbox').getAttribute('aria-describedby')).toContain(
        groupDescriptionId,
      );
      expect(screen.getByRole('checkbox')).toHaveAttribute(
        'aria-describedby',
        `checkbox-description ${groupDescriptionId}`,
      );
      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-describedby',
        `external-description ${groupDescriptionId}`,
      );
    });
  });

  describe('Form values', () => {
    it('projects selected enabled checkboxes while preserving the logical validation value', async () => {
      const handleSubmit = vi.fn();
      const validateGroup = vi.fn((_value: unknown, _formValues: Form.Values) => null);
      const validateOther = vi.fn((_value: unknown, _formValues: Form.Values) => null);

      const App = defineComponent(() => {
        const disabled = shallowRef(true);

        return () => (
          <Form onFormSubmit={handleSubmit} data-testid="form">
            <Field.Root name="fruits" validate={validateGroup}>
              <CheckboxGroup defaultValue={['apple', 'banana']}>
                <Checkbox.Root value="apple" />
                <Checkbox.Root value="banana" disabled={disabled.value} />
              </CheckboxGroup>
            </Field.Root>
            <Field.Root name="other" validate={validateOther}>
              <Field.Control defaultValue="value" />
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

      await render(<App />);

      await fireEvent.click(screen.getByText('Submit'));

      expect(validateGroup).toHaveBeenLastCalledWith(['apple', 'banana'], {
        fruits: ['apple'],
        other: 'value',
      });
      expect(validateOther.mock.lastCall?.[1].fruits).toEqual(['apple']);
      expect(handleSubmit.mock.lastCall?.[0].fruits).toEqual(['apple']);

      await fireEvent.click(screen.getByText('Enable'));
      await fireEvent.click(screen.getByText('Submit'));

      expect(validateGroup).toHaveBeenLastCalledWith(['apple', 'banana'], {
        fruits: ['apple', 'banana'],
        other: 'value',
      });
      expect(validateOther.mock.lastCall?.[1].fruits).toEqual(['apple', 'banana']);
      expect(handleSubmit.mock.lastCall?.[0].fruits).toEqual(['apple', 'banana']);
    });

    it('omits selected unmounted checkboxes while retaining group state across remounts', async () => {
      const handleSubmit = vi.fn();

      const App = defineComponent(() => {
        const mounted = shallowRef(true);

        return () => (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="fruits">
              <CheckboxGroup defaultValue={['apple', 'banana']}>
                <Checkbox.Root value="apple" />
                {mounted.value && <Checkbox.Root value="banana" data-testid="banana" />}
              </CheckboxGroup>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                mounted.value = !mounted.value;
              }}
            >
              Toggle
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      await render(<App />);

      await fireEvent.click(screen.getByText('Toggle'));
      await fireEvent.click(screen.getByText('Submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });

      await fireEvent.click(screen.getByText('Toggle'));
      expect(screen.getByTestId('banana')).toHaveAttribute('aria-checked', 'true');

      await fireEvent.click(screen.getByText('Submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple', 'banana'] });
    });

    it('preserves the logical field-name value when Checkbox.Root has no value prop', async () => {
      const handleSubmit = vi.fn();

      await render(
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['fruits']}>
              <Checkbox.Root />
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['fruits'] });
    });

    it('updates duplicate-value registrations before a parent layout effect submits', async () => {
      const handleSubmit = vi.fn();
      const form = shallowRef<FormInstance | null>(null);

      const App = defineComponent(() => {
        const trimmed = shallowRef(false);

        // The callback runs after the checkboxes left the field, as a layout effect of a parent does.
        watch(
          trimmed,
          (value) => {
            if (value) {
              form.value?.element?.requestSubmit();
            }
          },
          { flush: 'post' },
        );

        return () => (
          <Form ref={form} onFormSubmit={handleSubmit}>
            <Field.Root name="items">
              <CheckboxGroup defaultValue={['one', 'two']}>
                {!trimmed.value && <Checkbox.Root value="one" />}
                <Checkbox.Root value="two" />
                {!trimmed.value && <Checkbox.Root value="two" />}
              </CheckboxGroup>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                trimmed.value = true;
              }}
            >
              Trim
            </button>
          </Form>
        );
      });

      await render(<App />);

      await fireEvent.click(screen.getByText('Trim'));

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ items: ['two'] });
    });

    it('omits selected checkboxes associated with another form', async () => {
      const handleSubmit = vi.fn();

      await render(
        <>
          <form id="external-form" />
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="fruits">
              <CheckboxGroup defaultValue={['apple', 'banana']}>
                <Checkbox.Root value="apple" />
                <Checkbox.Root value="banana" form="external-form" />
              </CheckboxGroup>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        </>,
      );

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });
    });

    it('includes a context-portaled checkbox without native form association', async () => {
      const handleSubmit = vi.fn();
      const portalContainer = createPortalContainer();

      await render(
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['apple']}>
              <Teleport to={portalContainer}>
                <Checkbox.Root value="apple" />
              </Teleport>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByText('Submit'));

      // Field registration is context-driven, so a portaled checkbox with no explicit `form`
      // association still projects its value into `onFormSubmit`, like other field controls.
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });
    });

    it('includes a group fully portaled outside the form element', async () => {
      const handleSubmit = vi.fn();
      const portalContainer = createPortalContainer();

      await render(
        <Form onFormSubmit={handleSubmit}>
          <Teleport to={portalContainer}>
            <Field.Root name="fruits">
              <CheckboxGroup defaultValue={['apple', 'banana']}>
                <Checkbox.Root value="apple" />
                <Checkbox.Root value="banana" disabled />
              </CheckboxGroup>
            </Field.Root>
          </Teleport>
          <button type="submit">Submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });
    });

    it('includes a portaled checkbox explicitly associated with the Form', async () => {
      const handleSubmit = vi.fn();
      const portalContainer = createPortalContainer();

      await render(
        <Form id="current-form" onFormSubmit={handleSubmit}>
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['apple']}>
              <Teleport to={portalContainer}>
                <Checkbox.Root value="apple" form="current-form" />
              </Teleport>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });
    });

    it('omits checkboxes disabled by a fieldset', async () => {
      const handleSubmit = vi.fn();
      const validate = vi.fn((_value: unknown, _formValues: Form.Values) => null);

      await render(
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['apple', 'banana']}>
              <Checkbox.Root value="apple" />
              <fieldset disabled>
                <Checkbox.Root value="banana" />
              </fieldset>
            </CheckboxGroup>
          </Field.Root>
          <Field.Root name="other" validate={validate}>
            <Field.Control defaultValue="value" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByText('Submit'));

      expect(validate.mock.lastCall?.[1].fruits).toEqual(['apple']);
      expect(handleSubmit.mock.lastCall?.[0].fruits).toEqual(['apple']);
    });
  });

  describe.skipIf(isJSDOM)('Form', () => {
    it('includes the checkbox group value in form submission', async () => {
      await render(
        <Form
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget as HTMLFormElement);
            expect(formData.getAll('apple')).toEqual(['fuji-apple', 'gala-apple']);
          }}
        >
          <Field.Root name="apple">
            <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
              <Field.Item>
                <Checkbox.Root value="fuji-apple" data-testid="button-1" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="gala-apple" data-testid="button-2" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="granny-smith-apple" data-testid="button-3" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const submit = screen.getByRole('button');
      await fireEvent.click(submit);
    });

    it('is validated as a group upon form submission', async () => {
      const validateSpy = vi.fn();

      await render(
        <Form
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault();
          }}
        >
          <Field.Root name="apple" validate={validateSpy}>
            <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
              <Field.Item>
                <Checkbox.Root value="fuji-apple" data-testid="button-1" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="gala-apple" data-testid="button-2" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="granny-smith-apple" data-testid="button-3" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const submit = screen.getByRole('button');
      await fireEvent.click(submit);
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.calls[0][0]).toEqual(['fuji-apple', 'gala-apple']);
    });

    it('focuses the first checkbox when the field receives an error from Form', async () => {
      const App = defineComponent(() => {
        const errors = shallowRef<Form.Props['errors']>({});
        return () => (
          <Form
            errors={errors.value}
            onSubmit={(event: SubmitEvent) => {
              event.preventDefault();
              errors.value = { group: 'server error' };
            }}
          >
            <Field.Root name="group" data-testid="field">
              <CheckboxGroup defaultValue={['one']}>
                <Field.Item>
                  <Checkbox.Root value="one" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="two" />
                </Field.Item>
              </CheckboxGroup>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      const { user } = await render(<App />);
      expect(screen.queryByTestId('error')).toBe(null);
      const submit = screen.getByText('Submit');
      await user.click(submit);

      const [checkbox1] = screen.getAllByRole('checkbox');
      expect(checkbox1).toHaveFocus();
      expect(checkbox1).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('server error');
    });

    it('focuses the invalid checkbox when a later checkbox in the group fails validation', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="group">
            <CheckboxGroup defaultValue={['one']}>
              <Field.Item>
                <Checkbox.Root value="one" data-testid="checkbox" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="two" data-testid="checkbox" required />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const checkboxes = screen.getAllByTestId('checkbox');

      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('error')).toHaveTextContent('required');
      expect(checkboxes[1]).toHaveFocus();
    });

    it('ignores required checkboxes associated with a different form', async () => {
      const handleSubmit = vi.fn();

      const { user } = await render(
        <>
          <form id="external-form" />
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="group">
              <CheckboxGroup defaultValue={[]}>
                <Checkbox.Root value="external" form="external-form" required />
                <Checkbox.Root value="current" />
              </CheckboxGroup>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        </>,
      );

      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledOnce();
    });

    it('stops validating a checkbox after it changes form owner', async () => {
      const handleSubmit = vi.fn();

      const App = defineComponent(() => {
        const external = shallowRef(false);

        return () => (
          <>
            <form id="external-form" />
            <Form onFormSubmit={handleSubmit}>
              <Field.Root name="group">
                <CheckboxGroup defaultValue={[]}>
                  <Checkbox.Root
                    value="checkbox"
                    form={external.value ? 'external-form' : undefined}
                    required
                  />
                </CheckboxGroup>
              </Field.Root>
              <button
                type="button"
                onClick={() => {
                  external.value = true;
                }}
              >
                Move
              </button>
              <button type="submit">Submit</button>
            </Form>
          </>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByText('Submit'));
      expect(handleSubmit).not.toHaveBeenCalled();

      await user.click(screen.getByText('Move'));
      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledOnce();
    });

    it('validates and focuses required portaled checkboxes within the form', async () => {
      const handleSubmit = vi.fn();
      const portalContainer = createPortalContainer();

      const { user } = await render(
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="group">
            <CheckboxGroup defaultValue={[]}>
              <Teleport to={portalContainer}>
                <Checkbox.Root value="portaled" required data-testid="portaled" />
              </Teleport>
              <Checkbox.Root value="current" />
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('portaled')).toHaveFocus();

      await user.click(screen.getByTestId('portaled'));
      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledOnce();
    });

    it('ignores a checkbox portaled into another form without a form attribute', async () => {
      const handleSubmit = vi.fn();
      const externalForm = document.createElement('form');
      document.body.append(externalForm);
      onTestFinished(() => externalForm.remove());

      const { user } = await render(
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="group">
            <CheckboxGroup defaultValue={[]}>
              <Teleport to={externalForm}>
                <Checkbox.Root value="external" required />
              </Teleport>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledOnce();
    });

    it('skips a checkbox disabled by a fieldset when focusing Form errors', async () => {
      const App = defineComponent(() => {
        const errors = shallowRef<Form.Props['errors']>({});

        return () => (
          <Form
            errors={errors.value}
            onSubmit={(event: SubmitEvent) => {
              event.preventDefault();
              errors.value = { group: 'server error' };
            }}
          >
            <Field.Root name="group">
              <CheckboxGroup defaultValue={[]}>
                <fieldset disabled>
                  <Checkbox.Root value="disabled" data-testid="disabled" />
                </fieldset>
                <Checkbox.Root value="enabled" data-testid="enabled" />
              </CheckboxGroup>
              <Field.Error />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('enabled')).toHaveFocus();
      expect(screen.getByTestId('disabled')).not.toHaveFocus();
    });

    it('focuses a remaining checkbox when Form errors unmount the first checkbox', async () => {
      const App = defineComponent(() => {
        const showFirst = shallowRef(true);
        const errors = shallowRef<Form.Props['errors']>({});

        return () => (
          <Form
            errors={errors.value}
            onSubmit={(event: SubmitEvent) => {
              event.preventDefault();
              showFirst.value = false;
              errors.value = { group: 'server error' };
            }}
          >
            <Field.Root name="group">
              <CheckboxGroup defaultValue={[]}>
                {showFirst.value && <Checkbox.Root value="one" data-testid="first" />}
                <Checkbox.Root value="two" data-testid="second" />
              </CheckboxGroup>
              <Field.Error />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByText('Submit'));

      expect(screen.queryByTestId('first')).toBe(null);
      expect(screen.getByTestId('second')).toHaveFocus();
    });

    it('unblocks submission after every checkbox in the group unmounts', async () => {
      const handleSubmit = vi.fn();

      const App = defineComponent(() => {
        const mounted = shallowRef(true);

        return () => (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="group">
              <CheckboxGroup defaultValue={[]}>
                {mounted.value && <Checkbox.Root value="one" required data-testid="checkbox" />}
              </CheckboxGroup>
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

      expect(handleSubmit).toHaveBeenCalledOnce();
    });

    it('still runs custom validation after every checkbox in the group unmounts', async () => {
      const handleSubmit = vi.fn();
      const validate = vi.fn((value: unknown) =>
        (value as string[]).length > 0 ? null : 'required',
      );

      const App = defineComponent(() => {
        const mounted = shallowRef(true);

        return () => (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="group" validate={validate}>
              <CheckboxGroup defaultValue={[]}>
                {mounted.value && <Checkbox.Root value="one" data-testid="checkbox" />}
              </CheckboxGroup>
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

      validate.mockClear();
      await user.click(screen.getByText('Submit'));

      // The custom validator still runs against the preserved value and blocks submission, even
      // though no checkbox is mounted to carry a native constraint.
      expect(validate).toHaveBeenCalled();
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('clears a custom error when an inputless group becomes valid after submission', async () => {
      const handleSubmit = vi.fn();
      const validate = vi.fn((value: unknown) =>
        (value as string[]).length > 0 ? null : 'required',
      );

      const App = defineComponent(() => {
        const mounted = shallowRef(true);
        const value = shallowRef<string[]>([]);

        return () => (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="group" validate={validate}>
              <CheckboxGroup value={value.value}>
                {mounted.value && <Checkbox.Root value="one" />}
              </CheckboxGroup>
              <Field.Error />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                mounted.value = false;
              }}
            >
              Remove
            </button>
            <button
              type="button"
              onClick={() => {
                value.value = ['one'];
              }}
            >
              Select
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByText('Submit'));
      expect(screen.getByText('required')).not.toBe(null);

      await user.click(screen.getByText('Remove'));
      await user.click(screen.getByText('Select'));

      expect(screen.queryByText('required')).toBe(null);

      await user.click(screen.getByText('Submit'));
      expect(handleSubmit).toHaveBeenCalledOnce();
    });

    it.each(['onSubmit', 'onBlur'] as const)(
      'does not validate on change with validationMode=%s after the final checkbox unmounts',
      async (validationMode) => {
        const validate = vi.fn(() => 'invalid');

        const App = defineComponent(() => {
          const mounted = shallowRef(true);
          const value = shallowRef<string[]>([]);

          return () => (
            <Form>
              <Field.Root name="group" validationMode={validationMode} validate={validate}>
                <CheckboxGroup value={value.value}>
                  {mounted.value && <Checkbox.Root value="one" />}
                </CheckboxGroup>
              </Field.Root>
              <button
                type="button"
                onClick={() => {
                  mounted.value = false;
                }}
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => {
                  value.value = ['one'];
                }}
              >
                Select
              </button>
              <button type="submit">Submit</button>
            </Form>
          );
        });

        const { user } = await render(<App />);

        await user.click(screen.getByText('Remove'));
        validate.mockClear();
        await user.click(screen.getByText('Select'));

        expect(validate).not.toHaveBeenCalled();

        await user.click(screen.getByText('Submit'));

        expect(validate).toHaveBeenCalledExactlyOnceWith(['one'], { group: [] });
      },
    );

    it.each(['onSubmit', 'onBlur'] as const)(
      'respects validationMode=%s when a controlled group starts without inputs',
      async (validationMode) => {
        const validate = vi.fn(() => 'invalid');

        const App = defineComponent(() => {
          const value = shallowRef<string[]>([]);

          return () => (
            <Form>
              <Field.Root name="group" validationMode={validationMode} validate={validate}>
                <CheckboxGroup value={value.value} />
              </Field.Root>
              <button
                type="button"
                onClick={() => {
                  value.value = ['one'];
                }}
              >
                Select one
              </button>
              <button
                type="button"
                onClick={() => {
                  value.value = ['two'];
                }}
              >
                Select two
              </button>
              <button type="submit">Submit</button>
            </Form>
          );
        });

        const { user } = await render(<App />);

        validate.mockClear();
        await user.click(screen.getByText('Select one'));

        expect(validate).not.toHaveBeenCalled();

        await user.click(screen.getByText('Submit'));

        expect(validate).toHaveBeenCalledExactlyOnceWith(['one'], { group: [] });

        await user.click(screen.getByText('Select two'));

        expect(validate).toHaveBeenCalledTimes(validationMode === 'onSubmit' ? 2 : 1);
      },
    );

    it('skips a disabled representative checkbox on a later focus attempt', async () => {
      const App = defineComponent(() => {
        const firstDisabled = shallowRef(false);
        const errors = shallowRef<Form.Props['errors']>({});

        return () => (
          <Form
            errors={errors.value}
            onSubmit={(event: SubmitEvent) => {
              event.preventDefault();
              errors.value = { group: 'server error' };
            }}
          >
            <Field.Root name="group">
              <CheckboxGroup defaultValue={[]}>
                <Checkbox.Root value="one" data-testid="first" disabled={firstDisabled.value} />
                <Checkbox.Root value="two" data-testid="second" />
              </CheckboxGroup>
              <Field.Error />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                firstDisabled.value = true;
              }}
            >
              Disable first
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByText('Submit'));
      expect(screen.getByTestId('first')).toHaveFocus();

      await user.click(screen.getByText('Disable first'));
      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('second')).toHaveFocus();
    });

    it('focuses a later invalid field when an inputless group is invalid without a control', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="group" validate={() => 'Invalid group'}>
            <CheckboxGroup value={[]} />
          </Field.Root>
          <Field.Root name="email">
            <Field.Control required data-testid="email" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByText('Submit'));

      // The group is invalid but has no focusable control, so focus must skip to the next invalid field.
      expect(screen.getByTestId('email')).toHaveFocus();
    });

    it('focuses a later invalid field when every checkbox in an invalid group is disabled', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="group" validate={() => 'Invalid group'}>
            <CheckboxGroup defaultValue={[]}>
              <Checkbox.Root value="one" disabled />
            </CheckboxGroup>
          </Field.Root>
          <Field.Root name="email">
            <Field.Control required data-testid="email" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('email')).toHaveFocus();
    });

    it('appends the id attribute of the error to aria-describedby of individual checkboxes', async () => {
      await render(
        <Form errors={{ group: 'error' }}>
          <Field.Root name="group">
            <CheckboxGroup defaultValue={['one']}>
              <Field.Item>
                <Checkbox.Root value="one" />
                <Field.Description>Description</Field.Description>
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="two" />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );
      const error = screen.getByTestId('error');
      expect(error).not.toBe(null);

      const [checkbox1] = screen.getAllByRole('checkbox');
      expect(checkbox1.getAttribute('aria-describedby')).toContain(error.getAttribute('id'));
      expect(checkbox1.getAttribute('aria-describedby')).toContain(
        screen.getByText('Description').getAttribute('id'),
      );
    });
  });

  // Base UI lists the fields of a page that has no form in a module variable. Vase UI keeps no such
  // variable, so a field with no form sees no other field.
  describe('a field with no form', () => {
    it('validates an inputless controlled group on change', async () => {
      const validate = vi.fn((_value: unknown, _formValues: Form.Values) => null);

      const App = defineComponent(() => {
        const value = shallowRef<string[]>([]);

        return () => (
          <Field.Root name="group" validationMode="onChange" validate={validate}>
            <CheckboxGroup value={value.value} />
            <button
              type="button"
              onClick={() => {
                value.value = ['one'];
              }}
            >
              Select
            </button>
          </Field.Root>
        );
      });

      const { user } = await render(<App />);
      validate.mockClear();

      await user.click(screen.getByText('Select'));

      expect(validate).toHaveBeenCalledExactlyOnceWith(['one'], {});
    });

    it('validates an initially empty group through the exposed `validate`', async () => {
      const validate = vi.fn((_value: unknown, _formValues: Form.Values) => 'invalid');
      let root = null as FieldRootInstance | null;

      const { user } = await render(() => (
        <Field.Root
          name="group"
          ref={(instance) => {
            root = instance as FieldRootInstance | null;
          }}
          validate={validate}
        >
          <CheckboxGroup defaultValue={[]} />
          <button type="button" onClick={() => root?.validate()}>
            Validate
          </button>
        </Field.Root>
      ));
      validate.mockClear();

      await user.click(screen.getByText('Validate'));

      expect(validate).toHaveBeenCalledExactlyOnceWith([], {});
    });
  });

  describe('v-model:value', () => {
    it('emits `valueChange` and then `update:value`, before the click handler returns', async () => {
      const order: string[] = [];
      await render(
        <CheckboxGroup
          onValueChange={(value: string[]) => order.push(`valueChange ${value.join()}`)}
          {...{ 'onUpdate:value': (value: string[]) => order.push(`update:value ${value.join()}`) }}
        >
          <Checkbox.Root value="a" />
        </CheckboxGroup>,
      );

      screen.getByRole('checkbox').click();
      order.push('end of the click');

      expect(order).toEqual(['valueChange a', 'update:value a', 'end of the click']);
    });

    it.each([
      {
        name: 'no listener cancels',
        cancelIn: undefined,
        events: ['checkedChange', 'valueChange', 'update:value', 'update:checked'],
        checked: 'true',
      },
      {
        name: 'the checkbox cancels',
        cancelIn: 'checkedChange',
        events: ['checkedChange'],
        checked: 'false',
      },
      {
        name: 'the group cancels',
        cancelIn: 'valueChange',
        events: ['checkedChange', 'valueChange'],
        checked: 'false',
      },
    ])(
      'gives the events of the checkbox and of the group in order when $name',
      async ({ cancelIn, events, checked }) => {
        const received: string[] = [];
        const details = new Set<unknown>();

        await render(
          <CheckboxGroup
            onValueChange={(_value: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => {
              received.push('valueChange');
              details.add(eventDetails);
              if (cancelIn === 'valueChange') {
                eventDetails.cancel();
              }
            }}
            {...{ 'onUpdate:value': () => received.push('update:value') }}
          >
            <Checkbox.Root
              value="a"
              onCheckedChange={(
                _checked: boolean,
                eventDetails: Checkbox.Root.ChangeEventDetails,
              ) => {
                received.push('checkedChange');
                details.add(eventDetails);
                if (cancelIn === 'checkedChange') {
                  eventDetails.cancel();
                }
              }}
              {...{ 'onUpdate:checked': () => received.push('update:checked') }}
            />
          </CheckboxGroup>,
        );

        await fireEvent.click(screen.getByRole('checkbox'));

        expect(received).toEqual(events);
        expect(details.size).toBe(1);
        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', checked);
      },
    );
  });

  describe('VUE-35: a controlled `value` that the consumer changes in place', () => {
    it('gives the checkboxes, the state of the field and the validation the new value', async () => {
      const validate = vi.fn((value: unknown) =>
        (value as string[]).includes('banana') ? 'error' : null,
      );
      const selected = ref<string[]>(['apple']);
      const App = defineComponent(() => () => (
        <Field.Root name="fruits" validationMode="onChange" validate={validate}>
          <CheckboxGroup value={selected.value} data-testid="group">
            <Field.Item>
              <Checkbox.Root value="apple" data-testid="apple" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="banana" data-testid="banana" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));
      await render(<App />);
      const group = screen.getByTestId('group');

      expect(group).toHaveAttribute('data-filled');
      expect(group).not.toHaveAttribute('data-dirty');

      selected.value.push('banana');
      await flushMicrotasks();

      expect(screen.getByTestId('banana')).toHaveAttribute('aria-checked', 'true');
      expect(group).toHaveAttribute('data-dirty');
      expect(screen.getByTestId('banana')).toHaveAttribute('aria-invalid', 'true');
      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toEqual(['apple', 'banana']);

      selected.value.splice(0, 2);
      await flushMicrotasks();

      expect(group).not.toHaveAttribute('data-filled');
      expect(screen.getByTestId('apple')).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('the hidden input has the state of the checkbox', () => {
    it('after a click that the parent of a controlled group does not accept', async () => {
      await render(
        <CheckboxGroup value={['a']}>
          <Checkbox.Root value="a" />
          <Checkbox.Root value="b" />
        </CheckboxGroup>,
      );

      await fireEvent.click(screen.getAllByRole('checkbox')[1]);
      await flushMicrotasks();

      expect(screen.getAllByRole('checkbox')[1]).toHaveAttribute('aria-checked', 'false');
      expect(getInputs().map((input) => input.checked)).toEqual([true, false]);
    });
  });

  describe('in a native form', () => {
    function getFormData() {
      return new FormData(screen.getByTestId<HTMLFormElement>('form')).getAll('fruits');
    }

    it('submits the values of the checkboxes that are on, under the name of the field', async () => {
      await render(
        <form data-testid="form">
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['apple', 'cherry']}>
              <Checkbox.Root value="apple" />
              <Checkbox.Root value="banana" />
              <Checkbox.Root value="cherry" disabled />
            </CheckboxGroup>
          </Field.Root>
        </form>,
      );
      const [apple, banana] = screen.getAllByRole('checkbox');

      expect(getFormData()).toEqual(['apple']);

      await fireEvent.click(banana);

      expect(getFormData()).toEqual(['apple', 'banana']);

      await fireEvent.click(apple);

      expect(getFormData()).toEqual(['banana']);
    });

    it('submits nothing for a disabled group', async () => {
      await render(
        <form data-testid="form">
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['apple']} disabled>
              <Checkbox.Root value="apple" />
            </CheckboxGroup>
          </Field.Root>
        </form>,
      );

      expect(getFormData()).toEqual([]);
    });

    it('gives an input that is on its value, and an input that is off none', async () => {
      await render(
        <CheckboxGroup defaultValue={['apple']}>
          <Checkbox.Root value="apple" />
          <Checkbox.Root value="banana" />
        </CheckboxGroup>,
      );
      const [appleInput, bananaInput] = getInputs();
      const [apple, banana] = screen.getAllByRole('checkbox');

      expect(appleInput.value).toBe('apple');
      expect(bananaInput.value).toBe('');

      await fireEvent.click(banana);
      await fireEvent.click(apple);

      expect(appleInput.value).toBe('');
      expect(bananaInput.value).toBe('banana');
    });
  });

  describe('BUG-6206: a native reset', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function getFormData() {
      return new FormData(screen.getByTestId<HTMLFormElement>('form')).getAll('fruits');
    }

    it.each([
      { name: 'on', defaultValue: ['apple'], expected: ['apple'] },
      { name: 'empty', defaultValue: [] as string[], expected: [] as string[] },
    ])(
      'puts an uncontrolled group back to its default value, $name',
      async ({ defaultValue, expected }) => {
        const handleChange = vi.fn();
        await render(
          <form data-testid="form">
            <Field.Root name="fruits">
              <CheckboxGroup defaultValue={defaultValue} onValueChange={handleChange}>
                <Checkbox.Root value="apple" />
                <Checkbox.Root value="banana" />
              </CheckboxGroup>
            </Field.Root>
            <button type="reset">Reset</button>
          </form>,
        );
        const [apple, banana] = screen.getAllByRole('checkbox');
        await fireEvent.click(banana);
        await fireEvent.click(apple);
        expect(handleChange).toHaveBeenCalledTimes(2);
        expect(getFormData()).not.toEqual(expected);

        await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
        await settleReset();

        expect(getFormData()).toEqual(expected);
        expect(apple).toHaveAttribute('aria-checked', String(expected.includes('apple')));
        expect(banana).toHaveAttribute('aria-checked', 'false');
        expect(handleChange).toHaveBeenCalledTimes(3);
        expect(handleChange.mock.lastCall?.[0]).toEqual(expected);
        expect(handleChange.mock.lastCall?.[0]).not.toBe(defaultValue);
        expect(handleChange.mock.lastCall?.[1].event.type).toBe('reset');

        // A reset with nothing to change.
        await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
        await settleReset();

        expect(handleChange).toHaveBeenCalledTimes(3);
      },
    );

    it('asks the listener one time for the checkboxes of one reset, and keeps the value when it cancels', async () => {
      const handleChange = vi.fn(
        (_value: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => {
          if (eventDetails.event.type === 'reset') {
            eventDetails.cancel();
          }
        },
      );
      await render(
        <form data-testid="form">
          <CheckboxGroup defaultValue={['apple']} onValueChange={handleChange}>
            <Checkbox.Root value="apple" />
            <Checkbox.Root value="banana" />
            <Checkbox.Root value="cherry" />
          </CheckboxGroup>
        </form>,
      );
      await fireEvent.click(screen.getAllByRole('checkbox')[0]);
      expect(handleChange).toHaveBeenCalledTimes(1);

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(handleChange).toHaveBeenCalledTimes(2);
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'false');
    });

    it('does not change a controlled group, and emits nothing', async () => {
      const handleChange = vi.fn();
      const handleUpdate = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<string[]>([]);
        return () => (
          <form data-testid="form">
            <CheckboxGroup
              value={value.value}
              onValueChange={handleChange}
              {...{
                'onUpdate:value': (next: string[]) => {
                  handleUpdate(next);
                  value.value = next;
                },
              }}
            >
              <Checkbox.Root value="apple" />
            </CheckboxGroup>
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
      expect(getInputs()[0].checked).toBe(true);
      expect(handleChange).not.toHaveBeenCalled();
      expect(handleUpdate).not.toHaveBeenCalled();
    });

    it('resets a group whose checkbox is outside the form that its `form` prop names', async () => {
      await render(
        <div>
          <form data-testid="form" id="external" />
          <Field.Root name="fruits">
            <CheckboxGroup>
              <Checkbox.Root value="apple" form="external" />
            </CheckboxGroup>
          </Field.Root>
        </div>,
      );
      const checkbox = screen.getByRole('checkbox');
      await fireEvent.click(checkbox);
      expect(getFormData()).toEqual(['apple']);

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(getFormData()).toEqual([]);
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
      expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-invalid');
    }

    // The input keeps no message of the field. A required checkbox that is off keeps the message of
    // its native constraint.
    function expectInputConstraint(valueMissing: boolean) {
      const [input] = getInputs();
      expect(input.validity.customError).toBe(false);
      expect(input.validity.valueMissing).toBe(valueMissing);
      expect(Boolean(input.validationMessage)).toBe(valueMissing);
    }

    it.each([
      {
        name: 'a group at its default',
        valueMissing: false,
        renderForm: () => () => (
          <Form data-testid="form">
            <Field.Root
              data-testid="root"
              name="fruits"
              validate={(value) => ((value as string[]).length > 0 ? null : 'Pick one')}
            >
              <CheckboxGroup>
                <Checkbox.Root value="apple" aria-label="Apple" />
              </CheckboxGroup>
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
            <Field.Root data-testid="root" name="fruits">
              <CheckboxGroup>
                <Checkbox.Root value="apple" aria-label="Apple" required />
              </CheckboxGroup>
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
          <Form data-testid="form" errors={{ fruits: 'Server error' }}>
            <Field.Root data-testid="root" name="fruits">
              <CheckboxGroup>
                <Checkbox.Root value="apple" aria-label="Apple" />
              </CheckboxGroup>
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
          const value = shallowRef<string[]>([]);
          return () => (
            <Form data-testid="form">
              <Field.Root
                data-testid="root"
                name="fruits"
                validate={(next) => ((next as string[]).length > 0 ? null : 'Pick one')}
              >
                <CheckboxGroup
                  value={value.value}
                  {...{ 'onUpdate:value': (next: string[]) => (value.value = next) }}
                >
                  <Checkbox.Root value="apple" aria-label="Apple" />
                </CheckboxGroup>
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

    it('VUE-21: clears the error of a group whose listener cancels the reset, and validates the next click', async () => {
      const validate = vi.fn((value: unknown) =>
        (value as string[]).length > 0 ? 'Untick it' : null,
      );
      await render(
        <Form data-testid="form">
          <Field.Root data-testid="root" name="fruits" validate={validate}>
            <CheckboxGroup
              onValueChange={(_value: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => {
                if (eventDetails.event.type === 'reset') {
                  eventDetails.cancel();
                }
              }}
            >
              <Checkbox.Root value="apple" aria-label="Apple" />
            </CheckboxGroup>
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

      await fireEvent.click(screen.getByRole('checkbox'));

      expect(validate).toHaveBeenCalledTimes(2);
      expect(validate.mock.lastCall?.[0]).toEqual([]);
      expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');
    });

    it('VUE-21: clears the error when the reset changes the value, does not validate it, and validates the next click', async () => {
      const validate = vi.fn((value: unknown) =>
        (value as string[]).length > 0 ? 'Untick it' : null,
      );
      await render(
        <Form data-testid="form">
          <Field.Root
            data-testid="root"
            name="fruits"
            validate={validate}
            validationMode="onChange"
          >
            <CheckboxGroup>
              <Checkbox.Root value="apple" aria-label="Apple" />
            </CheckboxGroup>
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

      await fireEvent.click(screen.getByRole('checkbox'));

      expect(validate).toHaveBeenCalledTimes(2);
      expect(validate.mock.lastCall?.[0]).toEqual(['apple']);
      expect(screen.getByTestId('error')).toHaveTextContent('Untick it');
    });
  });

  describe('KeepAlive', () => {
    const Blank = defineComponent(() => () => <span />);

    it('leaves a checkbox that KeepAlive holds out of the values and the validation of the form', async () => {
      const handleSubmit = vi.fn();
      const shown = shallowRef(true);
      const Banana = defineComponent(() => () => (
        <Checkbox.Root value="banana" required data-testid="banana" />
      ));
      const App = defineComponent(() => () => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['apple']}>
              <Checkbox.Root value="apple" />
              <KeepAlive>{shown.value ? <Banana key="banana" /> : <Blank key="blank" />}</KeepAlive>
            </CheckboxGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      await render(<App />);

      // A required checkbox that is off blocks the submit while it shows.
      await fireEvent.click(screen.getByText('Submit'));
      expect(handleSubmit).not.toHaveBeenCalled();

      // A checkbox that is on gives no value to the form while KeepAlive holds it.
      await fireEvent.click(screen.getByTestId('banana'));
      shown.value = false;
      await flushMicrotasks();
      await fireEvent.click(screen.getByText('Submit'));
      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });

      // A required checkbox that is off does not block the submit while KeepAlive holds it.
      shown.value = true;
      await flushMicrotasks();
      await fireEvent.click(screen.getByTestId('banana'));
      shown.value = false;
      await flushMicrotasks();
      await fireEvent.click(screen.getByText('Submit'));
      expect(handleSubmit).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId('error')).toBe(null);

      // The checkbox is back in the values and in the validation when KeepAlive shows it again.
      shown.value = true;
      await flushMicrotasks();
      await fireEvent.click(screen.getByText('Submit'));
      expect(handleSubmit).toHaveBeenCalledTimes(2);
      await fireEvent.click(screen.getByTestId('banana'));
      await fireEvent.click(screen.getByText('Submit'));
      expect(handleSubmit).toHaveBeenCalledTimes(3);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple', 'banana'] });
    });

    it('keeps the order of the checkboxes when KeepAlive shows them again', async () => {
      const shown = shallowRef(true);
      const Fruits = defineComponent(() => () => (
        <CheckboxGroup>
          <Checkbox.Root value="apple" required data-testid="apple" />
          <Checkbox.Root value="banana" required data-testid="banana" />
        </CheckboxGroup>
      ));
      const App = defineComponent(() => () => (
        <Form>
          <Field.Root name="fruits">
            <KeepAlive>{shown.value ? <Fruits key="fruits" /> : <Blank key="blank" />}</KeepAlive>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      const { user } = await render(<App />);
      shown.value = false;
      await flushMicrotasks();
      shown.value = true;
      await flushMicrotasks();

      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('apple')).toHaveFocus();
    });

    it('gives no value to its form while KeepAlive holds the group', async () => {
      const handleSubmit = vi.fn();
      const shown = shallowRef(true);
      const Fruits = defineComponent(() => () => (
        <Field.Root name="fruits">
          <CheckboxGroup defaultValue={['apple']}>
            <Checkbox.Root value="apple" required />
            <Checkbox.Root value="banana" required data-testid="banana" />
          </CheckboxGroup>
        </Field.Root>
      ));
      const App = defineComponent(() => () => (
        <Form onFormSubmit={handleSubmit}>
          <KeepAlive>{shown.value ? <Fruits key="fruits" /> : <Blank key="blank" />}</KeepAlive>
          <Field.Root name="other">
            <Field.Control defaultValue="x" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      await render(<App />);

      shown.value = false;
      await flushMicrotasks();
      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ other: 'x' });

      shown.value = true;
      await flushMicrotasks();
      await fireEvent.click(screen.getByTestId('banana'));
      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(2);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({
        fruits: ['apple', 'banana'],
        other: 'x',
      });
    });
  });

  describe('in a field', () => {
    it('clears the error of the form for the field when the value changes', async () => {
      await render(
        <Form errors={{ fruits: 'Server error' }}>
          <Field.Root name="fruits">
            <CheckboxGroup>
              <Checkbox.Root value="apple" data-testid="apple" />
            </CheckboxGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByTestId('error')).toHaveTextContent('Server error');
      expect(screen.getByRole('group')).toHaveAttribute('data-invalid');

      await fireEvent.click(screen.getByTestId('apple'));

      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByRole('group')).not.toHaveAttribute('data-invalid');
    });

    it('leaves a group of a field with no name out of the validation of the form', async () => {
      const handleSubmit = vi.fn();
      await render(
        <Form onFormSubmit={handleSubmit}>
          <Field.Root>
            <CheckboxGroup>
              <Checkbox.Root value="apple" required />
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
    });

    it('is the control of the field: the group has the name of the label and the label has no `for`', async () => {
      await render(
        <Field.Root name="fruits">
          <Field.Label data-testid="label">Fruits</Field.Label>
          <CheckboxGroup>
            <Checkbox.Root value="apple" />
          </CheckboxGroup>
        </Field.Root>,
      );

      expect(screen.getByTestId('label')).not.toHaveAttribute('for');
      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });
  });

  describe('server-side rendering', () => {
    it.each([
      { name: 'a value', props: { defaultValue: ['banana'] } },
      { name: 'no value', props: {} },
      { name: 'a disabled group', props: { defaultValue: ['apple'], disabled: true } },
      { name: 'a label before the group', props: { label: 'before' } },
      { name: 'a label after the group', props: { label: 'after' } },
    ])('hydrates a group with $name with no mismatch', async ({ props }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      await hydrate(CheckboxGroupHydration, { serverHtml, props });
    });

    it('has the `for` of the provider on the label in the server HTML, and drops it after the mount', async () => {
      const props = { label: 'before' };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;

      expect(template.content.querySelector('[data-testid="label"]')?.hasAttribute('for')).toBe(
        true,
      );

      const { container } = await hydrate(CheckboxGroupHydration, { serverHtml, props });
      const label = container.querySelector('[data-testid="label"]');

      expect(label).not.toHaveAttribute('for');
      expect(container.querySelector('[data-testid="group"]')).toHaveAttribute(
        'aria-labelledby',
        label?.id,
      );
    });
  });
});
