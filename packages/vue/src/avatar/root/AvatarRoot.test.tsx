import { describe, expect, it } from 'vitest';
import { Avatar } from '@vase-ui/vue/avatar';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';

describe('<Avatar.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Avatar.Root />, () => ({
    render,
    refInstanceof: window.HTMLSpanElement,
  }));

  it('exposes the image error through the slot and the image attribute', async () => {
    const { container } = await render(
      <Avatar.Root>
        <Avatar.Image keepMounted data-testid="image" />
        <Avatar.Fallback
          v-slots={{
            default: ({ state }: { state: Avatar.Fallback.State }) => state.imageLoadingStatus,
          }}
        />
      </Avatar.Root>,
    );
    expect(screen.getByText('error')).toBeVisible();
    expect(screen.getByTestId('image')).toHaveAttribute('data-error');
    expect(container.querySelector('[data-imageloadingstatus]')).toBeNull();
  });

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
