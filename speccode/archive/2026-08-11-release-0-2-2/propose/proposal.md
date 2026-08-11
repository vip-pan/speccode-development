# Proposal: release-0-2-2

## Why

R4-R7 四项插件面修复(type 推断来源、orphan 虚警、memory append 边界、homepage scheme 门禁 + 死 CSS)已在主干但未触达用户;按发布纪律发 patch。另:R7 发现「plugin.json 元数据」规格把 `version: "0.2.0"` 钉成字面量,0.2.1 发布后已漂移——发版前必须先修这个"每次发版必然过时"的规格写法。

## What Changes

- `plugin.json`:version 0.2.1 → 0.2.2
- `CHANGELOG.md`:新增 `[0.2.2]` 小节(Fixed×4 / Changed,覆盖 R4-R7)+ 底部比较链接
- spec delta(plugin-packaging,MODIFIED ×2):
  - 「plugin.json 元数据」:version 断言去字面量,改为「合法语义化版本且与 CHANGELOG 最新小节一致」;「版本号控制更新」scenario 去具体版本举例化
  - 「命令命名空间」:「旧命令名不再出现」scenario 的 `0.2.0` → `0.2.x`
- 无 BREAKING

## Capabilities

- modified: `plugin-packaging`

## Impact

- 插件元数据与发布物:plugin.json、CHANGELOG.md
- 文档:`speccode/spec/plugin-packaging/spec.md`(经 syncing)
- 合并后主干动作:tag `v0.2.2` + GitHub Release(notes 摘自 0.2.2 小节)
