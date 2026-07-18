//! 파일 트리 커맨드 — read_dir. 시그니처·반환 규칙의 단일 출처: .claude/docs/rust-commands.md.
//! 한 호출 = 그 폴더 "한 단계"의 항목 목록(레벨별 lazy). 트리 조립과 "아직 안 읽음" 상태는
//! 프론트 모델 소관이다(→ .claude/docs/document-model.md#파일-트리-사이드바).
//!
//! 파일 처리 동작(레벨별 lazy 로딩·자연 정렬)은 VS Code(Code – OSS, MIT)의 동작을
//! 참고했다(→ .claude/rules/prior-art.md).

use std::cmp::Ordering;
use std::fs;

use serde::Serialize;
use tauri::State;

use crate::error::AppError;
use crate::scope::FileScope;

/// read_dir 항목(→ rust-commands.md). 응답에 children이 없다 — 중첩은 프론트가 조립한다.
#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    pub path: String,
    pub name: String,
    pub kind: NodeKind,
    /// 심볼릭 링크 표시 — 사이드바 배지용.
    pub is_symlink: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    Dir,
    File,
}

#[tauri::command]
#[specta::specta]
pub async fn read_dir(scope: State<'_, FileScope>, dir: String) -> Result<Vec<TreeNode>, AppError> {
    read_dir_impl(&scope, &dir)
}

pub fn read_dir_impl(scope: &FileScope, dir: &str) -> Result<Vec<TreeNode>, AppError> {
    let canonical = fs::canonicalize(dir)?;
    scope.ensure_allowed(&canonical)?;

    let mut nodes = Vec::new();
    for entry in fs::read_dir(&canonical)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let file_type = entry.file_type()?;
        let is_symlink = file_type.is_symlink();
        // 링크는 대상 기준으로 dir/file을 판정한다. 깨진 링크는 대상이 없으므로 파일로
        // 분류해 표시한다 — 열면 open_file의 NotFound가 안내한다(→ rust-commands.md).
        let is_dir = if is_symlink {
            fs::metadata(entry.path())
                .map(|meta| meta.is_dir())
                .unwrap_or(false)
        } else {
            file_type.is_dir()
        };
        if !is_dir && !has_markdown_extension(&name) {
            continue;
        }
        nodes.push(TreeNode {
            // canonical 부모 기준 경로 — 트리 클릭이 탭 신원(canonical)과 맞물린다.
            // (폴더 링크를 펼치면 다음 호출의 canonicalize가 실제 대상 기준으로 수렴한다.)
            path: entry.path().to_string_lossy().into_owned(),
            name,
            kind: if is_dir {
                NodeKind::Dir
            } else {
                NodeKind::File
            },
            is_symlink,
        });
    }

    nodes.sort_by(compare_nodes);
    Ok(nodes)
}

fn has_markdown_extension(name: &str) -> bool {
    name.rsplit_once('.').is_some_and(|(stem, ext)| {
        !stem.is_empty() && (ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown"))
    })
}

/// 정렬 규칙(→ rust-commands.md): 디렉터리 우선 → 자연 정렬 → 동률이면 원본 이름의
/// 코드포인트 비교로 확정한다(결정론).
fn compare_nodes(a: &TreeNode, b: &TreeNode) -> Ordering {
    match (a.kind, b.kind) {
        (NodeKind::Dir, NodeKind::File) => Ordering::Less,
        (NodeKind::File, NodeKind::Dir) => Ordering::Greater,
        _ => natural_cmp(&a.name, &b.name).then_with(|| a.name.cmp(&b.name)),
    }
}

/// 자연 정렬 — 이름을 숫자/비숫자 구간으로 분할해, 숫자 구간은 수치 비교(2 < 10),
/// 비숫자 구간은 대소문자 무시 코드포인트 비교를 한다.
fn natural_cmp(a: &str, b: &str) -> Ordering {
    let mut runs_a = split_runs(a).into_iter();
    let mut runs_b = split_runs(b).into_iter();
    loop {
        match (runs_a.next(), runs_b.next()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(run_a), Some(run_b)) => {
                let ord = compare_runs(run_a, run_b);
                if ord != Ordering::Equal {
                    return ord;
                }
            }
        }
    }
}

fn split_runs(name: &str) -> Vec<&str> {
    let mut runs = Vec::new();
    let mut start = 0;
    let mut prev_is_digit = None;
    for (index, ch) in name.char_indices() {
        let is_digit = ch.is_ascii_digit();
        if prev_is_digit.is_some_and(|prev| prev != is_digit) {
            runs.push(&name[start..index]);
            start = index;
        }
        prev_is_digit = Some(is_digit);
    }
    if start < name.len() {
        runs.push(&name[start..]);
    }
    runs
}

