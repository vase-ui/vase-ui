import { expect, vi, describe, it } from 'vitest';
import { Accordion } from '@vase-ui/vue/accordion';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  describeConformance,
  createRenderer,
  isJSDOM,
  screen,
  takeReportedMessages,
} from '#test-utils';

type RenderArguments = { props: HTMLProps; state: Accordion.Item.State };

describe('<Accordion.Item />', () => {
  const { render } = createRenderer();

  describeConformance(<Accordion.Item />, () => ({
    render: (node) => {
      return render(<Accordion.Root>{node}</Accordion.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  describe('state', () => {
    it.skipIf(isJSDOM)(
      'does not report hidden=true after the item has started opening',
      async () => {
        const renderSpy = vi.fn();
        const { user } = await render(
          <Accordion.Root>
            <Accordion.Item
              v-slots={{
                render: ({ props, state }: RenderArguments) => {
                  renderSpy(state);
                  return (
                    <div {...props}>
                      <Accordion.Header>
                        <Accordion.Trigger>Trigger</Accordion.Trigger>
                      </Accordion.Header>
                      <Accordion.Panel>Panel</Accordion.Panel>
                    </div>
                  );
                },
              }}
            />
          </Accordion.Root>,
        );

        await user.click(screen.getByRole('button', { name: 'Trigger' }));

        expect(
          renderSpy.mock.calls.some(([state]) => state.open === true && state.hidden === true),
        ).toBe(false);
      },
    );
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws when rendered outside an Accordion.Root', async () => {
    await expect(render(<Accordion.Item />)).rejects.toThrow(
      'Vase UI: A part of Accordion must be inside <Accordion.Root>. Without a root the part has no value to read. Put the part inside <Accordion.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
