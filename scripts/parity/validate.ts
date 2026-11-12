export type Report = (place: string, message: string) => void;
export type Check = (value: unknown, place: string, report: Report) => void;

function child(place: string, key: string): string {
  return place ? `${place}.${key}` : key;
}

export const string: Check = (value, place, report) => {
  if (typeof value !== 'string') {
    report(place, 'must be a string.');
  }
};

export const nonEmptyString: Check = (value, place, report) => {
  if (typeof value !== 'string' || value.trim() === '') {
    report(place, 'must be a string with text.');
  }
};

export const boolean: Check = (value, place, report) => {
  if (typeof value !== 'boolean') {
    report(place, 'must be true or false.');
  }
};

export function oneOf(...values: string[]): Check {
  return (value, place, report) => {
    if (typeof value !== 'string' || !values.includes(value)) {
      report(place, `must be one of ${values.map((item) => `"${item}"`).join(', ')}.`);
    }
  };
}

export function pattern(regexp: RegExp, expected: string): Check {
  return (value, place, report) => {
    if (typeof value !== 'string' || !regexp.test(value)) {
      report(place, `must be ${expected}.`);
    }
  };
}

export function nullable(check: Check): Check {
  return (value, place, report) => {
    if (value !== null) {
      check(value, place, report);
    }
  };
}

export function array(item: Check, options: { nonEmpty?: boolean } = {}): Check {
  return (value, place, report) => {
    if (!Array.isArray(value)) {
      report(place, 'must be a list.');
      return;
    }
    if (options.nonEmpty && value.length === 0) {
      report(place, 'must have at least one item.');
    }
    value.forEach((entry, index) => item(entry, `${place}[${index}]`, report));
  };
}

export function record(item: Check): Check {
  return (value, place, report) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      report(place, 'must be an object.');
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      item(entry, child(place, key), report);
    }
  };
}

export function object(fields: Record<string, Check>, optional: readonly string[] = []): Check {
  return (value, place, report) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      report(place, 'must be an object.');
      return;
    }
    const entries = value as Record<string, unknown>;
    for (const key of Object.keys(entries)) {
      if (!(key in fields)) {
        report(place, `has the key "${key}", which is not known.`);
      }
    }
    for (const [key, check] of Object.entries(fields)) {
      if (key in entries) {
        check(entries[key], child(place, key), report);
      } else if (!optional.includes(key)) {
        report(place, `needs the key "${key}".`);
      }
    }
  };
}

/** Runs `rule` only when `check` found no problem, so that the rule can trust the shape of the value. */
export function withRule<T>(
  check: Check,
  rule: (value: T, place: string, report: Report) => void,
): Check {
  return (value, place, report) => {
    let failed = false;
    check(value, place, (reportPlace, message) => {
      failed = true;
      report(reportPlace, message);
    });
    if (!failed) {
      rule(value as T, place, report);
    }
  };
}

export function problemsOf(scope: string, check: Check, value: unknown): string[] {
  const problems: string[] = [];
  check(value, '', (place, message) =>
    problems.push(place ? `${scope}: ${place}: ${message}` : `${scope}: ${message}`),
  );
  return problems;
}
