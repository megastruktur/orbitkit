import { describe, expect, it } from "vitest";
import {
  sanitizeMenuIconSvg,
  sanitizeMenuIconToDataUrl,
} from "./iconSanitize";

const cleanIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">' +
  '<path d="M4 4h16v16H4z" fill="none" stroke="#e6f6ff" stroke-width="2" stroke-linecap="round" />' +
  '<circle cx="12" cy="12" r="3" />' +
  "</svg>";

describe("sanitizeMenuIconSvg (K12 allowlist)", () => {
  it("keeps allowed tags and stroke attributes", () => {
    const out = sanitizeMenuIconSvg(cleanIcon);
    expect(out).not.toBeNull();
    expect(out).toContain("<path");
    expect(out).toContain('d="M4 4h16v16H4z"');
    expect(out).toContain('stroke-width="2"');
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain("<circle");
    expect(out).toContain('r="3"');
  });

  it("strips <script> elements", () => {
    const out = sanitizeMenuIconSvg(
      '<svg><script>alert(1)</script><path d="M0 0h1v1"/></svg>'
    );
    expect(out).not.toBeNull();
    expect(out).not.toContain("script");
    expect(out).toContain("<path");
  });

  it("strips on* event handler attributes (onload, onclick)", () => {
    const out = sanitizeMenuIconSvg(
      '<svg onload="alert(1)"><path onclick="alert(2)" onerror="alert(3)" d="M0 0h1v1"/></svg>'
    );
    expect(out).not.toBeNull();
    expect(out).not.toContain("onload");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).toContain("<path");
  });

  it("strips href and xlink:href from kept elements", () => {
    const out = sanitizeMenuIconSvg(
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><circle cx="1" cy="1" r="2" href="javascript:alert(4)"/><path xlink:href="javascript:alert(5)" d="M0 0h1v1"/></svg>'
    );
    expect(out).not.toBeNull();
    expect(out).not.toContain("href");
    expect(out).toContain("<circle");
    expect(out).toContain("<path");
  });

  it("removes foreignObject with its entire subtree", () => {
    const out = sanitizeMenuIconSvg(
      '<svg><foreignObject width="10" height="10"><body xmlns="http://www.w3.org/1999/xhtml"><p onload="alert(6)">hi</p></body></foreignObject><path d="M0 0h1v1"/></svg>'
    );
    expect(out).not.toBeNull();
    expect(out).not.toContain("foreignObject");
    expect(out).not.toContain("foreignobject");
    expect(out).not.toContain("<p>");
    expect(out).not.toContain("<body");
    expect(out).not.toContain("hi");
    expect(out).toContain("<path");
  });

  it("removes unknown elements such as style, use and animate", () => {
    const out = sanitizeMenuIconSvg(
      '<svg><style>.a{background:url(javascript:x)}</style><use href="#p"/><animate attributeName="r" to="9"/><path id="p" d="M0 0h1v1"/></svg>'
    );
    expect(out).not.toBeNull();
    expect(out).not.toContain("<style");
    expect(out).not.toContain("background");
    expect(out).not.toContain("<use");
    expect(out).not.toContain("animate");
    expect(out).toContain("<path");
  });

  it("returns null for malformed XML", () => {
    expect(sanitizeMenuIconSvg("<svg><path</svg>")).toBeNull();
  });

  it("returns null when the root element is not svg", () => {
    expect(sanitizeMenuIconSvg('<div onload="x">hi</div>')).toBeNull();
    expect(sanitizeMenuIconSvg("not svg at all")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(sanitizeMenuIconSvg("")).toBeNull();
    expect(sanitizeMenuIconSvg("   ")).toBeNull();
  });
});

describe("sanitizeMenuIconToDataUrl (K12)", () => {
  it("encodes sanitized markup as an svg data URL", () => {
    const dirty =
      '<svg onload="alert(1)"><script>alert(2)</script>' +
      '<foreignObject><body onload="x"/><p>t</p></foreignObject>' +
      '<path d="M4 4h16" stroke="#fff" stroke-width="2"/>' +
      '<circle cx="12" cy="12" r="3" href="javascript:alert(3)"/></svg>';
    const url = sanitizeMenuIconToDataUrl(dirty);
    expect(url).not.toBeNull();
    expect(url?.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);

    const decoded = decodeURIComponent(url!.slice("data:image/svg+xml;charset=utf-8,".length));
    expect(decoded).toContain("<path");
    expect(decoded).toContain("<circle");
    expect(decoded).not.toContain("<script");
    expect(decoded).not.toContain("script");
    expect(decoded).not.toContain("onload");
    expect(decoded).not.toContain("href");
    expect(decoded).not.toContain("foreignObject");
    expect(decoded).not.toContain("<p>");
    expect(decoded).not.toContain("<body");
  });

  it("returns null when the input cannot be sanitized", () => {
    expect(sanitizeMenuIconToDataUrl("<svg><path</svg>")).toBeNull();
  });
});
