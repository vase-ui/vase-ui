import { expect, describe, it, vi } from 'vitest';
import { computed, defineComponent, provide, shallowRef } from 'vue';
import type { Ref } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { NumberField } from '@vase-ui/vue/number-field';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  hydrate,
  hydrateAfter,
  isJSDOM,
  mockPageBeforeLoad,
  recordInputEvents,
  renderOnServer,
  screen,
  within,
} from '#test-utils';
import { NOOP } from '../../internals/noop';
import { ToolbarRootContext } from '../root/ToolbarRootContext';
import type { Orientation } from '../../internals/types';
import { CompositeRootContext } from '../../internals/composite/root/useCompositeRoot';
import { ARROW_UP, ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT } from '../../internals/composite/listIndex';
import ToolbarInputBeforeHydration from './ToolbarInputBeforeHydration.test.vue';
import ToolbarInputHydration from './ToolbarInputHydration.test.vue';

const HYDRATION_FIXTURE = 'src/toolbar/input/ToolbarInputHydration.test.vue';

function readTabindexes(root: ParentNode) {
  return ['input', 'button'].map((testId) =>
    root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('tabindex'),
  );
}

const testCompositeContext: CompositeRootContext = {
  hasFocus: () => false,
  focusDetachedItem: NOOP,
  blurDetachedItem: NOOP,
  keydownDetachedItem: NOOP,
  highlightedIndex: computed(() => 0),
  onHighlightedIndexChange: NOOP,
  highlightItemOnHover: computed(() => false),
  relayKeyboardEvent: NOOP,
  takeInitialTabStop: () => false,
  id: 'test',
  hasUnmountedTabStop: computed(() => false),
};

const testToolbarContext: ToolbarRootContext = {
  disabled: computed(() => false),
  orientation: computed(() => 'horizontal' as const),
};

const TestContexts = defineComponent((_, { slots }) => {
  provide(ToolbarRootContext, testToolbarContext);
  provide(CompositeRootContext, testCompositeContext);
  return () => slots.default?.();
});

