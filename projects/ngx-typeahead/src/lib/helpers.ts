export function withValue<T>(array: Array<T>, value: T): Array<T> {
  return array.includes(value) ? [...array] : [...array, value];
}

export function isPlainTextNode(node: Node): boolean {
  // Modern browsers insert TEXT_NODE for inner text, but IE 11 inserts ELEMENT_NODE "FONT"
  return node.nodeType === node.TEXT_NODE || (node.nodeType === node.ELEMENT_NODE && node.nodeName === 'FONT');
}

export function isCommentNode(node: Node): boolean {
  return node.nodeType === node.COMMENT_NODE;
}

export function getPlainTextNode(nodes: NodeList): Node {
  return Array.from(nodes).find(isPlainTextNode);
}

export function containsPlainTextNode(nodes: NodeList): boolean {
  return !!getPlainTextNode(nodes);
}
