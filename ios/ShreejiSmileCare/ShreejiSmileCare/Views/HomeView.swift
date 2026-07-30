import SwiftUI

struct HomeView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Good morning,")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(AppTheme.textSecondary)
                        Text("Dr. Ritika Mahajan")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundColor(AppTheme.textPrimary)
                    }
                    Spacer()
                    AvatarView(initials: "RM", bg: AppTheme.teal, fg: .white, size: 44, corner: 14, fontSize: 16)
                }
                .padding(.bottom, 18)

                Text("Shreeji Smile Care Clinic")
                    .textCase(.uppercase)
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.6)
                    .foregroundColor(AppTheme.textSecondary)
                    .padding(.bottom, 8)

                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(store.todaysAppointmentsRaw.count)")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundColor(.white)
                        Text("Appointments today")
                            .font(.system(size: 12.5, weight: .medium))
                            .foregroundColor(Color(hex: "#d0e2e2"))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(AppTheme.teal)
                    .cornerRadius(16)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(store.patients.count)")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundColor(AppTheme.goldCardText)
                        Text("Total patients")
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundColor(Color(hex: "#392c0c"))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(AppTheme.gold)
                    .cornerRadius(16)
                }
                .padding(.bottom, 22)

                HStack(spacing: 10) {
                    QuickActionButton(
                        title: "Add Patient", iconBg: AppTheme.quickActionTealIconBg, iconFg: AppTheme.teal,
                        action: store.openAddPatient
                    )
                    QuickActionButton(
                        title: "New Appointment", iconBg: AppTheme.quickActionGoldIconBg, iconFg: AppTheme.quickActionGoldIconFg,
                        action: store.openAddAppt
                    )
                }
                .padding(.bottom, 24)

                HStack {
                    Text("Today's schedule")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(AppTheme.textPrimary)
                    Spacer()
                    Button("See all", action: store.goAppointments)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(AppTheme.teal)
                }
                .padding(.bottom, 10)

                if store.todaysAppointments.isEmpty {
                    EmptyStateText(text: "No appointments scheduled today.")
                } else {
                    VStack(spacing: 8) {
                        ForEach(store.todaysAppointments, id: \.appt.id) { item in
                            CardRow(action: { store.openPatient(item.appt.patientId) }) {
                                HStack(spacing: 12) {
                                    Text(displayTime(item.appt.time))
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(AppTheme.teal)
                                        .frame(width: 68, alignment: .leading)
                                    Rectangle()
                                        .fill(AppTheme.cardBorder)
                                        .frame(width: 1)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.patientName)
                                            .font(.system(size: 14.5, weight: .semibold))
                                            .foregroundColor(AppTheme.textPrimary)
                                        Text(item.appt.type)
                                            .font(.system(size: 12.5))
                                            .foregroundColor(AppTheme.textSecondary)
                                    }
                                }
                            } trailing: { EmptyView() }
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(AppTheme.screenBackground)
    }
}

private struct QuickActionButton: View {
    let title: String
    let iconBg: Color
    let iconFg: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(iconBg)
                    .frame(width: 26, height: 26)
                    .overlay(
                        Text("+")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundColor(iconFg)
                    )
                Text(title)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundColor(AppTheme.textPrimary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.white)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppTheme.cardBorder, lineWidth: 1))
            .cornerRadius(14)
        }
        .buttonStyle(.plain)
    }
}
