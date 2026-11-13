import { h } from 'vue';
import { useToastManager } from './useToastManager';

const manager = useToastManager();

manager.add({ title: 'Saved', description: 1 });

manager.add({
  title: () => h('strong', 'Saved'),
  description: () => [h('em', 'Undo'), ' the change'],
  actionProps: { children: () => h('strong', 'Undo') },
});

// @ts-expect-error - a title is a text or a function, never a vnode
manager.add({ title: h('strong', 'Saved') });

// @ts-expect-error - a description is a text or a function, never a vnode
manager.update('saved', { description: h('strong', 'Saved') });

// @ts-expect-error - the content of an action is a text or a function, never a vnode
manager.add({ actionProps: { children: h('strong', 'Undo') } });
