//! 경로 스코프 — 커맨드가 만질 수 있는 경로를 "허용 루트 목록"의 하위로 제한한다.
//! capabilities는 커스텀 커맨드의 경로를 제한하지 못하므로, 실제 강제는 여기다
//! (단일 출처: .claude/docs/rust-commands.md#권한-capabilities).

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::error::AppError;

/// 허용 루트 목록 — 다이얼로그 선택분과 연 루트 폴더가 쌓인다. Tauri managed state로 보유한다.
#[derive(Default)]
pub struct FileScope {
    roots: Mutex<HashSet<PathBuf>>,
}

impl FileScope {
    /// canonicalize된 경로를 허용 루트로 추가한다(파일이면 그 파일만, 폴더면 하위 트리 전체).
    pub fn allow(&self, canonical_root: PathBuf) {
        self.roots
            .lock()
            .expect("FileScope 락은 포이즌되지 않는다")
            .insert(canonical_root);
    }

    /// canonicalize된 경로가 허용 루트와 같거나 그 하위인지 확인한다.
    /// canonicalize를 전제하므로 심볼릭 링크·`..`를 통한 스코프 탈출이 차단된다.
    pub fn ensure_allowed(&self, canonical: &Path) -> Result<(), AppError> {
        let roots = self.roots.lock().expect("FileScope 락은 포이즌되지 않는다");
        if roots.iter().any(|root| canonical.starts_with(root)) {
            Ok(())
        } else {
            Err(AppError::Permission(
                "허용되지 않은 경로입니다 — 다이얼로그로 선택했거나 연 폴더의 하위만 접근할 수 있습니다".into(),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 집행: rust-commands.md#권한-capabilities — 경로 스코프 강제는 커맨드 코드에 있다.
    // 왜: 이 검사가 없으면 웹뷰가 임의 전역 경로를 읽고 쓸 수 있다(최소 권한 붕괴).
    // 보장: 허용 루트 자신과 그 하위는 통과, 밖의 경로·형제 경로는 Permission으로 거부.
    // 경계: canonicalize 자체는 호출 측 책임이다 — 여기서는 정규화된 경로만 다룬다.
    #[test]
    fn 허용_루트의_하위만_통과한다() {
        let scope = FileScope::default();
        scope.allow(PathBuf::from("/tmp/vault"));

        assert!(scope.ensure_allowed(Path::new("/tmp/vault")).is_ok());
        assert!(scope.ensure_allowed(Path::new("/tmp/vault/a/b.md")).is_ok());
        assert!(matches!(
            scope.ensure_allowed(Path::new("/tmp/other/b.md")),
            Err(AppError::Permission(_))
        ));
        // 문자열 접두어가 아니라 경로 컴포넌트 기준이다 — /tmp/vault2는 하위가 아니다.
        assert!(matches!(
            scope.ensure_allowed(Path::new("/tmp/vault2/b.md")),
            Err(AppError::Permission(_))
        ));
    }

    // 왜: 스코프가 비어 있으면(앱 시작 직후) 어떤 경로도 접근할 수 없어야 한다.
    // 보장: 루트가 없을 때 모든 경로가 거부된다.
    // 경계: 다이얼로그가 루트를 추가하는 흐름은 커맨드 계층에서 다룬다.
    #[test]
    fn 빈_스코프는_모든_경로를_거부한다() {
        let scope = FileScope::default();
        assert!(matches!(
            scope.ensure_allowed(Path::new("/tmp/any.md")),
            Err(AppError::Permission(_))
        ));
    }
}
