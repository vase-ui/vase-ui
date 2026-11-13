import { expect, describe, it } from 'vitest';
import { Accordion } from '@vase-ui/vue/accordion';
import { describeConformance, createRenderer, takeReportedMessages } from '#test-utils';

describe('<Accordion.Header />', () => {
  const { render } = createRenderer();

  describeConformance(<Accordion.Header />, () => ({
    render: (node) =>
      render(
        <Accordion.Root>
          <Accordion.Item>{node}</Accordion.Item>
        </Accordion.Root>,
      ),
    refInstanceof: window.HTMLHeadingElement,
  }));

  // This case is the last one of the file. In Vue 3.5.0, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws when rendered outside an Accordion.Item', async () => {
    await expect(render(<Accordion.Header />)).rejects.toThrow(
      'Vase UI: A part of Accordion must be inside <Accordion.Item>. Without an item the part has no open state to read. Put the part inside <Accordion.Item>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
