import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        VStack(spacing: 0) {
            if store.isLoading && store.patients.isEmpty {
                Spacer()
                ProgressView()
                    .tint(AppTheme.teal)
                Spacer()
            } else if let error = store.loadError, store.patients.isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundColor(AppTheme.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                    Button("Retry") { Task { await store.loadAll() } }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(AppTheme.teal)
                        .cornerRadius(10)
                }
                Spacer()
            } else {
                Group {
                    switch store.screen {
                    case .home: HomeView()
                    case .patients: PatientsListView()
                    case .appointments: AppointmentsView()
                    case .billing: BillingView()
                    case .detail: PatientDetailView()
                    case .addPatient: AddPatientView()
                    case .addAppt: AddAppointmentView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                if store.showTabBar {
                    TabBarView()
                }
            }
        }
        .background(AppTheme.screenBackground)
        .task {
            if store.patients.isEmpty { await store.loadAll() }
        }
    }
}
