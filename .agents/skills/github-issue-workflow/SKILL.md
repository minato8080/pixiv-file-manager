---
name: github-issue-workflow
description: GitHub-backed repositoryで実装作業を行う際、GitHub Issue本文を再開可能なcheckpoint、labels・Closed・Milestonesを検索用metadataとして、Issue選択、着手、handoff、blocked、review、完了、roadmap進捗を管理する。pixiv-file-managerではPhase番号やローカルTODOを前提にせず、Tauriアプリの機能・バグ・保守・アップグレードをIssue単位で扱う。単なる質問、read-only調査、一時的な実験、GitHub管理外のrepo、Issue lifecycleと無関係なGit操作には使わない。
---

# GitHub Issue Workflow

GitHub Issues / Milestonesを作業状態のSingle Source of Truthとして扱う。特にIssue本文上部を、初見の人間や別エージェントがコメント履歴を読まずに再開するためのauthoritative checkpointとする。コメントは履歴や証拠に使えるが、現在状態をコメントだけに残さない。会話履歴、内部plan、ローカルTODO/ROADMAPを状態判定に使わない。

このSkillは実装方法、設計、code review、branch / commit戦略を規定しない。repoの`AGENTS.md`と通常のCodex判断に従う。GitHub Projectsも、repoが明示的に採用していなければ追加しない。

## Issueタイトルの契約

Phase番号や枝番は要求しない。IssueとPRのタイトル・本文・checkpointは原則として日本語で書く。技術名、コマンド、ファイルパス、ブランチ名、GitHubの固定フィールド名（`State`、`Owner`、`Next action`など）は英語のままにしてよい。タイトルは検索しやすい短い作業名にし、必要なら次の日本語種別prefixを使う。

```text
機能: <機能名>
不具合: <直す挙動>
保守: <保守内容>
更新: <更新対象>
判断: <方針・設計判断>
```

1件のIssueは、独立してレビューできる1つの作業単位とする。メジャーverUpのように長期化する作業は、親の`更新:` Issueと、フロントエンド / Tauri / Rust / CI / 検証などの子Issueに分けてよい。子IssueはGitHubのsub-issue関係と本文で親を明記するが、Issue番号をタイトルの枝番として再利用しない。

通常の機能・バグ・保守はPhaseなしで管理する。`docs/todo.md`の移行項目は、対応するGitHub Issueが作成され、元の項目との対応が確認できた後に限り、元ファイルを削除する。

## pixiv-file-managerの正本とbacklog移行

プロジェクト固有の要件・設計は、`README.md`、`docs/app_design.md`、`docs/db_design.md`、実装設定（`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`.github/workflows/`）の順で確認する。`docs/todo.md`は正本ではない。

`docs/todo.md`をIssueへ移すときは、次の順序を守る。

1. GitHubで既存の重複Issueを検索する。
2. 重複がなければ、各項目を独立したIssueとして作成する。
3. 作成したIssueのタイトル・本文と元項目の対応を確認する。
4. 5項目すべての対応が確認できた後にだけ`docs/todo.md`を削除する。

Issueの検索・作成・更新が失敗した場合は、GitHub上の状態を推測しない。ローカルのTODOやROADMAPへ戻さず、失敗内容を記録して移行と完了判定を保留する。ローカルのコードや文書を安全に続行できる場合でも、Issue checkpointが作成・更新できなかった事実を最終報告に残す。

## Issue本文の契約

本文上部に現在地レイヤーを置く。`Outcome`、`Status`、`Definition of Done`の責務は全Issueで維持する。既存`Goal`や客観的な`Acceptance Criteria`が同じ責務を満たすなら重複headingを追加しない。複数工程があるときは`Current progress`も置く。`Runbook`、`Verification`、`Notes`、`Human action required`は必要なときだけ置く。

```md
## Status

**State:** READY | IN_PROGRESS | BLOCKED | REVIEW | DONE
**Owner:** Human | Agent | <dependency / external system / specific owner when useful>
**Next action:** <次の担当者が直ちに実行できる1つのlogical work unit>
**Blocking reason:** <BLOCKEDのとき必須>
**Resume from:** <BLOCKEDまたはhandoffのとき必須>

## Outcome

最終的に達成する結果。

## Current progress

- [x] 完了工程
- [ ] 次の工程 ← NEXT
- [ ] 残りの工程

## Human action required

人間作業がある場合だけ、対象、場所、手順、入力、期待する出力を記す。

## Definition of Done

- [ ] 客観的な完了条件

## Runbook

必要な場合だけ詳細手順を記す。

## Verification

- 実行するtest / lint / build / review

## Notes

