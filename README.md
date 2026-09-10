# 打卡系统 PWA 项目（PWABuilder 本地打包安卓 APK）

全部文件放在同一个文件夹，**无任何外网链接、无公网部署要求**，用于 PWABuilder 本地打包生成安卓 APK。

## 一、文件清单

| 文件 | 说明 |
|------|------|
| `login.html` | 登录页：提交到电脑后端 `http://【电脑局域网IP】:8090/api/login`，成功跳转 `user.html` |
| `user.html` | 打卡主页：联网提交后端、断网存 IndexedDB、网络恢复自动同步、离线记录面板 |
| `manifest.json` | PWA 清单（名称"打卡系统"、start_url=login.html、standalone、icon.png） |
| `service-worker.js` | 离线缓存（满足 PWABuilder 检测） |
| `icon.png` | 应用图标（512x512，与网页同目录） |
| `README.md` | 本文档 |

## 二、后端接口约定（电脑端需提供，端口 8090）

前端只做两件事：登录校验、打卡上传。接口约定如下：

### 1. 登录
```
POST http://192.168.1.100:8090/api/login
Content-Type: application/json
Body: { "username": "zhangsan", "password": "123456" }

成功响应：{ "ok": true, "username": "zhangsan" }
失败响应：{ "ok": false, "message": "账号或密码错误" }   （HTTP 状态码 2xx/4xx 均可，前端按 ok 字段判断）
```

### 2. 打卡上传（离线同步也复用此接口）
```
POST http://192.168.1.100:8090/api/checkin
Content-Type: application/json
Body: { "record": { "id": "ck_...", "username": "zhangsan", "time": "2026-09-10 08:30:00",
                    "note": "备注文字", "image": "data:image/jpeg;base64,...", "createdAt": 1789020000000 } }

成功响应：{ "ok": true }
```

要求：
- 后端必须开启 **CORS**（响应头 `Access-Control-Allow-Origin: *`），否则打包后的 APK 无法跨域请求；
- 端口为 8090，需放行 Windows 防火墙（`wf.msc` 入站规则放行 TCP 8090）。

可选极简 Node 后端示例（放电脑上运行，二选一即可）：

```js
// server.js —— 极简打卡后端（Node.js 运行：node server.js）
const http = require('http');
const fs = require('fs');
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(200, cors); return res.end(); }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    let data = {}; try { data = JSON.parse(body || '{}'); } catch (e) {}
    if (req.url === '/api/login') {
      const ok = data.username && data.password;   // 自行改成真实账号校验
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
      return res.end(JSON.stringify(ok ? { ok: true, username: data.username } : { ok: false, message: '账号或密码错误' }));
    }
    if (req.url === '/api/checkin') {
      fs.appendFileSync('checkins.jsonl', JSON.stringify(data.record || {}) + '\n');  // 落盘保存
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
      return res.end(JSON.stringify({ ok: true }));
    }
    res.writeHead(404, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({ ok: false, message: 'not found' }));
  });
}).listen(8090, '0.0.0.0', () => console.log('backend on 8090'));
```

## 三、本地测试（打包前先验证）

Service Worker 需要 **localhost 或 HTTPS** 才能注册，浏览器测试请用本地服务器：

```
cd 本文件夹
python -m http.server 8080
```

浏览器打开 `http://localhost:8080/login.html`，填 `http://127.0.0.1:8090`（或电脑局域网 IP）即可联调。断网测试离线：F12 控制台 Network 切 Offline 后打卡，再切回 Online 观察自动同步。

## 四、PWABuilder 本地打包安卓 APK（普通 PWA 模式，非 TWA）

PWABuilder Studio 本地打包用 **Capacitor** 将本文件夹打进 APK（WebView 加载本地文件），不需要公网 URL、不是 TWA。

### 第 1 步：准备环境（一次性）
1. 安装 **Node.js**：https://nodejs.org/en/download （LTS）
2. 安装 **VS Code**：https://code.visualstudio.com
3. 安装 **Android Studio**（含 Android SDK + JDK 17）：https://developer.android.com/studio
   - 首次启动完成 SDK 组件安装；系统环境变量设置 `ANDROID_HOME`（指向 SDK 目录）、`JAVA_HOME`（JDK 目录）

### 第 2 步：PWABuilder Studio 打包
1. VS Code 打开本文件夹；
2. 扩展市场安装 **PWABuilder Studio** 扩展；
3. 左侧 PWABuilder Studio 面板 → **Package as app**（打包为应用）→ 选择 **Android**；
4. 打包模式选**普通 PWA（Capacitor）**，不要选 TWA（TWA 需要公网托管 URL）；
5. 填写应用信息后点 **Create / Package**，生成安卓工程（本文件夹下会多出 `android/` 目录）；
6. 在 `android/` 目录构建 APK（见第 3 步签名）或用 Studio 直接 Build。

### 第 3 步：新建签名密钥，生成带签名 APK
> keystore 必须**妥善备份**：后续版本升级必须用同一把密钥签名，否则无法覆盖安装。

1. 打开 CMD，在本文件夹执行（按提示输入密码与信息，两次密码一致）：

```cmd
keytool -genkey -v -keystore checkin-release.keystore -alias checkin -keyalg RSA -keysize 2048 -validity 10000
```

2. **立即备份** `checkin-release.keystore` 到安全位置（U 盘/网盘），并记住 keystore 密码与 alias（checkin）；
3. 签名打包（二选一）：
   - **Android Studio 方式**：打开生成的 `android/` 工程 → **Build → Generate Signed Bundle / APK → APK** → 选择上面的 keystore、填密码与 alias → Release 构建完成；
   - **命令行方式**（已配置 SDK 时）：在 `android/` 下执行
     ```cmd
     gradlew assembleRelease
     ```
     然后手工签名（`apksigner sign --ks checkin-release.keystore ...`），或用 Studio 图形界面签名更省事；
4. 产物：`android/app/build/outputs/apk/release/app-release.apk`（签名版，可安装）。

> 调试期可先装 `app-debug.apk`（未签名）验证功能；对外分发必须用签名版。

## 五、常见问题

| 现象 | 原因与解决 |
|------|-----------|
| APK 内打卡请求不到电脑后端 | ① 后端未开 CORS；② Android 9+ 默认禁止明文 HTTP：在生成的 `android/app/src/main/AndroidManifest.xml` 的 `<application>` 标签加 `android:usesCleartextTraffic="true"`；③ 防火墙未放行 8090 |
| 登录页一直提示连接失败 | 地址需带 `http://` 且以 `:8090` 结尾；电脑后端必须运行；手机与电脑同一局域网 |
| 断网打卡后看不到自动同步 | 网络恢复后会自动同步（online 事件 + 30 秒轮询）；也可在记录面板点【立即同步】；检查电脑端 `checkins.jsonl` 是否收到数据 |
| PWABuilder Studio 报 SDK 缺失 | 完成 Android Studio 首次配置并设置 `ANDROID_HOME`、`JAVA_HOME` 后重开 VS Code |
| keystore 丢失 | 无法再签名升级，只能卸载重装旧包；请务必备份 |
| Service Worker 测试无效 | 浏览器需 localhost 或 HTTPS 访问；直接双击 html 打开不注册 SW |
