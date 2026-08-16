<!-- distilled-from: archive/2026-07-13-add-speccode-plugin/ -->
**worktree 清理来源限定**：reset/finishing-worktree 清理 worktree 时仅处理满足来源判据的 worktree，不清理宿主环境创建的 worktree。v0.1 判据为过滤 worktree- 前缀 + git worktree remove --force + git branch -D。v2 强化为「分支带配置前缀 且（路径位于 resolve-worktree-dir 解析结果之下 或 在 state 中有登记）」，防止误删用户自建 worktree。不满足时原样保留并打印原因。

**pr_tool=none 降级语义**：config.pr_tool = "none" 时 finish/develop-complete MUST 不实际创建 PR，而是打印等效的 gh/glab 命令让用户手动执行，并中止流程。避免功能硬性要求外部 CLI，也避免在无授权环境下自动创建 PR。无 config（未 init）时 query-pr 返回 {ok:false} 并提示先执行 /speccode:init。

**丢弃路径需逐字输入 discard**：finishing-worktree 的丢弃（discard）不在菜单中，仅当用户显式要求时进入。进入后 MUST 先展示分支名、完整 commit 列表（git log --oneline <F>..<worktree>）、worktree 路径，再要求用户逐字输入 `discard`。任何其他输入（包括"确认/删除/是的"）→ 取消，不删任何东西。这防止误操作丢弃工作成果。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-09-speccode-v2-sdd-flow/ -->
**hooks warn-only 语义与威胁模型**：hook 失败是 warn-only，绝不破坏调用它的命令。非零退出/超时(30s)/不可执行 → 主命令继续并打印警告（含事件名与错误摘要）；hook 不改变主命令退出码。威胁模型：config.hooks 经 `sh -c` 以用户全权限执行 shell 命令。安全性来自 `.speccode/` 按约定 untracked，不经 PR/clone 传播（攻击者无法经仓库注入 hook）；payload 值受 slug.mjs 结构约束（feature_branch/worktree_branch 格式受限）。v2 不做 strict/blocking 模式——通知类集成（IM 等）的正确默认就是不阻断。

**hooks payload envelope 权威优先**：引擎只补 envelope 四字段（event/timestamp/repo_root/cwd），且 spread 在最后（caller fragment 不可覆盖）。这防止恶意或错误的 payload 片段覆盖权威字段（如伪造 event 名或 repo_root）。payload 片段允许为空（视为 {}），stdin 读取容忍空输入与非法 JSON（降级为 {} 并附 warning）。

**memory untracked 防止泄漏进 trunk 历史**：memory 文件 MUST 保持 untracked，不进入任何分支的 git 历史与 PR。备选（tracked in speccode/changes/）被否：会把会话笔记带进功能 PR、跨 worktree 产生合并冲突、泄漏进 trunk 历史。memory 含跨会话决策摘要，可能包含敏感上下文，untracked + 主仓定位是安全与功能的平衡。

**stale 检测与自愈安全网**：对账算法在每次涉及 worktree 的命令入口运行，容忍用户手动操作 git 后的状态漂移。state 中有 worktree 但 git 中不存在 → 标 orphaned（提示用户手动处理，不改 state 中的 status）；git 中有 worktree 但 state 中无 → ancestry/override 自动补齐。两个 no-config reconcile 端到端测试编码「对账绝不能因缺配置崩溃」的安全网语义——reconcile prefix 读 config 时 `?? 'worktree-'` 兜底必须保留，不许按字面「改读 config」删掉兜底。

**finishing-feature 门禁阻止未完成功能**：finishing-feature 开头先跑对账，再检查当前 feature 的所有 worktree 状态。存在任何 pending/in_progress/pr_open 的 worktree 时 MUST 阻止 finish 并列出未完成项。对账 orphans 里若有本 feature 的残留 worktree 也提示先清理。这防止未完成的工作被误「交付」到 trunk。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-10-rebrand-visual-companion/ -->
**references 自包含与品牌中立**：plugins/speccode/references/ 下的辅助资源（脚本、模板、文档）MUST 自包含：渲染产物 MUST NOT 引用第三方品牌标识（名称、logo、链接），MUST NOT 在运行时请求第三方远程资源（图片、脚本、样式）。所需版本号、仓库链接等元数据 MUST 读自 plugin.json，MUST NOT 硬编码（兜底常量除外）。这防止供应链污染（远程 logo 被替换）与品牌残留。删除远程 logo 后，遥测关停开关失去作用对象（所谓遥测环境变量的真实作用仅是抑制远程品牌图加载，不存在任何遥测上报流量），整块移除而非更名保留。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-visual-companion-cleanup/ -->
**homepage scheme 门禁(纵深防御)**:visual companion 把 plugin.json 的 homepage 直接渲进 `<a href>`,escapeHtmlText 防住属性逃逸但防不住 `javascript:` scheme。同信任边界内非漏洞但属纵深防御缺口——门禁放在读取时(readSpeccodeManifest)校验 `/^https?:\/\//`,非法/非字符串/空串统一回退兜底默认仓库 URL,brandMarkup 使用点无需改动,未来新增使用点也无需各自记得。

**元数据不盲信**:渲染层对元数据 homepage 做 scheme 白名单,只放行 http/https,其余一律回退。spec 钉为可验证契约(scenario: homepage 非 http(s) 回退)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-14-knowledge-set/ -->
write-knowledge 路径遍历防护:`assertSafeRel(rel)` 校验相对路径——拒绝 `..` 遍历、绝对路径(`/abs.md`)、反斜杠(a\b.md)、空段(a//b.md)、`.` 段(./x.md)、空串。只允许简单正斜杠相对路径。verb 层先校验再传 lib,rel 不合法直接 `{ok:false, error}` + exit 1。

trunk 防护:知识集写入命令(recording-knowledge/distilling-knowledge)入口检查 `git rev-parse --abbrev-ref HEAD` 必须以 `config.worktree_prefix`(默认 worktree-)开头,防止直提 trunk。绑定功能分支:运行 reconcile 找当前 worktree 所属 feature,找不到则报错退出。
<!-- /distilled -->
