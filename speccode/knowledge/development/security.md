<!-- distilled-from: cap/git-workflow-lifecycle -->
**worktree 清理来源限定**:reset/finishing-worktree 清理 worktree 时仅处理「路径位于 resolve-worktree-dir 解析结果之下 或 在 state 中有登记」的 worktree(state 登记项覆盖 worktree_dir 配置变更前旧目录);不满足时原样保留并打印原因,不清理宿主环境创建的 worktree。**丢弃路径需逐字输入 discard**:finishing-worktree 的丢弃不在菜单中,仅显式要求时进入;进入后 MUST 先展示分支名、完整 commit 列表(git log --oneline <F>..<worktree>)、worktree 路径,再要求用户逐字输入 discard;任何其他输入(含「确认/删除/是的」)→ 取消,不删任何东西——防止误操作丢弃工作成果。**finishing-feature 门禁阻止未完成功能**:开头先跑对账,再检查 children;存在任何 pending/in_progress/pr_open 子分支时 MUST 阻止并列出未完成项;对账 orphans 里若有本父实体残留 worktree 提示先清理——防止未完成的工作被误「交付」到 trunk。**对账安全网(缺配置不崩溃)**:对账在每个涉及 worktree 的命令入口运行,容忍用户手动操作 git 后的状态漂移;config 缺失时以默认 worktree_dir(.claude/worktrees)正常执行绝不报错退出(无 config reconcile 端到端测试编码此安全网语义)。(出自 archive/2026-07-13-add-speccode-plugin、2026-08-09-speccode-v2-sdd-flow;自动补齐/前缀兜底句按现行 v3 契约改写)
<!-- /distilled -->

<!-- distilled-from: cap/pr-tool-integration -->
**pr_tool=none 降级语义**:config.pr_tool 为 none 时 finishing-feature/finishing-worktree MUST 不实际创建 PR,而是打印等效 gh/glab 命令让用户手动执行并中止流程——避免功能硬性要求外部 CLI,也避免在无授权环境下自动创建 PR。无 config(未 init)时 query-pr 返回 {ok:false} 并提示先执行 /speccode:init。(出自 archive/2026-07-13-add-speccode-plugin)
<!-- /distilled -->

<!-- distilled-from: cap/hook-event-integration -->
**hooks warn-only 语义与威胁模型**:hook 失败是 warn-only,绝不破坏调用它的命令;非零退出/超时(30s)/不可执行 → 主命令继续并打印警告(含事件名与错误摘要),hook 不改变主命令退出码。威胁模型:config.hooks 经 sh -c 以用户全权限执行 shell 命令;安全性来自 .speccode/ 按约定 untracked,不经 PR/clone 传播(攻击者无法经仓库注入 hook);payload 值受 slug.mjs 结构约束(feature_branch/worktree_branch 格式受限)。通知类集成(IM 等)的正确默认就是不阻断,不做 strict/blocking 模式。

**payload envelope 权威优先**:引擎只补 envelope 四字段(event/timestamp/repo_root/cwd)且 spread 在最后(caller fragment 不可覆盖)——防止恶意或错误的 payload 片段覆盖权威字段(伪造 event 名或 repo_root);片段允许为空,stdin 读取容忍空输入与非法 JSON(降级为 {} 并附 warning)。(出自 archive/2026-08-09-speccode-v2-sdd-flow)
<!-- /distilled -->

<!-- distilled-from: cap/session-memory -->
**memory untracked 防止泄漏进 trunk 历史**:memory 文件 MUST 保持 untracked,不进入任何分支的 git 历史与 PR。备选(tracked in speccode/changes/)被否:会把会话笔记带进功能 PR、跨 worktree 产生合并冲突、泄漏进 trunk 历史。memory 含跨会话决策摘要、可能包含敏感上下文——untracked + 主仓定位是安全与功能的平衡。(出自 archive/2026-08-09-speccode-v2-sdd-flow)
<!-- /distilled -->

<!-- distilled-from: cap/plugin-packaging -->
**references 自包含与品牌中立**:plugins/speccode/references/ 下辅助资源 MUST 自包含——渲染产物 MUST NOT 引用第三方品牌标识(名称、logo、链接)、MUST NOT 运行时请求第三方远程资源(图片、脚本、样式);所需版本号、仓库链接等元数据 MUST 读自 plugin.json 不硬编码(兜底常量除外)。防止供应链污染(远程 logo 被替换)与品牌残留;删除远程 logo 后失去作用对象的机制(如遥测关停开关)整块移除而非更名保留。

**homepage scheme 门禁(纵深防御)**:visual companion 把 plugin.json 的 homepage 直接渲进 <a href>,escapeHtmlText 防住属性逃逸但防不住 javascript: scheme;门禁放读取时(readSpeccodeManifest)校验 /^https?:\//,非法/非字符串/空串统一回退兜底默认仓库 URL——消毒时机早,未来新增使用点无需各自记得。**元数据不盲信**:渲染层对元数据做 scheme 白名单只放行 http/https;spec 钉为可验证契约。**合法值无误杀面**:只放行 http/https 对当前值与可预见值(GitHub URL)无误杀。(出自 archive/2026-08-10-rebrand-visual-companion、2026-08-11-visual-companion-cleanup;visual companion 防御类按 plugin-packaging「references 自包含与品牌中立」requirement 归属,brief 默认归 documentation-facade 可改判)
<!-- /distilled -->

<!-- distilled-from: cap/knowledge-set -->
**write-knowledge 路径遍历防护**:assertSafeRel(rel) 校验相对路径——拒绝 .. 遍历、绝对路径(/abs.md)、反斜杠、空段(a//b.md)、. 段、空串;只允许简单正斜杠相对路径;verb 层先校验再传 lib,rel 不合法直接 {ok:false, error} + exit 1。

**知识维护分支纪律(现行)**:distilling-knowledge/recording-knowledge MUST 运行于 state 登记的 `chore/knowledge-*` 开发分支的 worktree 中(与其他开发分支同一入口与收尾);MUST NOT 在其他任何分支(含 trunk、feature/bugfix/refactor 分支、不匹配 chore/knowledge- 的 chore 分支)的 worktree 或主工作区执行知识写入,违反时提示并退出。(出自 archive/2026-08-14-knowledge-set;trunk 防护判据按现行契约由 worktree- 前缀改写为 chore/knowledge-* 分支纪律)
<!-- /distilled -->

<!-- distilled-from: cap/tool-input-sanitization -->
**清洗 hook 威胁模型**:fail-open 语义保证 hook 自身故障(非法 stdin、抛错、超时)退化为「不清洗」,绝不升级为阻断或拒绝用户交互;清洗范围限定单一控制字符(U+000D),最小打击面,不碰其他字节;插件级 hooks.json 不写目标项目 settings,零污染、卸载无残留;import 失败(文件缺失)是唯一 fail-closed 例外,由同插件包原子性保证,可接受。(出自 archive/2026-09-02-askuserquestion-cr-sanitizer)
<!-- /distilled -->
