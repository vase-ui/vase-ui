let loggedMessages: Set<string>;
if (process.env.NODE_ENV !== 'production') {
  loggedMessages = new Set<string>();
}

export function createLogOnce(severity: 'warn' | 'error', prefix?: string) {
  return function logOnce(...messages: string[]) {
    if (process.env.NODE_ENV !== 'production') {
      const message = messages.join(' ');
      const output = prefix ? `${prefix}: ${message}` : message;
      const key = `${severity}:${output}`;
      if (!loggedMessages.has(key)) {
        loggedMessages.add(key);
        if (severity === 'warn') {
          console.warn(output);
        } else {
          console.error(output);
        }
      }
    }
  };
}

export function reset() {
  loggedMessages?.clear();
}
