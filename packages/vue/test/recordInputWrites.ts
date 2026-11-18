/** Records assignments through this input. The native accessor still applies the input type's rules. */
export function recordInputWrites(input: HTMLInputElement, key: 'value' | 'checked') {
  const writes: (string | boolean)[] = [];
  const { get, set } = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, key)!;
  Object.defineProperty(input, key, {
    configurable: true,
    get: () => get!.call(input),
    set(value: string | boolean) {
      writes.push(value);
      set!.call(input, value);
    },
  });
  return writes;
}
