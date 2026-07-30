import SwiftUI

struct PatientDetailView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        let patient = store.selectedPatient

        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Button(action: store.backFromDetail) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 13, weight: .bold))
                        Text("Back")
                            .font(.system(size: 14.5, weight: .semibold))
                    }
                    .foregroundColor(AppTheme.teal)
                }
                .buttonStyle(.plain)
                .padding(.bottom, 14)

                if let patient {
                    let avatar = store.avatar(for: patient)
                    HStack(spacing: 14) {
                        AvatarView(initials: patient.initials, bg: avatar.bg, fg: avatar.fg, size: 60, corner: 16, fontSize: 19)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(patient.name)
                                .font(.system(size: 19, weight: .bold))
                                .foregroundColor(AppTheme.textPrimary)
                            Text("\(patient.age) yrs · \(patient.gender) · \(patient.phone)")
                                .font(.system(size: 13))
                                .foregroundColor(AppTheme.textSecondary)
                        }
                        Spacer()
                    }
                    .padding(.bottom, 16)

                    HStack(spacing: 6) {
                        ForEach(DetailTab.allCases, id: \.self) { tab in
                            let active = store.detailTab == tab
                            Button(action: { store.detailTab = tab }) {
                                Text(tab.label)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(active ? AppTheme.teal : AppTheme.textSecondary)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                                    .background(active ? Color.white : Color.clear)
                                    .cornerRadius(9)
                                    .shadow(color: active ? .black.opacity(0.08) : .clear, radius: 3, y: 1)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(4)
                    .background(AppTheme.segmentBackground)
                    .cornerRadius(12)
                    .padding(.bottom, 18)

                    Group {
                        switch store.detailTab {
                        case .overview: OverviewTab(patient: patient)
                        case .treatment: TreatmentTab(patient: patient)
                        case .billing: BillingTab(patient: patient)
                        case .photos: PhotosTab(patient: patient)
                        case .rx: RxTab(patient: patient)
                        }
                    }
                } else {
                    EmptyStateText(text: "Patient not found.")
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(AppTheme.screenBackground)
    }
}

private struct OverviewTab: View {
    let patient: Patient
    var body: some View {
        VStack(spacing: 14) {
            InfoCard(title: "Contact") {
                Text("DOB \(patient.dob)\n\(patient.address)")
                    .font(.system(size: 13.5))
                    .foregroundColor(AppTheme.textPrimary)
                    .lineSpacing(6)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("ALLERGIES / ALERTS")
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.5)
                    .foregroundColor(AppTheme.allergyHeader)
                Text(patient.allergies)
                    .font(.system(size: 13.5))
                    .foregroundColor(AppTheme.allergyBody)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(AppTheme.allergyBg)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppTheme.allergyBorder, lineWidth: 1))
            .cornerRadius(14)

            InfoCard(title: "Dental notes") {
                Text(patient.medicalNotes)
                    .font(.system(size: 13.5))
                    .foregroundColor(AppTheme.textPrimary)
                    .lineSpacing(6)
            }
        }
    }
}

private struct InfoCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .textCase(.uppercase)
                .font(.system(size: 12, weight: .bold))
                .tracking(0.5)
                .foregroundColor(AppTheme.textSecondary)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.white)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppTheme.cardBorder, lineWidth: 1))
        .cornerRadius(14)
    }
}

private struct TreatmentTab: View {
    let patient: Patient
    var body: some View {
        VStack(spacing: 10) {
            ForEach(patient.treatments) { tr in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(tr.name)
                            .font(.system(size: 14.5, weight: .semibold))
                            .foregroundColor(AppTheme.textPrimary)
                        Spacer()
                        StatusPill(status: tr.status)
                    }
                    Text("Started \(tr.date)")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.textSecondary)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3).fill(AppTheme.progressTrack)
                            RoundedRectangle(cornerRadius: 3)
                                .fill(tr.status == "Completed" ? AppTheme.green : AppTheme.teal)
                                .frame(width: geo.size.width * CGFloat(tr.progress) / 100)
                        }
                    }
                    .frame(height: 6)
                }
                .padding(14)
                .background(Color.white)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppTheme.cardBorder, lineWidth: 1))
                .cornerRadius(14)
            }
            if patient.treatments.isEmpty {
                EmptyStateText(text: "No treatments recorded yet.")
            }
        }
    }
}

private struct StatusPill: View {
    let status: String
    var body: some View {
        let (bg, fg): (Color, Color) = {
            switch status {
            case "Completed": return (AppTheme.statusCompletedBg, AppTheme.green)
            case "In Progress": return (AppTheme.statusInProgressBg, AppTheme.statusInProgressFg)
            default: return (AppTheme.statusPlannedBg, AppTheme.statusPlannedFg)
            }
        }()
        Text(status)
            .font(.system(size: 10.5, weight: .bold))
            .foregroundColor(fg)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(bg)
            .cornerRadius(7)
    }
}

private struct BillingTab: View {
    @EnvironmentObject var store: AppStore
    let patient: Patient

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Balance due")
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundColor(Color(hex: "#d0e2e2"))
                Spacer()
                Text("₹\(patient.balance)")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)
            }
            .padding(14)
            .background(AppTheme.teal)
            .cornerRadius(14)

            VStack(spacing: 8) {
                ForEach(patient.invoices) { inv in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(inv.description)
                                .font(.system(size: 13.5, weight: .semibold))
                                .foregroundColor(AppTheme.textPrimary)
                            Text(inv.date)
                                .font(.system(size: 11.5))
                                .foregroundColor(AppTheme.textSecondary)
                        }
                        Spacer()
                        Text("₹\(inv.amount)")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(AppTheme.textPrimary)
                        Button {
                            Task { await store.togglePaid(inv) }
                        } label: {
                            Text(inv.paid ? "Paid" : "Mark Paid")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(inv.paid ? AppTheme.green : .white)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(inv.paid ? AppTheme.statusCompletedBg : AppTheme.teal)
                                .cornerRadius(8)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Color.white)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(AppTheme.cardBorder, lineWidth: 1))
                    .cornerRadius(12)
                }
                if patient.invoices.isEmpty {
                    EmptyStateText(text: "No invoices yet.")
                }
            }
        }
    }
}

private struct PhotosTab: View {
    let patient: Patient
    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        if patient.photos.isEmpty {
            EmptyStateText(text: "No photos uploaded yet.")
        } else {
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(patient.photos) { photo in
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(AppTheme.progressTrack)
                        .aspectRatio(1, contentMode: .fit)
                        .overlay(
                            Text(photo.label)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(AppTheme.textMuted40)
                                .multilineTextAlignment(.center)
                                .padding(8)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(AppTheme.cardBorder, lineWidth: 1))
                }
            }
        }
    }
}

private struct RxTab: View {
    let patient: Patient
    var body: some View {
        VStack(spacing: 8) {
            ForEach(patient.rx) { r in
                VStack(alignment: .leading, spacing: 2) {
                    Text(r.drug)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(AppTheme.textPrimary)
                    Text("\(r.dosage) · prescribed \(r.date)")
                        .font(.system(size: 12.5))
                        .foregroundColor(AppTheme.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color.white)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(AppTheme.cardBorder, lineWidth: 1))
                .cornerRadius(12)
            }
            if patient.rx.isEmpty {
                EmptyStateText(text: "No prescriptions recorded.")
            }
        }
    }
}
