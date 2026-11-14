import { describe, expect, it, onTestFinished, vi } from 'vitest';
import * as Combobox from '../index.parts';
import { reset } from '../../common/error';
import { defaultItemEquality } from '../../internals/itemEquality';
import type { ComboboxItemCollection, ItemCollection } from './itemCollection';

interface User {
  id: number;
  name: string;
}

const users: User[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Carol' },
];

const getUserId = (user: User) => user.id;
const getUserName = (user: User) => user.name;

// The root reads a collection through this shape.
function readCollection<Item, Value>(collection: ComboboxItemCollection<Item, Value>) {
  return collection as unknown as ItemCollection<Item, Value>;
}

describe('Combobox.createItems', () => {
  describe('lazy normalization', () => {
    it('does not call the accessors when creating a flat collection', () => {
      const getValue = vi.fn(getUserId);
      const getLabel = vi.fn(getUserName);

      Combobox.createItems(users, { getValue, getLabel });

      expect(getValue).not.toHaveBeenCalled();
      expect(getLabel).not.toHaveBeenCalled();
    });

    it('does not call the accessors when creating a grouped collection', () => {
      const getValue = vi.fn(getUserId);
      const getLabel = vi.fn(getUserName);

      const groups = [{ value: 'Team', items: users }];
      Combobox.createItems(groups, { getValue, getLabel });

      expect(getValue).not.toHaveBeenCalled();
      expect(getLabel).not.toHaveBeenCalled();
    });
  });

  describe('collection functions', () => {
    const options = { getValue: getUserId, getLabel: getUserName };

    it('projects an item to its value and keeps a nullish item', () => {
      const collection = readCollection(Combobox.createItems(users, options));

      expect(collection.value(users[1])).toBe(2);
      expect(collection.value(null as unknown as User)).toBe(null);
      expect(collection.value(undefined as unknown as User)).toBe(undefined);
    });

    it.each([
      { name: 'a flat list', data: users },
      { name: 'groups', data: [{ value: 'Team', items: users }] },
    ])(
      'finds a value in $name with the default comparer and with a custom comparer',
      ({ data }) => {
        const collection = readCollection(Combobox.createItems(data, options));
        const isTenTimes = (itemValue: number, selectedValue: number) =>
          itemValue * 10 === selectedValue;

        expect(collection.hasValue(2, defaultItemEquality)).toBe(true);
        expect(collection.hasValue(20, defaultItemEquality)).toBe(false);
        expect(collection.hasValue(20, isTenTimes)).toBe(true);
        expect(collection.hasValue(25, isTenTimes)).toBe(false);
      },
    );

    it('gives the label of the first item for a duplicated value and reports the duplicate one time', () => {
      reset();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      onTestFinished(() => errorSpy.mockRestore());
      const duplicates = [
        { id: 1, name: 'First' },
        { id: 1, name: 'Second' },
        { id: 1, name: 'Third' },
      ];
      const collection = readCollection(Combobox.createItems(duplicates, options));

      expect(collection.label(1, defaultItemEquality)).toBe('First');
      expect(collection.label(1, defaultItemEquality)).toBe('First');

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toMatch(
        /^Vase UI: Two items passed to createItems\(\) derived the value 1,/,
      );
    });

    it('falls back to the fallback function and then to the default label for a value outside the data', () => {
      const collection = readCollection(Combobox.createItems(users, options));

      expect(collection.label(2, defaultItemEquality, () => 'Fallback')).toBe('Bob');
      expect(collection.label(9, defaultItemEquality, (value) => `User ${value}`)).toBe('User 9');
      expect(collection.label(9, defaultItemEquality)).toBe('9');
    });

    it('keeps undefined data as the absence of items', () => {
      const collection = readCollection(
        Combobox.createItems(undefined as User[] | undefined, options),
      );

      expect(collection.data).toBe(undefined);
      expect(collection.hasValue(1, defaultItemEquality)).toBe(false);
    });
  });
});
