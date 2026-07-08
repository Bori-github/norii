//! norii Rust 백엔드 라이브러리.
//! 파일 커맨드는 계약(.claude/docs/rust-commands.md)에 시그니처를 먼저 추가한 뒤 구현한다(M1부터).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // 개발 빌드에서만 임베디드 WebDriver 서버(127.0.0.1:4445)를 켠다 — 실앱 E2E 하네스용.
    // 릴리스 빌드에는 플러그인도 크레이트도 포함되지 않는다(→ .claude/docs/testing.md).
    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_webdriver::init());

    builder
        .run(tauri::generate_context!())
        .expect("norii 실행 중 오류가 발생했습니다");
}
