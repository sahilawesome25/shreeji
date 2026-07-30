import SwiftUI

struct AddPatientView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Button("Cancel", action: store.cancelAddPatient)
                        .font(.system(size: 15))
                        .foregroundColor(AppTheme.textSecondary)
                    Spacer()
                    Text("New Patient")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(AppTheme.textPrimary)
                    Spacer()
                    Button {
                        Task { await store.submitAddPatient() }
                    } label: {
                        Text("Save")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(AppTheme.teal)
                    }
                    .disabled(store.isSubmitting)
                }
                .padding(.bottom, 16)

                if !store.addPatientError.isEmpty {
                    ErrorBanner(message: store.addPatientError)
                        .padding(.bottom, 12)
                }

                VStack(spacing: 12) {
                    FormField(label: "Full name", text: $store.npForm.name, placeholder: "e.g. Aarav Shah")

                    HStack(spacing: 10) {
                        FormField(label: "Age", text: $store.npForm.age, keyboardType: .numberPad)
                        FormPickerField(
                            label: "Gender", selection: $store.npForm.gender,
                            options: [("Female", "Female"), ("Male", "Male"), ("Other", "Other")]
                        )
                    }

                    FormField(label: "Phone", text: $store.npForm.phone, placeholder: "+91 98xxxxxxx", keyboardType: .phonePad)

                    FormDateField(
                        label: "Date of birth",
                        date: Binding(
                            get: { store.npForm.dob.isEmpty ? Date() : isoStringToDate(store.npForm.dob) },
                            set: { store.npForm.dob = dateToIsoString($0) }
                        )
                    )

                    FormField(label: "Address", text: $store.npForm.address)
                    FormField(label: "Allergies / medical alerts", text: $store.npForm.allergies, placeholder: "None known")
                    FormTextArea(label: "Dental notes", text: $store.npForm.medicalNotes)
                }
                .padding(.bottom, 32)
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
        }
        .background(AppTheme.screenBackground)
    }
}
