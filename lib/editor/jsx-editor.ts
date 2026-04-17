import { parse, parseExpression } from "@babel/parser";
import * as t from "@babel/types";

import { EditorElementNode, EditorNode, EditorTextNode } from "./types";

const ROOT_WRAPPER_TAG = "div";

const INDENT = "  ";

export function parseComponentSource(source: string): EditorElementNode {
  const jsxNode = findRootJSXNode(source);
  if (!jsxNode) {
    throw new Error(
      "Could not find JSX in the pasted input. Paste a JSX snippet or a component with a JSX return.",
    );
  }

  let nodeCounter = 0;
  const nextId = () => `node_${++nodeCounter}`;

  const parsed = jsxToEditorNode(jsxNode, nextId);
  if (!parsed || parsed.type !== "element") {
    throw new Error("Unable to parse a valid root element from the pasted JSX.");
  }

  return parsed;
}

export function serializeComponent(node: EditorElementNode): string {
  return serializeNode(node, 0);
}

export function findElementById(
  root: EditorNode,
  nodeId: string,
): EditorElementNode | null {
  if (root.id === nodeId && root.type === "element") {
    return root;
  }

  if (root.type === "text") {
    return null;
  }

  for (const child of root.children) {
    const found = findElementById(child, nodeId);
    if (found) {
      return found;
    }
  }

  return null;
}

export function updateNodeById(
  root: EditorNode,
  nodeId: string,
  updater: (node: EditorNode) => EditorNode,
): EditorNode {
  if (root.id === nodeId) {
    return updater(root);
  }

  if (root.type === "text") {
    return root;
  }

  let changed = false;
  const nextChildren = root.children.map((child) => {
    const nextChild = updateNodeById(child, nodeId, updater);
    if (nextChild !== child) {
      changed = true;
    }

    return nextChild;
  });

  if (!changed) {
    return root;
  }

  return {
    ...root,
    children: nextChildren,
  };
}

export function setElementText(
  root: EditorElementNode,
  nodeId: string,
  value: string,
): EditorElementNode {
  const nextRoot = updateNodeById(root, nodeId, (node) => {
    if (node.type !== "element") {
      return node;
    }

    const firstTextIndex = node.children.findIndex((child) => child.type === "text");

    if (firstTextIndex === -1) {
      const textNode: EditorTextNode = {
        id: `${node.id}_text`,
        type: "text",
        value,
      };

      return {
        ...node,
        children: [textNode, ...node.children],
      };
    }

    const nextChildren = [...node.children];
    const current = nextChildren[firstTextIndex];

    if (!current || current.type !== "text") {
      return node;
    }

    nextChildren[firstTextIndex] = {
      ...current,
      value,
    };

    return {
      ...node,
      children: nextChildren,
    };
  });

  if (nextRoot.type !== "element") {
    return root;
  }

  return nextRoot;
}

export function getElementText(node: EditorElementNode): string {
  const textChild = node.children.find((child) => child.type === "text");

  return textChild?.type === "text" ? textChild.value : "";
}

export function setElementStyle(
  root: EditorElementNode,
  nodeId: string,
  styleKey: string,
  styleValue: string,
): EditorElementNode {
  const nextRoot = updateNodeById(root, nodeId, (node) => {
    if (node.type !== "element") {
      return node;
    }

    const nextStyle = { ...node.style };

    if (!styleValue.trim()) {
      delete nextStyle[styleKey];
    } else {
      nextStyle[styleKey] = styleValue;
    }

    return {
      ...node,
      style: nextStyle,
    };
  });

  if (nextRoot.type !== "element") {
    return root;
  }

  return nextRoot;
}

function findRootJSXNode(source: string): t.JSXElement | t.JSXFragment | null {
  try {
    const moduleAst = parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    const foundInModule = findFirstJSXNode(moduleAst);
    if (foundInModule) {
      return foundInModule;
    }
  } catch {
    // We try expression parsing below as a fallback.
  }

  try {
    const expressionAst = parseExpression(source, {
      plugins: ["jsx", "typescript"],
    });

    const foundInExpression = findFirstJSXNode(expressionAst);
    if (foundInExpression) {
      return foundInExpression;
    }
  } catch {
    return null;
  }

  return null;
}

function findFirstJSXNode(candidate: unknown): t.JSXElement | t.JSXFragment | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const astCandidate = candidate as t.Node;
  if (t.isJSXElement(astCandidate) || t.isJSXFragment(astCandidate)) {
    return astCandidate;
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const found = findFirstJSXNode(item);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const objectCandidate = candidate as Record<string, unknown>;
  for (const value of Object.values(objectCandidate)) {
    const found = findFirstJSXNode(value);
    if (found) {
      return found;
    }
  }

  return null;
}

