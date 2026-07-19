//! 네이티브 파일 다이얼로그 커맨드 — 시그니처의 단일 출처: .claude/docs/rust-commands.md.
//!
//! 다이얼로그는 경로 스코프의 입구다: 사용자가 선택한 경로만 허용 루트에 추가되고,
//! open/save 커맨드는 그 하위만 접근할 수 있다(→ rust-commands.md#권한-capabilities).

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::error::AppError;
use crate::scope::FileScope;

/// 트리에 표시하는 확장자와 동일한 필터(→ rust-commands.md read_dir 반환 규칙).
const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown"];

#[tauri::command]
#[specta::specta]
pub async fn show_open_dialog(
    app: AppHandle,
    scope: State<'_, FileScope>,
) -> Result<Option<String>, AppError> {
    // blocking_* API는 메인 스레드에서 금지지만, async 커맨드는 별도 스레드에서 돈다.
    let picked = app
        .dialog()
        .file()
        .add_filter("Markdown", MARKDOWN_EXTENSIONS)
        .blocking_pick_file();
    let Some(file_path) = picked else {
        return Ok(None);
    };
    let path = into_path(file_path)?;
    // 선택한 파일을 허용 루트로 추가한다 — 이 파일에 한해 open/save가 통과한다.
    let canonical = fs::canonicalize(&path)?;
    scope.allow(canonical.clone());
    Ok(Some(canonical.to_string_lossy().into_owned()))
}

#[tauri::command]
#[specta::specta]
pub async fn show_save_dialog(
    app: AppHandle,
    scope: State<'_, FileScope>,
    default_name: String,
) -> Result<Option<String>, AppError> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Markdown", MARKDOWN_EXTENSIONS)
        .set_file_name(&default_name)
        .blocking_save_file();
    let Some(file_path) = picked else {
        return Ok(None);
    };
    let path = into_path(file_path)?;
    // save_file과 동일한 해석 규칙으로 허용 루트를 등록한다 — 기존 심볼릭 링크를 고르면
    // 실제 대상이 등록되어, 저장 시 canonicalize 결과와 어긋나 오거부되는 일이 없다.
    let canonical = crate::fs_commands::resolve_save_target(&path)?;
    scope.allow(canonical.clone());
    Ok(Some(canonical.to_string_lossy().into_owned()))
}

#[tauri::command]
#[specta::specta]
pub async fn show_open_folder_dialog(
    app: AppHandle,
    scope: State<'_, FileScope>,
) -> Result<Option<String>, AppError> {
    let picked = app.dialog().file().blocking_pick_folder();
    let Some(folder_path) = picked else {
        return Ok(None);
    };
    let path = into_path(folder_path)?;
    // 폴더는 하위 트리 전체가 허용 루트가 된다 — read_dir·open·save가 이 아래를 통과한다
    // (→ rust-commands.md#권한-capabilities).
    let canonical = fs::canonicalize(&path)?;
    scope.allow(canonical.clone());
    Ok(Some(canonical.to_string_lossy().into_owned()))
}

fn into_path(file_path: tauri_plugin_dialog::FilePath) -> Result<PathBuf, AppError> {
    file_path
        .into_path()
        .map_err(|err| AppError::Io(err.to_string()))
}
