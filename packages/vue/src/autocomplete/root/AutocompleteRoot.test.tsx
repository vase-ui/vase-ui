import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, nextTick, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import {
  createFormDataSpy,
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import * as Autocomplete from '../index.parts';
import AutocompleteRootHydration from './AutocompleteRootHydration.test.vue';

// No part of this family renders the list or the items yet. The cases of our own use the fixture
// list `ComboboxListPart` in their place. The Base UI cases that render those parts replace the
// cases of the blocks `mode` and `inline completion` (except the `KeepAlive` case), and the case
// `an item press writes the label of the item to the input`.

const HYDRATION_FILE = 'src/autocomplete/root/AutocompleteRootHydration.test.vue';
const cities = ['Malmö', 'Malta', 'Oslo'];

function getInput() {
  return screen.getByRole<HTMLInputElement>('combobox');
}

function getHiddenInput() {
  return document.querySelector<HTMLInputElement>('input[aria-hidden]')!;
}

function getOptions() {
  return screen.queryAllByRole('option').map((option) => option.textContent?.trim());
}

function getFormData(name: string) {
  return new FormData(screen.getByTestId<HTMLFormElement>('form')).getAll(name);
}

async function type(text: string) {
  await fireEvent.input(getInput(), { target: { value: text }, inputType: 'insertText' });
  await flushMicrotasks();
}

async function pressArrowDown() {
  await fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
  await flushMicrotasks();
}

async function hover(label: string) {
  await fireEvent.mouseMove(screen.getByRole('option', { name: label }), { movementX: 1 });
  await flushMicrotasks();
}

function getServerOptions(serverHtml: string) {
  const template = document.createElement('template');
  template.innerHTML = serverHtml;
  return [...template.content.querySelectorAll('[role="option"]')].map(
    (option) => option.textContent,
  );
}

// A call with no locale uses `runtimeLocale`.
function spyOnCollator(runtimeLocale: string) {
  const Collator = Intl.Collator;
  const collatorSpy = vi
    .spyOn(Intl, 'Collator')
    .mockImplementation(function CountedCollator(requestedLocale, options) {
      return new Collator(requestedLocale ?? runtimeLocale, options);
    });
  onTestFinished(() => collatorSpy.mockRestore());
}

// The consumer writes each `valueChange` to `value`.
async function renderControlled(render: ReturnType<typeof createRenderer>['render']) {
  const value = shallowRef('');
  const items = shallowRef<readonly string[]>(cities);
  const Controlled = defineComponent(() => () => (
    <Autocomplete.Root
      mode="both"
      items={items.value}
      value={value.value}
      onValueChange={(next) => {
        value.value = next;
      }}
    >
      <Autocomplete.Input />
      <ComboboxListPart />
    </Autocomplete.Root>
  ));
  await render(<Controlled />);
  return { value, items };
}

async function writeOutside(target: { value: unknown }, next: unknown) {
  target.value = next;
  await nextTick();
  await flushMicrotasks();
}

describe('<Autocomplete.Root />', () => {
  const { render } = createRenderer();

  // `getFilter` keeps the filter for no locale, with the runtime locale of its first use. The case
  // of the mocked locale is thus the first case of the file.
  describe('hydration', () => {
    it('VUE-44: hydrates the list that the server filtered, then follows the runtime locale', async () => {
      spyOnCollator('sv');
      const props = { inline: true, defaultValue: 'malmo' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      expect(getServerOptions(serverHtml)).toEqual(['Malmö']);

      const { container } = await hydrate(AutocompleteRootHydration, { serverHtml, props });

      // The collator of `sv` does not match `ö` with `o`.
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    });

    it('hydrates with a locale of the developer', async () => {
      const props = { inline: true, defaultValue: 'malmo', locale: 'sv' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      expect(getServerOptions(serverHtml)).toEqual([]);

      const { container } = await hydrate(AutocompleteRootHydration, { serverHtml, props });

      expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    });

    it('gives the name to the hidden input after the mount when the root has no input outside the popup', async () => {
      const props = { name: 'search', defaultValue: 'Oslo', noInput: true };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      expect(serverHtml).not.toContain('name="search"');

      const { container } = await hydrate(AutocompleteRootHydration, { serverHtml, props });

      const namedInputs = container.querySelectorAll<HTMLInputElement>('input[name="search"]');
      expect(namedInputs).toHaveLength(1);
      expect(namedInputs[0]).toHaveAttribute('aria-hidden', 'true');
      expect(namedInputs[0].value).toBe('Oslo');
    });
  });

  it('exposes aria-autocomplete="none" when readOnly', async () => {
    await render(
      <Autocomplete.Root defaultValue="" readOnly mode="both">
        <Autocomplete.Input data-testid="input" />
      </Autocomplete.Root>,
    );

    expect(screen.getByTestId('input')).toHaveAttribute('aria-autocomplete', 'none');
  });

  describe('events', () => {
    it('emits valueChange, then update:value, then openChange for typed text', async () => {
      const events: string[] = [];
      await render(
        <Autocomplete.Root
          items={cities}
          onValueChange={(value, details) => events.push(`valueChange:${value}:${details.reason}`)}
          {...{ 'onUpdate:value': (value: string) => events.push(`update:value:${value}`) }}
          onOpenChange={(open, details) => events.push(`openChange:${open}:${details.reason}`)}
          {...{ 'onUpdate:open': (open: boolean) => events.push(`update:open:${open}`) }}
        >
          <Autocomplete.Input />
          <ComboboxListPart />
        </Autocomplete.Root>,
      );

      await type('ma');

      expect(events).toEqual([
        'valueChange:ma:input-change',
        'update:value:ma',
        'openChange:true:input-change',
        'update:open:true',
      ]);
    });
  });

  describe('mode', () => {
    it('mode="list": a keyboard highlight does not change the input', async () => {
      const handleItemHighlighted = vi.fn();
      await render(
        <Autocomplete.Root items={cities} onItemHighlighted={handleItemHighlighted}>
          <Autocomplete.Input />
          <ComboboxListPart />
        </Autocomplete.Root>,
      );
      getInput().focus();
      await type('ma');
      expect(getOptions()).toEqual(['Malmö', 'Malta']);

      await pressArrowDown();

      expect(handleItemHighlighted.mock.lastCall?.[0]).toBe('Malmö');
      expect(handleItemHighlighted.mock.lastCall?.[1].reason).toBe('keyboard');
      expect(getInput().value).toBe('ma');
    });

    it('mode="both": a keyboard highlight writes the label to the input and keeps the list of the typed text', async () => {
      await render(
        <Autocomplete.Root mode="both" items={cities}>
          <Autocomplete.Input />
          <ComboboxListPart />
        </Autocomplete.Root>,
      );
      getInput().focus();
      await type('ma');

      await pressArrowDown();
      expect(getInput().value).toBe('Malmö');
      expect(getOptions()).toEqual(['Malmö', 'Malta']);

      await pressArrowDown();
      expect(getInput().value).toBe('Malta');
      expect(getOptions()).toEqual(['Malmö', 'Malta']);
    });

    it('mode="inline": the list does not filter, and a keyboard highlight writes the label', async () => {
      await render(
        <Autocomplete.Root mode="inline" items={cities}>
          <Autocomplete.Input />
          <ComboboxListPart />
        </Autocomplete.Root>,
      );
      getInput().focus();
      await type('ma');
      expect(getOptions()).toEqual(cities);

      await pressArrowDown();

      expect(getInput().value).toBe('Malmö');
      expect(getOptions()).toEqual(cities);
    });

    it('mode="none": the list does not filter, and the input keeps the typed text', async () => {
      await render(
        <Autocomplete.Root mode="none" items={cities}>
          <Autocomplete.Input />
          <ComboboxListPart />
        </Autocomplete.Root>,
      );
      getInput().focus();
      await type('ma');
      expect(getInput()).toHaveAttribute('aria-autocomplete', 'none');
      expect(getOptions()).toEqual(cities);

      await pressArrowDown();

      expect(getInput().value).toBe('ma');
    });
  });

  describe('inline completion', () => {
    it('typed text replaces the inline text', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Autocomplete.Root
          mode="both"
          autoHighlight
          items={cities}
          onValueChange={handleValueChange}
        >
          <Autocomplete.Input />
          <ComboboxListPart />
        </Autocomplete.Root>,
      );
      getInput().focus();
      await type('ma');
      expect(getInput().value).toBe('Malmö');

      // The highlight stays on `Malmö`, so no new highlight writes the inline text again.
      await type('mal');

      expect(handleValueChange.mock.lastCall?.[0]).toBe('mal');
      expect(getInput().value).toBe('mal');
    });

    it('a pointer highlight writes no inline text', async () => {
      const handleItemHighlighted = vi.fn();
      await render(
        <Autocomplete.Root mode="both" items={cities} onItemHighlighted={handleItemHighlighted}>
          <Autocomplete.Input />
          <ComboboxListPart />
        </Autocomplete.Root>,
      );
      getInput().focus();
      await type('ma');

      await hover('Malmö');

      expect(handleItemHighlighted.mock.lastCall?.[0]).toBe('Malmö');
      expect(handleItemHighlighted.mock.lastCall?.[1].reason).toBe('pointer');
      expect(getInput().value).toBe('ma');
    });

    it('a change of the controlled value from outside replaces the inline text', async () => {
      const { value } = await renderControlled(render);
      getInput().focus();
      await type('ma');
      await pressArrowDown();
      expect(getInput().value).toBe('Malmö');

      await writeOutside(value, 'o');

      expect(getInput().value).toBe('o');
    });

    it('a change of the controlled value drops the completion of a pointer highlight', async () => {
      const { value } = await renderControlled(render);
      getInput().focus();
      await type('ma');
      await hover('Malmö');
      expect(getInput().value).toBe('ma');

      await writeOutside(value, 'o');

      expect(getInput().value).toBe('o');
    });

    it('a later change of the items gives a completion again', async () => {
      const { value, items } = await renderControlled(render);
      getInput().focus();
      await type('ma');
      await pressArrowDown();
      await writeOutside(value, 'o');
      expect(getInput().value).toBe('o');

      await writeOutside(items, ['Otta', ...cities]);

      expect(getInput().value).toBe('Otta');
    });

    it('readOnly removes the inline text, and the text does not come back', async () => {
      const readOnly = shallowRef(false);
      const ReadOnlyRoot = defineComponent(() => () => (
        <Autocomplete.Root mode="both" items={cities} readOnly={readOnly.value}>
          <Autocomplete.Input />
          <ComboboxListPart />
        </Autocomplete.Root>
      ));
      await render(<ReadOnlyRoot />);
      getInput().focus();
      await type('ma');
      await pressArrowDown();
      expect(getInput().value).toBe('Malmö');

      await writeOutside(readOnly, true);
      expect(getInput().value).toBe('ma');
      expect(getInput()).toHaveAttribute('aria-autocomplete', 'none');

      await writeOutside(readOnly, false);
      expect(getInput().value).toBe('ma');
      expect(getInput()).toHaveAttribute('aria-autocomplete', 'both');
    });

    it('KeepAlive: the inline text stays, and a change from outside while deactivated replaces it', async () => {
      const show = shallowRef(true);
      const value = shallowRef('');
      const KeptRoot = defineComponent(() => () => (
        <KeepAlive>
          {show.value ? (
            <Autocomplete.Root
              key="root"
              mode="both"
              items={cities}
              value={value.value}
              onValueChange={(next) => {
                value.value = next;
              }}
            >
              <Autocomplete.Input />
              <ComboboxListPart />
            </Autocomplete.Root>
          ) : null}
        </KeepAlive>
      ));
      await render(<KeptRoot />);
      getInput().focus();
      await type('ma');
      await pressArrowDown();
      expect(getInput().value).toBe('Malmö');

      await writeOutside(show, false);
      await writeOutside(show, true);
      expect(getInput().value).toBe('Malmö');

      await writeOutside(show, false);
      await writeOutside(value, 'o');
      await writeOutside(show, true);

      expect(getInput().value).toBe('o');
    });
  });

  describe('VUE-59: a canceled change', () => {
    it('VUE-59: a canceled valueChange keeps the value of an uncontrolled root', async () => {
      const events: string[] = [];
      await render(
        <Autocomplete.Root
          items={cities}
          defaultValue="m"
          onValueChange={(value, details) => {
            events.push(`valueChange:${value}`);
            details.cancel();
          }}
          {...{ 'onUpdate:value': (value: string) => events.push(`update:value:${value}`) }}
        >
          <Autocomplete.Input />
          <span data-testid="value">
            <Autocomplete.Value />
          </span>
        </Autocomplete.Root>,
      );

      await type('ma');

      expect(events).toEqual(['valueChange:ma']);
      expect(getInput().value).toBe('m');
      expect(screen.getByTestId('value').textContent).toBe('m');
    });
  });

  describe('form', () => {
    it('the visible input has the name and the hidden input has none', async () => {
      await render(
        <form data-testid="form">
          <Autocomplete.Root name="search" items={cities} defaultValue="ma">
            <Autocomplete.Input />
          </Autocomplete.Root>
        </form>,
      );

      expect(getFormData('search')).toEqual(['ma']);
      expect(getInput()).toHaveAttribute('name', 'search');
      expect(getHiddenInput()).not.toHaveAttribute('name');
      expect(getHiddenInput().type).toBe('text');

      await type('mal');

      expect(getFormData('search')).toEqual(['mal']);
    });

    it('an item press writes the label of the item to the input', async () => {
      const events: string[] = [];
      await render(
        <form data-testid="form">
          <Autocomplete.Root
            name="search"
            items={cities}
            onValueChange={(value, details) =>
              events.push(`valueChange:${value}:${details.reason}:${details.event.type}`)
            }
            onOpenChange={(open, details) => events.push(`openChange:${open}:${details.reason}`)}
          >
            <Autocomplete.Input />
            <ComboboxListPart />
          </Autocomplete.Root>
        </form>,
      );
      await type('mal');
      events.length = 0;

      await fireEvent.click(screen.getByRole('option', { name: 'Malta' }));
      await flushMicrotasks();

      expect(events).toEqual(['valueChange:Malta:item-press:click', 'openChange:false:item-press']);
      expect(getInput().value).toBe('Malta');
      expect(getFormData('search')).toEqual(['Malta']);
    });
  });

  describe('VUE-21: a native reset', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function reset() {
      screen.getByTestId<HTMLFormElement>('form').reset();
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
    }

    it('VUE-21: a native reset puts the default value back through valueChange', async () => {
      const handleValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Autocomplete.Root
            name="search"
            items={cities}
            defaultValue="ma"
            onValueChange={handleValueChange}
          >
            <Autocomplete.Input />
          </Autocomplete.Root>
        </form>,
      );
      await type('mal');
      handleValueChange.mockClear();

      await reset();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toBe('ma');
      expect(handleValueChange.mock.lastCall?.[1].reason).toBe('none');
      expect(handleValueChange.mock.lastCall?.[1].event.type).toBe('reset');
      expect(getInput().value).toBe('ma');
      expect(getFormData('search')).toEqual(['ma']);
    });

    it('VUE-21: a native reset does not change a controlled root', async () => {
      const handleValueChange = vi.fn();
      const value = shallowRef('ma');
      const Controlled = defineComponent(() => () => (
        <form data-testid="form">
          <Autocomplete.Root
            name="search"
            items={cities}
            value={value.value}
            onValueChange={(next) => {
              handleValueChange(next);
              value.value = next;
            }}
          >
            <Autocomplete.Input />
          </Autocomplete.Root>
        </form>
      ));
      await render(<Controlled />);
      await type('mal');
      handleValueChange.mockClear();

      await reset();

      expect(handleValueChange).toHaveBeenCalledTimes(0);
      expect(getInput().value).toBe('mal');
      expect(getFormData('search')).toEqual(['mal']);
    });

    it('VUE-21: the change of a reset starts no validation and removes the error of the field', async () => {
      const validate = vi.fn(() => null);
      await render(
        <form data-testid="form">
          <Field.Root name="search" validate={validate} validationMode="onChange">
            <Autocomplete.Root items={cities} required defaultValue="ma">
              <Autocomplete.Input />
            </Autocomplete.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </form>,
      );
      await type('');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
      expect(screen.getByTestId('error')).toBeInTheDocument();
      const validateCalls = validate.mock.calls.length;

      await reset();

      expect(getInput().value).toBe('ma');
      expect(screen.queryByTestId('error')).toBe(null);
      expect(validate).toHaveBeenCalledTimes(validateCalls);
    });
  });

  describe('prop: value', () => {
    it.each([
      { mode: 'none' as const },
      { mode: 'list' as const },
      { mode: 'inline' as const },
      { mode: 'both' as const },
    ])(
      'delivers a burst of controlled input without exceeding the update depth (mode="$mode")',
      async ({ mode }) => {
        const handleValueChange = vi.fn();

        const Controlled = defineComponent(() => {
          const value = shallowRef('');
          return () => (
            <Autocomplete.Root
              mode={mode}
              value={value.value}
              onValueChange={(nextValue) => {
                handleValueChange(nextValue);
                value.value = nextValue;
              }}
            >
              <Autocomplete.Input />
            </Autocomplete.Root>
          );
        });

        await render(<Controlled />);

        const input = screen.getByRole<HTMLInputElement>('combobox');
        const setNativeValue = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )!.set!;
        const errors: string[] = [];
        const handleError = (event: ErrorEvent) => {
          errors.push(String(event.error?.message ?? event.message));
          event.preventDefault();
        };
        const expectedValues = Array.from({ length: 120 }, (_, index) => 'x'.repeat(index + 1));

        window.addEventListener('error', handleError);
        try {
          expectedValues.forEach((nextValue) => {
            setNativeValue.call(input, nextValue);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          });

          await waitFor(() => {
            expect(input).toHaveValue(expectedValues[expectedValues.length - 1]);
          });
        } finally {
          window.removeEventListener('error', handleError);
        }

        expect(errors).toEqual([]);
        expect(handleValueChange.mock.calls.map(([nextValue]) => nextValue)).toEqual(
          expectedValues,
        );
      },
    );
  });

  describe('Form', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('submits the typed input value when wrapped in Field.Root', async () => {
      const handleSubmit = createFormDataSpy('search');

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root>
              <Autocomplete.Input data-testid="input" />
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'hello world');
      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('hello world');
    });

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      const handleSubmit = createFormDataSpy('query');

      const { user } = await render(
        <>
          <form id="external-form" onSubmit={handleSubmit}>
            <button type="submit">Submit</button>
          </form>
          <Autocomplete.Root name="query" form="external-form">
            <Autocomplete.Input data-testid="input" />
          </Autocomplete.Root>
        </>,
      );

      await user.type(screen.getByTestId('input'), 'base ui');
      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('base ui');
    });

    it('triggers native validation when required and empty', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="auto" data-testid="field">
            <Autocomplete.Root required>
              <Autocomplete.Input data-testid="input" />
            </Autocomplete.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Submit'));

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });
  });
});
