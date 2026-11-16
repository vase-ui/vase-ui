import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, takeReportedMessages } from '#test-utils';
import { useComboboxItemContext } from './ComboboxItemContext';

describe('ComboboxItemContext', () => {
  const { render } = createRenderer();

  // A case that throws in `setup` is the last case of its file.
  it('throws a descriptive error when used outside <Combobox.Item>', async () => {
    const Consumer = defineComponent(() => {
      useComboboxItemContext();
      return () => null;
    });

    await expect(render(<Consumer />)).rejects.toThrow(
      'Vase UI: <Combobox.ItemIndicator> must be inside <Combobox.Item>. Without an item the indicator has no selected state. Put the part inside <Combobox.Item>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
