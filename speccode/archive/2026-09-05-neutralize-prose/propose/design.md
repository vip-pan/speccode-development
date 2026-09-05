# Design: neutralize-prose

## Context

探索阶段(父实体记忆)锁定:prose 宿主中立是纪律而非转换——superpowers 11 宿主的实证是「共享 skills 零宿主专属 token,差异全部移到 per-host 映射」。实测本仓 24 skills:AskUserQuestion ×11 文件、`general-purpose` ×2、`${CLAUDE_PLUGIN_ROOT}` ×14(5 文件,全部是 references/ 路径引用)、`speccode.mjs` 裸调 ×94(依赖 CC 插件 bin/ 进 PATH 的隐含魔法)。cli.test 的 SKILL 内容断言均为语义级,不锁调用形态。

约束:CC 上行为不得退化;确定性逻辑不进 markdown(仓库第一纪律);host-adapters 尚未存在,映射文档不在本变更范围。

## Goals

- skills/ 零宿主专属 token(grep 守卫固化);提问与派发走宿主中立语义
- `speccode <verb>` 成为唯一 prose 调用形态,CC 与未来宿主共用;shim 缺失时链路断点显性化
- 插件内文件引用摆脱宿主变量,经引擎自定位解决

## Non-Goals

- 不做任何 per-host 映射文档与 adapter(manifest skillInstructions / references/host-mapping/* 归 `host-adapters`)
- 不做宿主探测与 config.host 字段(归 `host-detection`)
- 不改 verb 语义与 CLI 行为(仅 +1 只读 verb)
- 不动 README/docs 的 `/speccode:*` 门面表述(用户面 API 未变)

## Decisions

1. **`${CLAUDE_PLUGIN_ROOT}` → 引擎自定位 verb `plugin-root`**——备选:(a) 相对路径(依赖 agent 知晓 skill 目录位置,不可靠);(b) per-host 变量映射(把差异留在正文,违背中立纪律)。引擎可自定位(bin/speccode.mjs 的 `import.meta.url` 上溯两级 = 插件根),一行只读 verb 让 14 处路径引用获得宿主无关、且与 shim 同生命周期的解析方式——确定性逻辑下沉 lib 哲学的直接应用。
2. **调用形态 `speccode <verb>`,wrapper 落 `bin/speccode`**——CC 插件机制把插件 bin/ 整目录进 PATH,wrapper 即时生效零配置;其他宿主由 host-adapters 的安装步骤往 PATH 放 shim。备选:prose 保持 `speccode.mjs` 并要求各宿主把整个 bin/ 进 PATH(不可控);prose 写 `node <路径>/speccode.mjs`(宿主路径进正文,否定)。
3. **提问中性化 = 语义化措辞 + 不写分支**——prose 写「向用户提问,一次一问,给 2-4 个具体选项」;CC 模型按可用工具自选 AskUserQuestion(hooks sanitize 照常工作),Codex 等自然回落文本提问。备选:正文内写「若宿主提供 X 则用之」条件分支(superpowers 实证正文条件分支是弱模型误判源;宿主绑定归映射文档)。子代理同构:「派发一个全新子代理」+ 依赖型 skill 声明降级路由。
4. **中性化以 grep 守卫测试固化**——先写红测试(skills/ 检索 AskUserQuestion|CLAUDE_PLUGIN_ROOT|general-purpose|speccode\.mjs 必须零命中),改写转绿;防回潮优于人工纪律。
5. **install-skills.sh 仅参数化 `--dest`**——多宿主目录清单是 host 知识,归 host-adapters;本变更只把「目的地」从硬编码变为参数,默认 `.claude/skills` 保持现状。

## Risks

| 风险 | 缓解 |
|---|---|
| 24 篇 prose 改写引入语义漂移(尤其中性化后的提问/派发流程) | grep 守卫 + 语义级既有测试(279 项)全绿 + code review;逐文件改写在 tasks.md 列明清单 |
| shim 未进 PATH 的宿主上 `speccode` 不可用,链路全断 | host-adapters 安装步骤负责 shim;过渡期 `speccode.mjs` 直调保留;wrapper 在 CC 上零配置生效 |
| `plugin-root` 在非插件安装形态(如裸仓开发)下解析出错 | 引擎自定位以自身文件位置为锚,与安装形态无关;测试覆盖 |
| 中性化后 CC 提问体验退化(模型不再用 AskUserQuestion) | 语义化措辞保留「给选项」强信号;hooks sanitize 继续护栏;review 时人工抽验 |

## Open Questions

无——映射落点与调用形态均承自父实体锁定决策。
