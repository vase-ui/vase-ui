import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, reactive, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hiddenInputSizeTests,
  hiddenInputTypeTests,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  wait,
  waitFor,
} from '#test-utils';
import { platform } from '../../common/platform';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import * as Select from '../index.parts';
import type { SelectStore } from '../store';
import { useSelectRootContext } from './SelectRootContext';
import SelectRootHydration from './SelectRootHydration.test.vue';

const isWebKit = platform.engine.webkit;

type ChangeDetails = Select.Root.ChangeEventDetails;
type OpenChangeDetails = Select.Root.OpenChangeEventDetails;

// The cases set the value through the store, as an item does, so they need no popup.
let store: SelectStore;
const StoreProbe = defineComponent(() => {
  store = useSelectRootContext();
  return () => null;
});

async function setValueAsItem(value: unknown) {
  const accepted = store.context.setValue(value, createChangeEventDetails(REASONS.itemPress));
  await flushMicrotasks();
  return accepted;
}

async function settleReset() {
  vi.advanceTimersByTime(0);
  await flushMicrotasks();
}

// The trigger mounts the items in a 0 ms timer after it gets the focus. A browser delays a nested
// timer by 4 ms or more, so `flushMicrotasks` can resolve before the items mount.
async function focusTrigger(trigger: HTMLElement) {
  trigger.focus();
  await waitFor(() => {
    expect(document.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
  });
}

function getHiddenInput() {
  return document.querySelector<HTMLInputElement>('input[aria-hidden]')!;
}

function getFormData(name: string) {
  return new FormData(screen.getByTestId<HTMLFormElement>('form')).getAll(name);
}

describe('<Select.Root />', () => {
  const { render } = createRenderer();

  hiddenInputTypeTests({
    render,
    createComponent: (props) => (
      <Select.Root {...props}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
      </Select.Root>
    ),
  });

  hiddenInputSizeTests({
    render,
    createComponent: (props) => (
      <Select.Root {...props}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
      </Select.Root>
    ),
  });

  describe('prop: readOnly', () => {
    it('sets the readOnly state', async () => {
      const { user } = await render(
        <Select.Root defaultValue="b" readOnly>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('aria-readonly', 'true');
      expect(trigger).toHaveAttribute('data-readonly');

      await user.keyboard('[Tab]');
      expect(trigger).toHaveFocus();
    });

    it('does not commit a value with Enter on a highlighted item', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Select.Root onValueChange={handleValueChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      screen.getByTestId('trigger').focus();
      await flushMicrotasks();

      await user.keyboard('{ArrowDown}');
      await screen.findByRole('listbox');
      await user.keyboard('{Enter}');

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('value').textContent).toBe('');
    });

    it('does not commit a value with typeahead on a closed trigger', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Select.Root onValueChange={handleValueChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="apple">apple</Select.Item>
                <Select.Item value="banana">banana</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await focusTrigger(screen.getByTestId('trigger'));

      await user.keyboard('b');

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('value').textContent).toBe('');
    });

    it.skipIf(isJSDOM)('moves the highlight with typeahead while the popup is open', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Select.Root defaultOpen onValueChange={handleValueChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="apple">apple</Select.Item>
                <Select.Item value="banana">banana</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const apple = await screen.findByRole('option', { name: 'apple' });
      const banana = screen.getByRole('option', { name: 'banana' });

      apple.focus();
      await flushMicrotasks();

      await user.keyboard('b');

      await waitFor(() => {
        expect(banana).toHaveAttribute('data-highlighted');
      });
      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('value').textContent).toBe('');
    });
  });

  describe('prop: id', () => {
    it('sets a hidden input id when name is not provided', async () => {
      const { container } = await render(
        <Select.Root id="test-id">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = container.querySelector('input');
      expect(hiddenInput).toHaveAttribute('id', 'test-id-hidden-input');
      expect(hiddenInput).not.toHaveAttribute('name');
    });

    it('does not set a hidden input id when name is provided', async () => {
      await render(
        <Select.Root id="test-id" name="country">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'country');
      expect(hiddenInput).not.toHaveAttribute('id');
    });
  });

  describe('with Field.Root parent', () => {
    it('applies the root id to the trigger', async () => {
      await render(
        <Field.Root>
          <Field.Label data-testid="label">Label</Field.Label>
          <Select.Root id="test-id">
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
          </Select.Root>
        </Field.Root>,
      );

      expect(screen.getByTestId('trigger')).toHaveAttribute('id', 'test-id');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'test-id');
    });
  });

  describe('Field', () => {
    describe('[data-focused] without a blur event', () => {
      function Selects(props: { firstMounted?: boolean; firstDisabled?: boolean }) {
        const { firstMounted = true, firstDisabled = false } = props;
        return (
          <Field.Root data-testid="field">
            {firstMounted && (
              <Select.Root disabled={firstDisabled}>
                <Select.Trigger data-testid="first" />
              </Select.Root>
            )}
          </Field.Root>
        );
      }

      it('is removed when the focused trigger becomes disabled', async () => {
        const { setProps } = await render(<Selects />);

        const trigger = screen.getByTestId('first');
        trigger.focus();
        await flushMicrotasks();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
        expect(trigger).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused trigger unmounts', async () => {
        const { setProps } = await render(<Selects />);

        screen.getByTestId('first').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });
    });

    it('marks the field as touched and validates it when an outside press closes the popup', async () => {
      const validate = vi.fn((_value: unknown) => 'Pick a font');
      const { user } = await render(
        <Field.Root data-testid="field" validate={validate} validationMode="onBlur">
          <Select.Root defaultOpen defaultValue="sans">
            <Select.Trigger data-testid="trigger" />
          </Select.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('trigger')).not.toHaveFocus();

      await user.click(document.body);

      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('field')).toHaveAttribute('data-touched', '');
      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe('sans');
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Pick a font');
      });
    });

    it('BUG-1425: makes a required select with no value invalid when an outside press closes the popup', async () => {
      const { user } = await render(
        <Field.Root data-testid="field" validationMode="onBlur">
          <Select.Root defaultOpen required>
            <StoreProbe />
            <Select.Trigger data-testid="trigger" />
          </Select.Root>
          <Field.Error match="valueMissing" data-testid="error">
            required
          </Field.Error>
        </Field.Root>,
      );
      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(document.body);

      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('error')).toHaveTextContent('required');
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-dirty');

      await setValueAsItem('sans');

      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('trigger')).not.toHaveAttribute('aria-invalid');
    });

    it('sets the filled and dirty state of the field from the value', async () => {
      await render(
        <Field.Root data-testid="field">
          <Select.Root>
            <StoreProbe />
            <Select.Trigger />
          </Select.Root>
        </Field.Root>,
      );
      const field = screen.getByTestId('field');
      expect(field).not.toHaveAttribute('data-filled');
      expect(field).not.toHaveAttribute('data-dirty');

      await setValueAsItem('sans');

      expect(field).toHaveAttribute('data-filled', '');
      expect(field).toHaveAttribute('data-dirty', '');

      await setValueAsItem(null);

      expect(field).not.toHaveAttribute('data-filled');
      expect(field).not.toHaveAttribute('data-dirty');
    });

    it('gives its value to the form', async () => {
      const handleFormSubmit = vi.fn();
      await render(
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="font">
            <Select.Root defaultValue={{ code: 'sans' }} itemToStringValue={(item) => item.code}>
              <Select.Trigger />
            </Select.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleFormSubmit).toHaveBeenCalledTimes(1);
      expect(handleFormSubmit.mock.lastCall?.[0]).toEqual({ font: 'sans' });
    });
  });

  describe('typeahead', () => {
    it('matches an item by its label when the rendered text differs', async () => {
      const { user } = await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Item value="us" label="United States">
                  <Select.ItemText>Option 1</Select.ItemText>
                </Select.Item>
                <Select.Item value="fr" label="France">
                  <Select.ItemText>Option 2</Select.ItemText>
                </Select.Item>
                <Select.Item value="ca" label="Canada">
                  <Select.ItemText>Option 3</Select.ItemText>
                </Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      screen.getByTestId('trigger').focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Option 1' })).toHaveFocus();
      });

      // Only the label matches; the rendered text is "Option 2".
      await user.keyboard('fr');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Option 2' })).toHaveFocus();
      });
    });

    it('starts a new search after focus leaves the select', async () => {
      const { user } = await render(
        <div>
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apple">apple</Select.Item>
                  <Select.Item value="banana">banana</Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button data-testid="outside">outside</button>
        </div>,
      );

      const trigger = screen.getByTestId('trigger');
      await focusTrigger(trigger);
      await user.keyboard('b');
      expect(screen.getByTestId('value').textContent).toBe('banana');

      // Leaving and returning within the typeahead timeout must not continue the "b" search.
      screen.getByTestId('outside').focus();
      await focusTrigger(trigger);
      await user.keyboard('a');

      expect(screen.getByTestId('value').textContent).toBe('avocado');
    });

    it.skipIf(isJSDOM)(
      'does not trigger selection when Space is pressed during text navigation',
      async () => {
        const handleItemClick = vi.fn();
        const handleValueChange = vi.fn();

        const { user } = await render(
          <Select.Root defaultOpen onValueChange={handleValueChange}>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="one" onClick={() => handleItemClick()}>
                    Item One
                  </Select.Item>
                  <Select.Item value="two" onClick={() => handleItemClick()}>
                    Item Two
                  </Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
        );
        await flushMicrotasks();

        const options = screen.getAllByRole('option');

        options[0]!.focus();
        await flushMicrotasks();

        await user.keyboard('Item T');

        expect(handleItemClick.mock.calls.length > 0).toBe(false);
        expect(handleValueChange.mock.calls.length > 0).toBe(false);

        await waitFor(() => {
          expect(options[1]).toHaveFocus();
        });
      },
    );

    it('skips disabled items and commits the next match via typeahead on a closed trigger', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>(null);
        return () => (
          <Select.Root
            value={value.value}
            onValueChange={(next: string | null) => {
              value.value = next;
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apricot" disabled>
                    apricot
                  </Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // "apricot" and "avocado" both start with "a", but "apricot" is disabled. A single "a"
      // keypress must skip the disabled "apricot" and land on "avocado" — like native `<select>`
      // and arrow-key navigation — not stop on (or bail at) the disabled match.
      await focusTrigger(trigger);
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('avocado');
    });

    it('commits typeahead on a closed trigger when items are provided', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>(null);
        return () => (
          <Select.Root
            items={{ apple: 'Apple', cherry: 'Cherry' }}
            value={value.value}
            onValueChange={(next: string | null) => {
              value.value = next;
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apple">Apple</Select.Item>
                  <Select.Item value="cherry">Cherry</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // The popup is never opened. With `items` provided the value-change effect no longer
      // force-mounts, so this pins the load-bearing claim that the trigger's own onFocus
      // force-mount still registers the list for closed-trigger typeahead.
      await focusTrigger(trigger);
      await user.keyboard('c');
      expect(valueEl.textContent).toBe('Cherry');
    });

    it('commits nothing when the only typeahead match is disabled (closed trigger)', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>(null);
        return () => (
          <Select.Root
            value={value.value}
            onValueChange={(next: string | null) => {
              value.value = next;
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="cherry">cherry</Select.Item>
                  <Select.Item value="banana" disabled>
                    banana
                  </Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // "banana" is the only "b" item and it's disabled, so there is no selectable match.
      await focusTrigger(trigger);
      await user.keyboard('b');
      expect(valueEl.textContent).toBe('');
    });

    it('does not let a disabled double-letter item block rapid cycling among enabled matches', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>(null);
        return () => (
          <Select.Root
            value={value.value}
            onValueChange={(next: string | null) => {
              value.value = next;
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="aaron" disabled>
                    aaron
                  </Select.Item>
                  <Select.Item value="apple">apple</Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // The disabled "aaron" has a doubled first letter, which would otherwise disable
      // rapid same-letter cycling. Because disabled items are skipped while matching, they
      // must not count toward that guard: pressing "a" twice should cycle apple -> avocado.
      await focusTrigger(trigger);
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('apple');
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('avocado');
    });

    it.skipIf(isJSDOM)(
      'skips disabled items when highlighting via typeahead on an open popup',
      async () => {
        const { user } = await render(
          <Select.Root defaultOpen>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apricot" disabled>
                    apricot
                  </Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
        );

        const apricot = await screen.findByRole('option', { name: 'apricot' });
        const avocado = screen.getByRole('option', { name: 'avocado' });

        avocado.focus();
        await flushMicrotasks();

        // Open-state typeahead highlights via `activeIndex` (the closed branch commits the value
        // instead). Typing "a" must skip the disabled "apricot" and highlight "avocado".
        await user.keyboard('a');

        await waitFor(() => {
          expect(avocado).toHaveAttribute('data-highlighted');
        });
        expect(apricot).not.toHaveAttribute('data-highlighted');
      },
    );

    it('starts from the first match after value reset (closed)', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>(null);
        return () => (
          <>
            <button
              data-testid="reset"
              onClick={() => {
                value.value = null;
              }}
            >
              Reset
            </button>
            <Select.Root
              value={value.value}
              onValueChange={(next: string | null) => {
                value.value = next;
              }}
            >
              <Select.Trigger data-testid="trigger">
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a1">A1</Select.Item>
                    <Select.Item value="a2">A2</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');
      const resetBtn = screen.getByTestId('reset');

      await focusTrigger(trigger);
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('a1');

      await user.click(resetBtn);

      await focusTrigger(trigger);
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('a1');
    });

    it('does not jump matches after a closed-state value reset', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>('dog');
        return () => (
          <>
            <button
              data-testid="set-car"
              onClick={() => {
                value.value = 'car';
              }}
            >
              Set car
            </button>
            <Select.Root
              value={value.value}
              onValueChange={(next: string | null) => {
                value.value = next;
              }}
            >
              <Select.Trigger data-testid="trigger">
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="car">car</Select.Item>
                    <Select.Item value="cat">cat</Select.Item>
                    <Select.Item value="dog">dog</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');
      const setCarButton = screen.getByTestId('set-car');

      expect(valueEl.textContent).toBe('dog');

      await user.click(setCarButton);
      expect(valueEl.textContent).toBe('car');

      await focusTrigger(trigger);
      await user.keyboard('c');
      expect(valueEl.textContent).toBe('cat');

      await user.keyboard('a');
      expect(valueEl.textContent).toBe('cat');
    });
  });

  describe('prop: highlightItemOnHover', () => {
    it.skipIf(isWebKit)('highlights an item on mouse move by default', async () => {
      const { user } = await render(
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await flushMicrotasks();
      const optionB = screen.getByRole('option', { name: 'b' });
      await user.hover(optionB);

      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
    });

    it.skipIf(isJSDOM)(
      'highlights the first item after opening when alignItemWithTrigger is active and no value is selected',
      async () => {
        await render(
          <div style={{ paddingTop: '120px', paddingLeft: '24px' }}>
            <Select.Root>
              <Select.Trigger data-testid="trigger" style={{ width: '120px', height: '36px' }}>
                <Select.Value placeholder="Pick one" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup style={{ maxHeight: 'none' }}>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                    <Select.Item value="c">c</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        const trigger = screen.getByTestId('trigger');
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        await fireEvent.mouseDown(trigger);

        const optionA = await screen.findByRole('option', { name: 'a' });

        await waitFor(() => {
          expect(optionA).toHaveAttribute('data-highlighted');
        });
      },
    );

    it('does not highlight items from mouse movement when disabled', async () => {
      const { user } = await render(
        <Select.Root defaultOpen highlightItemOnHover={false}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await flushMicrotasks();
      const optionB = screen.getByRole('option', { name: 'b' });
      await user.hover(optionB);

      await flushMicrotasks();

      expect(optionB).not.toHaveAttribute('data-highlighted');
    });

    it('does not remove highlight when mousing out of popup when disabled', async () => {
      const { user } = await render(
        <Select.Root defaultOpen highlightItemOnHover={false}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await flushMicrotasks();
      const optionA = screen.getByRole('option', { name: 'a' });
      await user.hover(optionA);

      const popup = screen.getByRole('listbox');
      await waitFor(() => {
        expect(popup).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });

      await user.unhover(popup);

      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });
    });
  });

  describe('prop: multiple', () => {
    it('does not mark the hidden input as required when selection exists', async () => {
      await render(
        <Select.Root multiple required name="select" value={['a']}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).not.toHaveAttribute('required');
    });

    it('keeps the hidden input required when no selection exists', async () => {
      await render(
        <Select.Root multiple required name="select" value={[]}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).toHaveAttribute('required');
    });
  });

  describe('value', () => {
    it('emits valueChange and then update:value for a change that no listener cancels', async () => {
      const events: unknown[][] = [];
      await render(
        <Select.Root
          defaultValue="sans"
          onValueChange={(value: unknown, details: ChangeDetails) =>
            events.push(['valueChange', value, details.reason])
          }
          {...{ 'onUpdate:value': (value: unknown) => events.push(['update:value', value]) }}
        >
          <StoreProbe />
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      expect(await setValueAsItem('serif')).toBe(true);

      expect(events).toEqual([
        ['valueChange', 'serif', 'item-press'],
        ['update:value', 'serif'],
      ]);
      expect(screen.getByTestId('value')).toHaveTextContent('serif');
    });

    it('keeps the value when the listener cancels the change', async () => {
      const handleUpdate = vi.fn();
      await render(
        <Select.Root
          defaultValue="sans"
          onValueChange={(_value: unknown, details: ChangeDetails) => details.cancel()}
          {...{ 'onUpdate:value': handleUpdate }}
        >
          <StoreProbe />
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      expect(await setValueAsItem('serif')).toBe(false);

      expect(handleUpdate).toHaveBeenCalledTimes(0);
      expect(screen.getByTestId('value')).toHaveTextContent('sans');
    });

    it('follows the value prop of a controlled root', async () => {
      const value = shallowRef('sans');
      await render(() => (
        <Select.Root value={value.value}>
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>
      ));

      value.value = 'serif';
      await flushMicrotasks();

      expect(screen.getByTestId('value')).toHaveTextContent('serif');
      expect(getHiddenInput()).toHaveValue('serif');
    });
  });

  describe('open state', () => {
    it('emits openChange with the reason, then update:open', async () => {
      const events: unknown[][] = [];
      const { user } = await render(
        <Select.Root
          onOpenChange={(open: boolean, details: OpenChangeDetails) =>
            events.push(['openChange', open, details.reason])
          }
          {...{ 'onUpdate:open': (open: boolean) => events.push(['update:open', open]) }}
        >
          <Select.Trigger data-testid="trigger" />
        </Select.Root>,
      );
      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });

      expect(events).toEqual([
        ['openChange', true, 'trigger-press'],
        ['update:open', true],
      ]);

      events.length = 0;
      await user.keyboard('[Escape]');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(events).toEqual([
        ['openChange', false, 'escape-key'],
        ['update:open', false],
      ]);
    });

    it('keeps the popup closed when the listener cancels the change', async () => {
      const handleUpdate = vi.fn();
      const handleOpenChange = vi.fn((_open: boolean, details: OpenChangeDetails) =>
        details.cancel(),
      );
      const { user } = await render(
        <Select.Root onOpenChange={handleOpenChange} {...{ 'onUpdate:open': handleUpdate }}>
          <Select.Trigger data-testid="trigger" />
        </Select.Root>,
      );

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledTimes(1);
      });

      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
      expect(handleUpdate).toHaveBeenCalledTimes(0);
    });

    it('does not open while disabled', async () => {
      const handleOpenChange = vi.fn();
      await render(
        <Select.Root disabled onOpenChange={handleOpenChange}>
          <Select.Trigger data-testid="trigger" nativeButton={false} as="div" />
        </Select.Root>,
      );
      const trigger = screen.getByTestId('trigger');

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0 });
      await wait(20);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(handleOpenChange).toHaveBeenCalledTimes(0);
    });

    it('closes with the reason imperative-action from its close action', async () => {
      const handleOpenChange = vi.fn();
      let root: { close: () => void } | null = null;
      await render(() => (
        <Select.Root
          ref={(instance: any) => (root = instance)}
          defaultOpen
          onOpenChange={handleOpenChange}
        >
          <Select.Trigger data-testid="trigger" />
        </Select.Root>
      ));
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');

      root!.close();
      await flushMicrotasks();

      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
      expect(handleOpenChange.mock.lastCall?.[1].reason).toBe('imperative-action');
    });
  });

  describe('hidden inputs', () => {
    it('submits the value with the name of the root', async () => {
      await render(
        <form data-testid="form">
          <Select.Root name="font" defaultValue="serif">
            <Select.Trigger />
          </Select.Root>
        </form>,
      );

      expect(getFormData('font')).toEqual(['serif']);
    });

    it('submits the string of an object value', async () => {
      const value = { code: 'mono', name: 'Monospace' };
      await render(
        <form data-testid="form">
          <Select.Root name="font" defaultValue={value} itemToStringValue={(item) => item.code}>
            <Select.Trigger />
          </Select.Root>
        </form>,
      );

      expect(getFormData('font')).toEqual(['mono']);
    });

    it('submits one entry for each value of a multiple select, from inputs of its own', async () => {
      await render(
        <form data-testid="form">
          <Select.Root multiple name="tags" required defaultValue={['b']}>
            <StoreProbe />
            <Select.Trigger />
          </Select.Root>
        </form>,
      );

      expect(getFormData('tags')).toEqual(['b']);

      await setValueAsItem(['b', 'c']);

      expect(getFormData('tags')).toEqual(['b', 'c']);
      const inputs = document.querySelectorAll('input');
      expect(inputs).toHaveLength(3);
      expect(inputs[0]).not.toHaveAttribute('name');
      expect(inputs[0]).not.toHaveAttribute('required');
      expect(inputs[1]).toHaveAttribute('type', 'hidden');
    });

    it('does not submit the value of a disabled select', async () => {
      await render(
        <form data-testid="form">
          <Select.Root name="font" defaultValue="serif" disabled>
            <Select.Trigger />
          </Select.Root>
        </form>,
      );

      expect(getFormData('font')).toEqual([]);
    });

    it.each([
      { name: 'an input event', type: 'input' },
      { name: 'a change event', type: 'change' },
    ])('keeps its value after $name that gives the input another value', async ({ type }) => {
      const handleValueChange = vi.fn();
      await render(
        <Select.Root name="font" defaultValue="serif" onValueChange={handleValueChange}>
          <Select.Trigger />
        </Select.Root>,
      );
      const input = getHiddenInput();

      input.value = 'mono';
      await fireEvent[type === 'input' ? 'input' : 'change'](input);
      await flushMicrotasks();

      expect(input.value).toBe('serif');
      expect(handleValueChange).toHaveBeenCalledTimes(0);
    });

    it('writes its value to the input after a `pageshow` event', async () => {
      await render(
        <Select.Root name="font" defaultValue="serif">
          <Select.Trigger />
        </Select.Root>,
      );
      const input = getHiddenInput();
      input.value = 'mono';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));

      expect(input.value).toBe('serif');
    });

    it('moves the focus to the trigger when the input gets the focus', async () => {
      await render(
        <Select.Root name="font">
          <Select.Trigger data-testid="trigger" />
        </Select.Root>,
      );

      getHiddenInput().focus();
      await flushMicrotasks();

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });
  });

  describe('autofill', () => {
    function renderFonts(props: { readOnly?: boolean } = {}) {
      const handleValueChange = vi.fn();
      const result = render(
        <form data-testid="form">
          <Select.Root
            name="font"
            defaultValue="sans"
            readOnly={props.readOnly}
            onValueChange={handleValueChange}
          >
            <Select.Trigger />
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="sans">Sans-serif</Select.Item>
                  <Select.Item value="mono">Monospace</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </form>,
      );
      return { handleValueChange, result };
    }

    it('selects the item whose text the browser fills into the input of a closed select', async () => {
      const { handleValueChange, result } = renderFonts();
      await result;
      expect(document.querySelector('[role="option"]')).toBe(null);
      const input = getHiddenInput();

      input.value = 'Monospace';
      await fireEvent.input(input);
      await flushMicrotasks();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toBe('mono');
      expect((handleValueChange.mock.lastCall?.[1] as ChangeDetails).reason).toBe('none');
      expect(input.value).toBe('mono');
      expect(getFormData('font')).toEqual(['mono']);
    });

    it('selects the item whose value the browser fills in, in another case', async () => {
      const fonts = [
        { code: 'sans', name: 'Sans-serif' },
        { code: 'mono', name: 'Monospace' },
      ];
      const handleValueChange = vi.fn();
      await render(
        <Select.Root
          name="font"
          defaultValue={fonts[0]}
          itemToStringValue={(font) => font.code}
          itemToStringLabel={(font) => font.name}
          onValueChange={handleValueChange}
        >
          <Select.Trigger />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {fonts.map((font) => (
                  <Select.Item key={font.code} value={font}>
                    {font.name}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      const input = getHiddenInput();

      input.value = 'MONO';
      await fireEvent.change(input);
      await flushMicrotasks();

      expect(handleValueChange.mock.lastCall?.[0]).toBe(fonts[1]);
      expect(input.value).toBe('mono');
    });

    it('keeps the value of a read-only select', async () => {
      const { handleValueChange, result } = renderFonts({ readOnly: true });
      await result;
      const input = getHiddenInput();

      input.value = 'Monospace';
      await fireEvent.input(input);
      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(input.value).toBe('sans');
    });
  });

  describe('selected index', () => {
    it('follows the value while the popup is closed', async () => {
      const value = shallowRef('a');
      await render(() => (
        <Select.Root value={value.value}>
          <StoreProbe />
          <Select.Trigger />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      store.set('forceMounted', true);
      await flushMicrotasks();
      expect(store.state.selectedIndex).toBe(0);

      value.value = 'b';
      await flushMicrotasks();

      expect(store.state.selectedIndex).toBe(1);
    });

    it('is null for a new value after the items unmount', async () => {
      const value = shallowRef('a');
      const open = shallowRef(true);
      await render(() => (
        <Select.Root value={value.value} open={open.value}>
          <StoreProbe />
          <Select.Trigger />
          <Select.Portal>
            <Select.Positioner>
              {/* The trigger mounts the items when it gets the focus back. */}
              <Select.Popup finalFocus={false}>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      await flushMicrotasks();
      expect(store.state.selectedIndex).toBe(0);

      open.value = false;
      await waitFor(() => {
        expect(screen.queryByRole('option')).toBe(null);
      });
      value.value = 'b';
      await flushMicrotasks();

      expect(store.state.selectedIndex).toBe(null);
    });
  });

  describe('BUG-6206: a native reset', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('puts an uncontrolled select back to its default value', async () => {
      const handleValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Select.Root name="font" defaultValue="sans" onValueChange={handleValueChange}>
            <StoreProbe />
            <Select.Trigger>
              <Select.Value data-testid="value" />
            </Select.Trigger>
          </Select.Root>
        </form>,
      );
      await setValueAsItem('serif');
      expect(getFormData('font')).toEqual(['serif']);

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(screen.getByTestId('value')).toHaveTextContent('sans');
      expect(getFormData('font')).toEqual(['sans']);
      expect(handleValueChange).toHaveBeenCalledTimes(2);
      expect(handleValueChange.mock.lastCall?.[0]).toBe('sans');
      expect(handleValueChange.mock.lastCall?.[1].reason).toBe('none');
      expect(handleValueChange.mock.lastCall?.[1].event.type).toBe('reset');

      // A reset with nothing to change.
      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(handleValueChange).toHaveBeenCalledTimes(2);
    });

    it('puts the values of an uncontrolled multiple select back', async () => {
      await render(
        <form data-testid="form">
          <Select.Root multiple name="tags" defaultValue={['b']}>
            <StoreProbe />
            <Select.Trigger>
              <Select.Value data-testid="value" />
            </Select.Trigger>
          </Select.Root>
        </form>,
      );
      await setValueAsItem(['b', 'c']);
      expect(getFormData('tags')).toEqual(['b', 'c']);

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(screen.getByTestId('value')).toHaveTextContent('b');
      expect(getFormData('tags')).toEqual(['b']);
    });

    it('removes the filled state of the field when it clears the value', async () => {
      await render(
        <form data-testid="form">
          <Field.Root data-testid="field">
            <Select.Root name="font">
              <StoreProbe />
              <Select.Trigger />
            </Select.Root>
          </Field.Root>
        </form>,
      );
      await setValueAsItem('serif');
      expect(screen.getByTestId('field')).toHaveAttribute('data-filled', '');

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(screen.getByTestId('field')).not.toHaveAttribute('data-filled');
      expect(getFormData('font')).toEqual(['']);
    });

    it('does not change a controlled select', async () => {
      const handleValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Select.Root name="font" value="serif" onValueChange={handleValueChange}>
            <Select.Trigger />
          </Select.Root>
        </form>,
      );

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(handleValueChange).toHaveBeenCalledTimes(0);
      expect(getFormData('font')).toEqual(['serif']);
    });
  });

  describe('VUE-21: a native reset clears the error of the field', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function expectNeutralField() {
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-invalid');
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-valid');
      expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid');
    }

    it('VUE-21: clears the error of a required select whose value the reset does not change', async () => {
      const { container } = await render(
        <Form data-testid="form">
          <Field.Root data-testid="field" name="font">
            <Select.Root required>
              <Select.Trigger />
            </Select.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      container.addEventListener('submit', (event) => event.preventDefault());
      await fireEvent.submit(screen.getByTestId('form'));
      expect(screen.getByTestId('field')).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('error')).toBeInTheDocument();

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expectNeutralField();
      expect(getHiddenInput().validity.valueMissing).toBe(true);
    });

    it('VUE-21: clears the error when the reset changes the value, and does not validate it', async () => {
      const validate = vi.fn((value: unknown) => (value === 'serif' ? 'Not serif' : null));
      await render(
        <Form data-testid="form">
          <Field.Root data-testid="field" name="font" validate={validate} validationMode="onChange">
            <Select.Root defaultValue="sans">
              <StoreProbe />
              <Select.Trigger />
            </Select.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      await setValueAsItem('serif');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
      expect(screen.getByTestId('error')).toHaveTextContent('Not serif');
      expect(validate).toHaveBeenCalledTimes(1);

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(validate).toHaveBeenCalledTimes(1);
      expectNeutralField();

      await setValueAsItem('serif');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('error')).toHaveTextContent('Not serif');
    });
  });

  describe('VUE-52: prop: items', () => {
    it('VUE-52: follows a key that the consumer adds in place to a reactive items record', async () => {
      const items = reactive<Record<string, string>>({ sans: 'Sans-serif' });
      await render(() => (
        <Select.Root defaultValue="mono" items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>
      ));
      expect(screen.getByTestId('value')).toHaveTextContent('mono');

      items.mono = 'Monospace';
      await flushMicrotasks();

      expect(screen.getByTestId('value')).toHaveTextContent('Monospace');
    });
  });

  describe('server render', () => {
    it('hydrates a closed select that has a value, a name and items, and a label after the trigger', async () => {
      const props = {
        id: 'font',
        name: 'font',
        defaultValue: 'serif',
        items: { sans: 'Sans-serif', serif: 'Serif' },
        label: 'after',
      };
      const serverHtml = await renderOnServer(
        'src/select/root/SelectRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(SelectRootHydration, { serverHtml, props });

      const trigger = container.querySelector('[role="combobox"]');
      expect(trigger).toHaveTextContent('Serif');
      expect(trigger).toHaveAttribute('aria-labelledby', 'font-label');
      expect(container.querySelector('input')).toHaveValue('serif');
    });

    it('hydrates a select with no value and a placeholder', async () => {
      const props = { id: 'font', placeholder: 'Pick a font' };
      const serverHtml = await renderOnServer(
        'src/select/root/SelectRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(SelectRootHydration, { serverHtml, props });

      const trigger = container.querySelector('[role="combobox"]');
      expect(trigger).toHaveAttribute('data-placeholder');
      expect(trigger).toHaveTextContent('Pick a font');
    });
  });
});
