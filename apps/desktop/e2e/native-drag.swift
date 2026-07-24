// 실제 마우스 드래그를 CGEvent로 합성한다 — verify-native의 드래그 불변식 체크(B)가 쓴다.
// AppleScript System Events에는 신뢰할 만한 click-drag 프리미티브가 없어 CGEvent로 내려간다.
// 좌표는 전역 디스플레이 포인트(top-left 원점)로, AppleScript 창 좌표와 같은 계다.
// 인자: x1 y1 x2 y2 (시작점 → 끝점).
import CoreGraphics
import Foundation

let a = CommandLine.arguments.dropFirst().compactMap { Double($0) }
guard a.count == 4 else {
  FileHandle.standardError.write("usage: native-drag.swift x1 y1 x2 y2\n".data(using: .utf8)!)
  exit(2)
}
let src = CGEventSource(stateID: .hidSystemState)
func mouse(_ type: CGEventType, _ x: Double, _ y: Double) {
  CGEvent(
    mouseEventSource: src, mouseType: type,
    mouseCursorPosition: CGPoint(x: x, y: y), mouseButton: .left
  )?.post(tap: .cghidEventTap)
}
let (x1, y1, x2, y2) = (a[0], a[1], a[2], a[3])
mouse(.mouseMoved, x1, y1)
usleep(200_000)
mouse(.leftMouseDown, x1, y1)
usleep(250_000)
for i in 1...15 {
  let t = Double(i) / 15.0
  mouse(.leftMouseDragged, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
  usleep(25_000)
}
usleep(150_000)
mouse(.leftMouseUp, x2, y2)
