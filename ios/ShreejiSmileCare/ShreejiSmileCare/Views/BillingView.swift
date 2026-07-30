import SwiftUI

struct BillingView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("Billing")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundColor(AppTheme.textPrimary)
                    .padding(.bottom, 14)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Total outstanding")
                        .font(.system(size: 12.5, weight: .medium))
                        .foregroundColor(Color(hex: "#d0e2e2"))
                    Text("₹\(store.totalOutstanding)")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(AppTheme.teal)
                .cornerRadius(16)
                .padding(.bottom, 20)

                Text("Pending payments")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(AppTheme.textPrimary)
                    .padding(.bottom, 10)

                if store.noBilling {
                    EmptyStateText(text: "All accounts settled. 🎉")
                } else {
                    VStack(spacing: 8) {
                        ForEach(store.billingPatients) { p in
                            let avatar = store.avatar(for: p)
                            CardRow(action: { store.openPatient(p.id) }) {
                                HStack(spacing: 12) {
                                    AvatarView(initials: p.initials, bg: avatar.bg, fg: avatar.fg)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(p.name)
                                            .font(.system(size: 14.5, weight: .semibold))
                                            .foregroundColor(AppTheme.textPrimary)
                                        Text("\(p.pendingInvoiceCount) pending invoice(s)")
                                            .font(.system(size: 12))
                                            .foregroundColor(AppTheme.textSecondary)
                                    }
                                }
                            } trailing: {
                                Text("₹\(p.balance)")
                                    .font(.system(size: 14.5, weight: .bold))
                                    .foregroundColor(AppTheme.red)
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
