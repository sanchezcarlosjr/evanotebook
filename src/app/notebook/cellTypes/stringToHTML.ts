/**
 * From https://gomakethings.com/converting-a-string-into-markup-with-vanilla-js/
 * Convert a template string into HTML DOM nodes
 * @param  {String} str The template string
 * @return ChildNode      The template HTML
 */
export function stringToHTML(str: string): ChildNode {
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, 'text/html');
  return doc.body.firstChild as  ChildNode;
}

/**
 * @param {string} key
 * @param {any} value
 */
export function jsonStringifyToObjectReplacer(key: string, value: any) {
  if (value && value.toObject) {
    return value.toObject();
  }
  if (value && value.toJs) {
    return value.toString().replace(/[\u00A0-\u9999<>&]/g, (i: string) => '&#' + i.charCodeAt(0) + ';');
  }
  if (value && value.toJSON) {
    return value.toJSON();
  }
  return value;
}

export function stringify(value: any) {
  return JSON.stringify(value, jsonStringifyToObjectReplacer);
}
