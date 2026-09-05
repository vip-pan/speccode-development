# Tasks: host-adapters

依赖顺序分组;全部为 declarative 内容与文档,组 3 的 shim 脚本带测试。

## 1. 宿主 adapter(仓库根,薄 manifest)

- [x] `.codex-plugin/plugin.json`:name/speccode、skills `./skills/`、description、repository 指向 speccode 仓
- [x] `.kimi-plugin/plugin.json`:同上 + `skillInstructions` 内嵌工具映射(提问→AskUserQuestion、子代理→Agent tool、引擎调用→`speccode <verb>` shim;仿 superpowers 实测范本。**复审修正**:原列的「TodoWrite→TodoList」不做——skills 宿主 token 已被 neutralize-prose 守卫禁用,无任务清单语义需要映射;spec 正文「任务清单等语义」按此口径理解)
- [x] `.zcode-plugin/plugin.json`:Kimi 同款结构,skillInstructions 中宿主工具名以「待验证」标注
- [x] `.opencode/INSTALL.md`:opencode.json `plugin` 数组注入说明 + shim 步骤
- [x] `.pi/`:`extensions/speccode.ts` 最小骨架(注册 skills 目录;API 以官方文档为准,标注待验证)+ 安装说明(`pi install git:<URL>`)

## 2. 宿主映射文档(references/host-mapping/,五份三段式)

- [x] `references/host-mapping/codex.md`:安装(/plugins 或 git 直装)、工具映射、multi_agent 子代理机制教学(spawn_agent/wait_agent 注意,标注版本差异待验证)
- [x] `references/host-mapping/kimi-code.md`:安装(/plugins install git URL)、映射(与 manifest 一致)、注意
- [x] `references/host-mapping/zcode.md`:安装(待验证)、映射(同 Kimi 款)、待验证总标注
- [x] `references/host-mapping/opencode.md`:安装(opencode.json 注入)、映射、注意
- [x] `references/host-mapping/pi.md`:安装(pi install)、扩展说明、待验证标注
- [x] `references/host-mapping/README.md`:五宿主总览表(宿主/安装入口/映射载体/验证状态)

## 3. bin shim 安装脚本 + 测试

- [x] `scripts/install-shim.sh`:探测 `~/.local/bin`(可 `--dest <dir>` 覆盖)→ symlink `bin/speccode`;无候选可写 → 打印手动命令 + 非零退出
- [x] `tests/cli.test.mjs` 新增 shim 测试:`--dest` 临时目录安装 → 该目录加入 PATH 后 `speccode <verb>` 与 node 直调输出一致;不可写场景 → 非零退出(先红后绿)

## 4. 文档勾连

- [x] `AGENTS.md`「这个仓库是什么」段补一句:仓库根含五宿主 adapter 目录(分发配置,惰性,不进打包声明)
- [x] `docs/DESIGN.md` + `docs/DESIGN_CN.md` 分发章节(§2 或 §13)补多宿主安装入口表(双语同步;README 门面归 docs-multi-host)

## 5. 验证

- [x] 守卫测试:三个 plugin.json JSON 可解析且 skills 指向 ./skills/;host-mapping 五份存在且含三段标题;`.zcode-plugin` 含待验证标注(先红后绿)
- [x] 全量测试 `node --test ./tests/*.test.mjs` 全绿(295 基线 + 4 新守卫与 shim 测试 = 299 pass / 0 fail)
- [x] shim 冒烟:临时目录安装 + PATH 调用 `speccode plugin-root --cwd .`
