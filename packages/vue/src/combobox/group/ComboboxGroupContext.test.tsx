import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, takeReportedMessages } from '#test-utils';
import { useComboboxGroupContext } from './ComboboxGroupContext';

describe('ComboboxGroupContext', () => {
  const { render } = createRenderer();

  // A case that throws in `setup` is the last case of its file.
  it('throws a descriptive error when used outside <Combobox.Group>', async () => {
    const Consumer = defineComponent(() => {
      useComboboxGroupContext();
      return () => null;
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(render(<Consumer />)).rejects.toThrow(
        'Vase UI: <Combobox.GroupLabel> must be inside <Combobox.Group>. Without a group the label has no group to name. Put the part inside <Combobox.Group>.',
      );
    } finally {
      errorSpy.mockRestore();
    }

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
