import SwiftUI

struct AppointmentsView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Appointments")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundColor(AppTheme.textPrimary)
                    Spacer()
                    Button(action: store.openAddAppt) {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(AppTheme.teal)
                            .frame(width: 34, height: 34)
                            .overlay(
                                Image(systemName: "plus")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.white)
                            )
                    }
                }
                .padding(.bottom, 14)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(store.weekDays, id: \.self) { iso in
                            let selected = iso == store.selectedDate
                            Button(action: { store.selectedDate = iso }) {
                                VStack(spacing: 2) {
                                    Text(dayOfWeekLabel(iso))
                                        .font(.system(size: 10.5, weight: .semibold))
                                        .opacity(0.75)
                                    Text("\(dayNumber(iso))")
                                        .font(.system(size: 16, weight: .bold))
                                    if store.hasAppointment(on: iso) {
                                        Circle()
                                            .fill(selected ? Color.white : AppTheme.teal)
                                            .frame(width: 4, height: 4)
                                            .padding(.top, 2)
                                    }
                                }
                                .foregroundColor(selected ? .white : AppTheme.textMuted30)
                                .frame(width: 46)
                                .padding(.vertical, 8)
                                .background(selected ? AppTheme.teal : Color.white)
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(selected ? AppTheme.teal : AppTheme.inputBorder, lineWidth: 1))
                                .cornerRadius(12)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.bottom, 16)

                Text(store.selectedDateLabel)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(AppTheme.textPrimary)
                    .padding(.bottom, 10)

                if store.noApptsThisDay {
                    EmptyStateText(text: "No appointments this day.")
                } else {
                    VStack(spacing: 8) {
                        ForEach(store.apptsForSelectedDay) { a in
                            CardRow(action: { store.openPatient(a.patientId) }) {
                                HStack(spacing: 12) {
                                    Text(displayTime(a.time))
                                        .font(.system(size: 13.5, weight: .bold))
                                        .foregroundColor(AppTheme.teal)
                                        .frame(width: 66, alignment: .leading)
                                    Rectangle().fill(AppTheme.cardBorder).frame(width: 1)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(store.patientName(for: a))
                                            .font(.system(size: 14.5, weight: .semibold))
                                            .foregroundColor(AppTheme.textPrimary)
                                        Text("\(a.type) · \(a.duration)min")
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
