//! K11 (popups-anchor): pure popup placement math in physical pixels.
//!
//! Ported from CuteCare `desktop/src-tauri/src/geometry.rs` (`place_popup`,
//! `center_in`): six anchor-relative candidates in priority order
//! (`above-right`, `above-left`, `side-right`, `side-left`, `below-right`,
//! `below-left`); the first that fits the monitor work area with pad wins,
//! otherwise candidate #0 is clamped into the work area. Flip-at-edges and
//! the final clamp keep the popup fully visible; DPI scaling is the
//! caller's job — physical px in, physical px out (K9/K11).

use crate::PhysRect;

/// Gap between mascot and popup (physical px; CuteCare `POPUP_GAP`).
pub const POPUP_GAP: i32 = 14;
/// Margin to the work-area edges (physical px; CuteCare `POPUP_PAD`).
pub const POPUP_PAD: i32 = 12;

/// Physical-pixel size (K11).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PhysSize {
    pub width: i32,
    pub height: i32,
}

impl PhysSize {
    pub const fn new(width: i32, height: i32) -> Self {
        Self { width, height }
    }
}

/// Physical-pixel window origin (K11).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PhysPos {
    pub x: i32,
    pub y: i32,
}

impl PhysPos {
    pub const fn new(x: i32, y: i32) -> Self {
        Self { x, y }
    }
}

/// Side the popup slides out from (CuteCare `PopupSide`). `Clamped` — no
/// candidate fit; the position was clamped into the work area.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PopupSide {
    AboveRight,
    AboveLeft,
    SideRight,
    SideLeft,
    BelowRight,
    BelowLeft,
    Clamped,
}

/// Placement result: window origin + slide-out side.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Placement {
    pub pos: PhysPos,
    pub side: PopupSide,
}

fn rect_right(rect: PhysRect) -> i32 {
    rect.x + rect.width as i32
}

fn rect_bottom(rect: PhysRect) -> i32 {
    rect.y + rect.height as i32
}

/// K11: place the popup next to the mascot `anchor` inside the monitor
/// `work` area, flipping horizontally/vertically at work-area edges and
/// clamping as a last resort. Contract signature; the work-area pad is the
/// CuteCare default `POPUP_PAD`.
pub fn place_popup(anchor: PhysRect, size: PhysSize, work: PhysRect, gap: i32) -> PhysPos {
    place_popup_with_pad(anchor, size, work, gap, POPUP_PAD).pos
}

/// Full placement with an explicit work-area pad (CuteCare signature; the
/// ported test table asserts on the side).
pub fn place_popup_with_pad(
    anchor: PhysRect,
    size: PhysSize,
    work: PhysRect,
    gap: i32,
    pad: i32,
) -> Placement {
    let candidates: [(PopupSide, i32, i32); 6] = [
        // Above the mascot, sliding out right of the anchor's right edge.
        (
            PopupSide::AboveRight,
            rect_right(anchor) + gap,
            anchor.y - size.height - gap,
        ),
        // Above the mascot, left of the anchor's left edge.
        (
            PopupSide::AboveLeft,
            anchor.x - size.width - gap,
            anchor.y - size.height - gap,
        ),
        // Sides: popup bottom edge level with the mascot bottom edge (for
        // tall windows when "above" does not fit).
        (
            PopupSide::SideRight,
            rect_right(anchor) + gap,
            rect_bottom(anchor) - size.height,
        ),
        (
            PopupSide::SideLeft,
            anchor.x - size.width - gap,
            rect_bottom(anchor) - size.height,
        ),
        (
            PopupSide::BelowRight,
            rect_right(anchor) + gap,
            rect_bottom(anchor) + gap,
        ),
        (
            PopupSide::BelowLeft,
            anchor.x - size.width - gap,
            rect_bottom(anchor) + gap,
        ),
    ];

    let fits = |x: i32, y: i32| {
        x >= work.x + pad
            && y >= work.y + pad
            && x + size.width <= rect_right(work) - pad
            && y + size.height <= rect_bottom(work) - pad
    };

    for (side, x, y) in candidates {
        if fits(x, y) {
            return Placement {
                pos: PhysPos::new(x, y),
                side,
            };
        }
    }

    // Nothing fits: clamp candidate #0 into the work area — full visibility
    // beats edge attachment.
    let (_, x0, y0) = candidates[0];
    let x_min = work.x + pad;
    let y_min = work.y + pad;
    Placement {
        pos: PhysPos::new(
            x0.clamp(x_min, (rect_right(work) - pad - size.width).max(x_min)),
            y0.clamp(y_min, (rect_bottom(work) - pad - size.height).max(y_min)),
        ),
        side: PopupSide::Clamped,
    }
}

