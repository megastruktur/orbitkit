// scripts/ci/get_window.swift
// Queries window bounds (x y w h) for a given window title or owner name.
import Cocoa
import CoreGraphics
import Foundation

let args = CommandLine.arguments
let targetTitle = args.count > 1 ? args[1] : ""

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    exit(1)
}

for win in windowList {
    let name = win[kCGWindowName as String] as? String ?? ""
    let owner = win[kCGWindowOwnerName as String] as? String ?? ""
    let bounds = win[kCGWindowBounds as String] as? [String: CGFloat] ?? [:]
    let w = Int(bounds["Width"] ?? 0)
    let h = Int(bounds["Height"] ?? 0)
    let x = Int(bounds["X"] ?? 0)
    let y = Int(bounds["Y"] ?? 0)

    // Match exact title or fallback to owner "starter" for main window
    if !targetTitle.isEmpty {
        if name == targetTitle {
            print("\(x) \(y) \(w) \(h)")
            exit(0)
        }
        // Fallback for main window: if target is "orbitkit" and owner is "starter", matches 800x600 window
        if targetTitle == "orbitkit" && owner == "starter" && w >= 700 {
            print("\(x) \(y) \(w) \(h)")
            exit(0)
        }
        // Fallback for mascot window: if target is "orbitkit-mascot" and owner is "starter" and window is square ~296x296
        if targetTitle == "orbitkit-mascot" && owner == "starter" && w >= 250 && w <= 350 && h >= 250 && h <= 350 {
            print("\(x) \(y) \(w) \(h)")
            exit(0)
        }
        // Fallback for Notes popup: if target is "Notes" and owner is "starter" and window is ~320x420
        if targetTitle == "Notes" && owner == "starter" && w >= 300 && w <= 360 && h >= 400 && h <= 460 {
            print("\(x) \(y) \(w) \(h)")
            exit(0)
        }
    }
}

exit(1)
