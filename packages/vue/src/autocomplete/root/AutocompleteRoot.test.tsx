import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, nextTick, shallowRef } from 'vue';
import type { PropType, ShallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { Input } from '@vase-ui/vue/input';
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
import type { VaseUIRenderResult } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import * as AutocompleteSeparatorDataAttributes from '../../separator/SeparatorDataAttributes';
import * as Autocomplete from '../index.parts';
import AutocompleteRootHydration from './AutocompleteRootHydration.test.vue';

const HYDRATION_FILE = 'src/autocomplete/root/AutocompleteRootHydration.test.vue';
const cities = ['Malmö', 'Malta', 'Oslo'];

type ItemSlotProps = { item: string };

// The slot `item` renders each filtered item, in the place of the function child of Base UI.
const itemSlot = {
  item: ({ item }: ItemSlotProps) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>,
};

// WebKit ignores a `pointermove` and a `mousemove` with no movement, and `user.hover` gives none.
async function hover(user: VaseUIRenderResult['user'], element: Element) {
  await user.hover(element);
  await fireEvent.pointerMove(element, { pointerType: 'mouse', movementX: 1 });
  await fireEvent.mouseMove(element, { movementX: 1 });
}

function popup(slots: { item: (props: { item: any }) => unknown } = itemSlot) {
  return (
    <Autocomplete.Portal>
      <Autocomplete.Positioner>
        <Autocomplete.Popup>
          <Autocomplete.List v-slots={slots} />
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  );
}

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

async function writeOutside(target: { value: unknown }, next: unknown) {
  target.value = next;
  await nextTick();
  await flushMicrotasks();
}

describe('<Autocomplete.Root />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
  });

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

  it('exposes the orientation attribute rendered by Separator', async () => {
    await render(<Autocomplete.Separator orientation="vertical" />);

    const separator = screen.getByRole('presentation');
    expect(separator).toHaveAttribute(AutocompleteSeparatorDataAttributes.orientation, 'vertical');
  });

  describe('manual unmount lifecycle', () => {
    type OpenChangeListener = (
      open: boolean,
      details: Autocomplete.Root.OpenChangeEventDetails,
    ) => void;

    const Popup = defineComponent({
      props: {
        open: { type: Boolean, default: undefined },
        defaultOpen: { type: Boolean, default: undefined },
        onOpenChange: Function as PropType<OpenChangeListener>,
        onOpenChangeComplete: Function as PropType<(open: boolean) => void>,
        actionsRef: Object as PropType<ShallowRef<Autocomplete.Root.Actions | null>>,
      },
      setup(props) {
        const open = shallowRef(props.defaultOpen ?? false);
        return () => (
          <Autocomplete.Root
            ref={props.actionsRef}
            openOnInputClick
            open={props.open ?? open.value}
            onOpenChange={(nextOpen, details) => {
              props.onOpenChange?.(nextOpen, details);
              if (!details.isCanceled) {
                open.value = nextOpen;
              }
            }}
            onOpenChangeComplete={props.onOpenChangeComplete}
          >
            <Autocomplete.Input />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="apple">Apple</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        );
      },
    });

    function createActionsRef() {
      return shallowRef<Autocomplete.Root.Actions | null>(null);
    }

    function getCompletions(onOpenChangeComplete: (open: boolean) => void) {
      return vi.mocked(onOpenChangeComplete).mock.calls.filter(([open]) => !open);
    }

    it('automatically unmounts with an actions ref and completes closing once', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();
      const { user } = await render(
        <Popup actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />,
      );

      expect(onOpenChangeComplete).not.toHaveBeenCalled();
      await user.click(screen.getByRole('combobox'));
      await screen.findByRole('listbox');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(getCompletions(onOpenChangeComplete)).toHaveLength(1);

      // Calling the action after the automatic unmount must not repeat the completion.
      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(getCompletions(onOpenChangeComplete)).toHaveLength(1);
    });

    it('keeps the popup mounted until the unmount action completes closing', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();
      const { user, setProps } = await render(
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(getCompletions(onOpenChangeComplete)).toHaveLength(1);

      await setProps({ open: true });
      await screen.findByRole('listbox');
      await setProps({ open: false });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(getCompletions(onOpenChangeComplete)).toHaveLength(2);
    });

    it('clears the opt-out when a controlled reopen interrupts a pending unmount', async () => {
      const onOpenChangeComplete = vi.fn();
      const { user, setProps } = await render(
        <Popup
          defaultOpen
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      await setProps({ open: true });
      await setProps({ open: false });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(getCompletions(onOpenChangeComplete)).toHaveLength(1);
    });

    it('ignores an opt-out on a canceled close', async () => {
      let cancel = true;
      const { user } = await render(
        <Popup
          defaultOpen
          onOpenChange={(open, details) => {
            if (!open && cancel) {
              details.preventUnmountOnClose();
              details.cancel();
            }
          }}
        />,
      );

      await user.click(screen.getByRole('option'));
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByRole('listbox')).not.toBe(null);
      cancel = false;
      await user.click(screen.getByRole('option'));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
    });

    it('keeps the opt-out when a controlled close is applied in a transition', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();
      const App = defineComponent(() => {
        const open = shallowRef(true);
        return () => (
          <Popup
            open={open.value}
            actionsRef={actionsRef}
            onOpenChangeComplete={onOpenChangeComplete}
            onOpenChange={(nextOpen, details) => {
              if (!nextOpen) {
                details.preventUnmountOnClose();
              }
              // A transition of React applies the write after the event. Vue has no transition
              // of state, so the write comes in the next tick.
              void nextTick(() => {
                open.value = nextOpen;
              });
            }}
          />
        );
      });

      const { user } = await render(<App />);
      await user.click(screen.getByRole('option'));
      await waitFor(() =>
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false'),
      );
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(getCompletions(onOpenChangeComplete)).toHaveLength(1);
    });

    it('closes through the `close` action so `onOpenChange` can opt out', async () => {
      const actionsRef = createActionsRef();
      const reasons: string[] = [];
      await render(
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChange={(open, details) => {
            reasons.push(details.reason);
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );

      actionsRef.value!.close();
      await flushMicrotasks();
      expect(reasons).toEqual([REASONS.imperativeAction]);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('ignores `unmount` while the popup is open', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();
      await render(
        <Popup defaultOpen actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />,
      );
      const popup = screen.getByRole('listbox');

      actionsRef.value!.unmount();
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).toBe(popup);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    });

    it('unmounts when `close` and `unmount` are called in one batch', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();
      await render(
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );

      actionsRef.value!.close();
      actionsRef.value!.unmount();
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(getCompletions(onOpenChangeComplete)).toHaveLength(1);
    });

    it('still unmounts on a later close after `unmount` was called while open', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();
      const { user } = await render(
        <Popup defaultOpen actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />,
      );

      // A stale exit-animation callback can call `unmount()` after a quick reopen.
      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).not.toBe(null);

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });

    it('still unmounts on a later close after `unmount` and a reopen in one batch', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();
      let reopenOnComplete = true;
      let optOut = true;
      const App = defineComponent(() => {
        const open = shallowRef(true);
        return () => (
          <Popup
            open={open.value}
            actionsRef={actionsRef}
            onOpenChange={(nextOpen, details) => {
              if (!nextOpen && optOut) {
                details.preventUnmountOnClose();
              }
              open.value = nextOpen;
            }}
            onOpenChangeComplete={(nextOpen) => {
              onOpenChangeComplete(nextOpen);
              // An exit-animation callback that reopens right after it unmounts.
              if (!nextOpen && reopenOnComplete) {
                reopenOnComplete = false;
                open.value = true;
              }
            }}
          />
        );
      });

      const { user } = await render(<App />);
      actionsRef.value!.close();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(getCompletions(onOpenChangeComplete)).toHaveLength(1);

      optOut = false;
      await user.click(screen.getByRole('option'));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(getCompletions(onOpenChangeComplete)).toHaveLength(2);
    });

    it('does not call `onOpenChange` when the `close` action is called while closed', async () => {
      const actionsRef = createActionsRef();
      const onOpenChange = vi.fn();
      await render(<Popup actionsRef={actionsRef} onOpenChange={onOpenChange} />);

      actionsRef.value!.close();
      await flushMicrotasks();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    });

    it('completes closing once when `unmount` is called twice in one batch', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();
      const { user } = await render(
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actionsRef.value!.unmount();
      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(getCompletions(onOpenChangeComplete)).toHaveLength(1);
    });
  });

  describe('keyboard interactions', () => {
    it('closes popup on Tab after selecting with Enter and typing again', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['alpha', 'alpine', 'beta']} autoHighlight>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
          <button />
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);
      await user.type(input, 'al');

      const firstOption = await screen.findByRole('option', { name: 'alpha' });
      expect(firstOption).toHaveAttribute('data-highlighted');

      await user.keyboard('{Enter}');
      expect(input.value).toBe('alpha');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.clear(input);
      await user.type(input, 'a');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      await user.tab();

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('fills the input with the highlighted item on Space while the input is empty', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Autocomplete.Root items={['alpha', 'beta']} onValueChange={onValueChange}>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await user.keyboard('{ArrowDown}');
      const alpha = await screen.findByRole('option', { name: 'alpha' });
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(alpha).toHaveAttribute('data-highlighted');
      });
      expect(input.value).toBe('');

      await user.keyboard(' ');

      expect(input.value).toBe('alpha');
      expect(onValueChange.mock.lastCall?.[0]).toBe('alpha');
    });
  });

  describe('input inside popup composition', () => {
    it('commits a keyboard selection, restores trigger focus, and preserves it on reopen', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['alpha', 'alpine', 'beta']} autoHighlight>
          <Autocomplete.Trigger data-testid="trigger">
            <Autocomplete.Value />
          </Autocomplete.Trigger>
          <Autocomplete.Portal keepMounted>
            <Autocomplete.Positioner>
              <Autocomplete.Popup aria-label="Commands">
                <Autocomplete.Input data-testid="input" />
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());
      await user.type(input, 'al');

      const alpha = screen.getByRole('option', { name: 'alpha' });
      await waitFor(() => expect(alpha).toHaveAttribute('data-highlighted'));
      await user.keyboard('{Enter}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveTextContent('alpha');

      await user.click(trigger);

      expect(await screen.findByTestId('input')).toHaveValue('alpha');
      expect(await screen.findByRole('option', { name: 'alpha' })).not.toBe(null);

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
    });

    it('preserves the typed value when the popup is dismissed with Escape', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Autocomplete.Root items={['alpha', 'alpine', 'beta']} onValueChange={onValueChange}>
          <Autocomplete.Trigger data-testid="trigger">
            <Autocomplete.Value />
          </Autocomplete.Trigger>
          <Autocomplete.Portal keepMounted>
            <Autocomplete.Positioner>
              <Autocomplete.Popup aria-label="Commands">
                <Autocomplete.Input data-testid="input" />
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);
      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());
      await user.type(input, 'al');
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveTextContent('al');
      expect(onValueChange.mock.lastCall?.[0]).toBe('al');

      await user.click(trigger);

      expect(await screen.findByTestId('input')).toHaveValue('al');
      expect(await screen.findByRole('option', { name: 'alpha' })).not.toBe(null);
      expect(await screen.findByRole('option', { name: 'alpine' })).not.toBe(null);
      await waitFor(() => expect(screen.queryByRole('option', { name: 'beta' })).toBe(null));

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
    });
  });

  it('should handle browser autofill', async () => {
    await render(
      <Field.Root name="auto">
        <Autocomplete.Root defaultValue="">
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                  <Autocomplete.Item value="beta">beta</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      </Field.Root>,
    );

    // Hidden inputs are rendered without a name for selectionMode='none', but Field provides the form input.
    // Simulate browser autofill by changing the hidden field control input for this Field.
    const hidden = screen.getByRole('textbox', {
      hidden: true,
    });
    await fireEvent.input(hidden!, { target: { value: 'beta' } });
    await flushMicrotasks();

    const input = screen.getByTestId<HTMLInputElement>('input');
    expect(input.value).toBe('beta');
  });

  it('ignores hidden-input autofill when readOnly', async () => {
    const onValueChange = vi.fn();
    await render(
      <Field.Root name="auto">
        <Autocomplete.Root defaultValue="" readOnly onValueChange={onValueChange}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                  <Autocomplete.Item value="beta">beta</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      </Field.Root>,
    );

    const hidden = screen.getByRole<HTMLInputElement>('textbox', { hidden: true });
    await fireEvent.input(hidden, { target: { value: 'beta' } });
    await flushMicrotasks();

    const input = screen.getByTestId<HTMLInputElement>('input');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('opens the list with the arrow keys but does not commit on item press when readOnly', async () => {
    const onValueChange = vi.fn();
    const { user } = await render(
      <Autocomplete.Root defaultValue="" readOnly onValueChange={onValueChange}>
        <Autocomplete.Input data-testid="input" />
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.List>
                <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                <Autocomplete.Item value="beta">beta</Autocomplete.Item>
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>,
    );

    const input = screen.getByTestId<HTMLInputElement>('input');
    await user.click(input);
    await user.keyboard('{ArrowDown}');

    expect(await screen.findByRole('listbox')).toHaveAttribute('aria-readonly', 'true');

    await user.click(await screen.findByRole('option', { name: 'beta' }));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('does not fill the input with the highlighted item when readOnly', async () => {
    const { user } = await render(
      <Autocomplete.Root defaultValue="" readOnly mode="both">
        <Autocomplete.Input data-testid="input" />
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.List>
                <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                <Autocomplete.Item value="beta">beta</Autocomplete.Item>
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>,
    );

    const input = screen.getByTestId<HTMLInputElement>('input');
    // Focused without a pointer event so the highlight is reported as keyboard-driven.
    input.focus();
    await flushMicrotasks();

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'alpha' })).toHaveAttribute('data-highlighted');
    });
    expect(input).toHaveValue('');
  });

  it('drops a pending inline completion when readOnly is turned on', async () => {
    const { user, setProps } = await render(
      <Autocomplete.Root defaultValue="" mode="both">
        <Autocomplete.Input data-testid="input" />
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.List>
                <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                <Autocomplete.Item value="beta">beta</Autocomplete.Item>
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>,
    );

    const input = screen.getByTestId<HTMLInputElement>('input');
    await user.click(input);
    await user.keyboard('a');
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveValue('alpha');

    await setProps({ readOnly: true });
    expect(input).toHaveValue('a');

    // The suppressed completion must not come back when editing is restored.
    await setProps({ readOnly: false });
    expect(input).toHaveValue('a');
  });

  it('exposes aria-autocomplete="none" when readOnly', async () => {
    await render(
      <Autocomplete.Root defaultValue="" readOnly mode="both">
        <Autocomplete.Input data-testid="input" />
      </Autocomplete.Root>,
    );

    expect(screen.getByTestId('input')).toHaveAttribute('aria-autocomplete', 'none');
  });

  it('ignores hidden-input autofill when disabled', async () => {
    const onValueChange = vi.fn();
    await render(
      <Field.Root name="auto">
        <Autocomplete.Root defaultValue="" disabled onValueChange={onValueChange}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                  <Autocomplete.Item value="beta">beta</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      </Field.Root>,
    );

    const hidden = screen.getByRole<HTMLInputElement>('textbox', { hidden: true });
    await fireEvent.input(hidden, { target: { value: 'beta' } });
    await flushMicrotasks();

    const input = screen.getByTestId<HTMLInputElement>('input');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('should pass autoComplete to the visible input', async () => {
    await render(
      <Autocomplete.Root name="search">
        <Autocomplete.Input autocomplete="on" />
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.List>
                <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                <Autocomplete.Item value="beta">beta</Autocomplete.Item>
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen.getByRole('textbox', { hidden: true });

    expect(input).toHaveAttribute('name', 'search');
    expect(input).toHaveAttribute('autocomplete', 'on');
    expect(hiddenInput).not.toHaveAttribute('name');
    expect(hiddenInput).toHaveAttribute('id');
    expect(hiddenInput).not.toHaveAttribute('autocomplete');
  });

  it('does not expose data-placeholder on Trigger or InputGroup', async () => {
    const { user } = await render(
      <Autocomplete.Root items={['alpha', 'beta']} openOnInputClick>
        <Autocomplete.InputGroup data-testid="group">
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Trigger data-testid="trigger" />
        </Autocomplete.InputGroup>
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.List v-slots={itemSlot} />
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>,
    );

    const group = screen.getByTestId('group');
    const input = screen.getByTestId('input');
    const trigger = screen.getByTestId('trigger');

    expect(group).not.toHaveAttribute('data-placeholder');
    expect(trigger).not.toHaveAttribute('data-placeholder');

    await user.type(input, 'al');

    expect(group).not.toHaveAttribute('data-placeholder');
    expect(trigger).not.toHaveAttribute('data-placeholder');
  });

  describe('prop: onItemHighlighted', () => {
    it('passes native mouse and pointer events for pointer highlights', async () => {
      const onItemHighlighted = vi.fn();
      await render(
        <Autocomplete.Root open onItemHighlighted={onItemHighlighted}>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="apple">Apple</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const option = screen.getByRole('option', { name: 'Apple' });
      const hoverEvent = new MouseEvent('mousemove', { bubbles: true, movementX: 1 });
      await fireEvent(option, hoverEvent);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(
          'apple',
          expect.objectContaining({ reason: 'pointer', event: hoverEvent }),
        );
      });
      expect(onItemHighlighted.mock.lastCall?.[1].event).toBe(hoverEvent);

      const leaveEvent = new PointerEvent('pointerleave', { pointerType: 'mouse' });
      await fireEvent(option, leaveEvent);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(
          undefined,
          expect.objectContaining({ reason: 'pointer', event: leaveEvent }),
        );
      });
      expect(onItemHighlighted.mock.lastCall?.[1].event).toBe(leaveEvent);
    });
  });

  describe('prop: autoHighlight', () => {
    it('calls onItemHighlighted when the popup auto highlights on open', async () => {
      const onItemHighlighted = vi.fn();

      const { user } = await render(
        <Autocomplete.Root
          items={['alpha', 'alpine', 'beta']}
          autoHighlight
          onItemHighlighted={onItemHighlighted}
        >
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.type(input, 'a');

      const firstOption = await screen.findByRole('option', { name: 'alpha' });
      expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);

      const [value, eventDetails] = onItemHighlighted.mock.lastCall ?? [];
      expect(value).toBe('alpha');
      expect(eventDetails.reason).toBe('none');

      await waitFor(() => {
        expect(firstOption).toHaveAttribute('data-highlighted');
      });
    });

    it('highlights the first item when typing and keeps it during filtering', async () => {
      const { user } = await render(
        <Autocomplete.Root autoHighlight>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="new york">new york</Autocomplete.Item>
                  <Autocomplete.Item value="new york city">new york city</Autocomplete.Item>
                  <Autocomplete.Item value="newcastle">newcastle</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'new');

      const newYorkOption = screen.getByRole('option', { name: 'new york' });
      expect(newYorkOption).toHaveAttribute('data-highlighted');
      expect(input.getAttribute('aria-activedescendant')).toBe(newYorkOption.id);

      // Trailing space should not clear highlight if matches remain
      await user.type(input, ' ');

      expect(newYorkOption).toHaveAttribute('data-highlighted');
      expect(input.getAttribute('aria-activedescendant')).toBe(newYorkOption.id);
    });

    it('does not highlight on open via click or when pressing arrow keys initially', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['apple', 'banana']} autoHighlight openOnInputClick>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await fireEvent.click(input);

      await flushMicrotasks();
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{Escape}');
      await user.click(input);

      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant');
      });
    });

    it('highlights the first item when opening via ArrowDown', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['alpha', 'beta', 'gamma']} autoHighlight>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);
      await user.keyboard('{ArrowDown}');

      const firstOption = await screen.findByRole('option', { name: 'alpha' });
      expect(firstOption).toHaveAttribute('data-highlighted');
      expect(input.getAttribute('aria-activedescendant')).toBe(firstOption.id);
    });

    it('links aria-activedescendant to the highlighted item after filtering', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['feature', 'fix']} autoHighlight>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Type 'f' — both items remain, first should be highlighted
      await user.type(input, 'f');
      const firstOption = screen.getByRole('option', { name: 'feature' });
      expect(firstOption).toHaveAttribute('data-highlighted');
      expect(input.getAttribute('aria-activedescendant')).toBe(firstOption.id);

      // Type 'i' — filters to "fix" and highlight should follow, with ids stable
      await user.type(input, 'i');
      const fixOption = screen.getByRole('option', { name: 'fix' });
      expect(fixOption).toHaveAttribute('data-highlighted');
      expect(input.getAttribute('aria-activedescendant')).toBe(fixOption.id);
    });

    it('does not highlight first/last item when pressing ArrowDown/ArrowUp initially', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['alpha', 'beta', 'gamma']}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');

      await user.click(input);
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant');
      });
    });

    it('retains highlight when clearing the query with autoHighlight enabled', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['apple', 'banana', 'cherry']} autoHighlight openOnInputClick>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);
      await user.type(input, 'ban');

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(input).toHaveAttribute('aria-activedescendant');

      const highlightedBefore = input.getAttribute('aria-activedescendant');
      expect(highlightedBefore).not.toBe(null);

      await user.clear(input);

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(input.getAttribute('aria-activedescendant')).toBe(highlightedBefore);
    });

    it('highlights the first item immediately when behavior is "always"', async () => {
      await render(
        <Autocomplete.Root items={['alpha', 'beta', 'gamma']} autoHighlight="always" defaultOpen>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      const firstOption = screen.getByRole('option', { name: 'alpha' });

      expect(input).toHaveAttribute('aria-activedescendant', firstOption.id);
      expect(firstOption).toHaveAttribute('data-highlighted');
    });

    it('keeps the latest pointer highlight on outside blur when behavior is "always"', async () => {
      const { user } = await render(
        <>
          <Autocomplete.Root
            items={['apple', 'banana', 'cherry']}
            autoHighlight="always"
            keepHighlight
            open
            inline
          >
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.List v-slots={itemSlot} />
          </Autocomplete.Root>
          <button data-testid="outside">outside</button>
        </>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');
      const banana = screen.getByRole('option', { name: 'banana' });

      input.focus();
      await flushMicrotasks();

      await hover(user, banana);

      await waitFor(() => {
        expect(banana).toHaveAttribute('data-highlighted');
      });
      expect(input).toHaveAttribute('aria-activedescendant', banana.id);

      const outside = screen.getByTestId('outside');
      await fireEvent.pointerDown(outside);
      await fireEvent.focusOut(input, { relatedTarget: outside });
      await fireEvent.focusIn(outside);
      await flushMicrotasks();

      expect(banana).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', banana.id);

      expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute('data-highlighted');
    });

    describe('asynchronous items', () => {
      const AsyncAutocomplete = defineComponent({
        props: {
          items: { type: Array as PropType<string[]>, default: () => [] },
          keepMounted: { type: Boolean, default: false },
          open: { type: Boolean, default: undefined },
        },
        setup(props) {
          return () => (
            <Autocomplete.Root items={props.items} autoHighlight filter={null} open={props.open}>
              <Autocomplete.Input />
              <Autocomplete.Trigger data-testid="trigger" />
              <Autocomplete.Clear data-testid="clear" />
              <Autocomplete.Portal keepMounted={props.keepMounted}>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          );
        },
      });

      it('highlights a candidate arriving after typing', async () => {
        const { user, setProps } = await render(<AsyncAutocomplete />);
        const input = screen.getByRole('combobox');
        await user.type(input, '32');
        await setProps({ items: ['32', '320'] });

        const option = screen.getByRole('option', { name: '32' });
        expect(option).toHaveAttribute('data-highlighted');
        expect(input).toHaveAttribute('aria-activedescendant', option.id);

        await user.keyboard('{Enter}');
        expect(input).toHaveValue('32');
      });

      it('highlights asynchronous results while an inline input stays focused', async () => {
        const Test = defineComponent({
          props: { items: { type: Array as PropType<string[]>, default: () => [] } },
          setup(props) {
            return () => (
              <Autocomplete.Root inline defaultOpen autoHighlight items={props.items}>
                <Autocomplete.Input />
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Root>
            );
          },
        });

        const { user, setProps } = await render(<Test />);
        const input = screen.getByRole('combobox');
        await user.type(input, '32');
        await setProps({ items: ['32'] });

        const option = screen.getByRole('option');
        expect(option).toHaveAttribute('data-highlighted');
        expect(input).toHaveAttribute('aria-activedescendant', option.id);
      });

      it.each([true, 'always'] as const)(
        'handles asynchronous results after an inline input blurs with autoHighlight=%s',
        async (autoHighlight) => {
          const Test = defineComponent({
            props: { items: { type: Array as PropType<string[]>, default: () => [] } },
            setup(props) {
              return () => (
                <>
                  <Autocomplete.Root
                    inline
                    defaultOpen
                    autoHighlight={autoHighlight}
                    items={props.items}
                  >
                    <Autocomplete.Input />
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Root>
                  <button type="button">Blur target</button>
                </>
              );
            },
          });

          const { user, setProps } = await render(<Test />);
          const input = screen.getByRole('combobox');
          await user.type(input, '32');
          await user.click(screen.getByRole('button', { name: 'Blur target' }));
          await setProps({ items: ['32'] });

          const option = screen.getByRole('option');
          expect(option.hasAttribute('data-highlighted')).toBe(autoHighlight === 'always');
          expect(input.getAttribute('aria-activedescendant')).toBe(
            autoHighlight === 'always' ? option.id : null,
          );
        },
      );

      it('discards the request when the clear button clears the query', async () => {
        const { user, setProps } = await render(<AsyncAutocomplete />);
        const input = screen.getByRole('combobox');
        await user.type(input, '32');
        await user.click(screen.getByTestId('clear'));
        await setProps({ items: ['32'] });

        expect(input).toHaveValue('');
        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      it.each([false, true])(
        'discards the request when closing with keepMounted=%s',
        async (keepMounted) => {
          const { user, setProps } = await render(<AsyncAutocomplete keepMounted={keepMounted} />);
          const input = screen.getByRole('combobox');
          await user.type(input, '32');
          await user.keyboard('{Escape}');
          await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'false'));
          await user.click(screen.getByTestId('trigger'));
          await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
          await setProps({ items: ['32'] });

          expect(input).toHaveValue('32');
          expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
          expect(input).not.toHaveAttribute('aria-activedescendant');
        },
      );

      it('discards the request when a controlled popup closes', async () => {
        const { user, setProps } = await render(<AsyncAutocomplete open />);
        const input = screen.getByRole('combobox');
        await user.type(input, '32');
        await setProps({ open: false });
        await setProps({ open: true });
        await setProps({ open: true, items: ['32'] });

        expect(input).toHaveValue('32');
        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });
    });
  });

  describe('prop: keepHighlight', () => {
    it('keeps the current highlight when the pointer leaves the list', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['apple', 'banana']} autoHighlight keepHighlight>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await user.type(input, 'ap');

      const apple = await screen.findByRole('option', { name: 'apple' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));

      // Hovering puts the list into pointer modality, so leaving it runs the reset path.
      await hover(user, apple);

      const outside = document.createElement('div');
      document.body.appendChild(outside);
      await fireEvent.pointerLeave(apple, { pointerType: 'mouse', relatedTarget: outside });

      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));
      outside.remove();
    });

    it('clears the highlight when the pointer leaves the list without keepHighlight', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['apple', 'banana']} autoHighlight>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await user.type(input, 'ap');

      const apple = await screen.findByRole('option', { name: 'apple' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));

      await hover(user, apple);

      const outside = document.createElement('div');
      document.body.appendChild(outside);
      await fireEvent.pointerLeave(apple, { pointerType: 'mouse', relatedTarget: outside });

      await waitFor(() => expect(apple).not.toHaveAttribute('data-highlighted'));
      outside.remove();
    });

    it('continues keyboard navigation from the kept highlight after pointer leave', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['apple', 'banana', 'carrot']} autoHighlight keepHighlight>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await user.type(input, 'a');

      const apple = await screen.findByRole('option', { name: 'apple' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));

      // Hovering puts the list into pointer modality, so leaving it runs the reset path.
      await hover(user, apple);

      const outside = document.createElement('div');
      document.body.appendChild(outside);
      await fireEvent.pointerLeave(apple, { pointerType: 'mouse', relatedTarget: outside });

      await user.keyboard('{ArrowDown}');

      const banana = screen.getByRole('option', { name: 'banana' });
      await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
      outside.remove();
    });
  });

  describe('prop: mode', () => {
    it.each(['list', 'both'] as const)(
      'mode="%s": uses the locale when applying the default filter',
      async (mode) => {
        const items = ['Isparta', 'İzmir'];

        const { user } = await render(
          <Autocomplete.Root mode={mode} items={items} locale="tr">
            <Autocomplete.Input />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List v-slots={itemSlot} />
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>,
        );

        const input = screen.getByRole<HTMLInputElement>('combobox');
        await user.type(input, 'i');

        expect(screen.queryByRole('option', { name: 'Isparta' })).toBe(null);
        expect(screen.getByRole('option', { name: 'İzmir' })).not.toBe(null);
      },
    );

    it('mode="list" (default): no inline overlay, consumer handles filtering', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = await render(
        <Autocomplete.Root mode="list" items={items}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);
      await user.type(input, 'a');

      expect(screen.getAllByRole('option')).toHaveLength(2); // apple, banana

      await user.keyboard('{ArrowDown}');

      expect(input.value).toBe('a');
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    it('mode="both": inline overlay + autocomplete handles filtering', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = await render(
        <Autocomplete.Root mode="both" items={items}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');

      await user.click(input);
      await user.type(input, 'a');

      expect(screen.getAllByRole('option')).toHaveLength(2); // apple, banana

      await user.keyboard('{ArrowDown}');

      expect(input.value).toBe('apple');
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    it('mode="both": hovering items should not change the inline overlay (preserve temporary value)', async () => {
      const items = ['alpha', 'alpine', 'beta'];

      const { user } = await render(
        <Autocomplete.Root mode="both" items={items}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await user.type(input, 'al');

      await user.keyboard('{ArrowDown}');
      expect(input.value).toBe('alpha');

      const alpine = screen.getByRole('option', { name: 'alpine' });
      await hover(user, alpine);
      expect(input.value).toBe('alpha');
    });

    it('mode="both": external controlled updates replace the temporary inline value', async () => {
      const items = ['apple', 'banana'];

      const Test = defineComponent(() => {
        const value = shallowRef('');
        return () => (
          <div>
            <button
              type="button"
              onClick={() => {
                value.value = 'ba';
              }}
            >
              update value
            </button>
            <Autocomplete.Root
              mode="both"
              items={items}
              value={value.value}
              onValueChange={(next) => {
                value.value = next;
              }}
            >
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </div>
        );
      });

      const { user } = await render(<Test />);
      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'a');
      await user.keyboard('{ArrowDown}');
      expect(input.value).toBe('apple');

      await fireEvent.click(screen.getByText('update value'));
      expect(input.value).toBe('ba');
    });

    it('mode="both": a completion queued after a pointer highlight does not replace an external controlled update', async () => {
      const items = ['apple', 'banana'];

      const Test = defineComponent(() => {
        const value = shallowRef('');
        return () => (
          <div>
            <button
              type="button"
              onClick={() => {
                value.value = 'ba';
              }}
            >
              update value
            </button>
            <Autocomplete.Root
              mode="both"
              items={items}
              value={value.value}
              onValueChange={(next) => {
                value.value = next;
              }}
            >
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </div>
        );
      });

      const { user } = await render(<Test />);
      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'a');
      const apple = screen.getByRole('option', { name: 'apple' });
      await hover(user, apple);
      expect(apple).toHaveAttribute('data-highlighted');
      expect(input.value).toBe('a');

      await fireEvent.click(screen.getByText('update value'));
      expect(input.value).toBe('ba');
    });

    it('mode="inline": static items with inline overlay', async () => {
      const { user } = await render(
        <Autocomplete.Root mode="inline" openOnInputClick>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                  <Autocomplete.Item value="banana">banana</Autocomplete.Item>
                  <Autocomplete.Item value="cherry">cherry</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);

      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(3);
      });

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input.value).toBe('apple');
      });

      await user.type(input, 'b');

      expect(input.value).toBe('appleb');
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });

    it('mode="none": static items without inline overlay', async () => {
      const { user } = await render(
        <Autocomplete.Root mode="none" openOnInputClick>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                  <Autocomplete.Item value="banana">banana</Autocomplete.Item>
                  <Autocomplete.Item value="cherry">cherry</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);
      await user.keyboard('{ArrowDown}');

      expect(input.value).toBe('');
      expect(screen.getAllByRole('option')).toHaveLength(3);

      await user.type(input, 'x');
      await user.keyboard('{ArrowDown}');

      expect(input.value).toBe('x');
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });
  });

  describe('scroll reset on input value change', () => {
    const manyItems = Array.from({ length: 50 }, (_, index) => `item-${index}`);

    it.skipIf(isJSDOM)('resets the list scroll position to the top when typing', async () => {
      const filteringItems = Array.from({ length: 50 }, (_, index) =>
        index < 25 ? `alpha-${index}` : `beta-${index - 25}`,
      );

      const { user } = await render(
        <Autocomplete.Root items={filteringItems} openOnInputClick>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List
                  style={{ maxHeight: '100px', overflowY: 'auto' }}
                  v-slots={itemSlot}
                />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);

      const list = screen.getByRole('listbox');
      list.scrollTop = 40;
      expect(list.scrollTop).toBeGreaterThan(0);

      // Remove the current first item while keeping enough matches for the list to scroll.
      await user.type(input, 'b');

      await waitFor(() => {
        expect(list.scrollTop).toBe(0);
      });
    });

    it.skipIf(isJSDOM)(
      'mode="both": inline navigation does not reset the scroll to the top',
      async () => {
        const { user } = await render(
          <Autocomplete.Root mode="both" items={manyItems}>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List
                    style={{ maxHeight: '100px', overflowY: 'auto' }}
                    v-slots={itemSlot}
                  />
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>,
        );

        const input = screen.getByTestId<HTMLInputElement>('input');
        await user.click(input);
        // Keep every item in the filtered list so navigation can scroll far down.
        await user.type(input, 'item');

        // Navigate to an item that sits below the visible viewport. Inline autocompletion
        // rewrites the input value on each step, but that must not reset the scroll to the top.
        for (let i = 0; i < 20; i += 1) {
          await user.keyboard('{ArrowDown}');
        }

        const list = screen.getByRole('listbox');
        await waitFor(() => {
          expect(list.scrollTop).toBeGreaterThan(0);
        });
      },
    );
  });

  describe('prop: filter', () => {
    it('mode="both": keeps filtering against the typed query during inline completion', async () => {
      const items = ['apple', 'banana'];
      const filter = vi.fn((item: string, query: string) => item.includes(query));
      const { setProps, user } = await render(
        <Autocomplete.Root mode="both" items={items} filter={filter}>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'a');
      await user.keyboard('{ArrowDown}');

      expect(input).toHaveValue('apple');

      filter.mockClear();
      await setProps({ items: [...items, 'apricot'] });

      expect(filter).toHaveBeenCalled();
      expect(filter.mock.calls.every(([, query]) => query === 'a')).toBe(true);
    });

    it('mode="inline": does not call a custom filter', async () => {
      const filter = vi.fn(() => false);
      const { user } = await render(
        <Autocomplete.Root mode="inline" items={['apple', 'banana']} filter={filter}>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      await user.type(screen.getByRole('combobox'), 'a');

      expect(screen.getAllByRole('option')).toHaveLength(2);
      expect(filter).not.toHaveBeenCalled();
    });

    it.each(['list', 'both'] as const)(
      'mode="%s": uses a custom filter instead of the locale-aware default',
      async (mode) => {
        const items = ['Isparta', 'İzmir'];
        const filter = (item: string, query: string) => item.startsWith(query.toUpperCase());

        const { user } = await render(
          <Autocomplete.Root mode={mode} items={items} locale="tr" filter={filter}>
            <Autocomplete.Input />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List v-slots={itemSlot} />
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>,
        );

        const input = screen.getByRole<HTMLInputElement>('combobox');
        await user.type(input, 'i');

        expect(screen.getByRole('option', { name: 'Isparta' })).not.toBe(null);
        expect(screen.queryByRole('option', { name: 'İzmir' })).toBe(null);
      },
    );

    it.each(['list', 'both'] as const)(
      'mode="%s": does not apply default filtering when filter is null',
      async (mode) => {
        interface Movie {
          id: string;
          title: string;
          year: number;
        }

        const asyncResults: Movie[] = [
          { id: '1', title: 'Pulp Fiction', year: 1994 },
          { id: '2', title: 'The Godfather', year: 1972 },
          { id: '3', title: 'The Dark Knight', year: 2008 },
        ];

        const { user } = await render(
          <Autocomplete.Root
            mode={mode}
            items={asyncResults}
            filter={null}
            itemToStringValue={(movie: Movie) => movie.title}
          >
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List
                    v-slots={{
                      item: ({ item: movie }: { item: Movie }) => (
                        <Autocomplete.Item value={movie}>{movie.title}</Autocomplete.Item>
                      ),
                    }}
                  />
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>,
        );

        const input = screen.getByTestId<HTMLInputElement>('input');
        await user.type(input, '1994');

        await waitFor(() => {
          expect(screen.getAllByRole('option')).toHaveLength(3);
        });
        expect(screen.getByRole('option', { name: 'Pulp Fiction' })).not.toBe(null);
        expect(screen.getByRole('option', { name: 'The Godfather' })).not.toBe(null);
        expect(screen.getByRole('option', { name: 'The Dark Knight' })).not.toBe(null);
      },
    );
  });

  describe('prop: value', () => {
    it('treats a controlled null value as an empty query', async () => {
      await render(
        <Autocomplete.Root mode="both" value={null as never} items={['apple']} defaultOpen>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List v-slots={itemSlot} />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      expect(screen.getByRole('combobox')).toHaveValue('');
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
    });

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

  describe('prop: submitOnItemClick', () => {
    it('prevents submit on Enter when an item is highlighted by default (false)', async () => {
      const handleSubmit = createFormDataSpy('search');

      const { user } = await render(
        <form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root items={['apple', 'banana']} autoHighlight>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
        </form>,
      );

      const input = screen.getByRole('combobox');
      await user.click(screen.getByRole('combobox'));
      await user.type(input, 'a'); // open and highlight first
      await user.keyboard('{Enter}');

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('when true, clicking with pointer submits the owning form', async () => {
      const handleSubmit = createFormDataSpy('q');

      const { user } = await render(
        <form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Autocomplete.Root items={['alpha', 'alpine']} submitOnItemClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
        </form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'al');

      const alphaButton = screen.getByRole('option', { name: 'alpha' });
      await user.click(alphaButton);

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('alpha');
    });

    it('submits the form of the input when only the input is inside the form', async () => {
      const handleSubmit = vi.fn((event: Event) => {
        event.preventDefault();
      });

      const { user } = await render(
        <Autocomplete.Root items={['alpha']} submitOnItemClick>
          {/* The hidden input renders after the children, outside this form. */}
          <form onSubmit={handleSubmit}>
            <Autocomplete.Input />
          </form>
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      await user.type(screen.getByRole('combobox'), 'a');
      await user.click(screen.getByRole('option', { name: 'alpha' }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('submits its own form when an unscoped control in another form owns the validation ref', async () => {
      const handleSubmit = vi.fn((event: Event) => {
        event.preventDefault();
      });
      const handleOtherSubmit = vi.fn((event: Event) => {
        event.preventDefault();
      });

      const { user } = await render(
        <>
          <form onSubmit={handleSubmit}>
            <Autocomplete.Root items={['alpha']} submitOnItemClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </form>
          <form onSubmit={handleOtherSubmit}>
            <Input aria-label="Unrelated input" />
          </form>
        </>,
      );

      await user.type(screen.getByRole('combobox'), 'a');
      await user.click(screen.getByRole('option', { name: 'alpha' }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleOtherSubmit).not.toHaveBeenCalled();
    });

    it('when true, pressing Enter in the Input submits the owning form when an item is highlighted', async () => {
      const handleSubmit = createFormDataSpy('q');

      const { user } = await render(
        <form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Autocomplete.Root items={['alpha', 'alpine']} submitOnItemClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
        </form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'al');
      await user.keyboard('{ArrowDown}');

      const alphaButton = screen.getByRole('option', { name: 'alpha' });
      expect(alphaButton).toHaveAttribute('data-highlighted');

      await user.keyboard('{Enter}');

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('alpha');
    });

    it.skipIf(isJSDOM)(
      'when true, clicking with pointer submits an associated external form when `form` is provided',
      async () => {
        const handleSubmit = createFormDataSpy('q');

        const { user } = await render(
          <>
            <form id="external-form" onSubmit={handleSubmit} />
            <Autocomplete.Root
              items={['alpha', 'alpine']}
              name="q"
              form="external-form"
              submitOnItemClick
            >
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </>,
        );

        const input = screen.getByRole<HTMLInputElement>('combobox');
        await user.type(input, 'al');
        await user.click(screen.getByRole('option', { name: 'alpha' }));

        expect(handleSubmit).toHaveBeenCalledTimes(1);
        expect(handleSubmit.mock.results.at(-1)?.value).toBe('alpha');
      },
    );

    it('focusing the listbox should keep the input focused and maintain functionality', async () => {
      const handleSubmit = createFormDataSpy('q');

      const { user } = await render(
        <form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Autocomplete.Root items={['alpha', 'alpine']} submitOnItemClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List data-testid="listbox" v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
        </form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'al');
      await user.keyboard('{ArrowDown}');

      const listbox = screen.getByRole('listbox');
      const alphaOption = screen.getByRole('option', { name: 'alpha' });
      await waitFor(() => {
        expect(alphaOption).toHaveAttribute('data-highlighted');
      });

      listbox.focus();
      await flushMicrotasks();
      expect(input).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('alpha');
    });
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
          {popup()}
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

    it('a canceled openChange emits no update:open and keeps the popup closed', async () => {
      const events: string[] = [];
      await render(
        <Autocomplete.Root
          items={cities}
          onOpenChange={(open, details) => {
            events.push(`openChange:${open}`);
            details.cancel();
          }}
          {...{ 'onUpdate:open': (open: boolean) => events.push(`update:open:${open}`) }}
        >
          <Autocomplete.Input />
          {popup()}
        </Autocomplete.Root>,
      );

      await type('ma');

      expect(events).toEqual(['openChange:true']);
      expect(getInput()).toHaveAttribute('aria-expanded', 'false');
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
          {popup()}
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

    it('itemToStringValue gives the text of an object item to the filter and to the inline text', async () => {
      const countries = [
        { code: 'SE', label: 'Sweden' },
        { code: 'MT', label: 'Malta' },
      ];
      await render(
        <Autocomplete.Root mode="both" items={countries} itemToStringValue={(item) => item.code}>
          <Autocomplete.Input />
          {popup({
            item: ({ item }: { item: (typeof countries)[number] }) => (
              <Autocomplete.Item value={item}>{item.label}</Autocomplete.Item>
            ),
          })}
        </Autocomplete.Root>,
      );
      getInput().focus();
      await type('mt');
      expect(getOptions()).toEqual(['Malta']);

      await pressArrowDown();

      expect(getInput().value).toBe('MT');
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
              {popup()}
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

    it('submits the typed input value when name is provided on Autocomplete.Root', async () => {
      const handleSubmit = createFormDataSpy('query');

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="query">
            <Autocomplete.Root>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="base-ui">base-ui</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit" data-testid="submit-btn">
            Submit
          </button>
        </Form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'base ui');

      expect(input.getAttribute('name'), 'input should have name attribute').toBe('query');
      expect(input.value, 'input should have typed value').toBe('base ui');

      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('base ui');
    });

    it('submits the popup input value through native FormData when rendering a field-aware input', async () => {
      const handleSubmit = createFormDataSpy('search');

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']}>
              <Autocomplete.Trigger>
                <Autocomplete.Value />
              </Autocomplete.Trigger>
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.Input as={Input} data-testid="input" />
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByRole('combobox'));
      const input = await screen.findByTestId('input');
      expect(input).not.toHaveAttribute('name');

      await user.click(screen.getByRole('option', { name: 'alpha' }));

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveTextContent('alpha');
      });

      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('alpha');
    });

    it('submits the inline input value through native FormData', async () => {
      const handleSubmit = createFormDataSpy('search');

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']} inline>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.List v-slots={itemSlot} />
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('name', 'search');

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toHaveAttribute('name');

      await user.type(input, 'alp');
      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('alp');
    });

    it('submits a default popup input value through native FormData before the popup opens', async () => {
      const handleSubmit = createFormDataSpy('search');

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']} defaultValue="alpha">
              <Autocomplete.Trigger>
                <Autocomplete.Value />
              </Autocomplete.Trigger>
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.Input as={Input} data-testid="input" />
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('alpha');
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

    it('clears external errors on change', async () => {
      const { user } = await render(
        <Form
          errors={{
            autocomplete: 'test',
          }}
        >
          <Field.Root name="autocomplete">
            <Autocomplete.Root>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="a">a</Autocomplete.Item>
                      <Autocomplete.Item value="b">b</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByTestId('error')).toHaveTextContent('test');

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.type(input, 'test input');
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('submits the input value directly (not selection value)', async () => {
      const handleSubmit = createFormDataSpy('search');

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                      <Autocomplete.Item value="banana">banana</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      // Type something that doesn't exactly match any option
      await user.type(input, 'appl');
      await user.click(screen.getByText('Submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('appl');
    });

    it('Enter submits when no item is highlighted', async () => {
      const handleSubmit = createFormDataSpy('search');

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'beta']} openOnInputClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByRole('combobox'));
      await user.keyboard('{Enter}');

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('pressing Enter in the Input submits the owning form when no item is highlighted', async () => {
      const handleSubmit = createFormDataSpy('q');

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Autocomplete.Root items={['alpha', 'alpine']} submitOnItemClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'xyz');
      await user.keyboard('{Enter}');

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('xyz');
    });

    it('pressing Enter in the List when it has focus submits the owning form', async () => {
      const handleSubmit = createFormDataSpy('q');

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Autocomplete.Root items={['alpha', 'alpine']} submitOnItemClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
        </Form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'al');
      await user.keyboard('{ArrowDown}');

      const alphaButton = screen.getByRole('option', { name: 'alpha' });
      expect(alphaButton).toHaveAttribute('data-highlighted');

      const list = screen.getByRole('listbox');
      list.focus();
      await flushMicrotasks();

      await user.keyboard('{Enter}');

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.results.at(-1)?.value).toBe('alpha');
    });
  });

  describe('object item stringification', () => {
    it('filters and displays using label for {label} objects', async () => {
      const items = [{ label: 'United States' }, { label: 'Canada' }, { label: 'Australia' }];

      const { user } = await render(
        <Autocomplete.Root items={items}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List
                  v-slots={{
                    item: ({ item }: { item: { label: string } }) => (
                      <Autocomplete.Item value={item}>{item.label}</Autocomplete.Item>
                    ),
                  }}
                />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await user.type(input, 'can');

      // Should match the item by its label, not its value
      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(1);
      });
      await user.click(screen.getByRole('option', { name: 'Canada' }));

      expect(input).toHaveValue('Canada');
    });

    it('uses itemToStringValue when object lacks label', async () => {
      const items = [{ country: 'United States' }, { country: 'Canada' }, { country: 'Australia' }];

      const { user } = await render(
        <Autocomplete.Root items={items} itemToStringValue={(i) => i.country}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List
                  v-slots={{
                    item: ({ item }: { item: { country: string } }) => (
                      <Autocomplete.Item value={item}>{item.country}</Autocomplete.Item>
                    ),
                  }}
                />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await user.type(input, 'can');

      // Should match by the provided itemToStringValue mapping
      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(1);
      });
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(input).toHaveValue('Canada');
    });

    it('filters and displays using value for {value} objects', async () => {
      const items = [{ value: 'United States' }, { value: 'Canada' }, { value: 'Australia' }];

      const { user } = await render(
        <Autocomplete.Root items={items}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List
                  v-slots={{
                    item: ({ item }: { item: { value: string } }) => (
                      <Autocomplete.Item value={item}>{item.value}</Autocomplete.Item>
                    ),
                  }}
                />
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'can');

      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(1);
      });
      await user.click(screen.getByRole('option', { name: 'Canada' }));

      expect(input).toHaveValue('Canada');
    });
  });

  describe('Field', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('sets `required` on the visible input', async () => {
      await render(
        <Field.Root>
          <Autocomplete.Root required>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner />
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      expect(screen.getByTestId('input')).toHaveAttribute('required');
    });

    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="">Select</Autocomplete.Item>
                    <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('data-touched');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);

      await flushMicrotasks();

      expect(input).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      const { user } = await render(
        <Field.Root>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="">Select</Autocomplete.Item>
                    <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('data-dirty');

      await user.type(input, 'test');
      await flushMicrotasks();

      expect(input).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when input has content', async () => {
        const { user } = await render(
          <Field.Root>
            <Autocomplete.Root>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="">Select</Autocomplete.Item>
                      <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>,
        );

        const input = screen.getByTestId('input');

        expect(input).not.toHaveAttribute('data-filled');

        await user.type(input, 'test input');
        await flushMicrotasks();

        expect(input).toHaveAttribute('data-filled', '');
      });

      it('adds [data-filled] attribute when already filled with defaultValue', async () => {
        await render(
          <Field.Root>
            <Autocomplete.Root defaultValue="initial value">
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>,
        );

        const input = screen.getByTestId('input');

        expect(input).toHaveAttribute('data-filled');
      });
    });

    it('[data-focused]', async () => {
      await render(
        <Field.Root>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="">Select</Autocomplete.Item>
                    <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('data-focused');

      await fireEvent.focusIn(input);

      expect(input).toHaveAttribute('data-focused', '');

      await fireEvent.focusOut(input);

      expect(input).not.toHaveAttribute('data-focused');
    });

    it('[data-invalid]', async () => {
      await render(
        <Field.Root invalid>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('data-invalid', '');
    });

    it('[data-valid]', async () => {
      const { user } = await render(
        <Field.Root validationMode="onBlur">
          <Autocomplete.Root required>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByRole('combobox');
      expect(input).not.toHaveAttribute('data-valid');
      expect(input).not.toHaveAttribute('data-invalid');

      await user.type(input, 'ok');
      input.blur();
      await flushMicrotasks();

      expect(input).toHaveAttribute('data-valid', '');
      expect(input).not.toHaveAttribute('data-invalid');
    });

    it('prop: validate', async () => {
      await render(
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner />
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      expect(input).not.toHaveAttribute('aria-invalid');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);
      await flushMicrotasks();
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onSubmit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root
            validate={(value) => {
              return value === 'one' ? 'error' : null;
            }}
          >
            <Autocomplete.Root required>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="one">Option 1</Autocomplete.Item>
                      <Autocomplete.Item value="two">Option 2</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(screen.getByText('submit'));
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.type(input, 'two');
      expect(input).not.toHaveAttribute('aria-invalid');

      await user.clear(input);
      await user.type(input, 'one');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.clear(input);
      await user.type(input, 'three');
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('prop: validationMode=onChange', async () => {
      const { user } = await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            return value === 'invalid' ? 'error' : null;
          }}
        >
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="valid">Valid Option</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      await user.type(input, 'invalid');

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onBlur', async () => {
      const { user } = await render(
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            return value === 'invalid' ? 'error' : null;
          }}
        >
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="valid">Valid Option</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      await user.type(input, 'invalid');

      await fireEvent.focusOut(input);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('Field.Label', async () => {
      await render(
        <Field.Root>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner />
            </Autocomplete.Portal>
          </Autocomplete.Root>
          <Field.Label data-testid="label" as="span" nativeLabel={false} />
        </Field.Root>,
      );

      expect(screen.getByTestId('input')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner />
            </Autocomplete.Portal>
          </Autocomplete.Root>
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      expect(screen.getByTestId('input')).toHaveAttribute(
        'aria-describedby',
        screen.getByTestId('description').id,
      );
    });
  });
});
