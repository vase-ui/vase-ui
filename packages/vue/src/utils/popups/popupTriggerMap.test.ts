import { describe, expect, it } from 'vitest';
import { PopupTriggerMap } from './popupTriggerMap';

describe('PopupTriggerMap', () => {
  it('adds and retrieves elements by id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);

    expect(map.getById('trigger')).toBe(button);
    expect(map.hasElement(button)).toBe(true);
    expect(map.hasMatchingElement((el) => el === button)).toBe(true);
    expect(map.size).toBe(1);
  });

  it('replaces an existing element when the id is reused', () => {
    const map = new PopupTriggerMap();
    const first = document.createElement('button');
    const second = document.createElement('button');

    map.add('trigger', first);
    map.add('trigger', second);

    expect(map.getById('trigger')).toBe(second);
    expect(map.hasElement(first)).toBe(false);
    expect(map.hasElement(second)).toBe(true);
    expect(map.size).toBe(1);
  });

  it('deletes elements by id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);
    map.delete('trigger');

    expect(map.getById('trigger')).toBeUndefined();
    expect(map.hasElement(button)).toBe(false);
    expect(map.hasMatchingElement((el) => el === button)).toBe(false);
    expect(map.size).toBe(0);
  });

  it('does not duplicate when the same element is added twice with the same id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);
    map.add('trigger', button);

    expect(map.getById('trigger')).toBe(button);
    expect(map.size).toBe(1);
  });

  it('throws in non-production when the same element is registered under multiple ids', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    try {
      map.add('first', button);
      expect(() => map.add('second', button)).toThrow(
        'Vase UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.',
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('allows re-registering an element under a new id after it was deleted', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('first', button);
    map.delete('first');

    expect(() => map.add('second', button)).not.toThrow();
    expect(map.getById('second')).toBe(button);
    expect(map.size).toBe(1);
  });

  it('keeps an unrelated element claim when another id is deleted', () => {
    const map = new PopupTriggerMap();
    const first = document.createElement('button');
    const second = document.createElement('button');

    map.add('first', first);
    map.add('second', second);
    map.delete('second');

    expect(() => map.add('other', first)).toThrow(
      'Vase UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.',
    );
  });

  it('allows an element evicted by id reuse to register under a new id', () => {
    const map = new PopupTriggerMap();
    const first = document.createElement('button');
    const second = document.createElement('button');

    map.add('trigger', first);
    // `first` is no longer registered under `trigger`, so it may claim another id.
    map.add('trigger', second);

    expect(() => map.add('other', first)).not.toThrow();
    expect(map.getById('other')).toBe(first);
    expect(map.getById('trigger')).toBe(second);
    expect(map.size).toBe(2);
  });

  it('still throws when a re-added element is registered under a second id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('first', button);
    map.add('first', button);

    expect(() => map.add('second', button)).toThrow(
      'Vase UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.',
    );
  });

  describe('setActive', () => {
    function createMap() {
      const elements = {
        first: document.createElement('button'),
        second: document.createElement('button'),
        third: document.createElement('button'),
      };
      const map = new PopupTriggerMap();
      map.add('first', elements.first);
      map.add('second', elements.second);
      map.add('third', elements.third);
      return { map, elements };
    }

    const idsOf = (map: PopupTriggerMap) => Array.from(map.entries(), ([id]) => id);

    it('keeps the place of an entry that is not active', () => {
      const { map } = createMap();

      map.setActive('second', false);
      expect(idsOf(map)).toEqual(['first', 'third']);

      map.setActive('second', true);
      expect(idsOf(map)).toEqual(['first', 'second', 'third']);
    });

    it('hides an entry that is not active from each reader', () => {
      const { map, elements } = createMap();

      map.setActive('second', false);

      expect(map.getById('second')).toBeUndefined();
      expect(map.hasElement(elements.second)).toBe(false);
      expect(map.hasMatchingElement((element) => element === elements.second)).toBe(false);
      expect(Array.from(map.elements())).toEqual([elements.first, elements.third]);
      expect(map.size).toBe(2);
    });

    it('makes an entry active when its id gets a new element', () => {
      const { map } = createMap();
      const replacement = document.createElement('button');

      map.setActive('second', false);
      map.add('second', replacement);

      expect(map.getById('second')).toBe(replacement);
      expect(map.size).toBe(3);
    });

    it('forgets that an entry is not active when the entry is deleted', () => {
      const { map } = createMap();

      map.setActive('second', false);
      map.delete('second');

      expect(map.size).toBe(2);
    });

    it('does nothing for an id that has no entry', () => {
      const { map } = createMap();

      map.setActive('missing', false);

      expect(map.size).toBe(3);
    });
  });

  describe('delete with an element', () => {
    it('keeps an entry that holds another element', () => {
      const map = new PopupTriggerMap();
      const first = document.createElement('button');
      const second = document.createElement('button');
      map.add('trigger', first);

      map.delete('trigger', second);

      expect(map.getById('trigger')).toBe(first);
    });

    it('removes an entry that holds the element, also when the entry is not active', () => {
      const map = new PopupTriggerMap();
      const button = document.createElement('button');
      map.add('trigger', button);
      map.setActive('trigger', false);

      map.delete('trigger', button);
      // `setActive` shows an entry that is still in the map.
      map.setActive('trigger', true);

      expect(map.getById('trigger')).toBeUndefined();
      expect(map.size).toBe(0);
    });
  });
});
