import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, takeReportedMessages } from '#test-utils';
import { useComboboxPositionerContext } from './ComboboxPositionerContext';

describe('ComboboxPositionerContext', () => {
  const { render } = createRenderer();

  // A case that throws in `setup` is the last case of its file.
  it('throws a descriptive error when a required consumer is outside the positioner', async () => {
    const Consumer = defineComponent(() => {
      useComboboxPositionerContext();
      return () => null;
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(render(<Consumer />)).rejects.toThrow(
        'Vase UI: <Combobox.Popup> and <Combobox.Arrow> must be inside <Combobox.Positioner>. Without a positioner they have no side and no alignment. Put them inside <Combobox.Positioner>.',
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
