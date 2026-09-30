// scripts/ci/get_window.swift
// Queries window bounds (x y w h) for a given window title or owner name.
//
// 0.2.0 notes: the mascot window is no longer 296x296 — demoWindowFit sizes
// it to the fixed 360x288 content union, so the owner-name fallback now
// matches that rect. `--all` prints EVERY on-screen match, one "x y w h"
// line per window (used to count Notes popups). `--screen` prints the main
// display bounds "x y w h" (no PyObjC dependency in the driver).
import Cocoa
import CoreGraphics
import Foundation

let args = CommandLine.arguments
if args.contains("--screen") {
    let b = CGDisplayBounds(CGMainDisplayID())
    print("\(Int(b.origin.x)) \(Int(b.origin.y)) \(Int(b.size.width)) \(Int(b.size.height))")
    exit(0)
}
// --pid <pid>: every on-screen window owned by that PID as
// "title|x y w h" (title may be empty when Screen Recording TCC redacts
// window names, e.g. SSH sessions) — used by peer validation probes.
if args.count > 2, args[1] == "--pid", let pid = pid_t(args[2]) {
    if let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] {
        for win in list {
            let ownerPid = win[kCGWindowOwnerPID as String] as? Int ?? -1
            if ownerPid == Int(pid) {
                let name = win[kCGWindowName as String] as? String ?? ""
                let bounds = win[kCGWindowBounds as String] as? [String: CGFloat] ?? [:]
                let w = Int(bounds["Width"] ?? 0)
                let h = Int(bounds["Height"] ?? 0)
                let x = Int(bounds["X"] ?? 0)
                let y = Int(bounds["Y"] ?? 0)
                print("\(name)|\(x) \(y) \(w) \(h)")
            }
        }
        exit(0)
    }
    exit(1)
}
let targetTitle = args.count > 1 ? args[1] : ""
let listAll = args.contains("--all")

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    exit(1)
}

var printed = 0
for win in windowList {
    let name = win[kCGWindowName as String] as? String ?? ""
    let owner = win[kCGWindowOwnerName as String] as? String ?? ""
    let bounds = win[kCGWindowBounds as String] as? [String: CGFloat] ?? [:]
    let w = Int(bounds["Width"] ?? 0)
    let h = Int(bounds["Height"] ?? 0)
    let x = Int(bounds["X"] ?? 0)
    let y = Int(bounds["Y"] ?? 0)

    // Match exact title or fallback to owner "starter" for main window
    var matched = false
    if !targetTitle.isEmpty {
        if name == targetTitle {
            matched = true
        }
        // Fallback for main window: if target is "orbitkit" and owner is "starter", matches 800x600 window
        else if targetTitle == "orbitkit" && owner == "starter" && w >= 700 {
            matched = true
        }
        // Fallback for mascot window (0.2.0): fixed Design-B surface 360x288
        else if targetTitle == "orbitkit-mascot" && owner == "starter" && w >= 340 && w <= 380 && h >= 270 && h <= 310 {
            matched = true
        }
        // Fallback for Notes popup: if target is "Notes" and owner is "starter" and window is ~320x420
        else if targetTitle == "Notes" && owner == "starter" && w >= 300 && w <= 360 && h >= 400 && h <= 460 {
            matched = true
        }
    }
    if matched {
        print("\(x) \(y) \(w) \(h)")
        printed += 1
        if !listAll {
            exit(0)
        }
    }
}

if listAll {
    exit(0)
}
exit(1)
