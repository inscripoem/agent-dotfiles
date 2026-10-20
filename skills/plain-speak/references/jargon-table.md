# Term → Plain Language Mapping

> Adapted from this project's prior research session (October 2026). Rule: a replacement must preserve the original information; whatever cannot be replaced wasn't information to begin with.

## 1. Term-by-term mapping

### 探针 (probe)
❌ 在服务里加探针，验证返回正常。
✅ 加一个只查不改的入口，确认能拿到返回数据。
> "探针" implies heavy machinery. If it is just checking status, one token-carrying HTTP request does the job.

### 快照 (snapshot)
❌ 操作前先打快照。
✅ 改之前先把现在的配置文件复制一份存到 /backup。
> Snapshot = copy. Almost every "快照" should read "copy X to Y".

### 证据 (evidence)
❌ 留存全部查询证据。
✅ 结果贴在下面。
> The word carries nothing. "Evidence" must name the log, output, or screenshot; if you cannot name it, there is no evidence.

### 门禁 (gate)
❌ 配置多层确认门禁。
✅ 改之前必须你自己确认，我停下来等你回话。
> State the triple: who is blocked, on what action, what counts as passing. Miss one and there is no gate.

### 夹具 (fixture)
❌ 补充夹具覆盖异常路径。
✅ 造一条格式不对的假数据，测它会不会被正确拒绝。
> "Fixture" is test-framework internals. Readers care what data was constructed, not what it is called.

### 哈希 (hash)
❌ 记录文件哈希用于比对。
✅ 算一个文件的指纹（文件改一个字节它就变）。
> The term is accurate but bare; one clause ("changes if a single byte changes") is enough.

### 基线 (baseline)
❌ 确认基线一致性。
✅ 确认跟昨天那份一模一样。
> In documents, "基线" almost always hides a concrete object. A statistical baseline is a legitimate term — leave it alone.

### 可追溯备份 (traceable backup)
❌ 创建可追溯备份。
✅ 存一份备份，写清楚存在哪、怎么找回来。
> "可追溯" is a modifier, not information.

### 烟测 (smoke test)
❌ 烟测通过。
✅ 挑登录和下单这两个最要紧的流程跑一遍，能走通就算过。
> Translating it as 「冒烟测试」 loses the meaning entirely. Swap the example flows for whatever actually matters in the current business.

### 全量 dry-run (full dry-run)
❌ 已完成全量 dry-run。
✅ 完整模拟了一遍，没有真的执行。
> Worst mixed-language combo: the reader must know both languages at once.

### 验收矩阵 (acceptance matrix)
❌ 按验收矩阵逐项确认。
✅ 列出这次要确认的几件事，逐条打勾。
> "矩阵" implies a real 2-D table. Link it if it exists; drop the word if it doesn't.

### 最小改动 (minimal change)
✅ **Keep it.**
> The standing exception: it conveys real meaning ("I only touch what's necessary") with no accurate plain substitute.

## 2. Replacement order (apply in sequence)

| Step | Move | Example |
|---|---|---|
| 1 | Abstract noun → action + object | 「基线一致性」→「跟昨天那份对比」 |
| 2 | Acronym → full form (once) | 「CI」→「自动构建（CI）」, abbreviation OK afterwards |
| 3 | English loanword → Chinese | dry-run → 模拟执行 / 空跑 |
| 4 | Delete modifiers | 「可追溯的备份」→「备份」+ say where it lives |
| 5 | Genuinely needed → keep + one-line explanation | 「这是压测的基线，也就是没有优化时的耗时」 |

## 3. Extra rules for document authors

1. **One transition sentence between steps**: what problem does this step solve. Without it, readers copy commands blindly.
2. **Show the expected output**: without it, beginners cannot tell whether they succeeded.
3. **Every config field gets a real fillable value; every code example states its runtime version.**

## 4. Two extremes to avoid

- **Plain-language everything**: 幂等性 and 最终一致性 have precise meanings; paraphrasing them as 「重复做也一个样」 loses boundary conditions. Precision is the value of terms; threshold is the cost.
- **Rhetoric disguised as terminology**: 「优化」「提升」「完善」 look technical but are empty verbs — same disease as 「基线」, just harder to spot.

## 5. Word-list provenance

| Word group | Source | Evidence strength |
|---|---|---|
| 12 software-engineering terms (探针、快照、证据、门禁、夹具、哈希、基线、可追溯备份、最小改动、烟测、全量 dry-run、验收矩阵) | This project's prior research session (Oct 2026): problem observation on agent output | Observation sample, no corpus validation; zero hits in 4 community catalogs (unique list, pending empirical study) |
| 赋能、抓手、拉通 | Common knowledge of Chinese corporate jargon (no authoritative list) | Editorial judgment; uncontroversial pure filler |
| 沉淀、心智、留痕、对齐、闭环、复盘 | Added during the prior research session; flagged as dual-meaning | Editorial judgment; 对齐/闭环 corroborated by Humanizer-zh's conditional-list stance (19.8k-star repo: 「不因命中词表而删除」, preserves 「闭环反馈」) |
| Two-tier split (error/warning) | This session's design | Editorial; a string matcher cannot judge usage legitimacy, so the model decides context |
