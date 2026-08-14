## 手写踩坑

1. 测试中比对 git 解析出的路径时,先用 realpathSync 归一:macOS 上 git rev-parse --show-toplevel 会把 /var 解析为 /private/var,而 os.tmpdir() 不解析符号链接,两边直接相等断言必挂。
2. 写 verb 的 --json-stdin 是布尔 flag(parseArgs 置 true),payload 必须从 stdin 读(JSON.parse(readStdin())),绝不能 JSON.parse(jsonStdin)。
