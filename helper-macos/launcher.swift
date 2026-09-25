import Foundation
import Darwin

let fm = FileManager.default
let home = fm.homeDirectoryForCurrentUser

let supportDir = home
    .appendingPathComponent("Library/Application Support/Layer Export", isDirectory: true)

let configPath = supportDir.appendingPathComponent("launcher.conf")
let logPath = home.appendingPathComponent("Library/Logs/Layer Export/launcher.log")
let converterLogPath = home.appendingPathComponent("Library/Logs/Layer Export/converter.log")

func log(_ text: String) {
    let dir = logPath.deletingLastPathComponent()
    try? fm.createDirectory(at: dir, withIntermediateDirectories: true)

    let line = "[\(Date())] \(text)\n"

    if !fm.fileExists(atPath: logPath.path) {
        fm.createFile(atPath: logPath.path, contents: nil)
    }

    if let handle = try? FileHandle(forWritingTo: logPath) {
        _ = try? handle.seekToEnd()
        if let data = line.data(using: .utf8) {
            try? handle.write(contentsOf: data)
        }
        try? handle.close()
    }
}

func config() -> [String: String] {
    guard let text = try? String(contentsOf: configPath, encoding: .utf8) else {
        return [:]
    }

    var result: [String: String] = [:]

    for line in text.split(separator: "\n") {
        let parts = line.split(separator: "=", maxSplits: 1)

        if parts.count == 2 {
            result[String(parts[0])] = String(parts[1])
        }
    }

    return result
}

func startConverter() {
    let cfg = config()

    guard
        let projectRoot = cfg["project-root"],
        let nodePath = cfg["node-path"]
    else {
        log("ОШИБКА: launcher.conf неполный")
        return
    }

    let serverPath = URL(
        fileURLWithPath: projectRoot,
        isDirectory: true
    )
    .appendingPathComponent("converter/server.mjs")
    .path

    guard fm.fileExists(atPath: nodePath) else {
        log("ОШИБКА: Node не найден: \(nodePath)")
        return
    }

    guard fm.fileExists(atPath: serverPath) else {
        log("ОШИБКА: server.mjs не найден: \(serverPath)")
        return
    }

    let logDir = converterLogPath.deletingLastPathComponent()
    try? fm.createDirectory(at: logDir, withIntermediateDirectories: true)

    if !fm.fileExists(atPath: converterLogPath.path) {
        fm.createFile(atPath: converterLogPath.path, contents: nil)
    }

    do {
        let handle = try FileHandle(forWritingTo: converterLogPath)
        _ = try? handle.seekToEnd()

        let process = Process()
        process.executableURL = URL(fileURLWithPath: nodePath)
        process.arguments = [serverPath]
        process.currentDirectoryURL = URL(
            fileURLWithPath: projectRoot,
            isDirectory: true
        )
        process.standardOutput = handle
        process.standardError = handle

        try process.run()

        log("Node запущен, PID \(process.processIdentifier)")
    } catch {
        log("ОШИБКА запуска Node: \(error.localizedDescription)")
    }
}

func sendResponse(_ fd: Int32, status: String, body: String) {
    let response =
        "HTTP/1.1 \(status)\r\n" +
        "Content-Type: application/json; charset=utf-8\r\n" +
        "Access-Control-Allow-Origin: *\r\n" +
        "Access-Control-Allow-Methods: GET, OPTIONS\r\n" +
        "Access-Control-Allow-Headers: Content-Type\r\n" +
        "Access-Control-Allow-Private-Network: true\r\n" +
        "Cache-Control: no-store\r\n" +
        "Connection: close\r\n" +
        "Content-Length: \(body.utf8.count)\r\n" +
        "\r\n" +
        body

    _ = response.withCString {
        Darwin.send(fd, $0, strlen($0), 0)
    }
}

let server = socket(AF_INET, SOCK_STREAM, 0)

guard server >= 0 else {
    fatalError("socket() failed")
}

var reuse: Int32 = 1

setsockopt(
    server,
    SOL_SOCKET,
    SO_REUSEADDR,
    &reuse,
    socklen_t(MemoryLayout<Int32>.size)
)

var address = sockaddr_in()
address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
address.sin_family = sa_family_t(AF_INET)
address.sin_port = in_port_t(47830).bigEndian
address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))

let bindResult = withUnsafePointer(to: &address) {
    $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        bind(
            server,
            $0,
            socklen_t(MemoryLayout<sockaddr_in>.size)
        )
    }
}

guard bindResult == 0 else {
    log("ОШИБКА bind(): \(errno)")
    exit(1)
}

guard listen(server, 16) == 0 else {
    log("ОШИБКА listen(): \(errno)")
    exit(1)
}

log("Launcher слушает http://127.0.0.1:47830")

while true {
    let client = accept(server, nil, nil)

    if client < 0 {
        continue
    }

    var buffer = [UInt8](repeating: 0, count: 8192)
    let count = recv(client, &buffer, buffer.count, 0)

    guard count > 0 else {
        close(client)
        continue
    }

    let request = String(
        bytes: buffer.prefix(count),
        encoding: .utf8
    ) ?? ""

    if request.hasPrefix("OPTIONS ") {
        sendResponse(client, status: "204 No Content", body: "")
        close(client)
        continue
    }

    if request.hasPrefix("GET /start ") {
        startConverter()

        sendResponse(
            client,
            status: "200 OK",
            body: #"{"ok":true}"#
        )

        close(client)
        continue
    }

    if request.hasPrefix("GET /health ") {
        sendResponse(
            client,
            status: "200 OK",
            body: #"{"ok":true}"#
        )

        close(client)
        continue
    }

    sendResponse(
        client,
        status: "404 Not Found",
        body: #"{"error":"not found"}"#
    )

    close(client)
}
