export function write(query: string, expression: string) {
  const url = new URL(window.location.toString());
  url.searchParams.set(query, expression);
  window.history.pushState({}, "", url);
  return expression;
}

export function read(query: string, defaultValue = "") {
  return (new URL(document.location.toString())).searchParams.get(query) || defaultValue;
}

export function has(query: string): boolean {
  return !!read(query);
}
