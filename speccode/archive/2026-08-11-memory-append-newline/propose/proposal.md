# Proposal: memory-append-newline

## Why

`writeMemory` 的 append 模式是裸 `appendFileSync` 追加,对条目边界零处理;而 21 个命令文档的骨架/heredoc 示例天然产生「前条无尾换行 + 新条无头换行」的组合——严格按文档操作就会在 memory 文件里产生粘连行(R1 实测:R1 终审 Minor 发现;R2 起调用方手工加 `\n` 绕行)。条目分隔责任没有归属,靠每个调用方自觉是结构性陷阱。

## What Changes

- `lib/memory.mjs` writeMemory append 模式:既有内容非空且不以换行结尾、且追加内容不以换行开头时,在边界插入恰好一个 `\n`(随同一次 O_APPEND 写落盘);其余情况原样,不多做规范化
- `tests/memory.test.mjs` 新增 2 用例:缺边界补一个 / 边界已存在不重复补(既有「空文件 append 等同 replace」用例覆盖第三条边界,135 → 137)
- spec delta:session-memory MODIFIED「memory 原子写」——按模式精确化(replace=临时文件+rename;append=单次 O_APPEND),钉入条目边界规则;**顺带修正该条款与 a45202a O_APPEND 实现的既有漂移**(条款仍写「append 读-改-写」,实现早已改为单次追加写)
- `CLAUDE.md` 测试计数 135 → 137
- 无 BREAKING(只在缺失处补一个换行;既有全部用例语义不变)

## Capabilities

- modified: `session-memory`

## Impact

- 代码:`plugins/speccode/lib/memory.mjs`(append 路径)、`plugins/speccode/tests/memory.test.mjs`(2 新用例)
- 文档:`speccode/spec/session-memory/spec.md`(经 syncing)、`CLAUDE.md`(计数)
- 行为:命令文档不写换行约定也不再产生粘连行;调用方可传纯内容