/// K11: centre the popup in the work area (CuteCare `center_in`).
pub fn center_in(work: PhysRect, size: PhysSize) -> PhysPos {
    PhysPos::new(
        work.x + (work.width as i32 - size.width) / 2,
        work.y + (work.height as i32 - size.height) / 2,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Typical desktop 1920×1080 (physical px, DPI 100%).
    const FULL_HD: PhysRect = PhysRect {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
    };
    const GAP: i32 = POPUP_GAP;
    const PAD: i32 = POPUP_PAD;

    fn rect(x: i32, y: i32, width: i32, height: i32) -> PhysRect {
        PhysRect {
            x,
            y,
            width: width as u32,
            height: height as u32,
        }
    }

    #[test]
    fn open_space_prefers_above_right() {
        // Mascot in the middle: top ≥ 586 (560+14+12) makes above-right fit.
        let anchor = rect(900, 700, 200, 220);
        let p = place_popup_with_pad(anchor, PhysSize::new(380, 560), FULL_HD, GAP, PAD);
        assert_eq!(p.side, PopupSide::AboveRight);
        assert_eq!(p.pos.x, rect_right(anchor) + GAP);
        assert_eq!(p.pos.y + 560 + GAP, anchor.y);
    }

    #[test]
    fn side_candidate_bottom_aligns_with_anchor_bottom() {
        // side-* rule: popup bottom edge == mascot bottom edge.
        // Anchor at the top edge (above does not fit) but bottom ≥ 560+PAD.
        let anchor = rect(900, 360, 200, 220);
        let p = place_popup_with_pad(anchor, PhysSize::new(380, 560), FULL_HD, GAP, PAD);
        assert_eq!(p.side, PopupSide::SideRight);
        assert_eq!(p.pos.y + 560, rect_bottom(anchor));
        assert_eq!(p.pos.x, rect_right(anchor) + GAP);
    }

    // -- flip at edges ------------------------------------------------------

    #[test]
    fn right_edge_flips_left() {
        // Mascot at the right edge: above-right fails on X → above-left.
        let anchor = rect(1700, 700, 200, 220);
        let p = place_popup_with_pad(anchor, PhysSize::new(380, 560), FULL_HD, GAP, PAD);
        assert_eq!(p.side, PopupSide::AboveLeft);
        assert_eq!(p.pos.x + 380 + GAP, anchor.x);
    }

    #[test]
    fn top_edge_rejects_above() {
        // Mascot at the top edge: above-* fail on Y; window goes below.
        let anchor = rect(900, 16, 200, 220);
        let p = place_popup_with_pad(anchor, PhysSize::new(380, 560), FULL_HD, GAP, PAD);
        assert_eq!(p.side, PopupSide::BelowRight);
        assert_eq!(p.pos.y, rect_bottom(anchor) + GAP);
    }

    #[test]
    fn top_edge_small_popup_uses_side() {
        // Quick-ask (320×52) at the top edge: below not needed — fits on the
        // side, bottom edge level with the mascot.
        let anchor = rect(900, 16, 200, 220);
        let p = place_popup_with_pad(anchor, PhysSize::new(320, 52), FULL_HD, GAP, PAD);
        assert_eq!(p.side, PopupSide::SideRight);
        assert_eq!(p.pos.y + 52, rect_bottom(anchor));
    }

    #[test]
    fn bottom_edge_prefers_above() {
        // Mascot at the bottom edge: below-* do not fit → first fitting = above.
        let anchor = rect(900, 860, 200, 220);
        let p = place_popup_with_pad(anchor, PhysSize::new(380, 560), FULL_HD, GAP, PAD);
        assert_eq!(p.side, PopupSide::AboveRight);
        assert_eq!(p.pos.y + 560 + GAP, anchor.y);
    }

    #[test]
    fn nothing_fits_clamps_inside_work_area() {
        // Monitor smaller than the window: clamp must land INSIDE the area.
        let tiny = rect(0, 0, 480, 320);
        let anchor = rect(200, 100, 200, 220);
        let p = place_popup_with_pad(anchor, PhysSize::new(560, 700), tiny, GAP, PAD);
        assert_eq!(p.side, PopupSide::Clamped);
        assert_eq!(p.pos.x, PAD);
        assert_eq!(p.pos.y, PAD);
    }

    // -- multi-monitor layouts ------------------------------------------------

    #[test]
    fn second_monitor_left_of_primary() {
        // Second monitor to the left: negative coordinates. Candidates must
        // be evaluated in THIS monitor's coordinates, not the primary's.
        let wa = rect(-1920, 0, 1920, 1080);
        let anchor = rect(-1500, 600, 200, 220);
        let p = place_popup_with_pad(anchor, PhysSize::new(380, 560), wa, GAP, PAD);
        assert_eq!(p.side, PopupSide::AboveRight);
        assert!(p.pos.x >= wa.x + PAD && p.pos.x + 380 <= rect_right(wa) - PAD);
        assert!(p.pos.y >= wa.y + PAD && p.pos.y + 560 <= rect_bottom(wa) - PAD);
    }

    #[test]
    fn second_monitor_right_edge_flips() {
        // Mascot at the right edge of the SECOND monitor: flips left, not
        // onto the first monitor.
        let wa = rect(1920, 0, 1920, 1080);
        let anchor = rect(3620, 600, 200, 220);
        let p = place_popup_with_pad(anchor, PhysSize::new(380, 560), wa, GAP, PAD);
        assert_eq!(p.side, PopupSide::AboveLeft);
        assert!(p.pos.x >= wa.x + PAD);
    }

    // -- DPI ≠ 100% --------------------------------------------------------------

    #[test]
    fn dpi_150_physical_pixels() {
        // Logical 1280×720 at scale 1.5 → physical 1920×1080; chat window
        // 380×560 logical → 570×840 physical. Everything physical.
        let wa = rect(0, 0, 1920, 1080);
        let scale = 1.5_f64;
        let anchor = rect(
            (700.0 * scale) as i32,
            (700.0 * scale) as i32,
            (133.0 * scale) as i32,
            (147.0 * scale) as i32,
        );
        let p = place_popup_with_pad(
            anchor,
            PhysSize::new((380.0 * scale) as i32, (560.0 * scale) as i32),
            wa,
            (GAP as f64 * scale) as i32,
            (PAD as f64 * scale) as i32,
        );
        assert_eq!(p.side, PopupSide::AboveRight);
        assert!(p.pos.x + (380.0 * scale) as i32 <= rect_right(wa) - PAD);
        assert!(p.pos.y >= wa.y + PAD);
    }

    #[test]
    fn dpi_200_right_edge_flips() {
        // DPI 200%: logical 1280×720 → physical 2560×1440, mascot at the
        // right edge. top = 1172 = exactly the above lower bound (1120+28+24).
        let wa = rect(0, 0, 2560, 1440);
        let scale = 2.0_f64;
        let anchor = rect(2260, 1172, 266, 294);
        let p = place_popup_with_pad(
            anchor,
            PhysSize::new(760, 1120),
            wa,
            (GAP as f64 * scale) as i32,
            (PAD as f64 * scale) as i32,
        );
        assert_eq!(p.side, PopupSide::AboveLeft);
        assert!(p.pos.x >= wa.x + PAD);
        assert!(p.pos.x + 760 <= rect_right(wa) - PAD);
        assert_eq!(p.pos.y, (PAD as f64 * scale) as i32); // flush with the pad
    }

    // -- pages are centred -----------------------------------------------------

    #[test]
    fn pages_center_in_work_area() {
        let p = center_in(FULL_HD, PhysSize::new(720, 600));
        assert_eq!(p.x, (1920 - 720) / 2);
        assert_eq!(p.y, (1080 - 600) / 2);
    }

    #[test]
    fn center_second_monitor_uses_its_origin() {
        let wa = rect(-1920, 0, 1920, 1080);
        let p = center_in(wa, PhysSize::new(720, 600));
        assert_eq!(p.x, -1920 + (1920 - 720) / 2);
        assert_eq!(p.y, 240);
    }

    // -- contract-shape checks ---------------------------------------------------

    #[test]
    fn contract_signature_place_popup_returns_pos() {
        // K11: `place_popup(anchor, size, work, gap) -> PhysPos` with the
        // default pad built in (hand-computed: zero-sized mascot at origin,
        // AboveRight y0 = -494 does not fit → BelowRight (14, 14)).
        let pos = place_popup(
            rect(0, 0, 0, 0),
            PhysSize::new(320, 480),
            rect(0, 0, 1280, 800),
            POPUP_GAP,
        );
        assert_eq!(pos, PhysPos::new(14, 14));
    }
}
