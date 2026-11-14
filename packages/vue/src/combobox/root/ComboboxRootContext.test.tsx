import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, takeReportedMessages } from '#test-utils';
import { useComboboxDerivedItemsContext, useComboboxRootContext } from './ComboboxRootContext';

describe('ComboboxRootContext', () => {
  const { render } = createRenderer();

  const cases = [
    {
      name: 'useComboboxRootContext',
      useContext: useComboboxRootContext,
      message:
        'Vase UI: A part of Combobox must be inside <Combobox.Root>. Without a root the part has no combobox state. Put the part inside <Combobox.Root>.',
    },
    {
      name: 'useComboboxDerivedItemsContext',
      useContext: useComboboxDerivedItemsContext,
      message:
        'Vase UI: A part of Combobox must be inside <Combobox.Root>. Without a root the part has no filtered items. Put the part inside <Combobox.Root>.',
    },
  ];

  // A case that throws in `setup` is the last case of its file.
  it.each(cases)('$name throws when its provider is missing', async ({ useContext, message }) => {
    const Consumer = defineComponent(() => {
      useContext();
      return () => null;
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(render(<Consumer />)).rejects.toThrow(message);
    } finally {
      errorSpy.mockRestore();
    }

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
