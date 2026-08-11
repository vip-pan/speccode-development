# Tasks: visual-companion-cleanup

- [x] 1. 搭篡改线束(TDD 红):/tmp 下伪造目录结构(vc-test/x/.claude-plugin/plugin.json 写 `javascript:alert(1)` + vc-test/x/y/server.cjs 拷贝),起服务 cookie 取页,断言现行代码渲染非法 scheme → 确认红
- [x] 2. `server.cjs` `readSpeccodeManifest()`:homepage 加 `/^https?:\/\//` 校验,非法回退 fallback.homepage(TDD 绿:篡改线束下页脚链接 = 默认仓库 URL)
- [x] 3. 死 CSS 删除(4 处属性):server.cjs 与 frame-template.html 的 `.brand a` 去 `gap: 0.5rem; `、`.brand-copy` 去 ` transform: translateY(-1px);`
- [x] 4. 验证:篡改线束绿;冒烟脚本(版本断言改读 plugin.json 动态值)4×PASS;`grep -n "brand-logo\|gap: 0.5rem\|translateY" references/` 为空;全量 137 绿
- [x] 5. syncing 合并 delta(MODIFIED「references 自包含与品牌中立」+1 scenario)+ 勾选本文件 + archiving
- [ ] 6. finishing-worktree + finishing-feature,PR 合入 main
