import { describe, expect, it } from 'vitest';
import { Avatar } from '@vase-ui/vue/avatar';
import { createRenderer, describeConformance, takeReportedMessages } from '#test-utils';

describe('<Avatar.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Avatar.Root />, () => ({
    render,
    refInstanceof: window.HTMLSpanElement,
  }));

  it('throws a descriptive error when rendered outside <Avatar.Root>', async () => {
    await expect(render(<Avatar.Fallback />)).rejects.toThrow(
      'Vase UI: A part of Avatar must be inside <Avatar.Root>. Without a root the part has no image status to read or to report. Put the part inside <Avatar.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
