import AppKit
import ApplicationServices
import Foundation
let target = "AnswerCue"
let applications = NSWorkspace.shared.runningApplications.filter { application in
    (application.bundleIdentifier ?? "").hasPrefix("com.answercue") || (application.executableURL?.path ?? "").contains("/AnswerCue")
}.map { application -> [String: Any] in
    return ["pid": application.processIdentifier, "bundleId": application.bundleIdentifier ?? "", "name": application.localizedName ?? "", "bundlePath": application.bundleURL?.path ?? "", "executable": application.executableURL?.path ?? "", "activationPolicy": application.activationPolicy.rawValue, "active": application.isActive, "hidden": application.isHidden, "terminated": application.isTerminated]
}
var dockItems = [[String: Any]]()
var dockError: Int32 = 0
func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, name as CFString, &value)
    if result != .success { return nil }
    return value
}
func visit(_ element: AXUIElement, _ depth: Int) {
    if depth > 4 { return }
    let title = attribute(element, "AXTitle") as? String ?? ""
    let url = attribute(element, "AXURL") as? URL
    if title.contains(target) || (url?.path.contains(target) ?? false) || title.contains("CoreServices Helper") {
        var entry: [String: Any] = ["title": title, "url": url?.absoluteString ?? ""]
        var names: CFArray?
        if AXUIElementCopyAttributeNames(element, &names) == .success { entry["attributes"] = names as? [String] ?? [] }
        for key in ["AXRole", "AXSubrole", "AXIdentifier", "AXIsApplicationRunning", "AXIsApplicationHidden"] {
            if let value = attribute(element, key) { entry[key] = String(describing: value) }
        }
        dockItems.append(entry)
    }
    if let children = attribute(element, "AXChildren") as? [AXUIElement] { for child in children { visit(child, depth + 1) } }
}
if let dock = NSWorkspace.shared.runningApplications.first(where: { $0.bundleIdentifier == "com.apple.dock" }) {
    let element = AXUIElementCreateApplication(dock.processIdentifier)
    var children: CFTypeRef?
    dockError = AXUIElementCopyAttributeValue(element, "AXChildren" as CFString, &children).rawValue
    if dockError == 0 { visit(element, 0) }
}
let result: [String: Any] = ["timestamp": ISO8601DateFormatter().string(from: Date()), "applications": applications, "dockItems": dockItems, "axTrusted": AXIsProcessTrusted(), "dockAxError": dockError]
let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
print(String(data: data, encoding: .utf8)!)
