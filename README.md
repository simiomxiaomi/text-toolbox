# Text Toolbox · 文本处理工具箱

![License](https://img.shields.io/badge/License-MIT-67e8f9)
![Dependencies](https://img.shields.io/badge/dependencies-0-a78bfa)
![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-f0abfc)
![Size](https://img.shields.io/badge/size-~93KB-818cf8)

> 一个纯前端、零依赖的文本处理工具箱：40+ 个操作，点一下就走。

玻璃拟态 + 磨砂渐变视觉风格。大小写转换、文本清洗、行处理、编解码、JSON 格式化、字数统计全都塞进一个页面，输入即处理，结果可继续加工。

---

## 功能特性

### 40+ 个操作，分六类

**大小写（9 个）**：全部大写 / 全部小写 / 词首大写 / 句首大写 / camelCase / PascalCase / snake_case / kebab-case / 大小写反转

**文本（14 个）**：去首尾空白、连续空格压成一个、删除所有空白、删除空行、删除行首缩进、删除所有数字、删除标点、仅保留中英数字、中文标点转英文、统一换行符、查找替换、按宽度折行

**行处理（11 个）**：升序 / 降序 / 按长度 / 按数值排序、行顺序反转、去重（保序）、去重（忽略首尾空格）、随机打乱、添加行号（自动对齐）、移除行号

**编码（12 个）**：Base64 编解码、URL 编解码、HTML 转义 / 反转义、生成 URL slug、转 Unicode 码点、转十六进制、十六进制转文本、转 JSON 字符串字面量

**JSON（6 个）**：格式化（2 空格 / Tab）、压缩、**自动修复**、提取所有键、提取所有路径、转 CSV

**统计（1 个）**：把完整统计结果输出到结果区

### JSON 自动修复

处理从别处复制来的"脏 JSON"，能修这些毛病：

- 尾随逗号：`{"a": 1,}`
- 单引号字符串：`{'name': 'Bob'}`
- 无引号的键：`{name: "Bob"}`
- Python 字面量：`True` / `False` / `None`
- 注释：`// 行注释` 与 `/* 块注释 */`
- 缺外层花括号的裸键值列表

修完会告诉你修了几处，能解析就顺手格式化好。

### 实时统计面板

- **12 项数值**：字符（含 / 不含空白）、中文数、英文单词数、行数、非空行、段落、句子、数字字符、标点、最长行、平均行长
- **字符分布**：中文 / 字母 / 数字 / 空白 / 标点 / 其他 的占比条
- **高频词 Top 15**：英文按单词、中文按二元组统计，自动过滤常见停用词，点击即可复制

### 连续加工

- 结果区右下角有「**用作输入**」，可以把结果放回输入区继续处理下一道
- 「**撤销**」按钮（或 <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd>）可回退，保留最近 30 步
- 结果可直接复制或下载为 `.txt`

---

## 如何开始使用

**方式一：直接双击（最简单）**

双击 `index.html`，浏览器以 `file://` 方式打开。

**方式二：起一个本地静态服务器**

```bash
cd text-toolbox
python -m http.server 8000
```

然后访问 <http://localhost:8000>。

> 首次打开会自动载入一段示例文本，直接点操作就能看到效果。输入内容自动保存。

---

## 操作速查

| 场景 | 推荐操作 |
| --- | --- |
| 整理从 PDF / 网页复制的乱文本 | 去首尾空白 → 连续空格压成一个 → 删除空行 |
| 清理列表数据 | 去重（忽略首尾空格）→ 升序排序 → 添加行号 |
| 处理接口返回的压缩 JSON | 格式化（2 空格）→ 提取所有路径 |
| 拿到别人粘贴的"半个 JSON" | 自动修复 |
| 统计文案字数 | 直接用右侧统计面板，或点「统计到结果区」 |
| 给变量批量命名 | kebab-case / snake_case / camelCase |
| 排查中文乱码 | 十六进制转文本（按 UTF-8 解码） |

---

## 快捷键

| 按键 | 功能 |
| --- | --- |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Z</kbd> | 撤销上一步输出 |
| <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> | 输入区缩进 / 取消缩进（支持多行） |
| <kbd>Enter</kbd> | 参数输入框中确认执行 |
| <kbd>Esc</kbd> | 收起参数输入框 |
| 拖放文件 | 把 `.txt` / `.json` / `.log` 等拖进窗口即可载入 |

---

## 技术说明

### 零依赖

没有 `package.json`、没有构建步骤、没有第三方库。全部逻辑在 `index.html` + `style.css` + `app.js` 三个文件里。

### 操作引擎

引擎段位于 `app.js` 中 `/* ---ENGINE-END--- */` 之前，是一组纯函数。每个操作统一形如：

```js
{ id, cat, name, icon, run: function (text, param) { return { text, note }; } }
```

带参数的操作额外声明 `param`（默认值）与 `paramHint`（提示文案），UI 会自动弹出参数输入框。新增一个操作只需要往 `OPERATIONS` 数组里加一项，按钮会自动出现。

### 几个实现细节

| 点 | 做法 |
| --- | --- |
| Unicode 安全 | `splitChars` 按码点切分，emoji 不会被劈成两半 |
| Base64 | `unescape(encodeURIComponent())` 包装，中文与 emoji 都能往返 |
| URL 解码容错 | 遇到截断的多字节序列（如 `%E4%B8%AD%E6`）会逐级回退，能解的部分解出来、解不出的原样保留 |
| HTML 实体 | 支持命名实体与 `&#123;` / `&#x1F600;` 数字实体，未知实体原样保留 |
| 十六进制 | 按 UTF-8 字节序列处理，非法序列降级为按字节展示 |
| CSV 导出 | 带 BOM，Excel 打开中文不乱码；含逗号/引号的字段自动转义 |
| 高频词 | 英文按单词、中文按**二元组**近似分词（纯前端没有词典可依赖） |

### 数据存储

| 键名 | 内容 |
| --- | --- |
| `text-toolbox:input` | 输入区内容 |
| `text-toolbox:cat` | 当前操作分类 |

---

## 验证记录

```bash
node --check app.js
node _selftest.js     # 操作引擎纯逻辑用例：129 项
node _crosscheck.js   # HTML/CSS/JS 引用一致性：128 项
```

**已通过的检查：**

- `_selftest.js`（129 项）— 覆盖全部 40+ 操作的正常路径与边界；Base64 / URL / HTML 实体的**往返一致性**；JSON 自动修复后能被 `JSON.parse` 成功解析且类型正确；统计引擎逐项核对；词频过滤与排序；**全部操作 × 6 种特殊输入（空串、纯空白、emoji、中文混排等）零抛错**
- `_crosscheck.js`（128 项）— JS 选择器与 HTML 的对应、CSS 类定义完整性、id 唯一、资源引用、标签配对、可访问性、无 `innerHTML` 拼接、`JSON.parse`/`atob` 异常处理、操作注册表 id 唯一与分类合法、带参数操作必带 `paramHint`

**尚未做：** 真实浏览器中的交互与像素级视觉验证。建议打开后过这几件事——点几个操作看结果、试「用作输入」连续加工、撤销、拖入一个 `.json` 点自动修复、看看统计面板的高频词。

---

## 浏览器要求

需要 ES5+ 与 `Array.from`（emoji 安全切分时用到）：

Chrome / Edge 45+、Firefox 32+、Safari 9+。视觉上的 `backdrop-filter` 需 Chrome 76+ / Firefox 103+ / Safari 9+（带 `-webkit-` 前缀）。

不支持 IE。

---

## 项目结构

```
text-toolbox/
├── index.html        页面结构（顶栏 / 操作条 / 三栏工作区）
├── style.css         玻璃拟态视觉样式
├── app.js            操作引擎 + 统计引擎 + 交互
├── README.md         本文件
├── LICENSE           MIT
└── .gitignore        忽略规则
```

---

## 小提示

- 操作按钮悬停时会浮起来并透出青色光，点错了按 <kbd>Ctrl</kbd>+<kbd>Z</kbd> 就行
- 「按数值排序」遇到非数字行会拒绝执行并提示，不会把数据搞乱
- 统计面板的词频点击即可复制，查抄袭或看用词习惯挺好用

---

## License

[MIT](LICENSE) © 2026 苏小晗
