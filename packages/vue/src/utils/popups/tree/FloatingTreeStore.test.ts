import { describe, expect, it } from 'vitest';
import { computed } from 'vue';
import { FloatingTreeStore } from './FloatingTreeStore';

describe('FloatingTreeStore', () => {
  it('gives the list a new array for each node that it adds or removes', () => {
    const tree = new FloatingTreeStore();
    const count = computed(() => tree.nodesRef.value.length);
    const first = { id: 'first', parentId: null };
    const second = { id: 'second', parentId: 'first' };
    expect(count.value).toBe(0);

    tree.addNode(first);
    tree.addNode(second);
    expect(count.value).toBe(2);
    expect(tree.nodesRef.value).toEqual([first, second]);

    tree.removeNode(first);
    expect(count.value).toBe(1);
    expect(tree.nodesRef.value).toEqual([second]);
  });
});
