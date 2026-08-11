# Design: visual-companion-cleanup

## Context

R2 终审(opus)两条 Minor:M1——`brandMarkup()` 把 plugin.json 的 `homepage` 直接渲进 `<a href>`,`escapeHtmlText` 防住了属性逃逸但防不住 `javascript:` scheme;M3——logo `<img>` 删除后,`.brand a` 的 `gap`(图标-文字间距)与 `.brand-copy` 的 `transform: translateY(-1px)`(对齐 logo 基线的光学微调)失去作用对象。M3 在 server.cjs L164-165 与 frame-template.html L67-68 各两处。R2 终审原文确认 M1「同信任边界,defense-in-depth only」——本 change 把它做成正式防御。

## Goals

- 渲染层不再盲信元数据:非 http/https 的 homepage 一律回退默认仓库 URL
- 死 CSS 清零,样式表只含有效规则
- 防御行为入 spec(可验证)

## Non-Goals

- 不重构 brandMarkup/readSpeccodeManifest 结构,不新增 export
- 不动 `.brand a` 的 flex 布局等仍有效属性
- 不发版(随后 0.2.2,单独 feature)

## Decisions

- **门禁放在 readSpeccodeManifest(读取时消毒)**:homepage 校验 `/^https?:\/\//`,非法/非字符串/空串统一回退 `fallback.homepage`;`SPECCODE_REPO_URL` 自此必然合法,brandMarkup 无需改动。被否备选:在 brandMarkup 使用点校验(消毒时机晚,未来新增使用点要各自记得)
- **M3 只删属性不删规则**:`gap: 0.5rem; ` 与 ` transform: translateY(-1px);` 四处属性级删除;`.brand a`/`.brand-copy` 的其余属性仍有效,保留
- **spec 钉门禁**:「references 自包含与品牌中立」正文补「仓库链接渲染前 MUST 通过 http/https scheme 校验,非法值回退兜底常量」;新增 scenario 把回退行为写成可验证契约
- **验证方式(references 无单测的既有边界内)**:冒烟脚本升级——版本断言改为从 plugin.json 动态读取(修掉 0.2.0 硬编码的过时断言);scheme 门禁用临时线束验证:/tmp 复制 server.cjs 到伪造目录结构 + 篡改的 plugin.json(`javascript:alert(1)`),起服务取页,红(现行渲染非法 scheme)/绿(修复后回退)对照

## Risks

- 合法 homepage 被误杀:`/^https?:\/\//` 只放行 http/https——plugin.json 当前值与可预见值均为 https GitHub URL,无误杀面
- 冒烟动态版本断言依赖 plugin.json 可读 → 与 readSpeccodeManifest 同路径,测试环境即真实环境

## Open Questions

无。
