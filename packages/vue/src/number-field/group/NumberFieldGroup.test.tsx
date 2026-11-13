import { describe, expect, it } from 'vitest';
import { NumberField } from '@vase-ui/vue/number-field';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';

describe('<NumberField.Group />', () => {
  const { render } = createRenderer();

  describeConformance(<NumberField.Group />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<NumberField.Root>{node}</NumberField.Root>);
    },
  }));

  it('has role prop', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Group />
      </NumberField.Root>,
    );
    expect(screen.queryByRole('group')).not.toBe(null);
  });

  it('has the state attributes of the root', async () => {
    await render(
      <NumberField.Root disabled readOnly required>
        <NumberField.Group />
      </NumberField.Root>,
    );

    expect(screen.getByRole('group')).toHaveAttribute('data-disabled');
    expect(screen.getByRole('group')).toHaveAttribute('data-readonly');
    expect(screen.getByRole('group')).toHaveAttribute('data-required');
  });

  it('throws a descriptive error when rendered outside <NumberField.Root>', async () => {
    await expect(render(<NumberField.Group />)).rejects.toThrow(
      'Vase UI: A part of Number Field must be inside <NumberField.Root>. Without a root the part has no value to show. Put the part inside <NumberField.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
