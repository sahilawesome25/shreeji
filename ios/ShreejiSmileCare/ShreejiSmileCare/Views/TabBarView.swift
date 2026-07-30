import SwiftUI

struct TabBarView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        HStack(spacing: 0) {
            TabBarItem(icon: "house.fill", label: "Home", isActive: store.screen == .home, action: store.goHome)
            TabBarItem(icon: "person.fill", label: "Patients", isActive: store.screen == .patients, action: store.goPatients)
            TabBarItem(icon: "calendar", label: "Schedule", isActive: store.screen == .appointments, action: store.goAppointments)
            TabBarItem(icon: "doc.text", label: "Billing", isActive: store.screen == .billing, action: store.goBilling)
        }
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 22)
        .background(.ultraThinMaterial)
        .overlay(Rectangle().fill(AppTheme.cardBorder).frame(height: 1), alignment: .top)
    }
}

private struct TabBarItem: View {
    let icon: String
    let label: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                Text(label)
                    .font(.system(size: 10.5, weight: .semibold))
            }
            .foregroundColor(isActive ? AppTheme.teal : AppTheme.tealMuted)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}
