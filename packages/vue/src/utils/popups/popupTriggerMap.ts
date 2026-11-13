/**
 * A development-only index from an element to its registered id, for each map.
 *
 * Without it, a registration scans each entry to find an element that has two ids, and the mount of
 * many triggers that share one handle is quadratic. The index is module-scoped and lazy. Only the
 * guards of `process.env.NODE_ENV` read it, so a production build drops it with the checks.
 */
let devElementIdsByMap: WeakMap<PopupTriggerMap, WeakMap<Element, string>> | undefined;

function getDevElementIds(map: PopupTriggerMap) {
  devElementIdsByMap ??= new WeakMap();

  let elementIds = devElementIdsByMap.get(map);
  if (!elementIds) {
    elementIds = new WeakMap();
    devElementIdsByMap.set(map, elementIds);
  }
  return elementIds;
}

/**
 * Keeps the trigger elements of a popup by their ids.
 *
 * An element lookup iterates the id map and keeps no second set. A registration costs O(1).
 * `hasElement` and `hasMatchingElement` are linear in the number of triggers.
 */
export class PopupTriggerMap {
  private idMap: Map<string, Element> = new Map();

  /**
   * Adds a trigger element with the given ID.
   *
   * The element must not be registered under another ID.
   */
  public add(id: string, element: Element) {
    if (process.env.NODE_ENV !== 'production') {
      const elementIds = getDevElementIds(this);

      const existingId = elementIds.get(element);
      if (existingId !== undefined && existingId !== id) {
        throw new Error(
          'Vase UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap. The map assumes that each element has one ID, so a second ID can select the wrong trigger. Give each trigger its own element.',
        );
      }

      // A new element for an id evicts the old element. The old element must lose its claim on the
      // id. If not, a later registration of it under another id looks like a duplicate.
      const previousElement = this.idMap.get(id);
      if (previousElement !== undefined && previousElement !== element) {
        elementIds.delete(previousElement);
      }

      elementIds.set(element, id);
    }

    this.idMap.set(id, element);
  }

  /**
   * Removes the trigger element with the given ID.
   */
  public delete(id: string) {
    if (process.env.NODE_ENV !== 'production') {
      const element = this.idMap.get(id);
      if (element !== undefined) {
        devElementIdsByMap?.get(this)?.delete(element);
      }
    }

    this.idMap.delete(id);
  }

  /**
   * Whether the given element is registered as a trigger.
   */
  public hasElement(element: Element): boolean {
    for (const registered of this.idMap.values()) {
      if (registered === element) {
        return true;
      }
    }

    return false;
  }

  /**
   * Whether a registered trigger element matches the given predicate.
   */
  public hasMatchingElement(predicate: (el: Element) => boolean): boolean {
    for (const element of this.idMap.values()) {
      if (predicate(element)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Returns the trigger element for the given ID, or `undefined` when there is none.
   */
  public getById(id: string): Element | undefined {
    return this.idMap.get(id);
  }

  /**
   * Returns an iterable of the registered trigger entries. Each entry is a tuple of [id, element].
   */
  public entries(): IterableIterator<[string, Element]> {
    return this.idMap.entries();
  }

  /**
   * Returns an iterable of the registered trigger elements.
   */
  public elements(): IterableIterator<Element> {
    return this.idMap.values();
  }

  /**
   * Returns the number of registered trigger elements.
   */
  public get size(): number {
    return this.idMap.size;
  }
}
