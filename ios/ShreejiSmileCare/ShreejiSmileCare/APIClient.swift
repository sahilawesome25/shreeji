import Foundation

enum APIError: LocalizedError {
    case server(String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .server(let message): return message
        case .invalidResponse: return "Something went wrong. Please try again."
        }
    }
}

/// Talks to the Shreeji Smile Care Express + SQLite backend (see /backend).
///
/// Simulator can reach a backend running on the same Mac at `localhost`.
/// To test on a physical device, change `baseURL` to your Mac's LAN IP
/// (e.g. "http://192.168.1.23:4000") and add an ATS exception for that host
/// in Info.plist — see ios/README.md.
struct APIClient {
    static let shared = APIClient()

    var baseURL = URL(string: "http://localhost:4000")!

    private var decoder: JSONDecoder {
        JSONDecoder()
    }
    private var encoder: JSONEncoder {
        JSONEncoder()
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if !(200...299).contains(http.statusCode) {
            if let errBody = try? decoder.decode([String: String].self, from: data), let message = errBody["error"] {
                throw APIError.server(message)
            }
            throw APIError.invalidResponse
        }
        return try decoder.decode(T.self, from: data)
    }

    func fetchPatients() async throws -> [Patient] {
        let req = URLRequest(url: baseURL.appendingPathComponent("api/patients"))
        return try await send(req)
    }

    func fetchAppointments() async throws -> [Appointment] {
        let req = URLRequest(url: baseURL.appendingPathComponent("api/appointments"))
        return try await send(req)
    }

    func createPatient(_ form: NewPatientForm) async throws -> Patient {
        var req = URLRequest(url: baseURL.appendingPathComponent("api/patients"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: String] = [
            "name": form.name, "age": form.age, "gender": form.gender, "phone": form.phone,
            "dob": form.dob, "address": form.address, "allergies": form.allergies,
            "medicalNotes": form.medicalNotes,
        ]
        req.httpBody = try encoder.encode(body)
        return try await send(req)
    }

    func createAppointment(_ form: NewAppointmentForm) async throws -> Appointment {
        var req = URLRequest(url: baseURL.appendingPathComponent("api/appointments"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "patientId": form.patientId, "date": form.date, "time": form.time,
            "type": form.type, "duration": Int(form.duration) ?? 30, "notes": form.notes,
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(req)
    }

    func setInvoicePaid(id: String, paid: Bool) async throws -> Invoice {
        var req = URLRequest(url: baseURL.appendingPathComponent("api/invoices/\(id)"))
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(["paid": paid])
        return try await send(req)
    }
}