describe('<Toolbar.Input />', () => {
  const { render } = createRenderer();

  describeConformance(<Toolbar.Input />, () => ({
    refInstanceof: window.HTMLInputElement,
    testRenderPropWith: 'input',
    render: (node) => render(<TestContexts>{node}</TestContexts>),
  }));

  describe('pointer interactions', () => {
    it('does not steal focus while disabled and becomes pointer-focusable when enabled', async () => {
      function TestInput({ disabled }: { disabled: boolean }) {
        return (
          <Toolbar.Root>
            <Toolbar.Button data-testid="button" />
            <Toolbar.Input data-testid="input" disabled={disabled} />
          </Toolbar.Root>
        );
      }

      const { setProps, user } = await render(<TestInput disabled />);
      const button = screen.getByTestId('button');
      const input = screen.getByTestId('input');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.click(input);
      expect(button).toHaveFocus();

      await setProps({ disabled: false });
      await user.click(input);
      expect(input).toHaveFocus();
    });

    it('prevents click default actions while disabled', async () => {
      function TestInput({ disabled }: { disabled: boolean }) {
        return (
          <Toolbar.Root>
            <Toolbar.Input type="checkbox" disabled={disabled} />
          </Toolbar.Root>
        );
      }

      const { setProps, user } = await render(<TestInput disabled />);
      const input = screen.getByRole('checkbox');

      await user.click(input);
      expect(input).not.toBeChecked();

      await setProps({ disabled: false });
      await user.click(input);
      expect(input).toBeChecked();
    });
  });

  describe.skipIf(isJSDOM)('keyboard navigation', () => {
    it.each([
      ['ltr', ARROW_RIGHT, ARROW_LEFT],
      ['rtl', ARROW_LEFT, ARROW_RIGHT],
    ] as const)(
      'respects caret and selection boundaries in horizontal %s toolbars',
      async (direction, nextKey, previousKey) => {
        const { user } = await render(
          <DirectionProvider direction={direction}>
            <Toolbar.Root orientation="horizontal">
              <Toolbar.Button data-testid="before" />
              <Toolbar.Input defaultValue="abcd" />
              <Toolbar.Button data-testid="after" />
            </Toolbar.Root>
          </DirectionProvider>,
        );
        const input = screen.getByRole('textbox') as HTMLInputElement;
        const before = screen.getByTestId('before');
        const after = screen.getByTestId('after');

        await user.keyboard('[Tab]');
        await user.keyboard(`[${nextKey}]`);
        expect(input).toHaveFocus();

        input.setSelectionRange(1, 3);
        await user.keyboard(`[${nextKey}]`);
        expect(input).toHaveFocus();

        input.setSelectionRange(2, 2);
        await user.keyboard(`[ShiftLeft>][${nextKey}][/ShiftLeft]`);
        expect(input).toHaveFocus();

        const nextBoundary =
          direction === 'rtl' || nextKey === ARROW_RIGHT ? input.value.length : 0;
        input.setSelectionRange(nextBoundary, nextBoundary);
        await user.keyboard(`[${nextKey}]`);
        expect(after).toHaveFocus();

        await user.keyboard(`[${previousKey}]`);
        expect(input).toHaveFocus();
        const previousBoundary =
          direction === 'rtl' || previousKey === ARROW_LEFT ? 0 : input.value.length;
        input.setSelectionRange(previousBoundary, previousBoundary);
        await user.keyboard(`[${previousKey}]`);
        expect(before).toHaveFocus();
      },
    );

    // when navigating through RTL text in real browsers the arrow keys for
    // moving the text insertion cursor is also reversed from LTR but this doesn't
    // work with testing library
    it.each<{ orientation: Orientation; nextKey: string; prevKey: string }>([
      { orientation: 'horizontal', nextKey: ARROW_RIGHT, prevKey: ARROW_LEFT },
      { orientation: 'vertical', nextKey: ARROW_DOWN, prevKey: ARROW_UP },
    ])('orientation: $orientation', async ({ orientation, nextKey, prevKey }) => {
      const { user } = await render(
        <Toolbar.Root orientation={orientation}>
          <Toolbar.Button />
          <Toolbar.Input defaultValue="abcd" />
          <Toolbar.Button />
        </Toolbar.Root>,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      const [button1, button2] = screen.getAllByRole('button');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard(`[${nextKey}]`);
      expect(input).toHaveFocus();

      // Firefox doesn't support document.getSelection() in inputs
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(4);

      await user.keyboard(`[${ARROW_RIGHT}]`);
      await user.keyboard(`[${nextKey}]`);

      expect(button2).toHaveFocus();

      await user.keyboard(`[${prevKey}]`);
      expect(input).toHaveFocus();

      await user.keyboard(`[${ARROW_LEFT}]`);
      await user.keyboard(`[${prevKey}]`);

      expect(button1).toHaveFocus();
    });
  });

  describe.skipIf(isJSDOM)('disabled', () => {
    it('does not trap keyboard focus when disabled', async () => {
      const { user } = await render(
        <div>
          <Toolbar.Root>
            <Toolbar.Button data-testid="button" />
            <Toolbar.Input defaultValue="abcd" disabled />
          </Toolbar.Root>
          <button type="button" data-testid="after">
            after
          </button>
        </div>,
      );

      const button = screen.getByTestId('button');
      const input = screen.getByRole('textbox');
      const after = screen.getByTestId('after');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard(`[${ARROW_RIGHT}]`);
      expect(input).toHaveFocus();

      // Tab must leave the toolbar instead of being trapped on the disabled input
      await user.keyboard('[Tab]');
      expect(after).toHaveFocus();

      await user.keyboard('[ShiftLeft>][Tab][/ShiftLeft]');
      expect(input).toHaveFocus();
    });

    it('does not block vertical roving focus when disabled', async () => {
      const { user } = await render(
        <Toolbar.Root orientation="vertical">
          <Toolbar.Button data-testid="button1" />
          <Toolbar.Input defaultValue="abcd" disabled />
          <Toolbar.Button data-testid="button2" />
        </Toolbar.Root>,
      );

      const input = screen.getByRole('textbox');
      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(input).toHaveFocus();

      // ArrowDown must move roving focus past the disabled input
      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(button2).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      expect(input).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      expect(button1).toHaveFocus();
    });
  });

  describe('state attributes', () => {
    it('has the orientation of the toolbar and the focusable mark', async () => {
      await render(
        <Toolbar.Root orientation="vertical">
          <Toolbar.Input data-testid="focusable" />
          <Toolbar.Input data-testid="not-focusable" focusableWhenDisabled={false} />
        </Toolbar.Root>,
      );

      const focusable = screen.getByTestId('focusable');
      expect(focusable).toHaveAttribute('data-orientation', 'vertical');
      expect(focusable).toHaveAttribute('data-focusable');
      expect(screen.getByTestId('not-focusable')).not.toHaveAttribute('data-focusable');
    });
  });

  describe('prop: defaultValue', () => {
    it('keeps the text of the user when the input renders again', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button data-testid="button" />
          <Toolbar.Input data-testid="input" defaultValue="abcd" />
        </Toolbar.Root>,
      );
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.value).toBe('abcd');
      expect(input).toHaveAttribute('value', 'abcd');

      await user.click(input);
      await user.keyboard('X');
      const typedValue = input.value;
      expect(typedValue).not.toBe('abcd');

      // The input loses the tab stop, so it renders again.
      await user.keyboard('[Home][ArrowLeft]');
      expect(screen.getByTestId('button')).toHaveFocus();
      expect(input).toHaveAttribute('tabindex', '-1');
      expect(input.value).toBe(typedValue);
    });
  });

  describe('rendering NumberField', () => {
    it('renders NumberField.Input', async () => {
      await render(
        <Toolbar.Root>
          <NumberField.Root>
            <NumberField.Group>
              <Toolbar.Input as={NumberField.Input} />
            </NumberField.Group>
          </NumberField.Root>
        </Toolbar.Root>,
      );

      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('handles interactions', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Toolbar.Root>
          <NumberField.Root min={1} max={10} defaultValue={5} onValueChange={onValueChange}>
            <NumberField.Group>
              <NumberField.Decrement />
              <Toolbar.Input as={NumberField.Input} />
              <NumberField.Increment />
            </NumberField.Group>
          </NumberField.Root>
        </Toolbar.Root>,
      );

      const input = screen.getByRole('spinbutton');

      await user.keyboard('[Tab]');
      expect(input).toHaveAttribute('tabindex', '0');
      expect(input).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(6);

      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[1][0]).toBe(5);
    });

    it('disabled state', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Toolbar.Root>
          <NumberField.Root min={1} max={10} defaultValue={5} onValueChange={onValueChange}>
            <NumberField.Group>
              <NumberField.Decrement />
              <Toolbar.Input disabled as={NumberField.Input} />
              <NumberField.Increment />
            </NumberField.Group>
          </NumberField.Root>
        </Toolbar.Root>,
      );

      const input = screen.getByRole('spinbutton');

      expect(input).not.toHaveAttribute('disabled');
      expect(input).toHaveAttribute('data-disabled');
      expect(input).toHaveAttribute('aria-disabled', 'true');

      await user.keyboard('[Tab]');
      expect(input).toHaveAttribute('tabindex', '0');
      expect(input).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(onValueChange.mock.calls.length).toBe(0);
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'an enabled input', props: {}, tabindexes: ['0', '-1'] },
      {
        name: 'a disabled input that is not focusable',
        props: { first: 'disabled' },
        tabindexes: ['-1', '0'],
      },
      {
        name: 'a disabled input that is focusable',
        props: { first: 'focusable' },
        tabindexes: ['0', '-1'],
      },
    ] as const)('hydrates $name', async ({ props, tabindexes }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(readTabindexes(template.content)).toEqual(tabindexes);
      expect(template.content.querySelector('input')?.getAttribute('value')).toBe('abcd');

      const { container } = await hydrate(ToolbarInputHydration, { serverHtml, props });

      expect(readTabindexes(container)).toEqual(tabindexes);
      expect(container.querySelector('input')).toHaveValue('abcd');
    });
  });

  describe('VUE-74: text that the user typed before the hydration', () => {
    it.each([
      { name: 'a value of the consumer', props: { controlled: true }, text: 'abcd' },
      { name: 'a default value', props: { controlled: false }, text: 'abc' },
    ])('runs the input listener one time for $name', async ({ props, text }) => {
      const serverHtml = await renderOnServer(
        'src/toolbar/input/ToolbarInputBeforeHydration.test.vue',
        props,
      );

      const { container } = await hydrateAfter(ToolbarInputBeforeHydration, {
        serverHtml,
        props,
        before(serverContainer) {
          const serverInput = within(serverContainer).getByTestId<HTMLInputElement>('input');
          serverInput.focus();
          serverInput.value = 'abcd';
        },
      });
      await flushMicrotasks();

      const fixture = within(container);
      expect(fixture.getByTestId('input')).toHaveValue('abcd');
      expect(fixture.getByTestId('inputs').textContent).toBe('abcd');
      expect(fixture.getByTestId('text').textContent).toBe(text);
    });
  });

  describe('VUE-81: the form state that the browser restores', () => {
    it.each([
      { name: 'a value of the consumer', props: { controlled: true }, text: 'abcd' },
      { name: 'a default value', props: { controlled: false }, text: 'abc' },
    ])('sends the events of a restored value to an input with $name', async ({ props, text }) => {
      const { container } = await render(<ToolbarInputBeforeHydration {...props} />);
      const fixture = within(container);
      const events = recordInputEvents(container);
      fixture.getByTestId<HTMLInputElement>('input').value = 'abcd';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(fixture.getByTestId('inputs').textContent).toBe('abcd');
      expect(fixture.getByTestId('text').textContent).toBe(text);
      expect(fixture.getByTestId('input')).toHaveValue('abcd');
      expect(events).toEqual(['input', 'change', 'blur', 'focusout']);
    });

    it.each([
      { name: 'the mount', text: 'abc' },
      { name: 'a later render', text: 'abcd' },
    ])('sends no event for the value of $name', async ({ text }) => {
      const value = shallowRef('abc');
      const { container } = await render(() => (
        <Toolbar.Root>
          <Toolbar.Input value={value.value} data-testid="input" />
        </Toolbar.Root>
      ));
      const events = recordInputEvents(container);
      value.value = text;
      await flushMicrotasks();
      expect(screen.getByTestId('input')).toHaveValue(text);

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(events).toEqual([]);
    });

    function renderToolbarInput(props: Ref<{ value?: string; defaultValue?: string }>) {
      const texts: string[] = [];
      return {
        texts,
        result: render(() => (
          <Toolbar.Root>
            <Toolbar.Input
              {...props.value}
              data-testid="input"
              onInput={(event: Event) => {
                texts.push((event.currentTarget as HTMLInputElement).value);
              }}
            />
          </Toolbar.Root>
        )),
      };
    }

    it('takes the value that the browser restored into Toolbar.Input after a new default value', async () => {
      mockPageBeforeLoad();
      const props = shallowRef({ defaultValue: 'a' });
      const { texts, result } = renderToolbarInput(props);
      const { container } = await result;
      const recorded = recordInputEvents(container);
      const input = screen.getByTestId<HTMLInputElement>('input');
      input.value = 'restored';

      props.value = { defaultValue: 'b' };
      await flushMicrotasks();
      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(input).toHaveValue('restored');
      expect(texts).toEqual(['restored']);
      expect(recorded).toEqual(['input', 'change', 'blur', 'focusout']);
    });

    it('sends no event at the page show after a new default value of Toolbar.Input', async () => {
      const props = shallowRef({ defaultValue: 'a' });
      const { result } = renderToolbarInput(props);
      const { container } = await result;
      const recorded = recordInputEvents(container);

      props.value = { defaultValue: 'b' };
      await flushMicrotasks();
      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(screen.getByTestId('input')).toHaveValue('b');
      expect(recorded).toEqual([]);
    });

    it('sends no event at the page show after a new value of Toolbar.Input', async () => {
      mockPageBeforeLoad();
      const props = shallowRef({ value: 'a' });
      const { result } = renderToolbarInput(props);
      const { container } = await result;
      const recorded = recordInputEvents(container);
      screen.getByTestId<HTMLInputElement>('input').value = 'restored';

      props.value = { value: 'b' };
      await flushMicrotasks();
      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(screen.getByTestId('input')).toHaveValue('b');
      expect(recorded).toEqual([]);
    });
  });
});
