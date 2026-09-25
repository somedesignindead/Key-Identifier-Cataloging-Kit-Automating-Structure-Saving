import Foundation

let fm = FileManager.default

func log(_ text: String) {
    let dir = fm.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Logs/Layer Export", isDirectory: true)

    try? fm.createDirectory(
        at: dir,
        withIntermediateDirectories: true
    )

    let file = dir.appendingPathComponent("helper.log")
    let line = "[\(Date())] \(text)\n"

    if !fm.fileExists(atPath: file.path) {
        fm.createFile(atPath: file.path, contents: nil)
    }

    if let handle = try? FileHandle(forWritingTo: file) {
        _ = try? handle.seekToEnd()
        if let data = line.data(using: .utf8) {
            try? handle.write(contentsOf: data)
        }
        try? handle.close()
    }
}

let executable = URL(
    fileURLWithPath: CommandLine.arguments[0]
).standardizedFileURL

let currentApp = executable
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .deletingLastPathComponent()

let resources = currentApp
    .appendingPathComponent("Contents/Resources")

func resource(_ name: String) -> String? {
    let url = resources.appendingPathComponent("\(name).txt")

    guard let value = try? String(contentsOf: url, encoding: .utf8) else {
        log("Не найден ресурс: \(url.path)")
        return nil
    }

    return value.trimmingCharacters(in: .whitespacesAndNewlines)
}

let supportDir = fm.homeDirectoryForCurrentUser
    .appendingPathComponent("Applications", isDirectory: true)
    .appendingPathComponent(".LayerExport", isDirectory: true)

let installedApp = supportDir
    .appendingPathComponent(
        "Layer Export Helper.app",
        isDirectory: true
    )

log("Helper стартовал: \(currentApp.path)")

do {
    try fm.createDirectory(
        at: supportDir,
        withIntermediateDirectories: true
    )

    if currentApp.path != installedApp.path {
        if fm.fileExists(atPath: installedApp.path) {
            try fm.removeItem(at: installedApp)
        }

        try fm.copyItem(
            at: currentApp,
            to: installedApp
        )

        log("Helper установлен: \(installedApp.path)")

        let lsregisterPath =
            "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

        /*
         * Снимаем регистрацию с запускаемой копии
         * (обычно Downloads), чтобы layerexport://
         * не оставался привязан к временной .app.
         */
        let unregister = Process()
        unregister.executableURL = URL(
            fileURLWithPath: lsregisterPath
        )
        unregister.arguments = [
            "-u",
            currentApp.path
        ]

        try? unregister.run()
        unregister.waitUntilExit()

        log(
            "LaunchServices unregister: \(unregister.terminationStatus)"
        )

        /*
         * И только после этого регистрируем
         * постоянную установленную копию.
         */
        let register = Process()
        register.executableURL = URL(
            fileURLWithPath: lsregisterPath
        )
        register.arguments = [
            "-f",
            installedApp.path
        ]

        try register.run()
        register.waitUntilExit()

        log(
            "LaunchServices register: \(register.terminationStatus)"
        )
    }

    guard let projectRoot = resource("project-root") else {
        throw NSError(
            domain: "LayerExport",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Нет project-root.txt"]
        )
    }

    guard let nodePath = resource("node-path") else {
        throw NSError(
            domain: "LayerExport",
            code: 2,
            userInfo: [NSLocalizedDescriptionKey: "Нет node-path.txt"]
        )
    }

    let server = URL(
        fileURLWithPath: projectRoot,
        isDirectory: true
    ).appendingPathComponent("converter/server.mjs")

    let logDir = fm.homeDirectoryForCurrentUser
        .appendingPathComponent(
            "Library/Logs/Layer Export",
            isDirectory: true
        )

    try fm.createDirectory(
        at: logDir,
        withIntermediateDirectories: true
    )

    let converterLog = logDir.appendingPathComponent("converter.log")

    if !fm.fileExists(atPath: converterLog.path) {
        fm.createFile(atPath: converterLog.path, contents: nil)
    }

    let handle = try FileHandle(forWritingTo: converterLog)
    _ = try? handle.seekToEnd()

    let process = Process()
    process.executableURL = URL(fileURLWithPath: nodePath)
    process.arguments = [server.path]
    process.currentDirectoryURL = URL(
        fileURLWithPath: projectRoot,
        isDirectory: true
    )
    process.standardOutput = handle
    process.standardError = handle

    try process.run()

    log("Node запущен, PID \(process.processIdentifier)")
} catch {
    log("ОШИБКА: \(error.localizedDescription)")
}
