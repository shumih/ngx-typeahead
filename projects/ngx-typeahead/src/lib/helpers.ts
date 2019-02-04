export function withValue<T>(array: Array<T>, value: T): Array<T> {
  return array.includes(value) ? [...array] : [...array, value];
}

export function isTextNode(node: Node): boolean {
  return node.nodeType === node.TEXT_NODE;
}

export function isCommentNode(node: Node): boolean {
  return node.nodeType === node.COMMENT_NODE;
}

export function getTextNode(nodes: NodeList): Node {
  return Array.from(nodes).find(isTextNode);
}

export function containsTextNode(nodes: NodeList): boolean {
  return !!getTextNode(nodes);
}
