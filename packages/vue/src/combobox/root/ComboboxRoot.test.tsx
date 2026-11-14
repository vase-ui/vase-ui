import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, reactive, shallowRef, toRaw, watch } from 'vue';
import type { ComputedRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hiddenInputSizeTests,
  hiddenInputTypeTests,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import AutocompleteRootPart from '../../../test/fixtures/AutocompleteRootPart.vue';
import ComboboxInputPart from '../../../test/fixtures/ComboboxInputPart.vue';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import * as Combobox from '../index.parts';
import type { ComboboxStore } from '../store';
import { useComboboxInputValueContext, useComboboxRootContext } from './ComboboxRootContext';
import type { ComboboxInputElementValue } from './ComboboxRootContext';
import ComboboxRootHydration from './ComboboxRootHydration.test.vue';

// No part of this family renders the positioner, the list or the items yet. The cases use the
// fixture parts in their place, and they test the root. Most cases also use the fixture input. It
// handles only the `input` event, and its `insidePopup` prop stands for a positioner around it.
// The Base UI cases of this file render those parts, so the pull requests that add the parts port
// them. A ported case then replaces the case of this file that tests the same thing: the order of
// the events, a canceled change, the controlled values, the hidden inputs, the autofill, the field
// and the server render. One Base UI case of this file renders only the root. It is in the block
// `coverage edge cases`.

const HYDRATION_FILE = 'src/combobox/root/ComboboxRootHydration.test.vue';
const cities = ['Malmö', 'Malta', 'Oslo'];

let store: ComboboxStore;
const StoreProbe = defineComponent(() => {
  store = useComboboxRootContext();
  return () => null;
});

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

async function pick(label: string) {
  await fireEvent.click(screen.getByRole('option', { name: label }));
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

describe('<Combobox.Root />', () => {
  const { render } = createRenderer();

  // `getFilter` keeps the filter for no locale, with the runtime locale of its first use. These
  // cases are thus the first cases of the file.
  describe('VUE-44: the locale of the filter', () => {
    it('VUE-44: filters with en-US until the root is mounted when it has no locale', async () => {
      spyOnCollator('sv');
      const props = { inline: true, defaultInputValue: 'malmo' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      expect(getServerOptions(serverHtml)).toEqual(['Malmö']);

      const { container } = await hydrate(ComboboxRootHydration, { serverHtml, props });

      // The collator of `sv` does not match `ö` with `o`.
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    });

    it('VUE-44: uses the locale of the developer on the server and in the browser', async () => {
      const props = { inline: true, defaultInputValue: 'malmo', locale: 'sv' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      expect(getServerOptions(serverHtml)).toEqual([]);

      const { container } = await hydrate(ComboboxRootHydration, { serverHtml, props });

      expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    });
  });

  describe('events', () => {
    it('emits valueChange, update:value, inputValueChange, update:inputValue, openChange and update:open in this order for a pick', async () => {
      const events: string[] = [];
      let inputValue: ComputedRef<ComboboxInputElementValue>;
      const InputValueProbe = defineComponent(() => {
        inputValue = useComboboxInputValueContext();
        return () => null;
      });
      await render(
        <Combobox.Root
          items={cities}
          onValueChange={(value, details) => events.push(`valueChange:${value}:${details.reason}`)}
          onInputValueChange={(value, details) =>
            events.push(`inputValueChange:${value}:${details.reason}:${inputValue.value}`)
          }
          onOpenChange={(open, details) => events.push(`openChange:${open}:${details.reason}`)}
          {...{
            'onUpdate:value': (value: unknown) => events.push(`update:value:${value}`),
            'onUpdate:inputValue': (value: unknown) => events.push(`update:inputValue:${value}`),
            'onUpdate:open': (value: unknown) => events.push(`update:open:${value}`),
          }}
        >
          <InputValueProbe />
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>,
      );

      await type('ma');

      expect(events.splice(0)).toEqual([
        'inputValueChange:ma:input-change:',
        'update:inputValue:ma',
        'openChange:true:input-change',
        'update:open:true',
      ]);

      await pick('Malta');

      expect(events).toEqual([
        'valueChange:Malta:item-press',
        'update:value:Malta',
        'inputValueChange:Malta:item-press:ma',
        'update:inputValue:Malta',
        'openChange:false:item-press',
        'update:open:false',
      ]);
    });

    it.each([
      {
        name: 'valueChange',
        expected: { input: 'ma', value: '', expanded: 'true', updates: ['inputValue', 'open'] },
      },
      {
        name: 'inputValueChange',
        expected: { input: '', value: '', expanded: 'false', updates: [] },
      },
      {
        name: 'openChange',
        expected: { input: 'ma', value: '', expanded: 'false', updates: ['inputValue'] },
      },
    ])(
      'keeps the value, the input and the open state when a listener of $name cancels',
      async ({ name, expected }) => {
        const updates: string[] = [];
        const cancel = (details: { cancel: () => void }) => details.cancel();
        await render(
          <Combobox.Root
            name="city"
            items={cities}
            {...{
              [`on${name[0].toUpperCase()}${name.slice(1)}`]: (_: unknown, details: any) =>
                cancel(details),
              'onUpdate:value': () => updates.push('value'),
              'onUpdate:inputValue': () => updates.push('inputValue'),
              'onUpdate:open': () => updates.push('open'),
            }}
          >
            <ComboboxInputPart />
            <ComboboxListPart />
          </Combobox.Root>,
        );

        await type('ma');
        if (name === 'valueChange') {
          await pick('Malta');
        }

        expect({
          input: getInput().value,
          value: getHiddenInput().value,
          expanded: getInput().getAttribute('aria-expanded'),
          updates,
        }).toEqual(expected);
      },
    );

    it('keeps the typed filter while the popup closes after a pick', async () => {
      const root = shallowRef<Combobox.Root.Actions | null>(null);
      await render(() => (
        <Combobox.Root
          ref={root}
          items={cities}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        >
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>
      ));

      await type('ma');
      expect(getOptions()).toEqual(['Malmö', 'Malta']);

      await pick('Malta');

      expect(getInput()).toHaveAttribute('aria-expanded', 'false');
      expect(getOptions()).toEqual(['Malmö', 'Malta']);

      root.value!.unmount();
      await flushMicrotasks();

      expect(getOptions()).toEqual([]);
      expect(getInput().value).toBe('Malta');
    });
  });

  describe('controlled values', () => {
    it('gives the label of a new controlled value to the input, one time', async () => {
      const value = shallowRef('Oslo');
      const handleInputValueChange = vi.fn();
      await render(() => (
        <Combobox.Root
          items={cities}
          value={value.value}
          onInputValueChange={handleInputValueChange}
        >
          <ComboboxInputPart />
        </Combobox.Root>
      ));
      expect(getInput().value).toBe('Oslo');

      value.value = 'Malta';
      await flushMicrotasks();

      expect(getInput().value).toBe('Malta');
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('Malta');
      expect(handleInputValueChange.mock.lastCall?.[1].reason).toBe('none');
    });

    it('asks one time when a listener cancels and the label function changes in the same flush', async () => {
      const value = shallowRef('Malta');
      const upperCase = shallowRef(false);
      const handleInputValueChange = vi.fn((_: string, details: { cancel: () => void }) =>
        details.cancel(),
      );
      await render(() => (
        <Combobox.Root
          items={cities}
          value={value.value}
          itemToStringLabel={upperCase.value ? (city: string) => city.toUpperCase() : undefined}
          onInputValueChange={handleInputValueChange}
        >
          <ComboboxInputPart />
        </Combobox.Root>
      ));

      value.value = 'Oslo';
      upperCase.value = true;
      await flushMicrotasks();

      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('OSLO');
      expect(getInput().value).toBe('Malta');
    });

    it('follows a controlled input value', async () => {
      const inputValue = shallowRef('os');
      await render(() => (
        <Combobox.Root items={cities} inputValue={inputValue.value}>
          <ComboboxInputPart />
        </Combobox.Root>
      ));

      // The listener does not take the typed text.
      await type('osl');

      expect(getInput().value).toBe('os');

      inputValue.value = 'osl';
      await flushMicrotasks();

      expect(getInput().value).toBe('osl');
    });

    it('keeps the input value when it has no controlled value', async () => {
      await render(
        <Combobox.Root items={cities} defaultValue="Oslo">
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>,
      );
      expect(getInput().value).toBe('Oslo');

      await type('mal');
      expect(getInput().value).toBe('mal');

      await pick('Malta');

      expect(getInput().value).toBe('Malta');
    });
  });

  describe('filter', () => {
    it('runs the filter one time for a change of the query and not for a change of another prop', async () => {
      const filter = vi.fn((city: string, query: string) =>
        city.toLowerCase().includes(query.toLowerCase()),
      );
      const disabled = shallowRef(false);
      const name = shallowRef<string | undefined>(undefined);
      await render(() => (
        <Combobox.Root items={cities} filter={filter} disabled={disabled.value} name={name.value}>
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>
      ));

      await type('ma');

      expect(getOptions()).toEqual(['Malmö', 'Malta']);
      expect(filter).toHaveBeenCalledTimes(cities.length);

      disabled.value = true;
      await flushMicrotasks();
      name.value = 'city';
      await flushMicrotasks();

      expect(filter).toHaveBeenCalledTimes(cities.length);
    });

    // A regression check of the `items` prop: the root keeps no copy of the list.
    it('shows an item that the consumer adds in place to a reactive items list', async () => {
      const items = reactive(['Malmö', 'Malta']);
      await render(() => (
        <Combobox.Root items={items} defaultOpen>
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>
      ));
      expect(getOptions()).toEqual(['Malmö', 'Malta']);

      items.push('Oslo');
      await flushMicrotasks();

      expect(getOptions()).toEqual(['Malmö', 'Malta', 'Oslo']);
    });
  });

  describe('highlight', () => {
    async function renderList(props: Record<string, unknown> = {}) {
      const handleItemHighlighted = vi.fn();
      const view = await render(
        <Combobox.Root
          id="city"
          items={cities}
          onItemHighlighted={handleItemHighlighted}
          {...props}
        >
          <Combobox.Input />
          <ComboboxListPart />
        </Combobox.Root>,
      );
      const highlights = () =>
        handleItemHighlighted.mock.calls.map(
          ([value, details]) => `${value}:${details.index}:${details.reason}`,
        );
      return { ...view, handleItemHighlighted, highlights };
    }

    function getOptionId(label: string) {
      return screen.getByRole('option', { name: label }).id;
    }

    async function press(key: string) {
      await fireEvent.keyDown(getInput(), { key });
      await flushMicrotasks();
    }

    it('highlights the first item for typed text with autoHighlight', async () => {
      const { highlights } = await renderList({ autoHighlight: true });

      await type('ma');

      expect(highlights()).toEqual(['Malmö:0:none']);
      expect(getInput()).toHaveAttribute('aria-activedescendant', getOptionId('Malmö'));
      expect(getInput()).toHaveAttribute('aria-controls', 'city-list');
    });

    it('emits itemHighlighted one time for each change, with the reason keyboard for an arrow key', async () => {
      const { highlights } = await renderList({ autoHighlight: true });

      await type('ma');
      await press('ArrowDown');
      await type('mal');
      await type('o');

      expect(highlights()).toEqual([
        'Malmö:0:none',
        'Malta:1:keyboard',
        'Malmö:0:none',
        'Oslo:0:none',
      ]);
    });

    it('clears the highlight when no item matches', async () => {
      const { highlights } = await renderList({ autoHighlight: true });

      await type('ma');
      await type('zzz');

      expect(highlights()).toEqual(['Malmö:0:none', 'undefined:-1:none']);
      expect(getInput()).not.toHaveAttribute('aria-activedescendant');
    });

    it('highlights the first item at the open with autoHighlight always', async () => {
      const { highlights } = await renderList({ autoHighlight: 'always' });

      await fireEvent.mouseDown(getInput());
      await flushMicrotasks();

      expect(getInput()).toHaveAttribute('aria-expanded', 'true');
      expect(highlights()).toEqual(['Malmö:0:none']);
      expect(getInput()).toHaveAttribute('aria-activedescendant', getOptionId('Malmö'));
    });

    it('does not highlight for autofill text', async () => {
      const { highlights } = await renderList({ autoHighlight: true });
      await fireEvent.mouseDown(getInput());
      await flushMicrotasks();
      expect(getInput()).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.input(getInput(), {
        target: { value: 'ma' },
        inputType: 'insertReplacementText',
      });
      await flushMicrotasks();

      expect(getOptions()).toEqual(['Malmö', 'Malta']);
      expect(highlights()).toEqual([]);
    });

    it('returns the highlight to the selected item after a clear by a pick (input in the popup, multiple)', async () => {
      const { highlights } = await renderList({
        inline: true,
        open: true,
        multiple: true,
        defaultValue: ['Malmö'],
        autoHighlight: true,
      });
      getInput().focus();

      await type('mal');
      expect(highlights()).toEqual(['Malmö:0:none']);

      await pick('Malta');

      expect(getInput().value).toBe('');
      expect(getOptions()).toEqual(cities);
      expect(highlights()).toEqual(['Malmö:0:none', 'Malta:1:none']);
      expect(getInput()).toHaveAttribute('aria-activedescendant', getOptionId('Malta'));
    });

    it('aria-activedescendant names the active item and the input keeps the focus', async () => {
      await renderList();
      getInput().focus();

      await type('ma');
      expect(getInput()).not.toHaveAttribute('aria-activedescendant');

      await press('ArrowDown');

      expect(getInput()).toHaveAttribute('aria-activedescendant', getOptionId('Malmö'));
      expect(getInput()).toHaveFocus();
    });

    it('emits no highlight while the popup closes', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const { container, highlights } = await renderList({ defaultValue: 'Malta' });
      // The popup of the fixture list is the parent of the list. Its animation holds the close.
      const style = document.createElement('style');
      style.textContent =
        '@keyframes hold { to { opacity: 0.5; } } div:has(> #city-list) { animation: hold 100s; }';
      container.append(style);
      getInput().focus();
      await fireEvent.mouseDown(getInput());
      await flushMicrotasks();
      expect(getOptions()).toEqual(cities);

      await press('Escape');
      expect(getInput()).toHaveAttribute('aria-expanded', 'false');
      expect(getOptions()).toEqual(cities);

      await press('ArrowDown');

      expect(getInput()).toHaveAttribute('aria-expanded', 'true');
      expect(highlights()).toEqual([]);

      for (const animation of document.getAnimations()) {
        animation.finish();
      }
    });

    it('keeps the highlight of the popup that a controlled root closes for the typed text', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const open = shallowRef(true);
      const activeIndices: Array<number | null> = [];
      const ActiveIndexRecorder = defineComponent(() => {
        const rootStore = useComboboxRootContext();
        watch(
          () => rootStore.select('activeIndex'),
          (activeIndex) => activeIndices.push(activeIndex),
          { flush: 'sync' },
        );
        return () => null;
      });
      const { container } = await render(() => (
        <Combobox.Root
          id="city"
          items={cities}
          autoHighlight
          open={open.value}
          onInputValueChange={(value: string) => {
            if (value === 'mal') {
              open.value = false;
            }
          }}
        >
          <ActiveIndexRecorder />
          <Combobox.Input />
          <ComboboxListPart />
        </Combobox.Root>
      ));
      // The popup of the fixture list is the parent of the list. Its animation holds the close.
      const style = document.createElement('style');
      style.textContent =
        '@keyframes hold { to { opacity: 0.5; } } div:has(> #city-list) { animation: hold 100s; }';
      container.append(style);
      getInput().focus();
      await type('ma');
      await fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
      await flushMicrotasks();
      expect(activeIndices).toEqual([0, 1]);

      await type('mal');

      expect(getInput()).toHaveAttribute('aria-expanded', 'false');
      expect(getOptions()).toEqual(['Malmö', 'Malta']);
      expect(activeIndices).toEqual([0, 1]);

      for (const animation of document.getAnimations()) {
        animation.finish();
      }
    });
  });

  describe('store', () => {
    it('the store has the props bags and the modes in the first render of a part', async () => {
      let firstRender: Record<string, unknown> = {};
      const FirstRenderProbe = defineComponent(() => {
        const rootStore = useComboboxRootContext();
        firstRender = {
          role: rootStore.select('inputProps').role,
          selectionMode: rootStore.select('selectionMode'),
          name: rootStore.select('name'),
          disabled: rootStore.select('disabled'),
          inline: rootStore.select('inline'),
          itemRootId: rootStore.select('itemRoot').id,
          hasPopupListeners: Object.keys(rootStore.select('popupProps')).length > 0,
        };
        return () => null;
      });

      await render(
        <Combobox.Root id="city" name="city" multiple disabled inline items={cities}>
          <FirstRenderProbe />
        </Combobox.Root>,
      );

      expect(firstRender).toEqual({
        role: 'combobox',
        selectionMode: 'multiple',
        name: 'city',
        disabled: true,
        inline: true,
        itemRootId: 'city',
        hasPopupListeners: true,
      });
    });

    it('follows a change of each mode prop', async () => {
      const modes = shallowRef<Record<string, unknown>>({});
      const readState = () => {
        const state = toRaw(store.state);
        return {
          disabled: state.disabled,
          readOnly: state.readOnly,
          required: state.required,
          inline: state.inline,
          grid: state.grid,
          modal: state.modal,
          virtualized: state.virtualized,
          openOnInputClick: state.openOnInputClick,
          autoHighlight: state.autoHighlight,
          name: state.name,
          form: state.form,
        };
      };
      await render(() => (
        <Combobox.Root items={cities} {...modes.value}>
          <StoreProbe />
        </Combobox.Root>
      ));
      expect(readState()).toEqual({
        disabled: false,
        readOnly: false,
        required: false,
        inline: false,
        grid: false,
        modal: false,
        virtualized: false,
        openOnInputClick: true,
        autoHighlight: false,
        name: undefined,
        form: undefined,
      });

      modes.value = {
        disabled: true,
        readOnly: true,
        required: true,
        inline: true,
        grid: true,
        modal: true,
        virtualized: true,
        openOnInputClick: false,
        autoHighlight: true,
        name: 'city',
        form: 'checkout',
      };
      await flushMicrotasks();

      expect(readState()).toEqual({
        disabled: true,
        readOnly: true,
        required: true,
        inline: true,
        grid: true,
        modal: true,
        virtualized: true,
        openOnInputClick: false,
        autoHighlight: 'input-change',
        name: 'city',
        form: 'checkout',
      });
    });

    it('a part that mounts in the first render gets the real commands', async () => {
      const handleInputValueChange = vi.fn();
      let called = false;
      const EarliestCommandProbe = defineComponent(() => {
        const rootStore = useComboboxRootContext();
        return () => (
          <span
            ref={(element) => {
              if (element && !called) {
                called = true;
                rootStore.context.setInputValue('Oslo', createChangeEventDetails(REASONS.none));
              }
            }}
          />
        );
      });

      await render(
        <Combobox.Root items={cities} onInputValueChange={handleInputValueChange}>
          <EarliestCommandProbe />
        </Combobox.Root>,
      );

      expect(called).toBe(true);
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('Oslo');
    });
  });

  describe('hidden inputs', () => {
    hiddenInputTypeTests({
      render,
      createComponent: (props) => (
        <Combobox.Root {...props}>
          <ComboboxInputPart />
        </Combobox.Root>
      ),
    });

    hiddenInputSizeTests({
      render,
      createComponent: (props) => (
        <Combobox.Root {...props}>
          <ComboboxInputPart />
        </Combobox.Root>
      ),
    });

    it('submits the serialized value', async () => {
      const malta = { value: 'MT', label: 'Malta' };
      await render(
        <form data-testid="form">
          <Combobox.Root name="city" items={[malta]} defaultValue={malta}>
            <ComboboxInputPart />
          </Combobox.Root>
        </form>,
      );

      expect(getFormData('city')).toEqual(['MT']);
      expect(getInput().value).toBe('Malta');
    });

    it('submits one entry for each value of a multiple selection', async () => {
      await render(
        <form data-testid="form">
          <Combobox.Root name="city" multiple items={cities} defaultValue={['Oslo']}>
            <ComboboxInputPart />
            <ComboboxListPart />
          </Combobox.Root>
        </form>,
      );
      expect(getFormData('city')).toEqual(['Oslo']);

      await type('ma');
      await pick('Malta');

      expect(getFormData('city')).toEqual(['Oslo', 'Malta']);
      expect(getHiddenInput()).not.toHaveAttribute('name');
    });

    it('the input has the name when the root selects nothing', async () => {
      await render(
        <form data-testid="form">
          <AutocompleteRootPart name="search" items={cities}>
            <ComboboxInputPart />
          </AutocompleteRootPart>
        </form>,
      );

      await type('ma');

      expect(getFormData('search')).toEqual(['ma']);
      expect(getInput()).toHaveAttribute('name', 'search');
      expect(getHiddenInput()).not.toHaveAttribute('name');
    });

    it('is not valid when required and empty', async () => {
      const { unmount } = await render(
        <Combobox.Root name="city" required items={cities}>
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>,
      );
      expect(getHiddenInput().validity.valueMissing).toBe(true);

      await type('ma');
      await pick('Malta');

      expect(getHiddenInput().validity.valid).toBe(true);
      unmount();

      await render(
        <Combobox.Root name="city" multiple required items={cities} defaultValue={['Oslo']}>
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      expect(getHiddenInput()).not.toHaveAttribute('required');
      expect(getHiddenInput().validity.valid).toBe(true);
    });

    it('focuses the input when the hidden input gets the focus', async () => {
      await render(
        <Combobox.Root name="city" items={cities}>
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      getHiddenInput().focus();
      await flushMicrotasks();

      expect(getInput()).toHaveFocus();
    });

    it('requestSubmit submits the form of the hidden input', async () => {
      const handleSubmit = vi.fn((event: Event) => event.preventDefault());
      await render(
        <form onSubmit={handleSubmit}>
          <Combobox.Root name="city" items={cities}>
            <StoreProbe />
          </Combobox.Root>
        </form>,
      );

      store.context.requestSubmit();

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('BUG-6206: a native reset', () => {
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

    it('puts an uncontrolled single root back to its default value and its label', async () => {
      const handleValueChange = vi.fn();
      const handleInputValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Combobox.Root
            name="city"
            items={cities}
            defaultValue="Oslo"
            onValueChange={handleValueChange}
            onInputValueChange={handleInputValueChange}
          >
            <ComboboxInputPart />
            <ComboboxListPart />
          </Combobox.Root>
        </form>,
      );
      await type('ma');
      await pick('Malmö');
      expect(getFormData('city')).toEqual(['Malmö']);
      handleValueChange.mockClear();
      handleInputValueChange.mockClear();

      await reset();

      expect(getFormData('city')).toEqual(['Oslo']);
      expect(getInput().value).toBe('Oslo');
      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toBe('Oslo');
      expect(handleValueChange.mock.lastCall?.[1].reason).toBe('none');
      expect(handleValueChange.mock.lastCall?.[1].event.type).toBe('reset');
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('Oslo');
      expect(handleInputValueChange.mock.lastCall?.[1].reason).toBe('none');

      // A reset with nothing to change.
      await reset();

      expect(getFormData('city')).toEqual(['Oslo']);
      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
    });

    it('puts the values of an uncontrolled multiple root back', async () => {
      await render(
        <form data-testid="form">
          <Combobox.Root name="city" multiple items={cities} defaultValue={['Oslo']}>
            <ComboboxInputPart />
            <ComboboxListPart />
          </Combobox.Root>
        </form>,
      );
      await type('ma');
      await pick('Malta');
      expect(getFormData('city')).toEqual(['Oslo', 'Malta']);

      await reset();

      expect(getFormData('city')).toEqual(['Oslo']);
      expect(getInput().value).toBe('');
    });

    it('puts the typed text of the input back', async () => {
      const handleValueChange = vi.fn();
      const handleInputValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Combobox.Root
            items={cities}
            defaultValue="Oslo"
            onValueChange={handleValueChange}
            onInputValueChange={handleInputValueChange}
          >
            <ComboboxInputPart />
          </Combobox.Root>
        </form>,
      );
      await type('mal');
      handleInputValueChange.mockClear();

      await reset();

      expect(getInput().value).toBe('Oslo');
      expect(handleValueChange).toHaveBeenCalledTimes(0);
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[1].event.type).toBe('reset');
    });

    it('does not change a controlled root', async () => {
      const handleValueChange = vi.fn();
      const handleInputValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Combobox.Root
            name="city"
            items={cities}
            value="Oslo"
            inputValue="Oslo"
            onValueChange={handleValueChange}
            onInputValueChange={handleInputValueChange}
          >
            <ComboboxInputPart />
          </Combobox.Root>
        </form>,
      );

      await reset();

      expect(handleValueChange).toHaveBeenCalledTimes(0);
      expect(handleInputValueChange).toHaveBeenCalledTimes(0);
      expect(getFormData('city')).toEqual(['Oslo']);
    });

    it('keeps an input inside the popup empty', async () => {
      const handleInputValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Combobox.Root
            name="city"
            items={cities}
            defaultValue="Oslo"
            onInputValueChange={handleInputValueChange}
          >
            <ComboboxInputPart insidePopup />
            <ComboboxListPart />
          </Combobox.Root>
        </form>,
      );
      await type('ma');
      await pick('Malta');
      expect(getFormData('city')).toEqual(['Malta']);

      await reset();

      expect(getFormData('city')).toEqual(['Oslo']);
      expect(getInput().value).toBe('');
      expect(handleInputValueChange.mock.calls.map(([text]) => text)).not.toContain('Oslo');
    });

    it('puts the text back when the root part holds the input value itself', async () => {
      const handleInputValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <AutocompleteRootPart
            name="search"
            items={cities}
            defaultInputValue="os"
            onInputValueChange={handleInputValueChange}
          >
            <ComboboxInputPart />
          </AutocompleteRootPart>
        </form>,
      );
      await type('mal');
      expect(getFormData('search')).toEqual(['mal']);
      handleInputValueChange.mockClear();

      await reset();

      expect(getFormData('search')).toEqual(['os']);
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('os');
    });
  });

  describe('VUE-21: a native reset clears the error of the field', () => {
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

    function expectNeutralField() {
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-invalid');
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-valid');
      expect(getHiddenInput()).not.toHaveAttribute('aria-invalid');
    }

    it('VUE-21: clears the error of a required root whose value the reset does not change', async () => {
      const { container } = await render(
        <Form data-testid="form">
          <Field.Root data-testid="field" name="city">
            <Combobox.Root required items={cities}>
              <ComboboxInputPart />
            </Combobox.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      container.addEventListener('submit', (event) => event.preventDefault());
      await fireEvent.submit(screen.getByTestId('form'));
      expect(screen.getByTestId('field')).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('error')).toBeInTheDocument();

      await reset();

      expectNeutralField();
      expect(getHiddenInput().validity.valueMissing).toBe(true);
    });

    it('VUE-21: clears the error when the reset changes the value, and does not validate it', async () => {
      const validate = vi.fn((value: unknown) => (value === 'Malta' ? 'Not Malta' : null));
      await render(
        <Form data-testid="form">
          <Field.Root data-testid="field" name="city" validate={validate} validationMode="onChange">
            <Combobox.Root items={cities} defaultValue="Oslo">
              <ComboboxInputPart />
              <ComboboxListPart />
            </Combobox.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      await type('ma');
      await pick('Malta');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
      expect(screen.getByTestId('error')).toHaveTextContent('Not Malta');
      expect(validate).toHaveBeenCalledTimes(1);

      await reset();

      expect(validate).toHaveBeenCalledTimes(1);
      expectNeutralField();

      await type('ma');
      await pick('Malta');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('error')).toHaveTextContent('Not Malta');
    });

    it('VUE-21: starts no validation for the change of a reset when the root part holds the input value', async () => {
      const validate = vi.fn((value: unknown) => (value === 'Malta' ? 'Not Malta' : null));
      await render(
        <Form data-testid="form">
          <Field.Root
            data-testid="field"
            name="search"
            validate={validate}
            validationMode="onChange"
          >
            <AutocompleteRootPart items={cities} defaultInputValue="ma">
              <ComboboxInputPart />
            </AutocompleteRootPart>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      await type('Malta');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
      expect(screen.getByTestId('error')).toHaveTextContent('Not Malta');
      expect(validate).toHaveBeenCalledTimes(1);

      await reset();

      expect(getInput().value).toBe('ma');
      expect(validate).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-invalid');
    });
  });

  describe('autofill', () => {
    async function autofill(value: string, types: readonly string[] = ['input']) {
      const input = getHiddenInput();
      input.value = value;
      for (const eventType of types) {
        input.dispatchEvent(new Event(eventType, { bubbles: true }));
      }
      await flushMicrotasks();
    }

    it('selects the item whose serialized value the browser wrote', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Combobox.Root name="city" items={cities} onValueChange={handleValueChange}>
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      await autofill('malta');

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toBe('Malta');
      expect(handleValueChange.mock.lastCall?.[1].reason).toBe('none');
      expect(handleValueChange.mock.lastCall?.[1].event.type).toBe('input');
      expect(getHiddenInput().value).toBe('Malta');
      expect(getInput().value).toBe('Malta');
    });

    it('selects by the label', async () => {
      const items = [
        { value: 'MT', label: 'Malta' },
        { value: 'NO', label: 'Oslo' },
      ];
      await render(
        <Combobox.Root name="city" items={items}>
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      await autofill('Oslo');

      expect(getHiddenInput().value).toBe('NO');
      expect(getInput().value).toBe('Oslo');
    });

    it('handles an input and a change event of one task one time', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Combobox.Root name="city" items={cities} onValueChange={handleValueChange}>
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      await autofill('Malta', ['input', 'change']);

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(getHiddenInput().value).toBe('Malta');
    });

    it('ignores autofill when read-only', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Combobox.Root
          name="city"
          readOnly
          items={cities}
          defaultValue="Oslo"
          onValueChange={handleValueChange}
        >
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      await autofill('Malta');

      expect(handleValueChange).toHaveBeenCalledTimes(0);
      expect(getHiddenInput().value).toBe('Oslo');
    });

    it('writes the text of the input in mode none', async () => {
      const handleInputValueChange = vi.fn();
      await render(
        <AutocompleteRootPart items={cities} onInputValueChange={handleInputValueChange}>
          <ComboboxInputPart />
        </AutocompleteRootPart>,
      );

      await autofill('Oslo');

      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(getInput().value).toBe('Oslo');
    });
  });

  describe('Field', () => {
    const TriggerProbe = defineComponent(() => {
      const rootStore = useComboboxRootContext();
      return () => (
        <button
          type="button"
          data-testid="trigger"
          ref={(element) => {
            if (toRaw(rootStore.state).triggerElement !== element) {
              rootStore.set('triggerElement', element as HTMLElement | null);
            }
          }}
        />
      );
    });

    async function submitInvalidForm(content: () => unknown) {
      const result = await render(() => (
        <Form>
          <Field.Root name="city">{content()}</Field.Root>
        </Form>
      ));
      result.container.addEventListener('submit', (event) => event.preventDefault());
      await fireEvent.submit(result.container.querySelector('form')!);
      await flushMicrotasks();
      return result;
    }

    it('registers the input or the trigger as the control', async () => {
      const { unmount } = await submitInvalidForm(() => (
        <Combobox.Root required items={cities}>
          <ComboboxInputPart />
        </Combobox.Root>
      ));

      expect(getInput()).toHaveFocus();
      unmount();

      await submitInvalidForm(() => (
        <Combobox.Root required items={cities}>
          <TriggerProbe />
          <ComboboxInputPart insidePopup />
        </Combobox.Root>
      ));

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('sets filled, dirty and touched', async () => {
      const { user } = await render(
        <Field.Root data-testid="field">
          <Combobox.Root items={cities}>
            <ComboboxInputPart insidePopup />
            <ComboboxListPart />
          </Combobox.Root>
        </Field.Root>,
      );
      const field = screen.getByTestId('field');
      expect(field).not.toHaveAttribute('data-filled');
      expect(field).not.toHaveAttribute('data-dirty');

      await type('ma');
      await pick('Malta');

      expect(field).toHaveAttribute('data-filled', '');
      expect(field).toHaveAttribute('data-dirty', '');
      expect(field).not.toHaveAttribute('data-touched');

      await type('os');
      await user.click(document.body);
      await flushMicrotasks();

      expect(getInput()).toHaveAttribute('aria-expanded', 'false');
      expect(field).toHaveAttribute('data-touched', '');
    });

    it('validates on a change', async () => {
      await render(
        <Field.Root
          validate={(value) => (value === 'Malta' ? 'Not Malta' : null)}
          validationMode="onChange"
        >
          <Combobox.Root items={cities}>
            <ComboboxInputPart />
            <ComboboxListPart />
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      await type('ma');
      await pick('Malta');

      await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Not Malta'));
    });

    it('commits on a close by an outside press when the input is in the popup', async () => {
      const { user } = await render(
        <Field.Root
          validate={(value) => (value == null ? 'Pick a city' : null)}
          validationMode="onBlur"
        >
          <Combobox.Root items={cities}>
            <ComboboxInputPart insidePopup />
            <ComboboxListPart />
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      await type('ma');
      await user.click(document.body);

      await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Pick a city'));
    });
  });

  describe('KeepAlive', () => {
    function renderInKeepAlive(value: { value: string }) {
      const shown = shallowRef(true);
      const handleInputValueChange = vi.fn();
      const handleOpenChange = vi.fn();
      const view = render(() => (
        <KeepAlive>
          {shown.value ? (
            <Combobox.Root
              key="root"
              name="city"
              items={cities}
              value={value.value}
              onInputValueChange={handleInputValueChange}
              onOpenChange={handleOpenChange}
            >
              <ComboboxInputPart />
              <ComboboxListPart />
            </Combobox.Root>
          ) : null}
        </KeepAlive>
      ));
      return { view, shown, handleInputValueChange, handleOpenChange };
    }

    it('keeps the value, the input value and the open state', async () => {
      const { view, shown, handleOpenChange } = renderInKeepAlive(shallowRef('Oslo'));
      const { user } = await view;
      await type('ma');
      handleOpenChange.mockClear();

      shown.value = false;
      await flushMicrotasks();
      await user.click(document.body);
      shown.value = true;
      await flushMicrotasks();

      expect(handleOpenChange).toHaveBeenCalledTimes(0);
      expect(getInput().value).toBe('ma');
      expect(getInput()).toHaveAttribute('aria-expanded', 'true');
      expect(getOptions()).toEqual(['Malmö', 'Malta']);
      expect(getHiddenInput().value).toBe('Oslo');
    });

    it('removes the pageshow listener while deactivated', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      onTestFinished(() => {
        addSpy.mockRestore();
        removeSpy.mockRestore();
      });
      const count = (spy: typeof addSpy | typeof removeSpy) =>
        spy.mock.calls.filter(([eventType]) => eventType === 'pageshow').length;
      const { view, shown } = renderInKeepAlive(shallowRef('Oslo'));
      await view;
      expect([count(addSpy), count(removeSpy)]).toEqual([1, 0]);

      shown.value = false;
      await flushMicrotasks();

      expect([count(addSpy), count(removeSpy)]).toEqual([1, 1]);

      shown.value = true;
      await flushMicrotasks();

      expect([count(addSpy), count(removeSpy)]).toEqual([2, 1]);
    });

    it('reports a change of the value after the activation', async () => {
      const value = shallowRef('Oslo');
      const { view, shown, handleInputValueChange } = renderInKeepAlive(value);
      await view;

      shown.value = false;
      await flushMicrotasks();
      value.value = 'Malta';
      await flushMicrotasks();

      expect(handleInputValueChange).toHaveBeenCalledTimes(0);

      shown.value = true;
      await flushMicrotasks();

      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('Malta');
      expect(getInput().value).toBe('Malta');
      expect(getHiddenInput().value).toBe('Malta');
    });

    it('keeps the highlight and gives no itemHighlighted while deactivated', async () => {
      const shown = shallowRef(true);
      const handleItemHighlighted = vi.fn();
      await render(() => (
        <KeepAlive>
          {shown.value ? (
            <Combobox.Root
              key="root"
              items={cities}
              autoHighlight
              onItemHighlighted={handleItemHighlighted}
            >
              <Combobox.Input />
              <ComboboxListPart />
            </Combobox.Root>
          ) : null}
        </KeepAlive>
      ));
      getInput().focus();
      await type('ma');
      await fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
      await flushMicrotasks();
      const activeId = screen.getByRole('option', { name: 'Malta' }).id;
      expect(getInput()).toHaveAttribute('aria-activedescendant', activeId);
      handleItemHighlighted.mockClear();

      shown.value = false;
      await flushMicrotasks();
      shown.value = true;
      await flushMicrotasks();

      expect(handleItemHighlighted).toHaveBeenCalledTimes(0);
      expect(getInput()).toHaveAttribute('aria-expanded', 'true');
      expect(getInput()).toHaveAttribute('aria-activedescendant', activeId);
    });
  });

  describe('server render', () => {
    function getNamedInputs(container: HTMLElement) {
      return [...container.querySelectorAll<HTMLInputElement>('input[name]')].map(
        (input) => `${input.type}:${input.name}=${input.value}`,
      );
    }

    it('hydrates a single root with a name and a value', async () => {
      const props = { name: 'city', defaultValue: 'Oslo' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);

      const { container } = await hydrate(ComboboxRootHydration, { serverHtml, props });

      expect(container.querySelector<HTMLInputElement>('[role="combobox"]')!.value).toBe('Oslo');
      expect(getNamedInputs(container)).toEqual(['text:city=Oslo']);
    });

    it('hydrates a multiple root', async () => {
      const props = { name: 'city', multiple: true, defaultValue: ['Oslo', 'Malta'] };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);

      const { container } = await hydrate(ComboboxRootHydration, { serverHtml, props });

      expect(container.querySelector<HTMLInputElement>('[role="combobox"]')!.value).toBe('');
      expect(getNamedInputs(container)).toEqual(['hidden:city=Oslo', 'hidden:city=Malta']);
    });

    it('hydrates a root with no name', async () => {
      const serverHtml = await renderOnServer(HYDRATION_FILE, {});

      const { container } = await hydrate(ComboboxRootHydration, { serverHtml, props: {} });

      expect(getNamedInputs(container)).toEqual([]);
      expect(container.querySelector('input[aria-hidden]')).toHaveAttribute('type', 'hidden');
    });
  });

  describe('coverage edge cases', () => {
    it('safely handles hidden-control focus without a visible control', async () => {
      await render(<Combobox.Root />);
      const hiddenInput = getHiddenInput();

      await fireEvent.focusIn(hiddenInput);

      expect(document.body).toHaveFocus();
    });
  });
});
