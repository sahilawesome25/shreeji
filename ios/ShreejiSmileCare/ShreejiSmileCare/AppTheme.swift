import Foundation
import SwiftUI

/// Colors converted 1:1 from the Claude Design prototype's oklch() values
/// (teal / gold / white palette) to sRGB hex.
extension Color {
    init(hex: String, opacity: Double = 1) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        s.removeAll { $0 == "#" }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        let r = Double((v >> 16) & 0xFF) / 255
        let g = Double((v >> 8) & 0xFF) / 255
        let b = Double(v & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}

enum AppTheme {
    // Brand
    static let teal = Color(hex: "#004e4e")
    static let tealMuted = Color(hex: "#999fa4")
    static let gold = Color(hex: "#ca9d33")
    static let red = Color(hex: "#cf4040")
    static let green = Color(hex: "#439458")

    // Text
    static let textPrimary = Color(hex: "#141c21")
    static let textSecondary = Color(hex: "#646a6e")
    static let textTertiary = Color(hex: "#7b8186")
    static let textMuted40 = Color(hex: "#43494d")
    static let textMuted30 = Color(hex: "#292f32")

    // Surfaces
    static let screenBackground = Color(hex: "#f9f8f5")
    static let cardBorder = Color(hex: "#dfdeda")
    static let inputBorder = Color(hex: "#d9d7d3")
    static let progressTrack = Color(hex: "#eae8e2")
    static let segmentBackground = Color(hex: "#edebe5")

    // Home stat cards
    static let goldCardText = Color(hex: "#281e06")
    static let quickActionTealIconBg = Color(hex: "#ddf0ef")
    static let quickActionGoldIconBg = Color(hex: "#f6eed8")
    static let quickActionGoldIconFg = Color(hex: "#7d5e07")

    // Badges (patients list)
    static let badgeOverdueBg = Color(hex: "#ffe5e1")
    static let badgeNewBg = Color(hex: "#f6eed8")
    static let badgeNewFg = Color(hex: "#673e00")
    static let badgeActiveBg = Color(hex: "#def1e1")

    // Error banners
    static let errorBg = Color(hex: "#ffe8e4")
    static let errorFg = Color(hex: "#972527")

    // Allergy / alerts card
    static let allergyBg = Color(hex: "#ffefe6").opacity(0.5)
    static let allergyBorder = Color(hex: "#f1c1b1")
    static let allergyHeader = Color(hex: "#8a3819")
    static let allergyBody = Color(hex: "#4e1c0a")

    // Treatment status
    static let statusCompletedBg = Color(hex: "#def1e1")
    static let statusInProgressBg = Color(hex: "#f6eed8")
    static let statusInProgressFg = Color(hex: "#6e5000")
    static let statusPlannedBg = Color(hex: "#edebe5")
    static let statusPlannedFg = Color(hex: "#5e6468")

    static let avatarPalette: [(bg: Color, fg: Color)] = [
        (Color(hex: "#c8e5e4"), Color(hex: "#004e4e")),
        (Color(hex: "#f4e3bf"), Color(hex: "#523400")),
        (Color(hex: "#d3e3f5"), Color(hex: "#213c59")),
        (Color(hex: "#fedbd5"), Color(hex: "#6a2d24")),
    ]
}
