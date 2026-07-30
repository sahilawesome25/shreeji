import SwiftUI

struct AddAppointmentView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Button("Cancel", action: store.cancelAddAppt)
                        .font(.system(size: 15))
                        .foregroundColor(AppTheme.textSecondary)
                    Spacer()
                    Text("New Appointment")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(AppTheme.textPrimary)
                    Spacer()
                    Button {
                        Task { await store.submitAddAppt() }
                    } label: {
                        Text("Save")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(AppTheme.teal)
                    }
                    .disabled(store.isSubmitting)
                }
                .padding(.bottom, 16)

                if !store.addApptError.isEmpty {
                    ErrorBanner(message: store.addApptError)
                        .padding(.bottom, 12)
                }

                VStack(spacing: 12) {
                    FormPickerField(
                        label: "Patient", selection: $store.naForm.patientId,
                        options: patientPickerOptions
                    )

                    HStack(spacing: 10) {
                        FormDateField(
                            label: "Date",
                            date: Binding(
                                get: { isoStringToDate(store.naForm.date) },
                                set: { store.naForm.date = dateToIsoString($0) }
                            )
                        )
                        FormTimeField(
                            label: "Time",
                            date: Binding(
                                get: { timeStringToDate(store.naForm.time) },
                                set: { store.naForm.time = dateToTimeString($0) }
                            )
                        )
                    }

                    FormPickerField(
                        label: "Treatment type", selection: $store.naForm.type,
                        options: treatmentTypes.map { ($0, $0) }
                    )

                    FormPickerField(
                        label: "Duration (min)", selection: $store.naForm.duration,
                        options: appointmentDurations.map { ($0, $0) }
                    )

                    FormTextArea(label: "Notes", text: $store.naForm.notes)
                }
                .padding(.bottom, 32)
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
        }
        .background(AppTheme.screenBackground)
    }

    private var patientPickerOptions: [(value: String, label: String)] {
        var options: [(value: String, label: String)] = [(value: "", label: "Select patient…")]
        for p in store.patientOptions {
            options.append((value: p.id, label: p.name))
        }
        return options
    }
}
