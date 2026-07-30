import Foundation
import SwiftUI

@MainActor
final class AppStore: ObservableObject {
    private let api = APIClient.shared
    let today = isoDateToday()

    // Navigation
    @Published var screen: AppScreen = .home
    @Published var activeTab: AppScreen = .home
    @Published var detailTab: DetailTab = .overview
    @Published var selectedPatientId: String?

    // Data
    @Published var patients: [Patient] = []
    @Published var appointments: [Appointment] = []
    @Published var isLoading = false
    @Published var loadError: String?

    // Patients tab
    @Published var patientSearch: String = ""
    @Published var patientFilter: PatientFilter = .all

    // Appointments tab
    @Published var selectedDate: String

    // Forms
    @Published var addPatientError: String = ""
    @Published var addApptError: String = ""
    @Published var npForm = NewPatientForm()
    @Published var naForm: NewAppointmentForm
    @Published var isSubmitting = false

    init() {
        let t = isoDateToday()
        self.selectedDate = t
        self.naForm = NewAppointmentForm(date: t)
    }

    // MARK: - Loading

    func loadAll() async {
        isLoading = true
        loadError = nil
        do {
            async let p = api.fetchPatients()
            async let a = api.fetchAppointments()
            patients = try await p
            appointments = try await a
        } catch {
            loadError = "Couldn’t reach the server. Is the backend running?"
        }
        isLoading = false
    }

    // MARK: - Navigation

    func openPatient(_ id: String) {
        selectedPatientId = id
        detailTab = .overview
        screen = .detail
    }
    func backFromDetail() { screen = activeTab }

    func goHome() { screen = .home; activeTab = .home }
    func goPatients() { screen = .patients; activeTab = .patients }
    func goAppointments() { screen = .appointments; activeTab = .appointments }
    func goBilling() { screen = .billing; activeTab = .billing }

    var showTabBar: Bool {
        screen == .home || screen == .patients || screen == .appointments || screen == .billing
    }

    // MARK: - Home

    var todaysAppointmentsRaw: [Appointment] {
        appointments.filter { $0.date == today }.sorted { $0.time < $1.time }
    }
    var todaysAppointments: [(appt: Appointment, patientName: String)] {
        todaysAppointmentsRaw.map { a in
            (a, patients.first(where: { $0.id == a.patientId })?.name ?? "Unknown")
        }
    }

    // MARK: - Patients tab

    func balance(for p: Patient) -> Int { p.balance }

    var filteredPatients: [Patient] {
        let q = patientSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return patients.filter { p in
            if !q.isEmpty && !p.name.lowercased().contains(q) { return false }
            switch patientFilter {
            case .active: return p.status == "active"
            case .new: return p.status == "new"
            case .overdue: return p.balance > 0
            case .all: return true
            }
        }
    }
    var noPatientResults: Bool { filteredPatients.isEmpty }

    func badge(for p: Patient) -> (label: String, bg: Color, fg: Color) {
        if p.balance > 0 { return ("₹\(p.balance) due", AppTheme.badgeOverdueBg, AppTheme.red) }
        if p.status == "new" { return ("New", AppTheme.badgeNewBg, AppTheme.badgeNewFg) }
        return ("Active", AppTheme.badgeActiveBg, AppTheme.green)
    }

    func avatar(for p: Patient) -> (bg: Color, fg: Color) {
        (Color(hex: p.avatarBg), Color(hex: p.avatarFg))
    }

    // MARK: - Appointments tab

    var weekDays: [String] {
        let start = addDaysIso(today, -3)
        return (0..<7).map { addDaysIso(start, $0) }
    }
    func hasAppointment(on iso: String) -> Bool { appointments.contains { $0.date == iso } }

    var selectedDateLabel: String {
        selectedDate == today ? "Today, \(formatDisplayDate(selectedDate))" : formatDisplayDate(selectedDate)
    }
    var apptsForSelectedDay: [Appointment] {
        appointments.filter { $0.date == selectedDate }.sorted { $0.time < $1.time }
    }
    var noApptsThisDay: Bool { apptsForSelectedDay.isEmpty }
    func patientName(for appt: Appointment) -> String {
        patients.first(where: { $0.id == appt.patientId })?.name ?? "Unknown"
    }

    // MARK: - Billing tab

    var billingPatients: [Patient] {
        patients.filter { $0.balance > 0 }.sorted { $0.balance > $1.balance }
    }
    var totalOutstanding: Int { billingPatients.reduce(0) { $0 + $1.balance } }
    var noBilling: Bool { billingPatients.isEmpty }

    // MARK: - Detail

    var selectedPatient: Patient? {
        guard let id = selectedPatientId else { return nil }
        return patients.first(where: { $0.id == id })
    }

    func togglePaid(_ invoice: Invoice) async {
        guard let patientId = selectedPatientId else { return }
        do {
            let updated = try await api.setInvoicePaid(id: invoice.id, paid: !invoice.paid)
            guard let pIdx = patients.firstIndex(where: { $0.id == patientId }) else { return }
            guard let iIdx = patients[pIdx].invoices.firstIndex(where: { $0.id == updated.id }) else { return }
            var patient = patients[pIdx]
            var invoices = patient.invoices
            invoices[iIdx] = updated
            patient = Patient(
                id: patient.id, name: patient.name, age: patient.age, gender: patient.gender,
                phone: patient.phone, dob: patient.dob, address: patient.address, allergies: patient.allergies,
                status: patient.status, lastVisit: patient.lastVisit, medicalNotes: patient.medicalNotes,
                avatarBg: patient.avatarBg, avatarFg: patient.avatarFg,
                balance: invoices.filter { !$0.paid }.reduce(0) { $0 + $1.amount },
                pendingInvoiceCount: invoices.filter { !$0.paid }.count,
                treatments: patient.treatments, invoices: invoices, rx: patient.rx, photos: patient.photos
            )
            patients[pIdx] = patient
        } catch {
            // Non-fatal: leave state as-is; user can retry the tap.
        }
    }

    // MARK: - Add patient

    func openAddPatient() {
        addPatientError = ""
        npForm = NewPatientForm()
        screen = .addPatient
    }
    func cancelAddPatient() { screen = activeTab }

    func submitAddPatient() async {
        guard !npForm.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            addPatientError = "Please enter the patient’s name."
            return
        }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let created = try await api.createPatient(npForm)
            patients.append(created)
            selectedPatientId = created.id
            detailTab = .overview
            activeTab = .patients
            screen = .detail
        } catch let error as APIError {
            addPatientError = error.errorDescription ?? "Couldn’t save patient."
        } catch {
            addPatientError = "Couldn’t save patient."
        }
    }

    // MARK: - Add appointment

    func openAddAppt() {
        addApptError = ""
        naForm = NewAppointmentForm(date: selectedDate)
        screen = .addAppt
    }
    func cancelAddAppt() { screen = activeTab }

    var patientOptions: [(id: String, name: String)] {
        patients.map { ($0.id, $0.name) }
    }

    func submitAddAppt() async {
        guard !naForm.patientId.isEmpty else {
            addApptError = "Please select a patient."
            return
        }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let created = try await api.createAppointment(naForm)
            appointments.append(created)
            selectedDate = created.date
            activeTab = .appointments
            screen = .appointments
        } catch let error as APIError {
            addApptError = error.errorDescription ?? "Couldn’t save appointment."
        } catch {
            addApptError = "Couldn’t save appointment."
        }
    }
}
