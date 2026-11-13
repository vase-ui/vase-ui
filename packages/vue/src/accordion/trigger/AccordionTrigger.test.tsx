import { expect, describe, it } from 'vitest';
import { Accordion } from '@vase-ui/vue/accordion';
import { describeConformance, createRenderer, screen } from '#test-utils';

describe('<Accordion.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Accordion.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render: (node) =>
      render(
        <Accordion.Root>
          <Accordion.Item>{node}</Accordion.Item>
        </Accordion.Root>,
      ),
  }));

  it('removes a disabled non-native trigger from the tab order', async () => {
    const { user } = await render(
      <Accordion.Root>
        <Accordion.Item disabled>
          <Accordion.Header>
            <Accordion.Trigger nativeButton={false} as="span">
              Trigger
            </Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(trigger).toHaveAttribute('tabindex', '-1');
    expect(trigger).not.toHaveAttribute('disabled');

    await user.keyboard('[Tab]');
    expect(trigger).not.toHaveFocus();
  });

  it.each([
    { name: 'the root', root: true, item: false, trigger: false },
    { name: 'the item', root: false, item: true, trigger: false },
    { name: 'the trigger', root: false, item: false, trigger: true },
  ])('is disabled when $name is disabled', async ({ root, item, trigger: own }) => {
    await render(
      <Accordion.Root disabled={root}>
        <Accordion.Item disabled={item}>
          <Accordion.Header>
            <Accordion.Trigger disabled={own}>Trigger</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('data-disabled');
    // The header has the state of the item, and the item does not read the trigger.
    expect(trigger.parentElement!.hasAttribute('data-disabled')).toBe(root || item);
  });

  it('renders data-index on every trigger including the first', async () => {
    await render(
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger>first</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger>second</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const triggers = screen.getAllByRole('button');
    expect(triggers[0]).toHaveAttribute('data-index', '0');
    expect(triggers[1]).toHaveAttribute('data-index', '1');
  });
});
