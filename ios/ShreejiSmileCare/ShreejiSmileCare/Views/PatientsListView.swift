import SwiftUI

struct PatientsListView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Patients")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundColor(AppTheme.textPrimary)
                    Spacer()
                    Button(action: store.openAddPatient) {
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

                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(AppTheme.textTertiary)
                        .font(.system(size: 14))
                    TextField("Search patients...", text: $store.patientSearch)
                        .font(.system(size: 14.5))
                        .foregroundColor(AppTheme.textPrimary)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .background(Color.white)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(AppTheme.cardBorder, lineWidth: 1))
                .cornerRadius(12)
                .padding(.bottom, 12)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(PatientFilter.allCases, id: \.self) { f in
                            FilterChip(label: f.label, isActive: store.patientFilter == f) {
                                store.patientFilter = f
                            }
                        }
                    }
                }
                .padding(.bottom, 16)

                if store.noPatientResults {
                    EmptyStateText(text: "No patients match your search.")
                } else {
                    VStack(spacing: 8) {
                        ForEach(store.filteredPatients) { p in
                            let avatar = store.avatar(for: p)
                            let badge = store.badge(for: p)
                            CardRow(action: { store.openPatient(p.id) }) {
                                HStack(spacing: 12) {
                                    AvatarView(initials: p.initials, bg: avatar.bg, fg: avatar.fg)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(p.name)
                                            .font(.system(size: 14.5, weight: .semibold))
                                            .foregroundColor(AppTheme.textPrimary)
                                        Text("\(p.age) yrs · \(p.gender) · Last visit \(p.lastVisit)")
                                            .font(.system(size: 12))
                                            .foregroundColor(AppTheme.textSecondary)
                                            .lineLimit(1)
                                    }
                                }
                            } trailing: {
                                Text(badge.label)
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(badge.fg)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(badge.bg)
                                    .cornerRadius(8)
                            }
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
