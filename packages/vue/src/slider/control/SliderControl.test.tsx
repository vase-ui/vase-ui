import { expect, describe, it, onTestFinished, vi } from 'vitest';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';
import { ownerDocument } from '../../common/owner';
import * as Slider from '../index.parts';

// The mock calls through, so that a case can count the reads of the document.
vi.mock('../../common/owner', async () => {
  const actual = await vi.importActual<typeof import('../../common/owner')>('../../common/owner');
  return { ...actual, ownerDocument: vi.fn(actual.ownerDocument) };
});

describe('<Slider.Control />', () => {
  const { render } = createRenderer();

  describeConformance(<Slider.Control />, () => ({
    render: (node) => {
      return render(<Slider.Root>{node}</Slider.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  it('adds its touchstart listener as a passive listener', async () => {
    const addEventListener = vi.spyOn(EventTarget.prototype, 'addEventListener');
    onTestFinished(() => addEventListener.mockRestore());

    await render(
      <Slider.Root>
        <Slider.Control data-testid="control" />
      </Slider.Root>,
    );

    const control = screen.getByTestId('control');
    const touchstartOptions = addEventListener.mock.calls
      .filter(
        ([type], index) =>
          type === 'touchstart' && addEventListener.mock.contexts[index] === control,
      )
      .map(([, , options]) => options);

    expect(touchstartOptions).toEqual([{ passive: true }]);
  });

  // With Vue 3.6, a server also runs the cleanup of `onScopeDispose`, and a server has no document.
  it('reads no document when it unmounts with no gesture in progress', async () => {
    const { unmount } = await render(
      <Slider.Root>
        <Slider.Control />
      </Slider.Root>,
    );
    vi.mocked(ownerDocument).mockClear();

    unmount();

    expect(ownerDocument).not.toHaveBeenCalled();
  });

  it('throws a descriptive error when rendered outside <Slider.Root>', async () => {
    await expect(render(<Slider.Control />)).rejects.toThrow(
      'Vase UI: A part of Slider must be inside <Slider.Root>. Without a root the part has no value to show or to change. Put the part inside <Slider.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
