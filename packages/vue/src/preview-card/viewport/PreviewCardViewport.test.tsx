import { expect, describe, it } from 'vitest';
import * as PreviewCard from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  takeReportedMessages,
  viewportConformanceTests,
} from '#test-utils';

describe('<PreviewCard.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(<PreviewCard.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <PreviewCard.Root open>
          <PreviewCard.Trigger>Trigger</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>{node}</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  viewportConformanceTests({
    render,
    openOn: 'focus',
    createComponent: ({ root, triggers, portal, positioner, popup, viewport, renderContent }) => (
      <PreviewCard.Root {...root}>
        {{
          default: ({ payload }: { payload: unknown }) => [
            ...triggers.map(({ key, children, ...triggerProps }, index) => (
              <PreviewCard.Trigger key={key ?? index} href="#" delay={0} {...triggerProps}>
                {children}
              </PreviewCard.Trigger>
            )),
            <PreviewCard.Portal {...portal}>
              <PreviewCard.Positioner {...positioner}>
                <PreviewCard.Popup {...popup}>
                  <PreviewCard.Viewport {...viewport}>
                    {renderContent(payload)}
                  </PreviewCard.Viewport>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>,
          ],
        }}
      </PreviewCard.Root>
    ),
  });

  it('throws a descriptive error when rendered outside <PreviewCard.Positioner>', async () => {
    await expect(
      render(
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Viewport />
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A popup, an arrow or a viewport of PreviewCard must be inside <PreviewCard.Positioner>.',
    );
    // The portal renders its content in an update after the mount, so Vue also warns about it.
    expect(takeReportedMessages()).toHaveLength(2);
  });
});
