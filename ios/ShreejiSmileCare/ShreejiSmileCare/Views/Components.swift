import Foundation
import SwiftUI

/// A rounded initials avatar, matching the prototype's per-patient palette.
struct AvatarView: View {
    let initials: String
    let bg: Color
    let fg: Color
    var size: CGFloat = 42
    var corner: CGFloat = 12
    var fontSize: CGFloat = 14

    var body: some View {
        RoundedRectangle(cornerRadius: corner, style: .continuous)
            .fill(bg)
            .frame(width: size, height: size)
            .overlay(
                Text(initials)
                    .font(.system(size: fontSize, weight: .bold))
                    .foregroundColor(fg)
            )
    }
}

/// Generic white card row: avatar + title/subtitle + trailing content.
struct CardRow<Trailing: View>: View {
    let action: () -> Void
    let content: AnyView
    let trailing: Trailing

    init(action: @escaping () -> Void, @ViewBuilder content: () -> some View, @ViewBuilder trailing: () -> Trailing) {
        self.action = action
        self.content = AnyView(content())
        self.trailing = trailing()
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                content
                Spacer(minLength: 0)
                trailing
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.white)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(AppTheme.cardBorder, lineWidth: 1)
            )
            .cornerRadius(14)
        }
        .buttonStyle(.plain)
    }
}

struct FilterChip: View {
    let label: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundColor(isActive ? .white : AppTheme.textMuted40)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(isActive ? AppTheme.teal : Color.white)
                .overlay(
                    Capsule().stroke(isActive ? AppTheme.teal : AppTheme.inputBorder, lineWidth: 1)
                )
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .fixedSize()
    }
}

struct ErrorBanner: View {
    let message: String
    var body: some View {
        Text(message)
            .font(.system(size: 12.5, weight: .semibold))
            .foregroundColor(AppTheme.errorFg)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppTheme.errorBg)
            .cornerRadius(10)
    }
}

struct EmptyStateText: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 13.5))
            .foregroundColor(AppTheme.textTertiary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 30)
            .multilineTextAlignment(.center)
    }
}

struct SectionLabel: View {
    let text: String
    var color: Color = AppTheme.textSecondary
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(color)
            .tracking(0.5)
    }
}

/// Standard bordered text field matching the prototype's input styling.
struct FormField: View {
    let label: String
    @Binding var text: String
    var placeholder: String = ""
    var keyboardType: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppTheme.textSecondary)
            TextField(placeholder, text: $text)
                .keyboardType(keyboardType)
                .font(.system(size: 14.5))
                .foregroundColor(AppTheme.textPrimary)
                .padding(.horizontal, 13)
                .padding(.vertical, 11)
                .overlay(
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(AppTheme.inputBorder, lineWidth: 1)
                )
        }
    }
}

struct FormDateField: View {
    let label: String
    @Binding var date: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppTheme.textSecondary)
            DatePicker("", selection: $date, displayedComponents: .date)
                .labelsHidden()
                .datePickerStyle(.compact)
                .padding(.horizontal, 13)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(AppTheme.inputBorder, lineWidth: 1)
                )
        }
    }
}

struct FormTimeField: View {
    let label: String
    @Binding var date: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppTheme.textSecondary)
            DatePicker("", selection: $date, displayedComponents: .hourAndMinute)
                .labelsHidden()
                .datePickerStyle(.compact)
                .padding(.horizontal, 13)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(AppTheme.inputBorder, lineWidth: 1)
                )
        }
    }
}

struct FormPickerField<SelectionValue: Hashable>: View {
    let label: String
    @Binding var selection: SelectionValue
    let options: [(value: SelectionValue, label: String)]

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppTheme.textSecondary)
            Menu {
                Picker(selection: $selection) {
                    ForEach(options, id: \.value) { opt in
                        Text(opt.label).tag(opt.value)
                    }
                } label: {
                    EmptyView()
                }
            } label: {
                HStack {
                    Text(options.first(where: { $0.value == selection })?.label ?? "")
                        .font(.system(size: 14.5))
                        .foregroundColor(AppTheme.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.textTertiary)
                }
                .padding(.horizontal, 13)
                .padding(.vertical, 11)
                .overlay(
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(AppTheme.inputBorder, lineWidth: 1)
                )
            }
        }
    }
}

struct FormTextArea: View {
    let label: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppTheme.textSecondary)
            TextEditor(text: $text)
                .font(.system(size: 14.5))
                .foregroundColor(AppTheme.textPrimary)
                .frame(height: 74)
                .padding(.horizontal, 9)
                .padding(.vertical, 7)
                .overlay(
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(AppTheme.inputBorder, lineWidth: 1)
                )
        }
    }
}

// MARK: - Date <-> ISO string helpers used by form pickers

func isoStringToDate(_ iso: String) -> Date {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    f.timeZone = TimeZone(identifier: "UTC")
    return f.date(from: iso) ?? Date()
}
func dateToIsoString(_ date: Date) -> String {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    f.timeZone = TimeZone(identifier: "UTC")
    return f.string(from: date)
}
func timeStringToDate(_ time: String) -> Date {
    let f = DateFormatter()
    f.dateFormat = "HH:mm"
    f.timeZone = TimeZone(identifier: "UTC")
    return f.date(from: time) ?? Date()
}
func dateToTimeString(_ date: Date) -> String {
    let f = DateFormatter()
    f.dateFormat = "HH:mm"
    f.timeZone = TimeZone(identifier: "UTC")
    return f.string(from: date)
}
func displayTime(_ time: String) -> String {
    let f = DateFormatter()
    f.dateFormat = "HH:mm"
    f.timeZone = TimeZone(identifier: "UTC")
    guard let d = f.date(from: time) else { return time }
    let out = DateFormatter()
    out.dateFormat = "h:mm a"
    out.timeZone = TimeZone(identifier: "UTC")
    return out.string(from: d)
}
