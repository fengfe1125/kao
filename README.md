# kao

专升本备考应用：数字电路与逻辑设计 + 大学英语。

## 内容

### 数字电路与逻辑设计
依据武昌首义学院 2025 年专升本考试大纲。
- 5 章 23 个知识点，标注了解/理解/掌握/灵活运用四个层次
- 每个知识点配零基础教学页：为什么学它 → 分步讲解 → 例子 → 常见错误 → 学完自测 → 下一步
- 45 道主观题（大纲规定无选择题、无判断题），含完整解析
- 16 周 6 阶段学习路径

### 大学英语
依据湖北省普通高等教育专升本《大学英语》考试大纲（B 级标准）。
- 10 个语法专题，按学习顺序而非重要性排列
- 3645 个词汇 + 239 个固定搭配，分 L1-L4 四级
- Web Speech 朗读，支持常速与慢速
- SM-2 记忆曲线，间隔 1→3→8→22→64 天递增
- 每日计划，默认 30 词可调，新词与复习按 4:6 分配
- 自适应题型：按每个词的熟练度自动分配选择题或填空题
- 学习统计：熟练度分布、最近 7 天柱状图、今日词表

## 目录结构

```
web/                  完整学习网站，纯前端，可离线运行
ios/KaoApp/           iOS WKWebView 工程源码
.github/workflows/    GitHub Actions 云端构建配置
privacy/              隐私政策页面
```

## 本地预览

直接用浏览器打开 `web/index.html` 即可，无需服务器。

## iOS 构建

使用 GitHub Actions 的 macOS runner 构建，无需本地 Mac。
需在仓库 Settings → Secrets 配置：

```
APPLE_TEAM_ID
APP_STORE_CONNECT_KEY_ID
APP_STORE_CONNECT_ISSUER_ID
APP_STORE_CONNECT_PRIVATE_KEY
BUNDLE_ID
```

## 数据存储

学习进度保存在设备本地 localStorage，不上传服务器。
可在「我的 → 导出进度」备份。
