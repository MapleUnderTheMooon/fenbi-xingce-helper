# 粉笔行测辅助工具 - 项目说明

## 项目概述

Tampermonkey 用户脚本，为粉笔网行测错题练习页面提供标注工具和页面优化功能。

**当前版本**: 0.2.0
**@match**: `https://www.fenbi.com/*/exam/error/practice/xingce/*`

---

## 核心功能

### 1. 自动收起答题区
- 页面加载后自动点击"收起"按钮
- 隐藏答题区，扩大题目显示区域
- 实现：`startAutoCollapse()` 函数

### 2. 全屏画布标注系统
点击笔工具按钮后展开全屏画布，支持三种标注模式：

#### 2.1 画笔模式（默认）
- 红色画笔，线宽 2px
- 自由绘制标注
- 记录笔画路径到历史记录

#### 2.2 橡皮擦模式
- 使用 `globalCompositeOperation = 'destination-out'` 实现擦除
- 橡皮擦半径 10px
- 同样记录擦除路径到历史记录（可撤销）

#### 2.3 撤销功能
- 保存最近 100 条操作历史（`MAX_HISTORY = 100`）
- 点击撤销按钮回退上一步操作
- 支持撤销画笔和橡皮擦操作

#### 2.4 清屏功能
- 一键清除画布上所有内容
- 清空历史记录

### 3. UI 交互设计
- **主按钮**：笔工具（右上角固定位置）
- **子按钮展开**：点击笔工具后展开显示
  - 橡皮擦按钮
  - 撤销按钮
  - 清屏按钮
  - 关闭按钮
- **视觉反馈**：
  - 当前选中模式高亮显示
  - 按钮状态切换（展开/收起）

---

## 技术实现要点

### 1. SPA 路由监听（重要）
**问题**：Tampermonkey 的 `@match` 只在页面初次加载时触发，粉笔网是单页应用，路由切换时脚本不会重新初始化。

**解决方案**（三层防护）：
```javascript
// 1. 劫持 History API
history.pushState = function() {
    originalPushState.apply(this, arguments);
    window.dispatchEvent(new Event('urlchange'));
};

// 2. 监听浏览器原生事件
window.addEventListener('popstate', ...);      // 前进/后退
window.addEventListener('hashchange', ...);    // Hash 路由

// 3. URL 匹配检测
function isCurrentPageMatch() {
    return /\/exam\/error\/practice\/xingce\//.test(window.location.href);
}

// 智能初始化逻辑
function onUrlChange() {
    if (isCurrentPageMatch() && !isInitialized) {
        init();
    } else if (!isCurrentPageMatch() && isInitialized) {
        cleanUpAllResources();
    }
}
```

### 2. 绘画历史管理
**数据结构**：
```javascript
{
    type: 'pen' | 'eraser',
    points: [{x, y}, {x, y}, ...],  // 路径点数组
    lineWidth: 2,                     // 笔画宽度
    timestamp: Date.now()             // 时间戳
}
```

**性能优化**：
- **采样距离限制**：`MIN_POINT_DISTANCE = 3`，每隔 3 像素记录一个点
- **历史记录上限**：`MAX_HISTORY = 100`，自动移除最旧记录
- **重绘优化**：`redrawAll()` 批量重绘历史笔画

### 3. Canvas 绘图技术
- **画笔**：`ctx.lineTo()` 连续绘制路径
- **橡皮擦**：`ctx.globalCompositeOperation = 'destination-out'` 实现透明擦除
- **笔画保存**：每个笔画作为独立对象存储到 `drawHistory` 数组

### 4. 内存管理
**资源清理机制**：
```javascript
const resources = {
    timer: null,          // 自动收起定时器
    elements: [],         // 动态创建的 DOM 元素
    eventListeners: []    // 绑定的事件监听器
};

function cleanUpAllResources() {
    // 1. 清除定时器
    // 2. 移除所有事件监听器
    // 3. 移除所有动态创建的 DOM 元素
    // 4. 重置样式
}
```

**触发时机**：
- 页面卸载（`beforeunload`）
- 路由离开匹配页面（通过 `isInitialized` 标志判断）

### 5. 绘画保留功能
**问题**：关闭笔工具后再打开，画布尺寸变化会导致内容丢失。

**解决方案**：
```javascript
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redrawAll();  // 重新绘制历史记录
}
```

---

## 已知限制

1. **页面滚动**：画布开启时，底层的页面无法通过滚轮滚动（当前版本未实现）
2. **触摸设备**：未针对移动端触摸事件进行优化
3. **历史记录上限**：最多保存 100 条操作，超过会自动删除最旧记录

---

## 版本历史

### 0.2.0 (当前)
- ✅ 新增 SPA 路由监听，解决页面切换时脚本不生效的问题
- ✅ 实现橡皮擦功能
- ✅ 实现撤销功能
- ✅ 实现清屏功能
- ✅ 绘画保留功能（关闭笔工具不丢失笔画）
- ✅ 性能优化（采样距离限制、历史记录上限）

### 0.1.2
- 基础画笔功能
- 自动收起答题区
- 全屏画布

---

## 关键代码位置

| 功能 | 文件位置（行号） |
|------|-----------------|
| 自动收起 | ~100-150 |
| 画布初始化 | ~180-202 |
| 绘画历史管理 | ~205-240 |
| 画笔绘制逻辑 | ~250-290 |
| 橡皮擦逻辑 | ~290-314 |
| 撤销功能 | ~500-520 |
| 清屏功能 | ~540-550 |
| SPA 路由监听 | ~604-690 |
| 资源清理 | ~560-602 |

---

## 开发建议

### 后续优化方向
1. **滚轮支持**：画布开启时允许页面滚动
2. **快捷键**：添加 Ctrl+Z 撤销、Ctrl+Shift+Z 重做等快捷键
3. **颜色选择**：支持多种画笔颜色
4. **笔触调节**：支持画笔粗细调节
5. **重做功能**：支持撤销后重做
6. **导出功能**：将标注保存为图片

### 调试方法
打开浏览器控制台，查看以下日志：
- `粉笔行测辅助工具已加载完成` → 脚本初始化成功
- `检测到 URL 变化: [URL]` → 路由监听正常
- `URL 匹配，初始化脚本...` → 自动初始化成功
- `URL 不匹配，清理资源...` → 离开匹配页面，资源已清理

---

## 作者备注

本项目使用 Canvas 2D API 实现标注功能，核心难点在于：
1. SPA 路由监听（已解决）
2. 橡皮擦实现（使用 `destination-out` 混合模式）
3. 历史记录管理和撤销/重做
4. 内存泄漏防护（资源清理机制）
