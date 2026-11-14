import { shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import type { FloatingNodeType, PopupEvents } from '../types';
import { createEventEmitter } from '../createEventEmitter';

/**
 * Stores and manages floating elements in a tree structure.
 * `provideFloatingTree` gives one to the parts below a root.
 */
export class FloatingTreeStore {
  public readonly nodesRef: ShallowRef<FloatingNodeType[]> = shallowRef([]);

  public readonly events: PopupEvents = createEventEmitter();

  public addNode(node: FloatingNodeType) {
    this.nodesRef.value = [...this.nodesRef.value, node];
  }

  public removeNode(node: FloatingNodeType) {
    this.nodesRef.value = this.nodesRef.value.filter((n) => n !== node);
  }
}
