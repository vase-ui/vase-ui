import { expect, describe, it } from 'vitest';
import type { FunctionalComponent } from 'vue';
import { Tooltip } from '@vase-ui/vue/tooltip';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  positionerConformanceTests,
  screen,
  takeReportedMessages,
  isVaporApp,
  isVaporParts,
} from '#test-utils';
import { isVueMinor } from '../../../test/vaporParts/isVueMinor';

const Trigger: FunctionalComponent<Tooltip.Trigger.Props> = (props, { slots }) => (
  <Tooltip.Trigger {...props} as="div">
    {slots.default?.()}
  </Tooltip.Trigger>
);

describe('<Tooltip.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(<Tooltip.Positioner />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Tooltip.Root open>
          <Tooltip.Portal>{node}</Tooltip.Portal>
        </Tooltip.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  describe('prop: side', () => {
    it('uses the side prop over the default', async () => {
      await render(
        <Tooltip.Root open>
          <Trigger>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner data-testid="positioner" side="bottom" />
          </Tooltip.Portal>
        </Tooltip.Root>,
      );
      await flushMicrotasks();

      expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'bottom');
    });
  });

  positionerConformanceTests({
    render,
    viewport: true,
    defaultSide: 'top',
    defaultCollisionAvoidance: 'popup',
    createComponent: ({
      root,
      trigger,
      positioner: { render: renderPositioner, ...positioner },
      popup,
      viewport,
    }) => (
      <Tooltip.Root {...root}>
        <Trigger {...trigger}>Trigger</Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner
            {...positioner}
            v-slots={renderPositioner ? { render: renderPositioner } : undefined}
          >
            <Tooltip.Popup {...popup}>
              {viewport ? <Tooltip.Viewport>Popup</Tooltip.Viewport> : 'Popup'}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ),
  });

  // In Vue 3.5.12, a `setup` that throws leaves the current instance set, and a later case of the
  // file can then get a warning about a slot. The case that renders no slot thus comes last.
  it('throws a descriptive error when rendered outside <Tooltip.Portal>', async () => {
    await expect(
      render(
        <Tooltip.Root open>
          <Tooltip.Positioner />
        </Tooltip.Root>,
      ),
    ).rejects.toThrow('Vase UI: <Tooltip.Positioner> must be inside <Tooltip.Portal>.');
    expect(takeReportedMessages()).toHaveLength(1);
  });

  // On Vue 3.6.0-rc.15, a Vapor app takes the instance left by the earlier setup error as
  // its root's parent. The virtual DOM part then finds the earlier root.
  it(
    'throws a descriptive error when rendered outside <Tooltip.Root>',
    { fails: isVaporApp && !isVaporParts && !isVueMinor },
    async () => {
      await expect(render(<Tooltip.Positioner />)).rejects.toThrow(
        'Vase UI: A part of Tooltip must be inside <Tooltip.Root>.',
      );
      expect(takeReportedMessages()).toHaveLength(1);
    },
  );
});
