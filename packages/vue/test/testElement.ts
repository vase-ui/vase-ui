import { defineComponent, h, shallowRef } from 'vue';
import type { HTMLAttributes, Ref } from 'vue';
import { isVaporApp } from './testApp';
import VaporTestElement from './fixtures/VaporTestElement.vue';

export type SetupElement = (element: Readonly<Ref<HTMLDivElement | null>>) => HTMLAttributes | void;

// A JSX component runs its setup in the virtual DOM renderer even inside a Vapor app.
export const TestElement = isVaporApp
  ? VaporTestElement
  : defineComponent(
      (props: { setupElement: SetupElement }) => {
        const element = shallowRef<HTMLDivElement | null>(null);
        const bindings = props.setupElement(element);
        return () => h('div', { ...bindings, ref: element });
      },
      { props: ['setupElement'] },
    );
