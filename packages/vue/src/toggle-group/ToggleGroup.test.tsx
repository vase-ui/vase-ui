import { expect, vi, describe, it } from 'vitest';
import { computed, defineComponent, provide } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';
import { Toggle } from '@vase-ui/vue/toggle';
import { Toolbar } from '@vase-ui/vue/toolbar';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
} from '#test-utils';
import type { Orientation } from '../internals/types';
import { ToolbarGroupContext } from '../toolbar/group/ToolbarGroupContext';
import ToggleGroupHydration from './ToggleGroupHydration.test.vue';

const HYDRATION_FIXTURE = 'src/toggle-group/ToggleGroupHydration.test.vue';

function readTabindexes(root: ParentNode) {
  return ['before', 'a', 'b', 'c', 'after'].map(
    (testId) => root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('tabindex') ?? null,
  );
}

function parse(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

describe('<ToggleGroup />', () => {
  const { render } = createRenderer();

  describeConformance(<ToggleGroup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  it('renders a `group`', async () => {
    await render(<ToggleGroup aria-label="My Toggle Group" />);

    expect(screen.queryByRole('group', { name: 'My Toggle Group' })).not.toBe(null);
  });

  describe('uncontrolled', () => {
    it('pressed state', async ({ skip }) => {
      if (isJSDOM) {
        skip();
      }

      const { user } = await render(
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    it('prop: defaultValue', async () => {
      const { user } = await render(
        <ToggleGroup defaultValue={['two']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');
    });

    it('when Toggles omit value', async () => {
      const { user } = await render(
        <ToggleGroup>
          <Toggle />
          <Toggle value="" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'false');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await user.click(button1);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('should warn if Toggle value is not set and ToggleGroup value is defined', async () => {
      vi.spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      await render(
        <ToggleGroup defaultValue={['one']}>
          <Toggle />
          <Toggle />
        </ToggleGroup>,
      );

      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        'Vase UI: A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop. This will cause issues between the Toggle Group and Toggle values. Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
      );
    });
  });

  describe('controlled', () => {
    it('pressed state', async () => {
      const { setProps } = await render(
        <ToggleGroup value={['two']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');

      await setProps({ value: ['one'] });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await setProps({ value: ['two'] });

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    it('prop: value', async () => {
      const { setProps } = await render(
        <ToggleGroup value={['two']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await setProps({ value: ['one'] });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('prop: disabled', () => {
    it('can disable the whole group', async () => {
      await render(
        <ToggleGroup disabled>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-disabled', 'true');
      expect(button1).toHaveAttribute('data-disabled');
      expect(button2).toHaveAttribute('aria-disabled', 'true');
      expect(button2).toHaveAttribute('data-disabled');
    });

    it('can disable individual items', async () => {
      await render(
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" disabled />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-disabled', 'false');
      expect(button1).not.toHaveAttribute('data-disabled');
      expect(button2).toHaveAttribute('aria-disabled', 'true');
      expect(button2).toHaveAttribute('data-disabled');
    });
  });

  describe('prop: orientation', () => {
    it('vertical', async () => {
      await render(
        <ToggleGroup orientation="vertical">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const group = screen.queryByRole('group');
      expect(group).toHaveAttribute('data-orientation', 'vertical');
    });

    it('does not render aria-orientation on role="group"', async () => {
      await render(
        <ToggleGroup orientation="horizontal">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const group = screen.queryByRole('group');
      expect(group).not.toHaveAttribute('aria-orientation');
    });
  });

  describe('prop: multiple', () => {
    it('sets data-multiple only when true', async () => {
      const { setProps } = await render(
        <ToggleGroup>
          <Toggle value="one" />
        </ToggleGroup>,
      );

      const group = screen.getByRole('group');
      expect(group).not.toHaveAttribute('data-multiple');

      await setProps({ multiple: true });
      expect(group).toHaveAttribute('data-multiple');

      await setProps({ multiple: false });
      expect(group).not.toHaveAttribute('data-multiple');
    });

    it('multiple items can be pressed when true', async () => {
      const { user } = await render(
        <ToggleGroup multiple defaultValue={['one']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('only one item can be pressed when false', async () => {
      const { user } = await render(
        <ToggleGroup defaultValue={['one']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('when Toggles omit value', async () => {
      const { user } = await render(
        <ToggleGroup multiple>
          <Toggle value="" />
          <Toggle />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'false');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await user.click(button1);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      await user.click(button1);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe.skipIf(isJSDOM)('prop: multiple transitions', () => {
    // Base UI has the rows `standalone` and `nested in Toolbar.Group`, with `%s` in the title.
    it.each([
      { name: 'standalone', inToolbar: false },
      { name: 'in Toolbar.Root', inToolbar: true },
    ])('keeps the selection and the roving focus when $name', async ({ inToolbar }) => {
      const TestToggleGroup = defineComponent(
        (props: { multiple: boolean }) => () => {
          const group = (
            <ToggleGroup
              data-testid="toggle-group"
              defaultValue={['one']}
              multiple={props.multiple}
            >
              <Toggle value="one">One</Toggle>
              <Toggle value="two">Two</Toggle>
            </ToggleGroup>
          );

          return inToolbar ? <Toolbar.Root>{group}</Toolbar.Root> : group;
        },
        { props: ['multiple'] },
      );

      const { user, setProps } = await render(<TestToggleGroup multiple={false} />);
      const group = screen.getByTestId('toggle-group');
      const [button1, button2] = screen.getAllByRole('button');

      expect(group).not.toHaveAttribute('data-multiple');
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.keyboard('[Tab][ArrowRight]');
      expect(button2).toHaveFocus();

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      await setProps({ multiple: true });
      expect(group).toHaveAttribute('data-multiple');

      await user.click(button1);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await setProps({ multiple: false });
      expect(group).not.toHaveAttribute('data-multiple');

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      await user.keyboard('[ArrowLeft]');
      expect(button1).toHaveFocus();
    });
  });

  describe.skipIf(isJSDOM)('keyboard interactions', () => {
    const arrowKeyCases: Array<{
      direction: TextDirection;
      orientation: Orientation;
      nextKey: string;
      prevKey: string;
      ignoredNextKey: string;
      ignoredPrevKey: string;
    }> = [
      {
        direction: 'ltr',
        orientation: 'horizontal',
        nextKey: 'ArrowRight',
        prevKey: 'ArrowLeft',
        ignoredNextKey: 'ArrowDown',
        ignoredPrevKey: 'ArrowUp',
      },
      {
        direction: 'ltr',
        orientation: 'vertical',
        nextKey: 'ArrowDown',
        prevKey: 'ArrowUp',
        ignoredNextKey: 'ArrowRight',
        ignoredPrevKey: 'ArrowLeft',
      },
      {
        direction: 'rtl',
        orientation: 'horizontal',
        nextKey: 'ArrowLeft',
        prevKey: 'ArrowRight',
        ignoredNextKey: 'ArrowDown',
        ignoredPrevKey: 'ArrowUp',
      },
      {
        direction: 'rtl',
        orientation: 'vertical',
        nextKey: 'ArrowDown',
        prevKey: 'ArrowUp',
        ignoredNextKey: 'ArrowLeft',
        ignoredPrevKey: 'ArrowRight',
      },
    ];

    it.each(arrowKeyCases)(
      '$direction, orientation: $orientation moves focus with arrow keys',
      async ({ direction, orientation, nextKey, prevKey, ignoredNextKey, ignoredPrevKey }) => {
        const { user } = await render(
          <DirectionProvider direction={direction}>
            <ToggleGroup orientation={orientation}>
              <Toggle value="one" />
              <Toggle value="two" />
              <Toggle value="three" />
            </ToggleGroup>
          </DirectionProvider>,
        );

        const [button1, button2, button3] = screen.getAllByRole('button');

        await user.keyboard('[Tab]');

        expect(button1).toHaveAttribute('tabindex', '0');
        expect(button1).toHaveFocus();

        await user.keyboard(`[${nextKey}]`);

        expect(button2).toHaveAttribute('tabindex', '0');
        expect(button2).toHaveFocus();

        await user.keyboard(`[${nextKey}]`);

        expect(button3).toHaveAttribute('tabindex', '0');
        expect(button3).toHaveFocus();

        // loop to the beginning
        await user.keyboard(`[${nextKey}]`);

        expect(button1).toHaveAttribute('tabindex', '0');
        expect(button1).toHaveFocus();

        await user.keyboard(`[${prevKey}]`);

        expect(button3).toHaveAttribute('tabindex', '0');
        expect(button3).toHaveFocus();

        await user.keyboard(`[${prevKey}]`);

        expect(button2).toHaveAttribute('tabindex', '0');
        expect(button2).toHaveFocus();

        // keys from the other axis should not move focus
        await user.keyboard(`[${ignoredNextKey}]`);

        expect(button2).toHaveAttribute('tabindex', '0');
        expect(button2).toHaveFocus();

        await user.keyboard(`[${ignoredPrevKey}]`);

        expect(button2).toHaveAttribute('tabindex', '0');
        expect(button2).toHaveFocus();
      },
    );

    it('Home key moves focus to the first item', async () => {
      const { user } = await render(
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>,
      );

      const [button1, button2, button3] = screen.getAllByRole('button');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight][ArrowRight]');
      expect(button3).toHaveFocus();

      await user.keyboard('[Home]');
      expect(button1).toHaveAttribute('tabindex', '0');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(button2).toHaveFocus();

      await user.keyboard('[Home]');
      expect(button1).toHaveAttribute('tabindex', '0');
      expect(button1).toHaveFocus();
    });

    it('End key moves focus to the last item', async () => {
      const { user } = await render(
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>,
      );

      const [button1, button2, button3] = screen.getAllByRole('button');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[End]');
      expect(button3).toHaveAttribute('tabindex', '0');
      expect(button3).toHaveFocus();

      await user.keyboard('[ArrowLeft]');
      expect(button2).toHaveFocus();

      await user.keyboard('[End]');
      expect(button3).toHaveAttribute('tabindex', '0');
      expect(button3).toHaveFocus();
    });

    it.each([{ key: 'Enter' }, { key: 'Space' }])(
      'key: $key toggles the pressed state',
      async ({ key }) => {
        const { user } = await render(
          <ToggleGroup>
            <Toggle value="one" />
            <Toggle value="two" />
          </ToggleGroup>,
        );

        const [button1] = screen.getAllByRole('button');

        expect(button1).toHaveAttribute('aria-pressed', 'false');

        button1.focus();
        await flushMicrotasks();

        await user.keyboard(`[${key}]`);

        expect(button1).toHaveAttribute('aria-pressed', 'true');

        await user.keyboard(`[${key}]`);

        expect(button1).toHaveAttribute('aria-pressed', 'false');
      },
    );
  });

  describe('prop: onValueChange', () => {
    it('fires when an Item is clicked', async () => {
      const onValueChange = vi.fn();

      const { user } = await render(
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(onValueChange.mock.calls.length).toBe(0);

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(['one']);

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(['two']);
    });

    it('does not change the value when the event is canceled', async () => {
      const onValueChange = vi.fn((_value, eventDetails) => {
        eventDetails.cancel();
      });

      const { user } = await render(
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1] = screen.getAllByRole('button');

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    it.skipIf(isJSDOM).each([{ key: 'Enter' }, { key: 'Space' }])(
      'fires when the $key is pressed',
      async ({ key }) => {
        const onValueChange = vi.fn();

        const { user } = await render(
          <ToggleGroup onValueChange={onValueChange}>
            <Toggle value="one" />
            <Toggle value="two" />
          </ToggleGroup>,
        );

        const [button1, button2] = screen.getAllByRole('button');

        expect(onValueChange.mock.calls.length).toBe(0);

        button1.focus();
        await flushMicrotasks();

        await user.keyboard(`[${key}]`);

        expect(onValueChange.mock.calls.length).toBe(1);
        expect(onValueChange.mock.calls[0][0]).toEqual(['one']);

        button2.focus();
        await flushMicrotasks();

        await user.keyboard(`[${key}]`);

        expect(onValueChange.mock.calls.length).toBe(2);
        expect(onValueChange.mock.calls[1][0]).toEqual(['two']);
      },
    );
  });

  describe('emits', () => {
    it('emits pressedChange, valueChange, update:value and update:pressed in this sequence', async () => {
      const calls: unknown[][] = [];

      await render(
        <ToggleGroup
          onValueChange={(value, eventDetails) => {
            calls.push(['valueChange', value, eventDetails.reason, eventDetails.event.type]);
          }}
          {...{ 'onUpdate:value': (value: string[]) => calls.push(['update:value', value]) }}
        >
          <Toggle
            value="one"
            onPressedChange={(pressed) => calls.push(['pressedChange', pressed])}
            {...{
              'onUpdate:pressed': (pressed: boolean) => calls.push(['update:pressed', pressed]),
            }}
          />
        </ToggleGroup>,
      );

      screen.getByRole('button').click();
      await flushMicrotasks();

      expect(calls).toEqual([
        ['pressedChange', true],
        ['valueChange', ['one'], 'none', 'click'],
        ['update:value', ['one']],
        ['update:pressed', true],
      ]);
    });

    it('emits no update event when valueChange is canceled', async () => {
      const handleUpdate = vi.fn();

      await render(
        <ToggleGroup
          onValueChange={(_value, eventDetails) => {
            eventDetails.cancel();
          }}
          {...{ 'onUpdate:value': handleUpdate }}
        >
          <Toggle value="one" {...{ 'onUpdate:pressed': handleUpdate }} />
        </ToggleGroup>,
      );

      screen.getByRole('button').click();
      await flushMicrotasks();

      expect(handleUpdate).toHaveBeenCalledTimes(0);
    });
  });

  describe('prop: loopFocus', () => {
    it('stops at the two ends when loopFocus is false', async () => {
      const { user } = await render(
        <ToggleGroup loopFocus={false}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowLeft]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight][ArrowRight]');
      expect(button2).toHaveFocus();
    });
  });

  describe('listeners of the consumer', () => {
    it('runs a keydown listener of the consumer first, and the listener can stop the navigation', async () => {
      const { user } = await render(
        <ToggleGroup onKeydown={(event) => event.preventVaseUIHandler()}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1] = screen.getAllByRole('button');

      await user.keyboard('[Tab][ArrowRight]');

      expect(button1).toHaveFocus();
    });
  });

  describe('in a toolbar', () => {
    it('is not a second composite root: the toolbar has one tab stop and its keys move through the toggles', async () => {
      const { user, container } = await render(
        <Toolbar.Root>
          <Toolbar.Button data-testid="before" />
          <ToggleGroup orientation="vertical" loopFocus={false}>
            <Toggle value="a" data-testid="a" />
            <Toggle value="b" data-testid="b" />
          </ToggleGroup>
        </Toolbar.Root>,
      );

      expect(readTabindexes(container)).toEqual(['0', '-1', '-1', null, null]);

      await user.keyboard('[Tab][ArrowRight]');
      expect(screen.getByTestId('a')).toHaveFocus();

      // The toolbar owns the keys: its orientation and its `loopFocus` apply.
      await user.keyboard('[ArrowDown]');
      expect(screen.getByTestId('a')).toHaveFocus();

      await user.keyboard('[ArrowRight][ArrowRight]');
      expect(screen.getByTestId('before')).toHaveFocus();
      expect(readTabindexes(container)).toEqual(['0', '-1', '-1', null, null]);
    });

    const DisabledToolbarGroup = defineComponent((_, { slots }) => {
      provide(ToolbarGroupContext, { disabled: computed(() => true) });
      return () => slots.default?.();
    });

    it.each([
      { name: 'the toolbar', toolbarDisabled: true, Wrapper: 'div' },
      { name: 'a group of the toolbar', toolbarDisabled: false, Wrapper: DisabledToolbarGroup },
    ])('takes the disabled state of $name', async ({ toolbarDisabled, Wrapper }) => {
      await render(
        <Toolbar.Root disabled={toolbarDisabled}>
          <Wrapper>
            <ToggleGroup>
              <Toggle value="one" />
            </ToggleGroup>
          </Wrapper>
        </Toolbar.Root>,
      );

      expect(screen.getByRole('group')).toHaveAttribute('data-disabled');
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'a group', props: {}, tabindexes: [null, '0', '-1', '-1', null] },
      {
        name: 'a group with a pressed toggle',
        props: { defaultValue: ['b'] },
        tabindexes: [null, '0', '-1', '-1', null],
      },
      {
        name: 'a group whose first toggle is disabled',
        props: { firstDisabled: true },
        tabindexes: [null, '-1', '0', '-1', null],
      },
      {
        name: 'a group in a toolbar',
        props: { toolbar: true },
        tabindexes: ['0', '-1', '-1', '-1', '-1'],
      },
      {
        name: 'a group in a disabled toolbar',
        props: { toolbar: true, toolbarDisabled: true },
        tabindexes: ['0', '-1', '-1', '-1', '-1'],
      },
    ])('hydrates $name with no mismatch and keeps the tab stop', async ({ props, tabindexes }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      expect(readTabindexes(parse(serverHtml))).toEqual(tabindexes);

      const { container } = await hydrate(ToggleGroupHydration, { serverHtml, props });

      expect(readTabindexes(container)).toEqual(tabindexes);
    });
  });
});
