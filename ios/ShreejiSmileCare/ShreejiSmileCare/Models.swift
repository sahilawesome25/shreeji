import Foundation

struct Treatment: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let date: String
    let status: String
    let progress: Int
}

struct Invoice: Codable, Identifiable, Hashable {
    let id: String
    let description: String
    let date: String
    let amount: Int
    let paid: Bool
}

struct Prescription: Codable, Identifiable, Hashable {
    let id: String
    let drug: String
    let dosage: String
    let date: String
}

struct PatientPhoto: Codable, Identifiable, Hashable {
    let id: String
    let label: String
}

struct Patient: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let age: String
    let gender: String
    let phone: String
    let dob: String
    let address: String
    let allergies: String
    let status: String
    let lastVisit: String
    let medicalNotes: String
    let avatarBg: String
    let avatarFg: String
    let balance: Int
    let pendingInvoiceCount: Int
    let treatments: [Treatment]
    let invoices: [Invoice]
    let rx: [Prescription]
    let photos: [PatientPhoto]

    var initials: String {
        name.split(separator: " ")
            .prefix(2)
            .compactMap { $0.first }
            .map { String($0).uppercased() }
            .joined()
    }
}

struct Appointment: Codable, Identifiable, Hashable {
    let id: String
    let patientId: String
    let date: String
    let time: String
    let type: String
    let duration: Int
    let notes: String
}

struct NewPatientForm {
    var name: String = ""
    var age: String = ""
    var gender: String = "Female"
    var phone: String = ""
    var dob: String = ""
    var address: String = ""
    var allergies: String = ""
    var medicalNotes: String = ""
}

struct NewAppointmentForm {
    var patientId: String = ""
    var date: String
    var time: String = "10:00"
    var type: String = "Check-up"
    var duration: String = "30"
    var notes: String = ""
}

enum PatientFilter: String, CaseIterable {
    case all, active, new, overdue

    var label: String {
        switch self {
        case .all: return "All"
        case .active: return "In Treatment"
        case .new: return "New"
        case .overdue: return "Overdue"
        }
    }
}

enum DetailTab: String, CaseIterable {
    case overview, treatment, billing, photos, rx

    var label: String {
        switch self {
        case .overview: return "Overview"
        case .treatment: return "Treatment"
        case .billing: return "Billing"
        case .photos: return "Photos"
        case .rx: return "Rx"
        }
    }
}

enum AppScreen: Equatable {
    case home, patients, appointments, billing, detail, addPatient, addAppt
}

let treatmentTypes = [
    "Check-up", "Scaling & Polishing", "Root Canal", "Crown Fitting",
    "Braces Adjustment", "Extraction", "Whitening", "Implant Consult",
]

let appointmentDurations = ["15", "30", "45", "60", "90"]

func isoDateToday() -> String {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    f.timeZone = TimeZone(identifier: "UTC")
    return f.string(from: Date())
}

func addDaysIso(_ iso: String, _ n: Int) -> String {
    let inFmt = DateFormatter()
    inFmt.dateFormat = "yyyy-MM-dd"
    inFmt.timeZone = TimeZone(identifier: "UTC")
    guard let d = inFmt.date(from: iso) else { return iso }
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "UTC")!
    let shifted = cal.date(byAdding: .day, value: n, to: d) ?? d
    return inFmt.string(from: shifted)
}

func formatDisplayDate(_ iso: String) -> String {
    let inFmt = DateFormatter()
    inFmt.dateFormat = "yyyy-MM-dd"
    inFmt.timeZone = TimeZone(identifier: "UTC")
    guard let d = inFmt.date(from: iso) else { return iso }
    let outFmt = DateFormatter()
    outFmt.dateFormat = "MMM d"
    outFmt.timeZone = TimeZone(identifier: "UTC")
    return outFmt.string(from: d)
}

func dayOfWeekLabel(_ iso: String) -> String {
    let inFmt = DateFormatter()
    inFmt.dateFormat = "yyyy-MM-dd"
    inFmt.timeZone = TimeZone(identifier: "UTC")
    guard let d = inFmt.date(from: iso) else { return "" }
    let outFmt = DateFormatter()
    outFmt.dateFormat = "EEE"
    outFmt.timeZone = TimeZone(identifier: "UTC")
    return outFmt.string(from: d)
}

func dayNumber(_ iso: String) -> Int {
    let inFmt = DateFormatter()
    inFmt.dateFormat = "yyyy-MM-dd"
    inFmt.timeZone = TimeZone(identifier: "UTC")
    guard let d = inFmt.date(from: iso) else { return 0 }
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "UTC")!
    return cal.component(.day, from: d)
}
