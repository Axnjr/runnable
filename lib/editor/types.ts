export type EditableAttributeValue = string | number | boolean;

export interface EditorTextNode {
  id: string;
  type: "text";
  value: string;
}

export interface EditorElementNode {
  id: string;
  type: "element";
  tag: string;
  attributes: Record<string, EditableAttributeValue>;
  style: Record<string, string>;
  children: EditorNode[];
}

export type EditorNode = EditorTextNode | EditorElementNode;
