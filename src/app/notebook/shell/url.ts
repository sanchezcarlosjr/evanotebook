export function write(query: string, expression: string | undefined) {
  if (!expression)
    return "";
  const url = new URL(window.location.toString());
  url.searchParams.set(query, expression);
  window.history.pushState({}, "", url);
  return expression;
}

export function read(query: string, defaultValue = "") {
  return new URLSearchParams(window.location.search).get(query) || defaultValue;
}

export function has(query: string): boolean {
  return  new URLSearchParams(window.location.search).has(query);
}

export function remove(query: string) {
  const url = new URL(window.location.toString());
  url.searchParams.delete(query);
  window.history.pushState({}, "", url);
}
