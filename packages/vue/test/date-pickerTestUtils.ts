/**
 * Gives the instance that a `ref` function of a part gets. A ref on a part gives its exposed
 * members, and a vnode that a render function makes can have such a ref.
 */
export function createPartRef<Instance>() {
  let instance: Instance | undefined;
  return {
    ref(value: unknown) {
      instance = (value as Instance | null) ?? instance;
    },
    get current() {
      return instance!;
    },
  };
}
