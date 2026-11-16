import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, takeReportedMessages } from '#test-utils';
import { useComboboxPortalContext } from './ComboboxPortalContext';

describe('ComboboxPortalContext', () => {
  const { render } = createRenderer();

  // A case that throws in `setup` is the last case of its file.
  it('throws a descriptive error when used outside <Combobox.Portal>', async () => {
    const Consumer = defineComponent(() => {
      useComboboxPortalContext();
      return () => null;
    });

    await expect(render(<Consumer />)).rejects.toThrow(
      'Vase UI: <Combobox.Portal> is missing. Without it the positioner cannot know if it stays mounted while the popup is closed. Put <Combobox.Positioner> inside <Combobox.Portal>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
