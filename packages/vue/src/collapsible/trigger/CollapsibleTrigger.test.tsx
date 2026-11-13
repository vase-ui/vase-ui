import { expect, vi, describe, it } from 'vitest';
import { Collapsible } from '@vase-ui/vue/collapsible';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';

describe('<Collapsible.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Collapsible.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render: (node) => render(<Collapsible.Root>{node}</Collapsible.Root>),
  }));

  it('renders the disabled attribute when disabled', async () => {
    await render(
      <Collapsible.Root disabled>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      </Collapsible.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toBeDisabled();
    expect(trigger).not.toHaveAttribute('aria-disabled');
  });

  it('stays disabled when the root is disabled and `disabled={false}` is passed', async () => {
    const onOpenChange = vi.fn();
    const { user } = await render(
      <Collapsible.Root disabled onOpenChange={onOpenChange}>
        <Collapsible.Trigger disabled={false}>Trigger</Collapsible.Trigger>
      </Collapsible.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toBeDisabled();

    await user.click(trigger);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('adds data-disabled when only the trigger is disabled', async () => {
    await render(
      <Collapsible.Root>
        <Collapsible.Trigger disabled>Trigger</Collapsible.Trigger>
      </Collapsible.Root>,
    );

    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute('data-disabled');
  });

  it('removes a disabled non-native trigger from the tab order', async () => {
    const { user } = await render(
      <Collapsible.Root disabled>
        <Collapsible.Trigger nativeButton={false} as="span">
          Trigger
        </Collapsible.Trigger>
      </Collapsible.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(trigger).toHaveAttribute('tabindex', '-1');
    expect(trigger).not.toHaveAttribute('disabled');

    await user.keyboard('[Tab]');
    expect(trigger).not.toHaveFocus();
  });

  it('forwards the id prop', async () => {
    await render(
      <Collapsible.Root>
        <Collapsible.Trigger id="custom-trigger-id">Trigger</Collapsible.Trigger>
      </Collapsible.Root>,
    );

    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
      'id',
      'custom-trigger-id',
    );
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws when rendered outside a Collapsible.Root', async () => {
    await expect(render(<Collapsible.Trigger />)).rejects.toThrow(
      'Vase UI: A part of Collapsible must be inside <Collapsible.Root>. Without a root the part has no open state to read. Put the part inside <Collapsible.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
