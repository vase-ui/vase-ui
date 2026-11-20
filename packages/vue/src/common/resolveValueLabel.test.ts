import { expect, describe, it, vi } from 'vitest';
import {
  hasNullItemLabel,
  isGroupedItems,
  resolveMultipleLabels,
  resolveSelectedLabel,
  stringifyAsLabel,
} from './resolveValueLabel';

describe('resolveValueLabel', () => {
  describe('isGroupedItems', () => {
    it.each([
      ['an undefined items field', [{ value: 'a', items: undefined }], false],
      ['a non-array items field', [{ value: 'a', items: 3 }], false],
      ['an array items field', [{ value: 'group', items: [] }], true],
      [
        'a list that starts with a flat item',
        [{ value: 'a' }, { value: 'group', items: [] }],
        false,
      ],
    ])('classifies %s', (_name, items, expected) => {
      expect(isGroupedItems(items)).toBe(expected);
    });
  });

  it('resolves a flat item label when the item has an unrelated items field', () => {
    const items = [{ value: 'a', label: 'A', items: 'metadata' }];

    expect(resolveSelectedLabel('a', items)).toBe('A');
  });

  describe('hasNullItemLabel', () => {
    it('returns true when grouped items contain a null-valued item with a label', () => {
      const items = [
        {
          value: 'group-1',
          items: [
            { value: 'a', label: 'A' },
            { value: null, label: 'Select' },
          ],
        },
      ];

      expect(hasNullItemLabel(items)).toBe(true);
    });

    it('returns false when grouped items contain a null-valued item without a label', () => {
      const items = [
        {
          value: 'group-1',
          items: [
            { value: null, label: null },
            { value: 'a', label: 'A' },
          ],
        },
      ];

      expect(hasNullItemLabel(items)).toBe(false);
    });

    it('returns false when grouped items do not contain a null-valued item', () => {
      const items = [
        {
          value: 'group-1',
          items: [{ value: 'a', label: 'A' }],
        },
      ];

      expect(hasNullItemLabel(items)).toBe(false);
    });

    it('supports grouped items with custom heading keys', () => {
      const items = [
        {
          heading: 'group-1',
          items: [
            { value: 'a', label: 'A' },
            { value: null, label: 'Select' },
          ],
        },
      ];

      expect(hasNullItemLabel(items)).toBe(true);
    });

    it('returns true when flat items contain a null-valued item with a label', () => {
      const items = [
        { value: 'a', label: 'A' },
        { value: null, label: 'None' },
      ];

      expect(hasNullItemLabel(items)).toBe(true);
    });

    it('returns false when flat items do not contain a null-valued item', () => {
      const items = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];

      expect(hasNullItemLabel(items)).toBe(false);
    });

    it('returns false when items is a Record without a "null" key', () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
        mono: 'Monospace',
      };

      expect(hasNullItemLabel(items)).toBe(false);
    });

    it('returns true when items is a Record with a "null" key', () => {
      const items = {
        null: 'None',
        sans: 'Sans-serif',
        serif: 'Serif',
      };

      expect(hasNullItemLabel(items)).toBe(true);
    });

    it('returns false when items is undefined', () => {
      expect(hasNullItemLabel(undefined)).toBe(false);
    });
  });

  describe('record items with prototype member names', () => {
    it('falls back to the stringified label when the value matches an Object.prototype member', () => {
      const items = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' };

      expect(resolveSelectedLabel('constructor', items)).toBe('constructor');
      expect(resolveSelectedLabel('toString', items)).toBe('toString');
      expect(resolveSelectedLabel('hasOwnProperty', items)).toBe('hasOwnProperty');
      expect(resolveSelectedLabel('__proto__', items)).toBe('__proto__');
    });

    it('resolves an own key that matches an Object.prototype member', () => {
      const items = { constructor: 'Custom constructor', sans: 'Sans-serif' };

      expect(resolveSelectedLabel('constructor', items)).toBe('Custom constructor');
    });

    it('keeps resolving the null placeholder key in a record', () => {
      const items = { null: 'None', sans: 'Sans-serif' };

      expect(resolveSelectedLabel(null, items)).toBe('None');
    });

    it('falls back to the stringified label when an own key has a nullish label', () => {
      expect(resolveSelectedLabel('sans', { sans: undefined })).toBe('sans');
      expect(resolveSelectedLabel('sans', { sans: null })).toBe('sans');
    });
  });

  describe('VUE-36: an item label that is a function', () => {
    it.each([
      {
        name: 'a record',
        value: 'bold',
        items: (label: () => string) => ({ italic: 'Italic', bold: label }),
      },
      {
        name: 'a list',
        value: 'bold',
        items: (label: () => string) => [
          { value: 'italic', label: 'Italic' },
          { value: 'bold', label },
        ],
      },
      {
        name: 'a list of groups',
        value: 'bold',
        items: (label: () => string) => [{ heading: 'Styles', items: [{ value: 'bold', label }] }],
      },
      {
        name: 'a list, for a value that is an object',
        value: { value: 'bold' },
        items: (label: () => string) => [{ value: 'bold', label }],
      },
      {
        name: 'the value itself',
        value: (label: () => string) => ({ value: 'bold', label }),
        items: () => undefined,
      },
    ])('gives the function of $name and does not call it', ({ value, items }) => {
      const label = vi.fn(() => 'Bold');

      expect(
        resolveSelectedLabel(typeof value === 'function' ? value(label) : value, items(label)),
      ).toBe(label);
      expect(label).not.toHaveBeenCalled();
    });

    it('gives the text of the value as the text of the item', () => {
      expect(stringifyAsLabel({ value: 'bold', label: () => 'Bold' })).toBe('bold');
    });
  });

  describe('resolveMultipleLabels', () => {
    it('gives the labels in the sequence of the values, with a comma and a space between them', () => {
      const bold = () => 'Bold';
      const items = [
        { value: 'bold', label: bold },
        { value: 'italic', label: 'Italic' },
        { value: 'plain', label: 'Plain' },
      ];

      expect(resolveMultipleLabels(['plain', 'bold', 'italic'], items)).toEqual([
        'Plain',
        ', ',
        bold,
        ', ',
        'Italic',
      ]);
    });
  });
});