fn compare_runs(a: &str, b: &str) -> Ordering {
    let both_digits =
        a.bytes().all(|byte| byte.is_ascii_digit()) && b.bytes().all(|byte| byte.is_ascii_digit());
    if both_digits {
        // 앞자리 0을 벗긴 수치 비교 — 자릿수가 다르면 긴 쪽이 크고, 같으면 사전식이 곧 수치다.
        // 수치 동률("02" vs "2")은 Equal로 두고 상위의 원본 코드포인트 비교가 확정한다.
        let trimmed_a = a.trim_start_matches('0');
        let trimmed_b = b.trim_start_matches('0');
        (trimmed_a.len().cmp(&trimmed_b.len())).then_with(|| trimmed_a.cmp(trimmed_b))
    } else {
        // 대소문자 무시 코드포인트 비교 — 로케일 collation은 쓰지 않는다(결정론 우선).
        let lowered_a = a.chars().flat_map(char::to_lowercase);
        let lowered_b = b.chars().flat_map(char::to_lowercase);
        lowered_a.cmp(lowered_b)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scope::FileScope;
    use std::path::PathBuf;

    fn scoped_tempdir() -> (tempfile::TempDir, FileScope, PathBuf) {
        let dir = tempfile::tempdir().expect("임시 디렉터리 생성");
        let canonical = fs::canonicalize(dir.path()).expect("canonicalize");
        let scope = FileScope::default();
        scope.allow(canonical.clone());
        (dir, scope, canonical)
    }

    fn names(nodes: &[TreeNode]) -> Vec<&str> {
        nodes.iter().map(|node| node.name.as_str()).collect()
    }

    // 집행: rust-commands.md read_dir — "필터: 디렉터리는 전부, 파일은 .md/.markdown만
    //       (확장자 대소문자 무시)"·"숨김 항목(이름이 '.'으로 시작)은 제외".
    // 왜: 트리는 마크다운 에디터의 입구다 — 무관 파일이 섞이면 탐색이 흐려지고,
    //     숨김 파일(.git·.DS_Store)은 사용자의 문서가 아니다.
    // 보장: md/markdown(대소문자 무관)과 모든 디렉터리만 남고 나머지·숨김은 걸러진다.
    // 경계: 정렬은 아래 테스트가 다룬다. 하위 재귀는 없다(호출당 한 단계).
    #[test]
    fn 디렉터리_전부와_마크다운_파일만_반환한다() {
        let (dir, scope, canonical) = scoped_tempdir();
        fs::create_dir(dir.path().join("notes")).unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        fs::write(dir.path().join("a.md"), "").unwrap();
        fs::write(dir.path().join("B.MD"), "").unwrap();
        fs::write(dir.path().join("c.markdown"), "").unwrap();
        fs::write(dir.path().join("d.txt"), "").unwrap();
        fs::write(dir.path().join(".DS_Store"), "").unwrap();

        let nodes = read_dir_impl(&scope, canonical.to_str().unwrap()).unwrap();

        // 대소문자 무시 정렬이라 a.md < B.MD다(사전식이면 B가 앞 — 자연 정렬 규칙 확인).
        assert_eq!(names(&nodes), vec!["notes", "a.md", "B.MD", "c.markdown"]);
        assert_eq!(nodes[0].kind, NodeKind::Dir);
        assert_eq!(nodes[1].kind, NodeKind::File);
    }

    // 집행: rust-commands.md read_dir — "정렬: 디렉터리 우선 → 자연 정렬 → 동률이면 원본
    //       이름의 코드포인트 비교로 확정"·"숫자 구간은 수치 비교(2.md < 10.md)".
    // 왜: 정렬이 비결정적이면 트리가 열 때마다 흔들리고, 사전식 정렬은 10이 2보다
    //     앞에 오는 반직관을 만든다.
    // 보장: 디렉터리가 파일보다 앞, 숫자는 수치 순, 대소문자 무시, 동률은 결정론적.
    // 경계: 로케일 collation(한글 자모 순 등)은 하지 않는다 — 코드포인트 기준이다.
    #[test]
    fn 디렉터리_우선_자연_정렬이_결정론적이다() {
        let (dir, scope, canonical) = scoped_tempdir();
        fs::write(dir.path().join("10.md"), "").unwrap();
        fs::write(dir.path().join("2.md"), "").unwrap();
        fs::write(dir.path().join("Beta.md"), "").unwrap();
        fs::write(dir.path().join("alpha.md"), "").unwrap();
        fs::create_dir(dir.path().join("zeta")).unwrap();

        let nodes = read_dir_impl(&scope, canonical.to_str().unwrap()).unwrap();

        assert_eq!(
            names(&nodes),
            vec!["zeta", "2.md", "10.md", "alpha.md", "Beta.md"]
        );
    }

    // 왜: 자연 정렬이 "같다"고 보는 이름 쌍(02.md vs 2.md)이 실행마다 순서를 바꾸면
    //     트리가 흔들린다 — 동률 확정 규칙(원본 코드포인트)이 결정론을 만든다.
    // 보장: 수치 동률 쌍의 순서가 코드포인트 비교로 항상 같다('0' < '2').
    // 경계: 어떤 순서가 "옳은가"가 아니라 항상 같은 순서인가를 고정한다.
    #[test]
    fn 수치_동률은_원본_코드포인트로_확정한다() {
        let (dir, scope, canonical) = scoped_tempdir();
        fs::write(dir.path().join("2.md"), "").unwrap();
        fs::write(dir.path().join("02.md"), "").unwrap();

        let nodes = read_dir_impl(&scope, canonical.to_str().unwrap()).unwrap();

        assert_eq!(names(&nodes), vec!["02.md", "2.md"]);
    }

    // 집행: rust-commands.md read_dir — "심볼릭 링크: is_symlink로 표시하고 일반 항목처럼
    //       다룬다. 대상이 없는(깨진) 링크도 표시하며, 열면 AppError::NotFound".
    // 왜: 링크를 숨기면 사용자가 파인더에서 보는 것과 트리가 어긋나고, 링크임을 표시하지
    //     않으면 "같은 파일이 두 곳에 있는" 상황을 이해할 수 없다.
    // 보장: 파일 링크는 file, 폴더 링크는 dir로 분류되고 is_symlink가 켜진다.
    //       깨진 링크도 목록에 남는다(열기의 NotFound는 open_file 테스트 소관).
    // 경계: 루트 밖을 가리키는 링크의 거부는 "펼칠 때"(read_dir(링크 경로)) 스코프
    //       검증이 한다 — 목록 표시는 막지 않는다.
    #[test]
    fn 심볼릭_링크는_대상_종류로_분류하고_표시한다() {
        let (dir, scope, canonical) = scoped_tempdir();
        fs::write(dir.path().join("real.md"), "").unwrap();
        fs::create_dir(dir.path().join("realdir")).unwrap();
        std::os::unix::fs::symlink(dir.path().join("real.md"), dir.path().join("link.md")).unwrap();
        std::os::unix::fs::symlink(dir.path().join("realdir"), dir.path().join("linkdir")).unwrap();
        std::os::unix::fs::symlink(dir.path().join("ghost.md"), dir.path().join("broken.md"))
            .unwrap();

        let nodes = read_dir_impl(&scope, canonical.to_str().unwrap()).unwrap();

        let find = |name: &str| nodes.iter().find(|node| node.name == name).unwrap();
        assert_eq!(find("link.md").kind, NodeKind::File);
        assert!(find("link.md").is_symlink);
        assert_eq!(find("linkdir").kind, NodeKind::Dir);
        assert!(find("linkdir").is_symlink);
        assert_eq!(find("broken.md").kind, NodeKind::File);
        assert!(find("broken.md").is_symlink);
        assert!(!find("real.md").is_symlink);
    }

    // 집행: rust-commands.md#권한-capabilities — read_dir도 canonicalize 후 허용 루트
    //       검증을 거친다(경로 스코프 강제는 커맨드 코드에 있다).
    // 왜: 이 검사가 없으면 트리 입구로 임의 전역 디렉터리를 나열할 수 있다(정보 노출).
    // 보장: 허용 루트 밖은 Permission, 없는 디렉터리는 NotFound로 거부된다.
    // 경계: 루트 등록(다이얼로그·폴더 열기)은 커맨드 계층 밖의 흐름이다.
    #[test]
    fn 허용_루트_밖과_없는_경로는_거부한다() {
        let (_dir, scope, _canonical) = scoped_tempdir();
        let outside = tempfile::tempdir().unwrap();

        assert!(matches!(
            read_dir_impl(&scope, outside.path().to_str().unwrap()),
            Err(AppError::Permission(_))
        ));
        assert!(matches!(
            read_dir_impl(&scope, "/no/such/dir"),
            Err(AppError::NotFound(_))
        ));
    }

    // 집행: rust-commands.md read_dir — "빈 폴더 = 빈 배열"(children 부재=미해석과 구분).
    // 왜: 프론트 모델은 "빈 배열"로 "읽었지만 비었음"을 표현한다 — 에러로 오인하면 안 된다.
    // 보장: 빈 폴더는 Ok(빈 목록)이고, 항목 path는 canonical 부모 기준 전체 경로다.
    // 경계: children 부재(미해석) 상태는 프론트 스토어 테스트 소관.
    #[test]
    fn 빈_폴더는_빈_배열이고_경로는_canonical_기준이다() {
        let (dir, scope, canonical) = scoped_tempdir();
        assert!(read_dir_impl(&scope, canonical.to_str().unwrap())
            .unwrap()
            .is_empty());

        fs::write(dir.path().join("a.md"), "").unwrap();
        // 요청은 비canonical 표기(tempdir 원본)로 한다 — 반환 경로는 canonical 기준이어야
        // 트리 클릭이 탭 신원(canonical)과 그대로 맞물린다(→ 단위 1의 신원 규칙).
        let nodes = read_dir_impl(&scope, dir.path().to_str().unwrap()).unwrap();
        assert_eq!(nodes[0].path, canonical.join("a.md").to_str().unwrap());
    }
}
