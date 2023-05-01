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
