# Proposal: visual-companion-cleanup

## Why

第二轮品牌改写的两处残留(R2 终审 M1/M3):页脚 `homepage` 链接渲染前无 scheme 校验(`javascript:` 类非法 scheme 会被渲染为可执行链接——同信任边界内非漏洞,属纵深防御缺口);已删除 logo 的陪葬 CSS(`gap`、`translateY(-1px)`)仍留在两个文件中,误导后来者。

## What Changes

- `server.cjs` `readSpeccodeManifest()`:homepage 读取时校验 `/^https?:\/\//`,非法或缺失回退默认仓库 URL(纵深防御,2 行级)
- `server.cjs` 与 `frame-template.html`:删除 `.brand a` 的 `gap: 0.5rem` 与 `.brand-copy` 的 `transform: translateY(-1px)`(共 4 处属性,logo 删除后失去作用对象)
- spec delta:plugin-packaging MODIFIED「references 自包含与品牌中立」——正文补 scheme 校验句,新增「homepage 非 http(s) 回退」scenario
- 无 BREAKING(渲染产物不变或更安全;CSS 删除不改变有效渲染)

## Capabilities

- modified: `plugin-packaging`

## Impact

- 代码:`plugins/speccode/references/visual-companion-scripts/server.cjs`、`frame-template.html`
- 文档:`speccode/spec/plugin-packaging/spec.md`(经 syncing)
- 验证:references 层无单测(既有边界),走冒烟 + 篡改 plugin.json 的临时线束(红/绿)+ 137 全量
