# Tasks: host-detection

依赖顺序分组。组 1 为 TDD 红灯;探测逻辑全部注入式,单测不触真机。

## 1. 测试先行(红)

- [x] `tests/detect.test.mjs` 新增 `detectHost` 启发测试(env 标记命中 claude-code、`.claude/` 目录命中、无信号回退 generic、`--host` 显式覆盖优先)——注入 homeDir/exists/env,此时为红
- [x] `tests/detect.test.mjs` 新增 code_intel 分流测试:host=codex 时 ~/.claude 探测物不产生 evidence;host=claude-code/缺失时行为与现行为逐字节一致(既有断言照旧通过)
- [x] `tests/` 新增缺省单源测试:`resolveWorktreeDir` 缺省 = `.speccode/worktrees`;reconcile 在 config 缺失时按同一常量解析(两处一致,此时为红)

## 2. lib(转绿)

- [x] `lib/detect.mjs`:新增 `detectHost(cwd, opts)`(分层启发 + opts 显式覆盖,注入 env/exists/homeDir)+ 导出 `DEFAULT_WORKTREE_DIR = '.speccode/worktrees'`;`resolveWorktreeDir` 缺省改引该常量
- [x] `lib/reconcile.mjs:13`:fallback 硬编码 `.claude/worktrees` 改为引用 `DEFAULT_WORKTREE_DIR`(import from detect.mjs)

## 3. bin verb

- [x] `bin/speccode.mjs` VERBS 表新增只读 verb `detect-host`(支持 `--host <id>` 显式覆盖;输出 `{ok:true, host, evidence, source}`)
- [x] `detect-code-intel-tools` verb:读 `config.host`(缺失 = generic)传入 `detectCodeIntelTools(cwd, { host })`;`detectCodeIntelTools` 增加 host 分流逻辑(非 claude-code 跳过 ~/.claude 两类探测)

## 4. 命令与文档

- [x] `skills/init/SKILL.md`:新增「探测宿主」步骤(运行 detect-host → 向用户提问确认(给出选项)→ 写入);config 组装字段表加 `host`;二次 init diff 字段表同步
- [x] `AGENTS.md` 对账不变量小节:worktree_dir 缺省表述改 `.speccode/worktrees`(两处:对账算法描述、SDD 工作区外的缺省提及如有)
- [x] 检查其余 skills/docs 对 `.claude/worktrees` 缺省的引用(grep 清点,逐处更新或确认语境仍成立;复扫发现 docs/DESIGN 双语 R6 风险条目各一处,随本条修复。**范围修正(复审)**:知识集 speccode/knowledge/ 两处过时缺省表述(environment.md「默认 .claude/worktrees」、security.md)位于 distilled 区禁手改,4.3 的 grep 未覆盖知识集——留待本变更 syncing 更新主规格后由下次 distilling 刷新,与 neutralize-prose 的知识集延期同款处理)

## 5. 验证

- [x] 全量测试 `node --test ./tests/*.test.mjs` 全绿(组 1 红灯转绿,既有用例不破;295 pass / 0 fail)
- [x] grep 验证 `.claude/worktrees` 在 lib/ 零残留(缺省唯一来源 = DEFAULT_WORKTREE_DIR)
- [x] verb 冒烟:`speccode detect-host --cwd .`(真实环境命中 env:CLAUDECODE → claude-code)+ `--host zcode` 覆盖(source: explicit)+ `speccode detect-code-intel-tools --cwd .` 正常(host:null 全量探测)
- [x] 复审修复(With fixes,3 Important + 4 Minor 已修):①init 幂等流程 stale 步骤引用(第 7 步→第 8 步,「第 N 步」全量 grep 复核);②spec delta 自相矛盾修正(host 缺失语义:未记录 = 全量探测,与实现/设计/场景一致——host-detection 与 speccode-config-management 两个 delta 各一处,syncing 前最后时机);③知识集延期处理确认(见 4.3);④stale 红灯注释修剪;⑤detect-host 裸 `--host` 显式拒绝 + 移除冗余本地 try/catch(交 main 统一处理,CLI 测试验证);⑥docs/DESIGN 双语字段集与探测来源列表补 host 门控;⑦幂等流程补宿主切换注意 + init frontmatter description 补宿主探测。Minor 7(TDD 红灯未覆盖 CLI 层)与 Minor 9(启发标记弱信号)接受为已知项,记入分支记忆
