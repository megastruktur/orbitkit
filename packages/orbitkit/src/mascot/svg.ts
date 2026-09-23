/**
 * SVG utilities for OrbitKit Mascot (K3-A3).
 * Inline SVG markup is converted to a data: URL and rendered exclusively
 * via <img> to guarantee that scripts and external resources never execute.
 */

/**
 * Checks if a string appears to be SVG markup rather than a URL or path.
 */
export function isSvgMarkup(src: string): boolean {
  if (!src || typeof src !== "string") return false;
  return src.trim().startsWith("<");
}

/**
 * Converts SVG markup into a safe data URL for <img> rendering.
 */
export function toSvgDataUrl(markup: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
}

/**
 * Resolves an SVG src string (URL, path, or inline markup) to an <img> compatible src URL.
 */
export function resolveSvgSrc(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  if (isSvgMarkup(raw)) {
    return toSvgDataUrl(raw);
  }
  return raw;
}
