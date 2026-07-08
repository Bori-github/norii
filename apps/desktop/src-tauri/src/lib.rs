//! norii Rust 백엔드 라이브러리.
//! 파일 커맨드는 계약(.claude/docs/rust-commands.md)에 시그니처를 먼저 추가한 뒤 구현한다(M1부터).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("norii 실행 중 오류가 발생했습니다");
}
