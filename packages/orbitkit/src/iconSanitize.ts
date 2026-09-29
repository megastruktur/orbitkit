/**
 * K12 allowlist sanitizer for RadialMenu item icons (`MenuItem.icon: { svg }`).
 *
 * Inline SVG is sanitized against a strict allowlist (tags, attributes) before
 * being rendered as a data-URL <img> (mascot/svg.ts toSvgDataUrl), so scripts,
 * event handlers, hyperlinks and foreignObject content can never survive into
 * the rendered icon.
 */

import { toSvgDataUrl } from "./mascot/svg.js";

/** Tags permitted inside a menu icon (structural/stroke primitives only). */
const ALLOWED_TAGS: Record<string, true> = {
  svg: true,
  g: true,
  path: true,
  circle: true,
  rect: true,
  line: true,
  polyline: true,
  polygon: true,
  ellipse: true,
};

/** Attributes permitted on allowed tags (compared lowercased). */
const ALLOWED_ATTRS: Record<string, true> = {
  d: true,
  viewbox: true,
  fill: true,
  cx: true,
  cy: true,
  r: true,
  x: true,
  y: true,
  width: true,
  height: true,
  points: true,
  transform: true,
  opacity: true,
};

/**
 * Recursively sanitizes `el`: unknown elements are removed with their subtree,
 * unknown/unsafe attributes (on*, href, anything outside the allowlist) are
 * stripped from kept elements. `stroke*` attributes are allowlisted by prefix.
 */
function sanitizeElement(el: Element): void {
  if (!(el.localName.toLowerCase() in ALLOWED_TAGS)) {
    el.remove();
    return;
  }
  for (const attr of Array.from(el.attributes)) {
    const local = attr.localName.toLowerCase();
    if (
      local.startsWith("on") ||
      local === "href" ||
      (!(local in ALLOWED_ATTRS) && !local.startsWith("stroke"))
    ) {
      el.removeAttribute(attr.name);
    }
  }
  for (const child of Array.from(el.children)) {
    sanitizeElement(child);
  }
}

/**
 * Sanitizes inline SVG markup for use as a menu item icon.
 *
 * Returns the sanitized serialized markup, or `null` when the input is empty,
 * not well-formed XML, or its root element is not `<svg>`.
 */
export function sanitizeMenuIconSvg(svg: string): string | null {
  if (typeof svg !== "string" || svg.trim() === "") return null;
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    return null;
  }

  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return null;

  const root = doc.documentElement;
  if (!root || root.localName.toLowerCase() !== "svg") return null;

  sanitizeElement(root);
  return new XMLSerializer().serializeToString(root);
}

/**
 * Sanitizes inline SVG markup and encodes it as a data URL ready for
 * `<img src>`. Returns `null` when the input could not be sanitized.
 */
export function sanitizeMenuIconToDataUrl(svg: string): string | null {
  const clean = sanitizeMenuIconSvg(svg);
  return clean === null ? null : toSvgDataUrl(clean);
}
