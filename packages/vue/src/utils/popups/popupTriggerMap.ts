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
 *
 * `KeepAlive` takes the DOM of a trigger out of the document. `setActive` hides the entry of that
 * trigger from each reader and keeps its place.
 */
export class PopupTriggerMap {
  private idMap = new Map<string, Element>();

  private inactiveIds = new Set<string>();

  /**
   * Hides the entry with the given ID from each reader while `active` is `false`. The entry keeps
   * its place in the order of the entries. A new entry for an ID is active.
   */
  public setActive(id: string, active: boolean) {
    if (active) {
      this.inactiveIds.delete(id);
    } else if (this.idMap.has(id)) {
      this.inactiveIds.add(id);
    }
  }

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
    this.inactiveIds.delete(id);
  }

  /**
   * Removes the trigger element with the given ID. With `element`, the entry stays unless it holds
   * that element, also when the entry is not active. Another trigger can take an ID before the
   * trigger that held it removes its entry.
   */
  public delete(id: string, element?: Element) {
    const registered = this.idMap.get(id);
    if (element !== undefined && registered !== element) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      if (registered !== undefined) {
        devElementIdsByMap?.get(this)?.delete(registered);
      }
    }

    this.idMap.delete(id);
    this.inactiveIds.delete(id);
  }

  /**
   * Whether the given element is registered as a trigger.
   */
  public hasElement(element: Element): boolean {
    for (const registered of this.elements()) {
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
    for (const element of this.elements()) {
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
    return this.inactiveIds.has(id) ? undefined : this.idMap.get(id);
  }

  /**
   * Returns an iterable of the registered trigger entries. Each entry is a tuple of [id, element].
   */
  public *entries(): IterableIterator<[string, Element]> {
    for (const entry of this.idMap.entries()) {
      if (!this.inactiveIds.has(entry[0])) {
        yield entry;
      }
    }
  }

  /**
   * Returns an iterable of the registered trigger elements.
   */
  public *elements(): IterableIterator<Element> {
    for (const [, element] of this.entries()) {
      yield element;
    }
  }

  /**
   * Returns the number of registered trigger elements.
   */
  public get size(): number {
    return this.idMap.size - this.inactiveIds.size;
  }
}