補足。
```

小さい単一工程のIssueでは`Current progress`、`Runbook`、`Notes`を省略してよい。ただし、現在地の再構築に必要な情報は省かない。既存の`Goal`は`Outcome`と同じ責務なので、段階的移行中は名前を変えずに使ってよい。既存の`Acceptance Criteria`もDoDとして客観的なら保持してよいが、進捗表示の代わりにはしない。

### 各フィールドの責務

- `Outcome`: 最終的に何を達成するか。進捗や次の操作を書かない。
- `Current progress`: 完了済み、次、残りの工程。複数工程なら`← NEXT`は1件だけにし、`Next action`と一致させる。
- `Next action`: 最重要フィールド。`DONE`以外では原則必須。目標や大きな作業名ではなく、次の担当者が即実行できる1つのlogical work unitを、対象・操作・完了点が分かる粒度で書く。
- `Definition of Done`: Issueを閉じてよい客観条件。工程logを書かない。
- `Owner`: 次のactionを担当する主体。単なるIssue作成者や過去の作業者ではない。
- `Resume from`: handoffまたはblocker解消後にAgentが開始するsection / step / command。BLOCKEDとhandoffでは必須で、`Next action`と同じなら`same as Next action`と明記する。人間handoffでは人間の`Next action`と、その完了後のAgentの`Resume from`を分離する。

`Next action`の悪い例は「メジャーverUpを続ける」「残件を修正する」。良い例は「`src-tauri/tauri.conf.json`と`package.json`のversionを比較し、差分と期待値を親Upgrade Issueへ記録する」「ファイル移動時のsuffix選択を実装し、関連するfrontend buildとRust checkを実行する」。

## 状態モデル

状態を5つに限定し、本文の`State`を意味上の正本とする。

| State | 意味 | GitHub metadata |
| --- | --- | --- |
| `READY` | prerequisitesを満たし着手可能 | Open、作業中/blocked labelなし |
| `IN_PROGRESS` | HumanまたはAgentが現在作業中 | Open、`status:in-progress` |
| `BLOCKED` | 外部入力、人間判断、依存Issue等がなければ進めない | Open、`status:blocked` |
| `REVIEW` | 実装等は完了しreviewまたは最終確認待ち | Open、作業中/blocked labelなし |
| `DONE` | Definition of Doneを満たしdeliveryも完了 | Closed |

labelsとClosedはqueue検索、競合防止、roadmap集計の索引として本文に同期させる。`status:in-progress`と`status:blocked`は同時に付けない。`status:done`、`status:todo`、`status:review`は、repoが既に要求していなければ作らない。

queue検索はlabels / Closedで候補を絞り、採用判定は必ず最新のIssue本文で行う。本文`State`が宣言上の正本だが、PR、dependency、成果、metadataと矛盾するIssueは候補から除外し、事実確認後に本文とmetadataを同じcheckpointで修正する。矛盾を解消できなければ取得しない。`REVIEW`は別枠で報告し、明示依頼なしに取得しない。

状態遷移の基本は`READY → IN_PROGRESS → REVIEW → DONE`。外部待ちが必要なときだけ`BLOCKED`へ遷移し、解消後は実態に応じて`READY`または`IN_PROGRESS`へ戻す。単なる未完了、時間切れ、難しさを`BLOCKED`にしない。

## 作業開始前

可能な限りGitHub connectorを優先し、利用できない場合だけ`gh` CLIのJSON出力を使って一度に次を確認する。子Issueを作成するときは、作成直前に親Issueの子Issue一覧を再取得する。

- repository / remoteと認証
- 対象Issueの本文、state、labels、assignee、milestone
- Issueタイトルの種別prefixと、対象機能・アップグレード範囲
- dependency / sub-issueがあればその状態
- 関連branch / PRがあればその情報
- 自動選択時は候補Issueの本文中の`State`と`Next action`
- 子Issue作成時は、親Issueの既存子Issue一覧と依存関係

高レベルの`gh` commandで取れない情報だけ`gh api`を使う。mutationの前に対象repositoryとIssue番号を再確認し、secrets/tokenは出力しない。GitHub APIや認証が取得できない場合は状態を推測しない（「エラー時」を参照）。

Phase番号や子Issueの枝番は割り当てない。親子関係、依存関係、実施順はGitHubのsub-issue関係とIssue本文に明記する。並行作業で同じ目的のIssueが重複した場合は自動統合せず、重複を解消する人間判断を`BLOCKED`として記録する。

### Issueの決定

次の優先順位で対象を決める。

1. ユーザーが明示したIssue
2. 現在のbranch / PRに明確に関連するIssue
3. ユーザーが指定したMilestone内の次の作業
4. 現在のactive Milestone内の次の作業

自動選択では`State: READY`、`Owner: Agent`またはrepoが明示したagent ownerで、`Next action`がAgent実行可能、かつdependencyにblockされていないIssueだけを候補にする。`Owner: Human`、`IN_PROGRESS`、`BLOCKED`、`REVIEW`、本文の現在地が不足するIssueは自動取得しない。複数候補なら親子関係、dependency上先に必要なもの、Issueの作成日・番号の順で選ぶ。種別prefixの有無だけを理由に優先順位を変えない。明示指定、または現在branch / PRと明確に紐付く`IN_PROGRESS`だけ再開してよい。

### Issueがない場合

repo変更依頼に対応するIssueがなければ、実装前に最小Issueを作る。メジャーverUpのような長期作業では、先に親`更新:` Issueを作成し、その下にコンポーネント単位の子Issueを作る。まず`State: READY`、着手時に`IN_PROGRESS`へ更新する。単一工程なら次で十分である。

```md
## Status

