import { expect, vi, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Toggle } from '@vase-ui/vue/toggle';
import { Toolbar } from '@vase-ui/vue/toolbar';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
} from '#test-utils';
import { ToggleGroup } from '../toggle-group';
import ToggleHydration from './ToggleHydration.test.vue';

describe('<Toggle />', () => {
  const { render } = createRenderer();

  describeConformance(<Toggle />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render,
  }));

  describe('pressed state', () => {
    it('controlled', async () => {
      const App = defineComponent(() => {
        const pressed = shallowRef(false);
        return () => (
          <div>
            <input
              type="checkbox"
              checked={pressed.value}
              onChange={() => {
                pressed.value = !pressed.value;
              }}
            />
            <Toggle pressed={pressed.value} />;
          </div>
        );
      });

      await render(<App />);
      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-pressed', 'false');
      checkbox.click();
      await flushMicrotasks();

      expect(button).toHaveAttribute('aria-pressed', 'true');

      checkbox.click();
      await flushMicrotasks();

      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('uncontrolled', async () => {
      await render(<Toggle defaultPressed={false} />);

      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-pressed', 'false');
      button.click();
      await flushMicrotasks();

      expect(button).toHaveAttribute('aria-pressed', 'true');

      button.click();
      await flushMicrotasks();

      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('prop: onPressedChange', () => {
    it('is called when the pressed state changes', async () => {
      const handlePressed = vi.fn();

      await render(<Toggle defaultPressed={false} onPressedChange={handlePressed} />);

      const button = screen.getByRole('button');

      button.click();
      await flushMicrotasks();

      expect(handlePressed.mock.calls.length).toBe(1);
      expect(handlePressed.mock.calls[0][0]).toBe(true);
    });

    it('does not change the pressed state when the event is canceled', async () => {
      await render(
        <Toggle
          defaultPressed={false}
          onPressedChange={(_pressed, eventDetails) => {
            eventDetails.cancel();
          }}
        />,
      );

      const button = screen.getByRole('button');

      button.click();
      await flushMicrotasks();

      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('emits pressedChange with the details and then update:pressed', async () => {
      const calls: unknown[][] = [];

      await render(
        <Toggle
          onPressedChange={(pressed, eventDetails) => {
            calls.push(['pressedChange', pressed, eventDetails.reason, eventDetails.event.type]);
          }}
          {...{ 'onUpdate:pressed': (pressed: boolean) => calls.push(['update:pressed', pressed]) }}
        />,
      );

      screen.getByRole('button').click();
      await flushMicrotasks();

      expect(calls).toEqual([
        ['pressedChange', true, 'none', 'click'],
        ['update:pressed', true],
      ]);
    });

    it('does not emit update:pressed when the event is canceled', async () => {
      const handleUpdate = vi.fn();

      await render(
        <Toggle
          onPressedChange={(_pressed, eventDetails) => {
            eventDetails.cancel();
          }}
          {...{ 'onUpdate:pressed': handleUpdate }}
        />,
      );

      screen.getByRole('button').click();
      await flushMicrotasks();

      expect(handleUpdate).toHaveBeenCalledTimes(0);
    });

    it('canceling in a grouped Toggle prevents the group value from changing', async () => {
      const onValueChange = vi.fn();

      await render(
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle
            value="one"
            onPressedChange={(_pressed, eventDetails) => {
              eventDetails.cancel();
            }}
          />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1] = screen.getAllByRole('button');

      button1.click();
      await flushMicrotasks();

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(onValueChange.mock.calls.length).toBe(0);
    });
  });

  describe('prop: disabled', () => {
    it('disables the component', async () => {
      const handlePressed = vi.fn();
      await render(<Toggle disabled onPressedChange={handlePressed} />);

      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).toHaveAttribute('aria-pressed', 'false');

      button.click();
      await flushMicrotasks();

      expect(handlePressed.mock.calls.length).toBe(0);
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('prop: render', () => {
    it('should pass composite props', async () => {
      const renderSpy = vi.fn();

      function ToggleRenderComponent({ renderProps }: { renderProps: Record<string, unknown> }) {
        renderSpy(renderProps);
        return <button type="button" {...renderProps} />;
      }

      await render(
        <ToggleGroup defaultValue={['left']}>
          <Toggle
            value="left"
            v-slots={{
              render: ({ props }: { props: Record<string, unknown> }) => (
                <ToggleRenderComponent renderProps={props} />
              ),
            }}
          />
        </ToggleGroup>,
      );

      expect(renderSpy.mock.lastCall?.[0]).toHaveProperty('tabindex', 0);
    });
  });

  describe('prop: value', () => {
    it('gives each toggle with an empty value a generated value of its own', async () => {
      await render(
        <ToggleGroup multiple>
          <Toggle value="" />
          <Toggle value="" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      button1.click();
      await flushMicrotasks();

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');
    });

    it('reports a toggle in a group with a value when its own value goes away', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      const { rerender } = await render(
        <ToggleGroup defaultValue={['one']}>
          <Toggle value="one" />
        </ToggleGroup>,
      );

      expect(errorSpy).toHaveBeenCalledTimes(0);

      await rerender(
        <ToggleGroup defaultValue={['one']}>
          <Toggle />
        </ToggleGroup>,
      );

      expect(errorSpy).toHaveBeenCalledExactlyOnceWith(
        'Vase UI: A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop. This will cause issues between the Toggle Group and Toggle values. Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
      );
    });
  });

  describe('attributes and listeners of the consumer', () => {
    it('does not give `type` and `form` to the button', async () => {
      await render(<Toggle type="submit" form="settings" />);

      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('type', 'button');
      expect(button).not.toHaveAttribute('form');
    });

    it('runs a click listener of the consumer first, and the listener can stop the change', async () => {
      await render(<Toggle onClick={(event) => event.preventVaseUIHandler()} />);

      const button = screen.getByRole('button');

      button.click();
      await flushMicrotasks();

      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('in a toolbar', () => {
    it('gives the toolbar the metadata of a disabled toggle that is not a native button', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <ToggleGroup>
            <Toggle value="one" data-testid="one" />
            <Toggle value="two" data-testid="two" disabled as="span" nativeButton={false} />
            <Toggle value="three" data-testid="three" />
          </ToggleGroup>
        </Toolbar.Root>,
      );

      await user.keyboard('[Tab]');
      expect(screen.getByTestId('one')).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(screen.getByTestId('three')).toHaveFocus();
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'a toggle', props: {} },
      { name: 'a pressed toggle', props: { defaultPressed: true } },
      { name: 'a disabled toggle', props: { disabled: true } },
    ])('hydrates $name with no mismatch', async ({ props }) => {
      const serverHtml = await renderOnServer('src/toggle/ToggleHydration.test.vue', props);

      await hydrate(ToggleHydration, { serverHtml, props });
    });
  });
});
