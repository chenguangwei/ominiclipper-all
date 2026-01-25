# better-sqlite3 Electron 编译问题解决记录

## 问题描述

运行 Electron 应用时，BM25 搜索功能报错：

```
Error: The module '/path/to/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 131. This version of Node.js requires
NODE_MODULE_VERSION 133. Please try re-compiling or re-installing
```

## 原因

Electron 35 使用 Node.js 133 版本，而 `better-sqlite3` 是原生模块，需要针对 Electron 的 Node.js 版本重新编译。

## 解决方案

不要使用普通的 `npm rebuild`，需要使用 `electron-rebuild`：

```bash
cd /path/to/ominiclipper-desktop
npx electron-rebuild -f -w better-sqlite3
```

## 注意事项

1. **必须用 `electron-rebuild`**：普通 `npm rebuild` 不会针对 Electron 的 Node.js 版本编译
2. **electron-rebuild 已作为 devDependencies 安装**：直接使用 `npx electron-rebuild` 即可
3. **如果还不行**，可以尝试完整重装：
   ```bash
   rm -rf node_modules
   rm package-lock.json
   npm install
   npx electron-rebuild -f -w better-sqlite3
   ```

## 相关文件

- [package.json](ominiclipper-desktop/package.json) - 依赖配置
