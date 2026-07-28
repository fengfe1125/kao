# iOS 构建部署指南

无需 Mac，使用 GitHub Actions 的 macOS runner 完成构建与上传。

---

## 第一步：启用 workflow 文件

由于当前 Token 缺少 `workflow` 权限，构建配置暂放在 `ci-templates/`。
你需要在 GitHub 网页上手动创建一次：

1. 打开仓库 → **Add file** → **Create new file**
2. 文件名填写：

```
.github/workflows/ios.yml
```

3. 把 `ci-templates/ios-workflow.yml` 的全部内容复制粘贴进去
4. 点击 **Commit new file**

之后这个文件由 GitHub 网页管理，不再受 Token 权限限制。

---

## 第二步：在 Apple Developer 注册 Bundle ID

打开 [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list)

1. 点 **+** 新建
2. 选择 **App IDs** → **App**
3. Description 填 `kao`
4. Bundle ID 选 **Explicit**，填写：

```
com.fengfe1125.kao
```

5. Capabilities 全部不勾选（当前版本不需要）
6. 保存

---

## 第三步：创建 App Store Connect API 密钥

打开 [App Store Connect → 用户和访问 → 集成 → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)

1. 点 **+** 生成密钥
2. 名称填 `GitHub Actions`
3. 访问权限选 **App Manager**
4. 生成后记录下：
   - **Key ID**（10 位字符）
   - **Issuer ID**（UUID 格式）
5. 下载 `.p8` 文件 —— **只能下载一次**，务必保存好

---

## 第四步：获取 Team ID

打开 [Apple Developer → Membership](https://developer.apple.com/account#MembershipDetailsCard)

找到 **Team ID**，10 位字符，形如 `A1B2C3D4E5`。

---

## 第五步：配置 GitHub Secrets

打开仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

依次添加 5 个：

| Secret 名称 | 值 | 从哪里来 |
|---|---|---|
| `BUNDLE_ID` | `com.fengfe1125.kao` | 第二步注册的 |
| `BUNDLE_ID_PREFIX` | `com.fengfe1125` | Bundle ID 去掉最后一段 |
| `APPLE_TEAM_ID` | 10 位字符 | 第四步 |
| `APP_STORE_CONNECT_KEY_ID` | 10 位字符 | 第三步 |
| `APP_STORE_CONNECT_ISSUER_ID` | UUID | 第三步 |
| `APP_STORE_CONNECT_PRIVATE_KEY` | `.p8` 文件全部内容 | 第三步下载的文件 |

`.p8` 内容要包含首尾两行，形如：

```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49...
-----END PRIVATE KEY-----
```

用文本编辑器打开 `.p8` 文件，全选复制粘贴即可。

---

## 第六步：先跑一次验证构建

1. 仓库 → **Actions** 标签
2. 左侧选 **Build kao iOS**
3. 点 **Run workflow**
4. `upload_testflight` 保持 `false`
5. 点绿色 **Run workflow** 按钮

这次只验证代码能否编译，不需要签名。大约 5-8 分钟。

如果显示绿色对勾，说明代码没问题，可以进行下一步。

---

## 第七步：在 App Store Connect 创建应用

打开 [App Store Connect → 我的 App](https://appstoreconnect.apple.com/apps)

1. 点 **+** → **新建 App**
2. 平台选 **iOS**
3. 名称填 `kao`（如已被占用，换成 `kao 专升本` 等）
4. 主要语言选 **简体中文**
5. 套装 ID 选择第二步注册的 `com.fengfe1125.kao`
6. SKU 随便填，如 `kao001`
7. 用户访问权限选 **完全访问权限**

---

## 第八步：构建并上传 TestFlight

回到 **Actions** → **Build kao iOS** → **Run workflow**

这次把 `upload_testflight` 改成 `true`，运行。

成功后，等待 10-30 分钟，App Store Connect 的 **TestFlight** 标签下会出现构建版本。

首次上传需要填写「出口合规信息」，选择：

> 你的 App 是否使用加密？→ **否**

（本 App 仅本地存储，无网络加密传输）

---

## 第九步：安装到手机

1. iPhone 安装 **TestFlight**（App Store 免费下载）
2. 用你的 Apple ID 登录
3. TestFlight → 你的 App → 安装

---

## 常见问题

### 构建失败：No signing certificate

检查 `APPLE_TEAM_ID` 是否正确，以及 Bundle ID 是否已在 Apple Developer 注册。

### 构建失败：Authentication credentials are missing

检查 `APP_STORE_CONNECT_PRIVATE_KEY` 是否完整粘贴，包括首尾的 `-----BEGIN/END PRIVATE KEY-----`。

### 上传成功但 TestFlight 看不到

正常，Apple 处理需要 10-30 分钟。可在 App Store Connect 的「活动」标签查看处理状态。

### 朗读没声音

确认手机没有静音（侧边开关），且系统音量已打开。iOS 静音开关会影响 Web Speech API。

---

## 后续升级路径

当前是纯本地版本，学习数据存在设备上。如果以后需要多设备同步，可以再加：

```
FastAPI 后端 + PostgreSQL
   ↓
用户登录 / 进度同步接口
   ↓
前端改造为可选云端同步
```

到时候只需替换 `web/` 目录内容并重新构建，iOS 工程本身不用改。
