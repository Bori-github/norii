// 실제 키를 CGEvent로 보낸다 — verify-native의 한글 IME 체크가 쓴다.
// WebDriver 입력은 조합을 만들지 못하므로(→ .claude/docs/korean-ime.md) OS 층으로 내려간다.
//
// 입력 소스는 **건드리지 않는다.** 프로그램 전환은 조합을 꺼뜨리고 시스템 입력기 상태를
// 망가뜨린다(실측). 실행하는 사람이 한국어 입력 상태로 두고 시작한다.
//
// stdin 한 줄에 키 하나: "5" · "cmd:11" · "quit". 처리하면 "ok"를 낸다.
import CoreGraphics
import Foundation

let source = CGEventSource(stateID: .hidSystemState)
print("ready")
fflush(stdout)

while let line = readLine() {
  let arg = line.trimmingCharacters(in: .whitespaces)
  if arg == "quit" { break }
  if arg.isEmpty { continue }

  var flags: CGEventFlags = []
  var codePart = arg
  if arg.contains(":") {
    let parts = arg.split(separator: ":")
    for modifier in parts[0].split(separator: "+") {
      if modifier == "cmd" { flags.insert(.maskCommand) }
      if modifier == "shift" { flags.insert(.maskShift) }
      if modifier == "ctrl" { flags.insert(.maskControl) }
      if modifier == "alt" { flags.insert(.maskAlternate) }
    }
    codePart = String(parts[1])
  }
  guard let code = UInt16(codePart) else { continue }

  let down = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: true)
  down?.flags = flags
  down?.post(tap: .cghidEventTap)
  usleep(60_000)
  let up = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: false)
  up?.flags = flags
  up?.post(tap: .cghidEventTap)
  usleep(150_000)

  print("ok")
  fflush(stdout)
}
