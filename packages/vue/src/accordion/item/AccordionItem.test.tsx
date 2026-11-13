import { expect, describe, it } from 'vitest';
import { Accordion } from '@vase-ui/vue/accordion';
import { describeConformance, createRenderer, takeReportedMessages } from '#test-utils';

describe('<Accordion.Item />', () => {
  const { render } = createRenderer();

  describeConformance(<Accordion.Item />, () => ({
    render: (node) => {
      return render(<Accordion.Root>{node}</Accordion.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  // This case is the last one of the file. In Vue 3.5.0, a `setup` that throws leaves the current
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