**State:** READY
**Owner:** Agent
**Next action:** <具体的な最初の作業>

## Outcome

<達成する結果>

## Definition of Done

- [ ] <検証可能な完了条件>

## Verification

- <必要な検証>
```

Milestoneは、ユーザー指定、parent/sub-issue、関連Issue、open Milestoneが1つだけ、の順で判断して割り当てる。判断できなければMilestoneなしで作成し、報告する。通常の実装中にMilestoneを勝手に新設しない。

## 実行とcheckpoint

現在Issueに自然に含まれる小規模作業はIssueを増やさない。独立して完了判定でき、別実施可能、現在Issueをblockする、またはscopeが大きすぎる場合だけ追加Issueを作る。将来やるかもしれない思いつきで大量生成しない。

毎回、次のloopを1 logical work unitずつ実行する。

```text
Read Issue body
  → Read Status / Next action
  → Check prerequisites
  → Execute one logical work unit
  → Verify result
  → Update Current progress
  → Set one concrete Next action
  → Set State / Owner / blocker / resume point
```

実作業の直前に本文を`IN_PROGRESS`へし、`Owner`と`Next action`を現在作業に合わせ、`status:blocked`を除去して`status:in-progress`を付ける。Skillを読んだだけでは状態を変えない。

作業単位の完了時、handoff時、sessionを終える前、blocker発生時、review待ちになる時に、コメントより先にIssue本文をcheckpointする。完了checkbox、`← NEXT`、`Next action`、`Owner`、`State`、必要な`Blocking reason` / `Resume from`を相互整合させる。結果の証拠や長いlogはコメントや外部artifactへ置き、本文には現在地と再開に必要な参照だけを残す。

## BLOCKEDとhandoff

`BLOCKED`では次をすべて本文に残す。`Owner`はblockerを解消する次の主体であり、人間とは限らない。

```md
**State:** BLOCKED
**Owner:** Human | <dependency / external system / specific owner>
**Next action:** <人間が直ちに行える具体的な作業>
**Blocking reason:** <なぜ他の作業を続けられないか>
**Resume from:** <人間作業完了後にAgentが再開するsection / step / command>
```

人間作業なら`Owner: Human`と`Human action required`を必須とし、技術背景を知らなくても実施できるよう、対象file/page、開き方、編集対象、禁止事項、期待する出力、完了の伝え方を記す。単に「確認してください」と書かない。dependency Issueや外部system待ちではspecific ownerを記し、`Human action required`は人間が実行する操作がある場合だけ追加する。`Next action`にはblocker解消の操作または確認条件を書く。

handoff先に応じてcheckpointを調整する。

- Agent → Human: `Owner: Human`。exact action、入力、出力、Agentのresume pointを残す。
- Human → Agent: 人間作業完了時に本文を`READY` / `Owner: Agent`とし、検証または実装の次actionへcheckpointする。人間にGitHub write権限がなければ、成果物pathと完了証拠を指定channelでAgentへ渡し、Agentが確認後に本文を更新する。
- Agent A → Agent B / new session: 完了工程、未完了action、安全なresume point、使用artifact / branch / commandを本文に残す。次担当がまだ着手していなければ`READY`、引受け済みで作業中なら`IN_PROGRESS`とする。

## 既存Issueの更新

Issue全体の書き直しを目的にしない。最新取得した本文へ`Status`と必要な`Current progress`を最小差分で挿入し、既存`Goal` / `Outcome`、Acceptance Criteria、Runbook、Verification、Notesを保持する。既存sectionの要約、再構成、削除は、明確に古い状態表現である場合を除き行わない。成果物、履歴、詳細手順を不必要に変更せず、不明なcheckboxは変更しない。

不明点があれば推測でcheckboxを完了にせず、`Next action`を「不足事実を確認する具体的操作」にする。移行後は本文だけで、State、Owner、完了工程、次action、blocker、resume point、DoDを答えられるか確認する。

## ブランチとメジャーverUp

通常は`main`からIssueごとの短期ブランチを作り、検証後にPRで`main`へ統合する。ブランチ名は`feat/`、`fix/`、`docs/`、`test/`、`refactor/`、`chore/`のいずれかから始め、目的をlowercase hyphenatedで表す。

メジャーverUpの期間だけ、長期作業を安全に統合するための暫定ブランチを許可する。

1. 親`更新:` Issueを作成する。
2. 最新の`main`から`chore/major-version-upgrade`を作成する。
3. Frontend / Tauri / Rust / CI / verificationの子Issueとブランチを、必要に応じて暫定ブランチへPRする。
4. 親Issueに統合順、未解決事項、検証結果をcheckpointする。
5. 全体検証後、暫定ブランチから`main`への最終PRを作成する。
6. 最終PRのmerge後に暫定ブランチを削除する。

`develop`を恒久的な統合ブランチにしない。既存の`develop`上に未コミット変更がある場合は、勝手に切り替えず、変更を保存・commit・handoffしてから暫定ブランチへ移す。通常の機能IssueをメジャーverUpの暫定ブランチへ混ぜない。

`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`のversionは、メジャーverUpまたはrelease時に整合性を確認する。現在の不一致はupgrade Issueで扱い、無関係なIssueで黙って修正しない。

## 完了判定

コードを書き終えただけでは`DONE`にしない。Definition of Done、required verification、repoのdelivery workflowを満たすことを確認する。

- PR deliveryならmerge前は`REVIEW`にし、merge時にCloseされる関連付けを行う。Issueを先にCloseしない。
- direct commit workflowならrequired commit、必要ならremote反映、verification成功後に`DONE`へしてCloseする。
- workspace上だけの未commit / 未delivery変更なら`REVIEW`または`IN_PROGRESS`のままとし、deliveryを`Next action`にする。

delivery条件はrepoの`AGENTS.md`または明示されたworkflowだけから決める。Skill自身がCloseのためだけに勝手にcommit / pushしない。commit、push、PR、branchはrepo指示とユーザー権限に従う。承認が必要なpush / PR / merge待ちは`REVIEW`、`Owner: Human`とし、具体的な承認actionと承認後の`Resume from`を記す。Closeするときは本文を`DONE`へ更新してからCloseし、再取得して両方を確認する。

## Milestone / roadmap

Milestoneを作成・変更してよいのは、ユーザーが明示的にroadmapの作成・再編を依頼した場合だけ。Milestoneは成果または大きなupgrade単位とし、細かいタスク単位にしない。親IssueとMilestoneを使う場合は、対応関係を本文に明記する。独自MarkdownのTODO/ROADMAPは作成・更新しない。

## 最終報告

最終回答を書く直前に対象Issueを必ず再queryし、以前の取得値や会話上の記憶から進捗を推測しない。関連Issueは依存・handoff判断に使った場合、Milestoneは設定済みまたはroadmap報告時に再取得する。Milestoneの対象Issueがあればcompletion percentageを`closed / (open + closed) * 100`で算出する。必要ならIN_PROGRESS、BLOCKED、REVIEW、次に着手可能なIssueも再取得する。

簡潔に次の構成で報告する。未設定の項目は`none`と書く。Issueが存在しない、または再queryできない場合は、推測した番号や状態を出力せず、`Issue: unavailable`として理由を記す。

```text
Issue
#42 機能: タグ検索 — IN PROGRESS

Changes
- 一致スコアを実装

Validation
- test: PASS

Roadmap
none

Active
#42 機能: タグ検索

Blocked
none

Next
none
```

## エラー時

GitHub connector / `gh`がない、認証、remote特定、API取得、mutationに失敗した場合、取得・更新できなかった状態を明示して推測しない。Markdown TODOやローカルfileへfallbackしない。コード作業はユーザー依頼とrepo policyの範囲で継続してよいが、Issue checkpoint / lifecycle更新失敗を最終報告に残す。

## 補助物を追加する基準

まず代表Issueを本文だけで再開できるか検証し、必須field欠落やparse不能が再現しなければSkillだけを選ぶ。種別prefixの欠落、重複Issue、親子関係の欠落についても、まずSkillの規則で運用する。Issue templateや軽量checkerは、新規Issue作成時の同じ欠落が複数回反復した場合だけ追加する。本文を再表示するだけのharnessは追加しない。GitHub Issueを置き換えるdatabase、同期daemon、巨大な独自状態管理を導入しない。