function jsxToEditorNode(
  jsxNode: t.JSXElement | t.JSXFragment,
  nextId: () => string,
): EditorNode | null {
  if (t.isJSXFragment(jsxNode)) {
    const children = collectChildren(jsxNode.children, nextId);

    return {
      id: nextId(),
      type: "element",
      tag: ROOT_WRAPPER_TAG,
      attributes: {
        "data-fragment-root": true,
      },
      style: {},
      children,
    };
  }

  const tag = extractTagName(jsxNode.openingElement.name);
  if (!tag) {
    return null;
  }

  const attributes: Record<string, string | number | boolean> = {};
  let style: Record<string, string> = {};

  for (const attribute of jsxNode.openingElement.attributes) {
    if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)) {
      continue;
    }

    const name = attribute.name.name;

    if (!attribute.value) {
      attributes[name] = true;
      continue;
    }

    if (t.isStringLiteral(attribute.value)) {
      attributes[name] = attribute.value.value;
      continue;
    }

    if (!t.isJSXExpressionContainer(attribute.value)) {
      continue;
    }

    const expression = attribute.value.expression;

    if (name === "style" && t.isObjectExpression(expression)) {
      style = parseStyleObjectExpression(expression);
      continue;
    }

    if (t.isStringLiteral(expression)) {
      attributes[name] = expression.value;
      continue;
    }

    if (t.isNumericLiteral(expression)) {
      attributes[name] = expression.value;
      continue;
    }

    if (t.isBooleanLiteral(expression)) {
      attributes[name] = expression.value;
      continue;
    }

    if (t.isTemplateLiteral(expression) && expression.expressions.length === 0) {
      attributes[name] = expression.quasis.map((quasi) => quasi.value.cooked ?? "").join("");
    }
  }

  const children = collectChildren(jsxNode.children, nextId);

  return {
    id: nextId(),
    type: "element",
    tag,
    attributes,
    style,
    children,
  };
}

function collectChildren(
  jsxChildren: t.JSXElement["children"] | t.JSXFragment["children"],
  nextId: () => string,
): EditorNode[] {
  const children: EditorNode[] = [];

  for (const child of jsxChildren) {
    if (t.isJSXText(child)) {
      const normalized = normalizeText(child.value);
      if (!normalized) {
        continue;
      }

      children.push({
        id: nextId(),
        type: "text",
        value: normalized,
      });
      continue;
    }

    if (t.isJSXExpressionContainer(child)) {
      if (t.isStringLiteral(child.expression)) {
        children.push({
          id: nextId(),
          type: "text",
          value: child.expression.value,
        });
        continue;
      }

      if (t.isNumericLiteral(child.expression)) {
        children.push({
          id: nextId(),
          type: "text",
          value: `${child.expression.value}`,
        });
      }

      continue;
    }

    if (t.isJSXElement(child) || t.isJSXFragment(child)) {
      const childNode = jsxToEditorNode(child, nextId);
      if (childNode) {
        children.push(childNode);
      }
    }
  }

  return children;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTagName(name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName): string | null {
  if (t.isJSXIdentifier(name)) {
    return name.name;
  }

  if (t.isJSXMemberExpression(name)) {
    return "div";
  }

  if (t.isJSXNamespacedName(name)) {
    return `${name.namespace.name}:${name.name.name}`;
  }

  return null;
}

function parseStyleObjectExpression(expression: t.ObjectExpression): Record<string, string> {
  const style: Record<string, string> = {};

  for (const prop of expression.properties) {
    if (!t.isObjectProperty(prop) || prop.computed) {
      continue;
    }

    const key = getPropertyKey(prop.key);
    if (!key) {
      continue;
    }

    const value = getStyleValue(prop.value);
    if (value === null) {
      continue;
    }

    style[key] = value;
  }

  return style;
}

function getPropertyKey(key: t.Expression | t.Identifier | t.PrivateName): string | null {
  if (t.isIdentifier(key)) {
    return key.name;
  }

  if (t.isStringLiteral(key) || t.isNumericLiteral(key)) {
    return `${key.value}`;
  }

  return null;
}

function getStyleValue(value: t.Expression | t.PatternLike): string | null {
  if (t.isStringLiteral(value)) {
    return value.value;
  }

  if (t.isNumericLiteral(value)) {
    return `${value.value}`;
  }

  if (t.isTemplateLiteral(value) && value.expressions.length === 0) {
    return value.quasis.map((quasi) => quasi.value.cooked ?? "").join("");
  }

  return null;
}

function serializeNode(node: EditorNode, depth: number): string {
  const indentation = INDENT.repeat(depth);

  if (node.type === "text") {
    return `${indentation}${escapeText(node.value)}`;
  }

  const attrs = serializeAttributes(node.attributes, node.style);
  const openTag = `${indentation}<${node.tag}${attrs}`;

  if (!node.children.length) {
    return `${openTag} />`;
  }

  if (node.children.length === 1 && node.children[0]?.type === "text") {
    const textChild = node.children[0];
    return `${openTag}>${escapeText(textChild.value)}</${node.tag}>`;
  }

  const serializedChildren = node.children
    .map((child) => serializeNode(child, depth + 1))
    .join("\n");

  return `${openTag}>\n${serializedChildren}\n${indentation}</${node.tag}>`;
}

function serializeAttributes(
  attributes: Record<string, string | number | boolean>,
  style: Record<string, string>,
): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === "boolean") {
      if (value) {
        parts.push(key);
      }
      continue;
    }

    if (typeof value === "number") {
      parts.push(`${key}={${value}}`);
      continue;
    }

    parts.push(`${key}="${escapeAttribute(value)}"`);
  }

  const styleEntries = Object.entries(style);
  if (styleEntries.length) {
    const serializedStyle = styleEntries
      .map(([styleKey, styleValue]) => `${styleKey}: \"${escapeAttribute(styleValue)}\"`)
      .join(", ");

    parts.push(`style={{ ${serializedStyle} }}`);
  }

  if (!parts.length) {
    return "";
  }

  return ` ${parts.join(" ")}`;
}

function escapeAttribute(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeText(value: string): string {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
