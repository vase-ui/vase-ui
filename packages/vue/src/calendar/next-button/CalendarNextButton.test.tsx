import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';

describe('<Calendar.NextButton />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.NextButton />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render: (node) => render(<CalendarAncestors level="root">{node}</CalendarAncestors>),
  }));

  it('leaves the tab order and ignores a press when its prop disables it', async () => {
    const { user } = await render(
      <CalendarAncestors level="root">
        <Calendar.NextButton disabled data-testid="button" />
      </CalendarAncestors>,
    );
    const button = screen.getByTestId('button');

    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-disabled');
    expect(button).not.toHaveAttribute('aria-disabled');
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <Calendar.Root>', async () => {
    await expect(render(<Calendar.NextButton />)).rejects.toThrow(
      'Vase UI: A part of Calendar must be inside <Calendar.Root>. Without a root the part has no days and no selection to show. Put the part inside <Calendar.Root>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
