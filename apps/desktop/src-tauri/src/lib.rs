//! norii Rust 백엔드 라이브러리.
//! 파일 커맨드는 계약(.claude/docs/rust-commands.md)에 시그니처를 먼저 추가한 뒤 구현한다.

mod content_hash;
mod dialog_commands;
mod eol;
mod error;
mod fs_commands;
mod scope;
mod text_encoding;
mod titlebar_drag;
mod watch;
mod window_glass;

/// IPC 계약의 단일 조립 지점 — 커맨드 등록과 TS 바인딩 생성(specta_export 테스트)이
/// 같은 목록을 쓰게 해, 등록 누락과 바인딩 드리프트를 함께 막는다(→ .claude/docs/testing.md).
fn specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new().commands(tauri_specta::collect_commands![
        fs_commands::open_file,
        fs_commands::save_file,
        watch::watch_paths,
        dialog_commands::show_open_dialog,
        dialog_commands::show_save_dialog,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Rust·프론트 로그를 한 파이프라인으로 통합한다. 릴리스는 warn 이상만
        // (→ .claude/docs/error-handling.md#로깅--tauri-plugin-log).
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Warn
                })
                .build(),
        )
        // 경로 스코프 상태 — 다이얼로그가 허용 루트를 채운다(→ rust-commands.md#권한-capabilities).
        .manage(scope::FileScope::default())
        // 파일 감시 상태 — watch_paths가 선언적으로 교체한다(→ rust-commands.md).
        .manage(watch::SharedWatcher::default())
        .invoke_handler(specta_builder().invoke_handler());

    // webdriver 피처를 켠 빌드에서만 임베디드 WebDriver 서버(127.0.0.1:4445)를 켠다 — 실앱 E2E용.
    // 피처를 끄면 플러그인도 크레이트도 컴파일되지 않는다(→ .claude/docs/testing.md).
    #[cfg(feature = "webdriver")]
    let builder = builder.plugin(tauri_plugin_webdriver::init());

    builder
        .setup(|app| {
            // 창 유리 — 투명 창의 뒤 배경을 OS가 흐린다(→ src/window_glass.rs).
            // 그 위에 드래그 띠를 얹는다 — 오버레이 타이틀바에서 창을 끄는 유일한 길이다
            // (→ src/titlebar_drag.rs).
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    window_glass::apply_window_glass(&window, window_glass::DEFAULT_BLUR_RADIUS);
                    titlebar_drag::attach_titlebar_strip(
                        &window,
                        titlebar_drag::TITLEBAR_STRIP_HEIGHT,
                    );
                }
            }

            // E2E는 네이티브 다이얼로그를 자동화할 수 없어, webdriver 빌드에 한해 환경변수로
            // 허용 루트를 주입한다(다이얼로그 대체 입구). 일반·릴리스 빌드에는 없는 경로다.
            // 루트가 없으면 만들어 준다 — 테스트가 앱 기동 전에 디렉터리를 준비할 필요가 없게.
            #[cfg(feature = "webdriver")]
            if let Ok(root) = std::env::var("NORII_E2E_SCOPE_ROOT") {
                let _ = std::fs::create_dir_all(&root);
                if let Ok(canonical) = std::fs::canonicalize(&root) {
                    use tauri::Manager;
                    app.state::<scope::FileScope>().allow(canonical);
                }
            }
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("norii 실행 중 오류가 발생했습니다");
}

#[cfg(test)]
mod tests {
    // 왜: TS 바인딩(shared/ipc/bindings.ts)은 이 테스트가 생성한다 — 커맨드 시그니처가
    //     바뀌면 cargo test가 바인딩을 재생성하고, 프론트 typecheck가 드리프트를 잡는다
    //     (→ .claude/docs/testing.md — tauri-specta로 계약 드리프트를 컴파일 타임에 차단).
    // 보장: 커맨드 목록·타입이 TS로 내보내지고, 내보내기 실패(미지원 타입 등)가 게이트에서 터진다.
    // 경계: 생성물의 의미(호출 동작)는 검증하지 않는다 — 그것은 E2E·프론트 테스트 소관.
    #[test]
    fn specta_export() {
        super::specta_builder()
            .export(
                specta_typescript::Typescript::default(),
                "../src/shared/ipc/bindings.ts",
            )
            .expect("TS 바인딩 내보내기 실패");
    }
}
