import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  waitFor,
  within,
} from '#test-utils';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import ComboboxPartsReplacement from '../../../test/fixtures/ComboboxPartsReplacement.vue';
import * as Autocomplete from '../../autocomplete/index.parts';
import { REASONS } from '../../internals/reasons';
import * as Combobox from '../index.parts';
import type { ComboboxStore } from '../store';
import ComboboxInputHydration from './ComboboxInputHydration.test.vue';

const HYDRATION_FIXTURE = 'src/combobox/input/ComboboxInputHydration.test.vue';

type RenderSlotProps = { props: Record<string, unknown> };

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

    it('should not open popup when disabled', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Input disabled data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);

      expect(screen.queryByRole('listbox')).toBe(null);
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

  describe('rendering as a different element', () => {
    // The injected `type: 'text'` was removed so the input can be rendered as a
    // `<textarea>` without receiving an attribute that element does not support.
    it('renders as a <textarea> without an invalid `type` attribute and stays editable', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana']}>
          <Combobox.Input data-testid="input" as="textarea" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId<HTMLTextAreaElement>('input');
      expect(input.tagName).toBe('TEXTAREA');
      expect(input).not.toHaveAttribute('type');

      await user.type(input, 'app');
      expect(input.value).toBe('app');
    });

    // A non-input control only carries the combobox ARIA attributes while the popup
    // is open; a native <input> exposes them even when closed.
    it('applies combobox aria attributes to a <textarea> only while the popup is open', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana']}>
          <Combobox.Input data-testid="input" as="textarea" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      // Closed: combobox semantics are not exposed on a non-input control.
      expect(input).not.toHaveAttribute('role', 'combobox');
      expect(input).not.toHaveAttribute('aria-expanded');
      expect(input).not.toHaveAttribute('aria-controls');

      await user.type(input, 'a');
      const listbox = await screen.findByRole('listbox');

      // Open: the combobox ARIA contract is applied to the textarea.
      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-controls', listbox.id);
    });

    // An inline list is exposed for as long as it's rendered, so a non-input control carries
    // the combobox ARIA attributes from the start rather than waiting for the open state.
    it('applies combobox aria attributes to an inline <textarea> before it is interacted with', async () => {
      await render(
        <Combobox.Root inline items={['apple', 'banana']}>
          <Combobox.Input data-testid="input" as="textarea" />
          <Combobox.List>
            {{
              item: ({ item }: { item: string }) => (
                <Combobox.Item key={item} value={item}>
                  {item}
                </Combobox.Item>
              ),
            }}
          </Combobox.List>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const listbox = screen.getByRole('listbox');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-controls', listbox.id);
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
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

    it('should open popup when readOnly', async () => {
      const { user } = await render(
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);

      expect(await screen.findByRole('listbox')).toHaveAttribute('aria-readonly', 'true');
    });

    it('should not change the input value when typing while readOnly', async () => {
      const onInputValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root readOnly onInputValueChange={onInputValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.type(input, 'a');

      expect(input).toHaveValue('');
      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('allows interactions when readOnly={false}', async () => {
      const { user } = await render(
        <Combobox.Root readOnly={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await waitFor(() => {
        screen.getByRole('option', { name: 'a' });
      });
      await user.click(screen.getByRole('option', { name: 'a' }));
      expect(input).toHaveValue('a');
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

  describe('onOpenChange reason', () => {
    it('fires with reason input-press when Input is clicked', async () => {
      const onOpenChange = vi.fn();

      const { user } = await render(
        <Combobox.Root items={['apple', 'banana']} onOpenChange={onOpenChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);

      expect(onOpenChange.mock.calls.length).toBeGreaterThan(0);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.inputPress);
    });
  });

  describe('interaction behavior', () => {
    it('clears selected value when input text is cleared (single selection)', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana']} defaultValue="apple">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      expect(input.value).toBe('apple');

      await user.clear(input);

      expect(input.value).toBe('');

      await user.type(input, 'a');
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const options = screen.getAllByRole('option');
      options.forEach((opt) => {
        expect(opt).not.toHaveAttribute('aria-selected', 'true');
      });
    });

    it('should open popup on typing when enabled', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'a');

      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    it('should handle multiple selection with chips when disabled', async () => {
      const { user } = await render(
        <Combobox.Root multiple disabled defaultValue={['apple']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip">
              apple
              <Combobox.ChipRemove data-testid="remove" />
            </Combobox.Chip>
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const chip = screen.getByTestId('chip');
      const remove = screen.getByTestId('remove');

      expect(input).toHaveAttribute('disabled');
      expect(chip).toHaveAttribute('aria-disabled', 'true');
      expect(remove).toHaveAttribute('aria-disabled', 'true');

      await user.type(input, '{backspace}');
      expect(screen.getByTestId('chip')).not.toBe(null);
    });

    it('should handle multiple selection with chips when readOnly', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root
          multiple
          readOnly
          defaultValue={['apple', 'banana']}
          onValueChange={handleValueChange}
        >
          <Combobox.Chips>
            <Combobox.Value
              v-slots={{
                default: ({ value }: { value: string[] }) => (
                  <>
                    {value.map((item) => (
                      <Combobox.Chip key={item}>{item}</Combobox.Chip>
                    ))}
                    <Combobox.Input data-testid="input" />
                  </>
                ),
              }}
            />
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('aria-readonly', 'true');

      await user.click(input);
      await user.keyboard('{Backspace}');

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByText('banana')).not.toBe(null);
    });

    it('should move focus to clear button when pressing Escape and popup is closed', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana']} defaultValue="apple">
          <Combobox.Input data-testid="input" />
          <Combobox.Clear data-testid="clear" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      input.focus();
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(input.value).toBe('');
      });

      await user.type(input, 'a');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });
      await user.click(screen.getByRole('option', { name: 'apple' }));

      await user.type(input, 'a');
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(input.value).toBe('apple');
      });
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

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

    it('clears the chip highlight when focus returns to the input', async () => {
      const { user } = await render(
        <Combobox.Root multiple defaultValue={['apple', 'banana', 'cherry']}>
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
            <Combobox.Chip data-testid="chip-cherry">cherry</Combobox.Chip>
            <Combobox.Input data-testid="input" />
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      input.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(screen.getByTestId('chip-banana')).toHaveFocus();

      input.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByTestId('chip-cherry')).toHaveFocus();
    });

    it('removes the last chip after clicking from a chip back to the input', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root
          multiple
          openOnInputClick={false}
          defaultValue={['apple', 'banana', 'cherry']}
          onValueChange={handleValueChange}
        >
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
            <Combobox.Chip data-testid="chip-cherry">cherry</Combobox.Chip>
            <Combobox.Input data-testid="input" />
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.click(input);
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByTestId('chip-cherry')).toHaveFocus();

      await user.click(input);
      expect(input).toHaveFocus();

      await user.keyboard('{Backspace}');

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['apple', 'banana']);
    });

    it('removes the last chip after leaving a chip and tabbing back to the input', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <div>
          <button data-testid="outside">outside</button>
          <Combobox.Root
            multiple
            defaultValue={['apple', 'banana', 'cherry']}
            onValueChange={handleValueChange}
          >
            <Combobox.Chips>
              <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
              <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
              <Combobox.Chip data-testid="chip-cherry">cherry</Combobox.Chip>
              <Combobox.Input data-testid="input" />
            </Combobox.Chips>
          </Combobox.Root>
        </div>,
      );

      const input = screen.getByTestId('input');
      const outside = screen.getByTestId('outside');

      await user.click(outside);
      await user.tab();
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByTestId('chip-cherry')).toHaveFocus();

      await user.click(outside);
      expect(outside).toHaveFocus();

      await user.tab();
      expect(input).toHaveFocus();

      await user.keyboard('{Backspace}');

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['apple', 'banana']);
    });

    it('keeps focus on the input when navigating toward chips but none are rendered', async () => {
      const { user } = await render(
        <Combobox.Root multiple defaultValue={['apple']}>
          <Combobox.Chips>
            <Combobox.Input />
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      input.focus();
      input.setSelectionRange(0, 0);
      await user.keyboard('{ArrowLeft}');

      expect(input).toHaveFocus();
    });

    it('treats a null selectionStart as the beginning of a custom input', async () => {
      const { user } = await render(
        <Combobox.Root multiple defaultValue={['apple']}>
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip">apple</Combobox.Chip>
            <Combobox.Input
              v-slots={{
                render: ({ props }: RenderSlotProps) => <input {...props} type="number" />,
              }}
            />
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input.selectionStart).toBe(null);
      input.focus();
      await user.keyboard('{ArrowLeft}');

      expect(screen.getByTestId('chip')).toHaveFocus();
    });

    it('keeps the popup open after modified keyboard navigation', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      input.focus();

      await user.keyboard('{Control>}{ArrowDown}{/Control}');
      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    it('toggles the highlighted item with Space in multiple mode while keeping the popup open', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root multiple defaultOpen onValueChange={onValueChange}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await user.keyboard('{ArrowDown}');
      const option = screen.getByRole('option', { name: 'apple' });
      expect(option).toHaveAttribute('data-highlighted');
      expect(option).not.toHaveAttribute('data-selected');
      expect(input.value).toBe('');
      expect(input).toHaveFocus();

      await user.keyboard(' ');

      expect(onValueChange.mock.lastCall?.[0]).toEqual(['apple']);
      expect(option).toHaveAttribute('data-selected');
      expect(option).toHaveAttribute('data-highlighted');
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(input.value).toBe('');
      expect(input).toHaveFocus();

      await user.keyboard(' ');

      expect(onValueChange.mock.lastCall?.[0]).toEqual([]);
      expect(option).not.toHaveAttribute('data-selected');
      const listboxAfterDeselection = screen.getByRole('listbox');
      expect(listboxAfterDeselection).toBeInTheDocument();
      expect(input.value).toBe('');
      expect(input).toHaveFocus();
    });

    it('ignores Space in an empty input without a highlighted item', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root defaultOpen onValueChange={onValueChange}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');

      await user.keyboard(' ');

      expect(input.value).toBe('');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    it('types Space into a non-empty input with a highlighted item', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root defaultOpen onValueChange={onValueChange}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await user.keyboard('a{ArrowDown}');
      expect(screen.getByRole('option')).toHaveAttribute('data-highlighted');

      await user.keyboard(' ');

      expect(input.value).toBe('a ');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not select an item for an IME keydown without a highlight', async () => {
      const onValueChange = vi.fn();
      await render(
        <Combobox.Root defaultOpen onValueChange={onValueChange}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      input.focus();
      await fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, which: 229 });
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not restore an inline highlight after the highlighted slot is removed', async () => {
      const Test = defineComponent(() => {
        const items = shallowRef(['apple']);

        return () => (
          <div>
            <Combobox.Root inline open items={items.value}>
              <Combobox.Input />
              <Combobox.List>
                {{
                  item: ({ item }: { item: string }) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  ),
                }}
              </Combobox.List>
            </Combobox.Root>
            <button
              type="button"
              onClick={() => {
                items.value = [];
              }}
            >
              remove items
            </button>
          </div>
        );
      });

      const { user } = await render(<Test />);
      const input = screen.getByRole('combobox');
      input.focus();
      await user.keyboard('{ArrowDown}');
      expect(input).toHaveAttribute('aria-activedescendant');

      await user.click(screen.getByRole('button', { name: 'remove items' }));
      await user.click(input);

      expect(input).not.toHaveAttribute('aria-activedescendant');
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

    it('closes on an empty composition update when input clicks do not open the popup', async () => {
      await render(
        <Combobox.Root
          defaultOpen
          defaultInputValue="x"
          openOnInputClick={false}
          filter={null}
          items={['apple']}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      expect(screen.getByRole('listbox')).not.toBe(null);

      await fireEvent.compositionStart(input);
      await fireEvent.input(input, { target: { value: '' } });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('clears the highlight on an empty composition update while staying open', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen defaultInputValue="x" filter={null} items={['apple']}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      input.focus();
      await user.keyboard('{ArrowDown}');
      expect(input).toHaveAttribute('aria-activedescendant');

      await fireEvent.compositionStart(input);
      await fireEvent.input(input, { target: { value: '' } });

      expect(screen.getByRole('listbox')).not.toBe(null);
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('removes the last rendered chip when pressing Backspace in an empty input', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root
          multiple
          defaultValue={['apple', 'banana', 'cherry']}
          onValueChange={handleValueChange}
        >
          <Combobox.Chips>
            <Combobox.Value
              v-slots={{
                default: ({ value }: { value: string[] }) => (
                  <>
                    {value.slice(0, 2).map((item) => (
                      <Combobox.Chip key={item}>{item}</Combobox.Chip>
                    ))}
                    <Combobox.Input data-testid="input" />
                  </>
                ),
              }}
            />
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.click(input);
      await user.keyboard('{Backspace}');

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['apple', 'cherry']);
    });

    it('removes the last chip after tabbing from a chip back to the input', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root
          multiple
          open={false}
          defaultValue={['apple', 'banana', 'cherry']}
          onValueChange={handleValueChange}
        >
          <Combobox.Chips>
            <Combobox.Value
              v-slots={{
                default: ({ value }: { value: string[] }) => (
                  <>
                    {value.map((item) => (
                      <Combobox.Chip key={item} data-testid={item}>
                        {item}
                      </Combobox.Chip>
                    ))}
                    <Combobox.Input data-testid="input" />
                  </>
                ),
              }}
            />
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.click(input);
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByTestId('cherry')).toHaveFocus();

      await user.tab();
      expect(input).toHaveFocus();

      await user.keyboard('{Backspace}');

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['apple', 'banana']);
    });

    it('focuses the last chip with ArrowLeft after tabbing from a chip back to the input', async () => {
      const { user } = await render(
        <Combobox.Root multiple open={false} defaultValue={['apple', 'banana', 'cherry']}>
          <Combobox.Chips>
            <Combobox.Value
              v-slots={{
                default: ({ value }: { value: string[] }) => (
                  <>
                    {value.map((item) => (
                      <Combobox.Chip key={item} data-testid={item}>
                        {item}
                      </Combobox.Chip>
                    ))}
                    <Combobox.Input data-testid="input" />
                  </>
                ),
              }}
            />
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const lastChip = screen.getByTestId('cherry');

      await user.click(input);
      await user.keyboard('{ArrowLeft}');
      expect(lastChip).toHaveFocus();

      await user.tab();
      expect(input).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(lastChip).toHaveFocus();
    });

    it('removes the last selected value when no chips are rendered', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root
          multiple
          defaultValue={['apple', 'banana']}
          onValueChange={handleValueChange}
        >
          <Combobox.Chips>
            <Combobox.Value
              v-slots={{
                default: ({ value }: { value: string[] }) => (
                  <>
                    <span>{`+${value.length} selected`}</span>
                    <Combobox.Input data-testid="input" />
                  </>
                ),
              }}
            />
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.click(input);
      await user.keyboard('{Backspace}');

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['apple']);
    });

    it('closes the popup when tabbing out', async () => {
      const { user } = await render(
        <div>
          <Combobox.Root>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="apple">apple</Combobox.Item>
                    <Combobox.Item value="banana">banana</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <button type="button" data-testid="button">
            button
          </button>
        </div>,
      );

      const input = screen.getByRole('combobox');
      const button = screen.getByTestId('button');

      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.tab();

      await waitFor(() => {
        expect(button).toHaveFocus();
      });
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.tab();

      await waitFor(() => {
        expect(button).toHaveFocus();
      });
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  describe('data state attributes', () => {
    it.skipIf(isJSDOM)('sets data-popup-side to the current popup side', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple']}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner side="right">
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      expect(input).not.toHaveAttribute('data-popup-side');

      await user.click(input);

      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));
      expect(input).toHaveAttribute('data-popup-side', 'right');

      await user.click(document.body);

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(input).not.toHaveAttribute('data-popup-side');
    });

    it('toggles data-list-empty when the filtered list is empty', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana']}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await user.click(input);

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(input).not.toHaveAttribute('data-list-empty');

      await user.type(input, 'zzz');

      expect(input).toHaveAttribute('data-list-empty');

      await user.clear(input);

      expect(input).not.toHaveAttribute('data-list-empty');
    });
  });

  describe('Vue form of the input', () => {
    const cities = ['Malmö', 'Malta', 'Oslo'];

    function getInput() {
      return screen.getByRole<HTMLInputElement>('combobox');
    }

    async function type(text: string, inputType = 'insertText') {
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
      await type('ma', 'insertCompositionText');

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
      await type('ma', 'insertCompositionText');
      // WebKit writes the committed text, sends `compositionend`, and then sends the last `input`
      // event, before the input renders again.
      getInput().value = 'マ';
      const ended = fireEvent.compositionEnd(getInput());
      await type('マ', 'insertCompositionText');
      await ended;

      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('マ');
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
      await type('ma', 'insertCompositionText');
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

      // Text with no `inputType`, as an autofill gives, does not open the popup. No render of the
      // input then follows.
      await type('Osl', '');

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

    it('gives the form one entry for the name in the selection mode none', async () => {
      await render(
        <form data-testid="form">
          <Autocomplete.Root name="search" defaultValue="ma">
            <Combobox.Input />
          </Autocomplete.Root>
        </form>,
      );

      expect(getInput()).toHaveAttribute('name', 'search');
      expect(new FormData(screen.getByTestId<HTMLFormElement>('form')).getAll('search')).toEqual([
        'ma',
      ]);
    });

    it('keeps the input and the dismiss button of an input that mounts before the old input unmounts', async () => {
      let store!: ComboboxStore;
      const { setProps } = await render(
        <ComboboxPartsReplacement first onStore={(value: ComboboxStore) => (store = value)} />,
      );
      expect(store.select('inputElement')).toBe(screen.getByTestId('first-input'));

      await setProps({ first: false });

      const input = screen.getByTestId('second-input');
      expect(screen.queryByTestId('first-input')).toBe(null);
      expect(store.select('inputElement')).toBe(input);
      expect(store.context.inputRef.value).toBe(input);
      expect(store.context.startDismissRef.value).toBe(input.previousElementSibling);
      expect(store.context.startDismissRef.value).toHaveAttribute('aria-label', 'Dismiss');
    });

    it.each([
      { name: 'the label first, the description last', parts: ['label', 'input', 'description'] },
      { name: 'the input first', parts: ['input', 'label', 'description'] },
      { name: 'the description first, the label last', parts: ['description', 'input', 'label'] },
    ])('VUE-17: hydrates with the ids of the server: $name', async ({ parts }) => {
      const props = { parts };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverInput = template.content.querySelector('[data-testid="input"]');
      const serverId = (testId: string) =>
        template.content.querySelector(`[data-testid="${testId}"]`)?.id;
      expect(serverInput?.getAttribute('aria-labelledby')).toBe(serverId('label'));
      expect(serverInput?.getAttribute('aria-describedby')).toBe(serverId('description'));
      expect(template.content.querySelector('[data-testid="label"]')?.getAttribute('for')).toBe(
        serverInput?.id,
      );
      expect(serverInput?.getAttribute('value')).toBe('ma');

      const { container } = await hydrate(ComboboxInputHydration, { serverHtml, props });

      const input = within(container).getByTestId('input');
      expect(input).toHaveAttribute('aria-labelledby', serverId('label'));
      expect(input).toHaveAttribute('aria-describedby', serverId('description'));
      expect(input).toHaveValue('ma');
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

    it('selects the highlighted item with Enter in a root that the consumer opens', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Combobox.Root open items={cities} onValueChange={handleValueChange}>
          <Combobox.Input />
          <ComboboxListPart />
        </Combobox.Root>,
      );

      getInput().focus();
      await fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
      await fireEvent.keyDown(getInput(), { key: 'Enter' });
      await flushMicrotasks();

      expect(handleValueChange.mock.lastCall?.[0]).toBe('Malmö');
    });
  });
});
