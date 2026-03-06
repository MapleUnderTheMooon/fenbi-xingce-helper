// ==UserScript==
// @name         抖音&哔哩哔哩标注工具
// @namespace    http://tampermonkey.net/
// @version      0.2.2
// @description  抖音和哔哩哔哩网页标注工具，支持画笔、橡皮擦、撤销等功能
// @author       spl
// @match        https://www.douyin.com/*
// @match        https://www.bilibili.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ========== 全局存储需要清理的资源 ==========
    const resources = {
        elements: [],         // 动态创建的DOM元素
        eventListeners: []    // 绑定的事件监听
    };

    // ===================== 标注工具（带清理） =====================
    let isPenToolActive = false; // 全局变量，用于控制视频加速功能
    function initDrawTool() {
        // Canvas图层 - 检查是否已存在，避免重复创建
        let canvas = document.querySelector('#custom-draw-canvas');
        let ctx;

        if (canvas) {
            // 如果 canvas 已存在，复用现有的 canvas 和 ctx
            ctx = canvas.getContext('2d');
        } else {
            // 如果不存在，创建新的 canvas
            canvas = document.createElement('canvas');
            canvas.id = 'custom-draw-canvas';
            canvas.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                z-index: 9998; background: rgba(50,50,50,0.1);
                cursor: default; border: none; display: none;
            `;
            resources.elements.push(canvas); // 加入清理列表
            document.body.appendChild(canvas);
            ctx = canvas.getContext('2d');
        }

        // 标注状态
        let isPenToolVisible = false; // 新增：控制工具是否可见
        let isDrawing = false; // 控制是否正在绘制
        let currentMode = null; // 'pen' | 'eraser' | null
        let currentStroke = null; // 当前正在绘制的笔画
        const drawHistory = []; // 历史记录数组
        const MAX_HISTORY = 100; // 最大历史记录数
        const MIN_POINT_DISTANCE = 3; // 最小采样距离（像素）
        const drawColor = '#ff0000';
        const drawWidth = 2;

        // 重绘所有笔画
        function redrawAll() {
            drawHistory.forEach(item => {
                if (item.type === 'pen') {
                    // 重绘笔笔画
                    if (item.points.length < 2) return;
                    ctx.beginPath();
                    ctx.lineWidth = item.lineWidth;
                    ctx.strokeStyle = drawColor;
                    ctx.lineCap = 'round';
                    ctx.moveTo(item.points[0].x, item.points[0].y);
                    for (let i = 1; i < item.points.length; i++) {
                        ctx.lineTo(item.points[i].x, item.points[i].y);
                    }
                    ctx.stroke();
                } else if (item.type === 'eraser') {
                    // 重绘橡皮擦路径
                    ctx.save();
                    ctx.globalCompositeOperation = 'destination-out';
                    for (let i = 0; i < item.points.length; i++) {
                        ctx.beginPath();
                        ctx.arc(item.points[i].x, item.points[i].y, 10, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                }
            });
        }

        // 调整Canvas大小
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            // 重绘所有历史笔画
            redrawAll();
        }
        resizeCanvas();

        // 存储resize事件（方便清理）
        window.addEventListener('resize', resizeCanvas);
        resources.eventListeners.push({
            element: window,
            type: 'resize',
            handler: resizeCanvas
        });

        // 标注事件
        const drawMouseDown = (e) => {
            e.preventDefault();
            if (!isPenToolActive) return;

            isDrawing = true;
            currentStroke = {
                id: Date.now(),
                type: currentMode,
                points: [{x: e.clientX, y: e.clientY}],
                lineWidth: currentMode === 'pen' ? 2 : 20
            };

            if (currentMode === 'pen') {
                ctx.beginPath();
                ctx.moveTo(e.clientX, e.clientY);
                ctx.lineWidth = drawWidth;
                ctx.strokeStyle = drawColor;
                ctx.lineCap = 'round';
            } else if (currentMode === 'eraser') {
                // 橡皮擦：立即擦除当前点
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(e.clientX, e.clientY, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        };

        const drawMouseMove = (e) => {
            e.preventDefault();
            if (!isDrawing || !isPenToolActive) return;

            // 采样优化：只记录距离上一个点超过阈值的点
            const lastPoint = currentStroke.points[currentStroke.points.length - 1];
            const distance = Math.hypot(e.clientX - lastPoint.x, e.clientY - lastPoint.y);
            if (distance < MIN_POINT_DISTANCE) return; // 距离太小，跳过

            // 记录路径点
            currentStroke.points.push({x: e.clientX, y: e.clientY});

            if (currentMode === 'pen') {
                ctx.lineTo(e.clientX, e.clientY);
                ctx.stroke();
            } else if (currentMode === 'eraser') {
                // 橡皮擦：擦除路径
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(e.clientX, e.clientY, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        };

        const drawMouseUp = (e) => {
            e.preventDefault();
            if (isDrawing && currentStroke) {
                // 保存到历史记录
                drawHistory.push(currentStroke);
                // 限制历史记录长度，移除最旧的记录
                if (drawHistory.length > MAX_HISTORY) {
                    drawHistory.shift();
                }
                currentStroke = null;
            }
            isDrawing = false;
        };

        const drawMouseLeave = (e) => {
            e.preventDefault();
            if (isDrawing && currentStroke) {
                // 保存到历史记录
                drawHistory.push(currentStroke);
                // 限制历史记录长度，移除最旧的记录
                if (drawHistory.length > MAX_HISTORY) {
                    drawHistory.shift();
                }
                currentStroke = null;
            }
            isDrawing = false;
        };

        // 绑定标注事件并存储
        canvas.addEventListener('mousedown', drawMouseDown);
        canvas.addEventListener('mousemove', drawMouseMove);
        canvas.addEventListener('mouseup', drawMouseUp);
        canvas.addEventListener('mouseleave', drawMouseLeave);
        resources.eventListeners.push({ element: canvas, type: 'mousedown', handler: drawMouseDown });
        resources.eventListeners.push({ element: canvas, type: 'mousemove', handler: drawMouseMove });
        resources.eventListeners.push({ element: canvas, type: 'mouseup', handler: drawMouseUp });
        resources.eventListeners.push({ element: canvas, type: 'mouseleave', handler: drawMouseLeave });

        // 滚轮事件：允许页面滚动
        const wheelEvent = (e) => {
            // 如果正在绘制，不处理滚轮事件
            if (isDrawing) return;
            // 未按下鼠标时，不阻止默认行为，让浏览器自然处理滚轮事件，实现丝滑的页面滚动
            // 不调用 e.preventDefault()，让页面自然滚动
        };
        canvas.addEventListener('wheel', wheelEvent, { passive: true });
        resources.eventListeners.push({ element: canvas, type: 'wheel', handler: wheelEvent });

        // 标注面板 - 检查是否已存在，避免重复创建
        let drawCtrlPanel = document.querySelector('#draw-control-panel');
        if (drawCtrlPanel) {
            // 面板已存在，直接返回，避免重复创建
            return;
        }

        // 创建新面板容器（收缩式圆球设计）
        drawCtrlPanel = document.createElement('div');
        drawCtrlPanel.style.cssText = `
            position: fixed; right: 15px; top: 25px; /* 精确设置右上角位置，根据图片调整 */
            width: 50px; height: 50px; border-radius: 50%; overflow: visible;
            z-index: 9999; transition: none; user-select: none;
            display: none; /* 默认隐藏 */
        `;
        drawCtrlPanel.id = 'draw-control-panel';
        resources.elements.push(drawCtrlPanel); // 加入清理列表

        // 圆球按钮（收缩状态的主按钮） - 采用iPhone风格设计，柔和蓝色
        const penBtn = document.createElement('button');
        penBtn.style.cssText = `
            position: absolute; right: 0; top: 0; width: 50px; height: 50px;
            border-radius: 50%; background: #4da6ff;
            color: white; border: none;
            font-size: 16px; font-weight: 600; cursor: move;
            box-shadow: 0 4px 15px rgba(77, 166, 255, 0.4);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex; align-items: center; justify-content: center;
            text-align: center; padding: 0; user-select: none;
            backdrop-filter: blur(10px);
        `;
        penBtn.innerText = '✏️';
        penBtn.id = 'pen-tool-btn';

        // 展开的按钮容器（默认隐藏，悬停时显示） - 采用iPhone风格设计
        const expandedButtonsContainer = document.createElement('div');
        expandedButtonsContainer.style.cssText = `
            position: absolute; right: 60px; top: 0;
            display: none; flex-direction: column; gap: 8px;
            padding: 12px;border-radius: 16px;
            background: rgba(255, 255, 255, 0.95);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(20px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: auto;
        `;
        expandedButtonsContainer.id = 'expanded-buttons-container';
        resources.elements.push(expandedButtonsContainer); // 加入清理列表

        // 子按钮容器（用于存放橡皮擦和撤销）
        const subButtonsContainer = document.createElement('div');
        subButtonsContainer.style.cssText = `
            display: flex; flex-direction: column; gap: 8px;
        `;
        subButtonsContainer.id = 'sub-buttons-container';
        resources.elements.push(subButtonsContainer); // 加入清理列表

        // 按钮样式 - iPhone风格
        const buttonStyle = `
            width: 100px; height: 40px; border: none; border-radius: 12px;
            font-size: 14px; font-weight: 500; cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex; align-items: center; justify-content: center;
            gap: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        `;

        // 橡皮擦按钮 - 灰色系（直观表示擦除）
        const eraserBtn = document.createElement('button');
        eraserBtn.style.cssText = buttonStyle + `
            background: #f0f0f0;
            color: #333333;
        `;
        eraserBtn.innerHTML = '🧽 橡皮擦 <span style="font-size: 12px; opacity: 0.7; margin-left: 5px;">(E)</span>';
        eraserBtn.id = 'eraser-btn';

        // 撤销按钮 - 蓝色系（直观表示返回操作）
        const undoBtn = document.createElement('button');
        undoBtn.style.cssText = buttonStyle + `
            background: #e6f2ff;
            color: #0066cc;
        `;
        undoBtn.innerHTML = '↩ 撤销 <span style="font-size: 12px; opacity: 0.7; margin-left: 5px;">(Ctrl+Z)</span>';
        undoBtn.id = 'undo-btn';

        // 组装子按钮容器
        subButtonsContainer.append(eraserBtn, undoBtn);

        // 光标定义
        const penCursorUrl = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyOCcgaGVpZ2h0PScyOCcgdmlld0JveD0nMCAwIDI4IDI4Jz48cGF0aCBkPSdNMTkuOCAyLjJjLjYtLjYgMS42LS42IDIuMiAwbDMuOCAzLjhjLjYuNi42IDEuNiAwIDIuMkwxMSAyM2wtNiAxLjggMS44LTUuOCAxMy0xNi44eicgZmlsbD0nIzU1NTU1NScvPjxwYXRoIGQ9J00xOC42IDMuNGw0IDQnIHN0cm9rZT0nI2ZmZicgc3Ryb2tlLXdpZHRoPScxLjInIG9wYWNpdHk9Jy42Jy8+PC9zdmc+") 4 24, auto';
        // 橡皮擦光标：圆形虚线框（半径10px，直径30px）
        const eraserCursorUrl = 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTUiIGN5PSIxNSIgcj0iMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzU1NSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSIzLDMiLz48L3N2Zz4=") 15 15, auto';

        // 拖动功能 - 全新实现，确保精确跟随鼠标
        // 拖动功能 - 简化实现，参考粉笔工具
        let isDragging = false;
        let hasDragged = false; // 标记是否发生了拖动
        let dragStartX = 0;
        let dragStartY = 0;
        let panelStartX = 0;
        let panelStartY = 0;

        // 拖动开始事件处理
        const startDrag = (e) => {
            // 如果正在绘制，不启动拖动
            if (isPenToolActive && isDrawing) return;

            isDragging = true;
            hasDragged = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            const rect = drawCtrlPanel.getBoundingClientRect();
            panelStartX = rect.left;
            panelStartY = rect.top;
            penBtn.style.cursor = 'grabbing';
            e.preventDefault();

            // 添加mousemove和mouseup事件监听器
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', stopDrag);
        };

        // 拖动过程事件处理 - 直接更新位置，跟随鼠标
        const doDrag = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;

            // 如果移动距离超过5px，认为发生了拖动
            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                hasDragged = true;
            }

            // 计算新位置
            const newX = panelStartX + deltaX;
            const newY = panelStartY + deltaY;

            // 限制在可视区域内
            const maxX = window.innerWidth - 50;
            const maxY = window.innerHeight - 50;
            const clampedX = Math.max(0, Math.min(newX, maxX));
            const clampedY = Math.max(0, Math.min(newY, maxY));

            // 直接设置位置，跟随鼠标
            drawCtrlPanel.style.left = clampedX + 'px';
            drawCtrlPanel.style.top = clampedY + 'px';
            drawCtrlPanel.style.right = 'auto';
            drawCtrlPanel.style.bottom = 'auto';
        };

        // 拖动结束事件处理
        const stopDrag = (e) => {
            if (isDragging) {
                isDragging = false;
                penBtn.style.cursor = isPenToolActive ? 'pointer' : 'move';

                // 移除mousemove和mouseup事件监听器
                document.removeEventListener('mousemove', doDrag);
                document.removeEventListener('mouseup', stopDrag);

                // 如果发生了拖动，延迟重置 hasDragged，避免触发点击事件
                if (hasDragged) {
                    setTimeout(() => {
                        hasDragged = false;
                    }, 100);
                }
            }
        };

        // 添加mousedown事件监听器
        penBtn.addEventListener('mousedown', startDrag, { passive: false });

        // 注册资源清理
        resources.eventListeners.push({ element: penBtn, type: 'mousedown', handler: startDrag });
        // mousemove和mouseup事件在startDrag中动态添加，stopDrag中移除，无需注册到资源清理列表

        // 笔工具点击事件
        const penClick = (e) => {
            // 如果刚刚发生了拖动，不触发点击
            if (hasDragged || isDragging) {
                e.preventDefault();
                return;
            }

            if (!isPenToolActive) {
                // 激活笔工具（默认笔模式）
                isPenToolActive = true;
                currentMode = 'pen';
                penBtn.style.background = '#4da6ff';
                penBtn.innerHTML = '✏️';
                penBtn.style.cursor = 'pointer';
                canvas.style.display = 'block';
                resizeCanvas();
                canvas.style.cursor = penCursorUrl;
                document.body.style.cursor = penCursorUrl;
                drawCtrlPanel.style.display = 'block';
                // 重置橡皮擦按钮样式
                eraserBtn.style.background = '#f0f0f0';
            } else if (currentMode === 'eraser') {
                // 从橡皮擦模式切换回笔模式
                currentMode = 'pen';
                eraserBtn.style.background = '#f0f0f0';
                canvas.style.cursor = penCursorUrl;
                document.body.style.cursor = penCursorUrl;
            } else {
                // 关闭笔工具（当前是笔模式）
                closeCanvas();
            }
        };
        penBtn.addEventListener('click', penClick);
        resources.eventListeners.push({ element: penBtn, type: 'click', handler: penClick });

        // 橡皮擦按钮点击事件
        const eraserClick = () => {
            if (currentMode === 'pen') {
                // 切换到橡皮擦模式
                currentMode = 'eraser';
                eraserBtn.style.background = '#d9d9d9';
                canvas.style.cursor = eraserCursorUrl;
                document.body.style.cursor = eraserCursorUrl;
            } else if (currentMode === 'eraser') {
                // 切换回笔模式
                currentMode = 'pen';
                eraserBtn.style.background = '#f0f0f0';
                canvas.style.cursor = penCursorUrl;
                document.body.style.cursor = penCursorUrl;
            }
        };
        eraserBtn.addEventListener('click', eraserClick);
        resources.eventListeners.push({ element: eraserBtn, type: 'click', handler: eraserClick });

        // 撤销按钮点击事件
        const undoClick = () => {
            if (drawHistory.length === 0) {
                console.log('没有可撤销的操作');
                return;
            }

            // 移除最后一笔
            drawHistory.pop();

            // 清空Canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 重绘所有剩余笔画
            redrawAll();

            // 视觉反馈：按钮闪烁，保持柔和配色
            undoBtn.style.background = '#cce7ff';
            setTimeout(() => {
                undoBtn.style.background = '#e6f2ff';
            }, 200);
        };

        undoBtn.addEventListener('click', undoClick);
        resources.eventListeners.push({ element: undoBtn, type: 'click', handler: undoClick });

        // 清屏按钮（优先显示） - 橙色系（直观表示清除操作）
        const clearBtn = document.createElement('button');
        clearBtn.style.cssText = buttonStyle + `
            background: #fff2e6;
            color: #ff6600;
        `;
        clearBtn.innerHTML = '🗑️ 清屏 <span style="font-size: 12px; opacity: 0.7; margin-left: 5px;">(X)</span>';
        clearBtn.id = 'clear-btn';

        // 清屏功能核心逻辑
        const clearCanvas = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 清空历史记录
            drawHistory.length = 0;
            // 只清除画布内容，不关闭画布
        };

        // 清屏点击事件
        const clearClick = () => {
            clearCanvas();
        };
        clearBtn.addEventListener('click', clearClick);
        resources.eventListeners.push({ element: clearBtn, type: 'click', handler: clearClick });

        // 关闭画布按钮（X按钮） - 红色系（直观表示关闭操作）
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = buttonStyle + `
            background: #ffe6e6;
            color: #cc0000;
        `;
        closeBtn.innerHTML = '❌ 关闭 <span style="font-size: 12px; opacity: 0.7; margin-left: 5px;">(Esc)</span>';
        closeBtn.id = 'close-canvas-btn';
        resources.elements.push(closeBtn); // 加入清理列表

        // 关闭画布函数（统一关闭逻辑）
        const closeCanvas = () => {
            isPenToolActive = false;
            currentMode = null;
            penBtn.style.background = '#4da6ff';
            penBtn.innerHTML = '✏️';
            penBtn.style.cursor = 'move';
            canvas.style.display = 'none';
            canvas.style.cursor = 'default';
            document.body.style.cursor = 'default';
            // 清除隐藏定时器
            clearHideTimer();
            // 隐藏展开容器，但保留圆球显示
            expandedButtonsContainer.style.display = 'none';
            // 重置橡皮擦按钮样式
            eraserBtn.style.background = '#f0f0f0';
        };

        // 关闭按钮点击事件
        const closeClick = () => {
            closeCanvas();
        };
        closeBtn.addEventListener('click', closeClick);
        resources.eventListeners.push({ element: closeBtn, type: 'click', handler: closeClick });

        // 右键关闭画布功能
        const canvasRightClick = (e) => {
            if (!isPenToolActive) return;
            e.preventDefault(); // 阻止默认右键菜单
            closeCanvas();
        };
        canvas.addEventListener('contextmenu', canvasRightClick);
        resources.eventListeners.push({ element: canvas, type: 'contextmenu', handler: canvasRightClick });

        // 调整展开容器位置，避免超出屏幕
        const adjustExpandedContainerPosition = () => {
            const panelRect = drawCtrlPanel.getBoundingClientRect();
            const containerWidth = 124; // 展开容器宽度（包含padding和gap）
            const screenWidth = window.innerWidth;

            // 如果圆球在屏幕右侧，展开容器显示在左侧
            if (panelRect.right > screenWidth / 2) {
                expandedButtonsContainer.style.right = '60px';
                expandedButtonsContainer.style.left = 'auto';
            } else {
                // 如果圆球在屏幕左侧，展开容器显示在右侧
                expandedButtonsContainer.style.right = 'auto';
                expandedButtonsContainer.style.left = '60px';
            }
        };

        // 延迟隐藏定时器
        let hideTimer = null;
        const HIDE_DELAY = 300; // 延迟隐藏时间（毫秒）

        // 清除隐藏定时器
        const clearHideTimer = () => {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
        };

        // 延迟隐藏展开容器
        const scheduleHide = () => {
            clearHideTimer();
            hideTimer = setTimeout(() => {
                expandedButtonsContainer.style.display = 'none';
                hideTimer = null;
            }, HIDE_DELAY);
        };

        // 悬停展开逻辑
        const panelHoverIn = () => {
            // 清除任何待执行的隐藏操作
            clearHideTimer();
            // 只有在画布激活时才展开按钮列表
            if (isPenToolActive) {
                adjustExpandedContainerPosition();
                expandedButtonsContainer.style.display = 'flex';
            }
        };
        const panelHoverOut = (e) => {
            // 检查鼠标是否移动到展开容器上
            const relatedTarget = e.relatedTarget;
            if (relatedTarget && expandedButtonsContainer.contains(relatedTarget)) {
                return; // 鼠标仍在展开容器内，不隐藏
            }
            // 延迟隐藏按钮列表
            scheduleHide();
        };

        // 展开容器的悬停事件（防止鼠标移动到展开容器时隐藏）
        const expandedHoverIn = () => {
            // 清除任何待执行的隐藏操作
            clearHideTimer();
            if (isPenToolActive) {
                adjustExpandedContainerPosition();
                expandedButtonsContainer.style.display = 'flex';
            }
        };
        const expandedHoverOut = (e) => {
            // 检查鼠标是否移动到圆球上
            const relatedTarget = e.relatedTarget;
            if (relatedTarget && drawCtrlPanel.contains(relatedTarget)) {
                return; // 鼠标仍在容器内，不隐藏
            }
            // 延迟隐藏按钮列表
            scheduleHide();
        };

        // 绑定悬停事件
        drawCtrlPanel.addEventListener('mouseenter', panelHoverIn);
        drawCtrlPanel.addEventListener('mouseleave', panelHoverOut);
        expandedButtonsContainer.addEventListener('mouseenter', expandedHoverIn);
        expandedButtonsContainer.addEventListener('mouseleave', expandedHoverOut);
        resources.eventListeners.push({
            element: drawCtrlPanel,
            type: 'mouseenter',
            handler: panelHoverIn
        });
        resources.eventListeners.push({
            element: drawCtrlPanel,
            type: 'mouseleave',
            handler: panelHoverOut
        });
        resources.eventListeners.push({
            element: expandedButtonsContainer,
            type: 'mouseenter',
            handler: expandedHoverIn
        });
        resources.eventListeners.push({
            element: expandedButtonsContainer,
            type: 'mouseleave',
            handler: expandedHoverOut
        });

        // 组装展开容器（按钮顺序：清屏、橡皮擦、撤销、关闭）
        expandedButtonsContainer.append(clearBtn, subButtonsContainer, closeBtn);

        // 组装面板（圆球 + 展开容器）
        drawCtrlPanel.append(penBtn, expandedButtonsContainer);
        document.body.appendChild(drawCtrlPanel);

        // 初始状态：隐藏整个面板（通过CSS display: none）
        drawCtrlPanel.style.display = 'none';
        expandedButtonsContainer.style.display = 'none';

        // 显示/隐藏工具的函数
        const toggleToolVisibility = () => {
            isPenToolVisible = !isPenToolVisible;
            if (isPenToolVisible) {
                drawCtrlPanel.style.display = 'block';
                // 添加淡入动画，只使用opacity，不使用transform影响位置
                drawCtrlPanel.style.opacity = '0';
                drawCtrlPanel.style.transform = 'none'; // 重置transform，避免影响位置
                setTimeout(() => {
                    drawCtrlPanel.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                    drawCtrlPanel.style.opacity = '1';
                }, 10);
            } else {
                // 添加淡出动画，只使用opacity，不使用transform影响位置
                drawCtrlPanel.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                drawCtrlPanel.style.opacity = '0';
                setTimeout(() => {
                    drawCtrlPanel.style.display = 'none';
                    // 确保工具被关闭
                    closeCanvas();
                }, 300);
            }
        };

        // 全屏事件处理函数
        const handleFullscreenChange = () => {
            const fullscreenElement = document.fullscreenElement;
            if (fullscreenElement) {
                // 进入全屏模式：将元素移动到全屏容器中
                if (canvas.parentNode !== fullscreenElement) {
                    fullscreenElement.appendChild(canvas);
                }
                if (drawCtrlPanel.parentNode !== fullscreenElement) {
                    fullscreenElement.appendChild(drawCtrlPanel);
                }
                // 调整canvas大小
                resizeCanvas();
            } else {
                // 退出全屏模式：将元素移回document.body
                if (canvas.parentNode !== document.body) {
                    document.body.appendChild(canvas);
                }
                if (drawCtrlPanel.parentNode !== document.body) {
                    document.body.appendChild(drawCtrlPanel);
                }
                // 调整canvas大小
                resizeCanvas();
            }
        };

        // 键盘快捷键处理
        const handleKeyPress = (e) => {
            // 检查是否按下了Ctrl+Shift+D（显示/隐藏工具）
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                e.stopPropagation(); // 阻止事件传播
                e.stopImmediatePropagation(); // 阻止同一元素上的其他事件监听器
                toggleToolVisibility();
                return;
            }

            // 只有在画布激活时才处理其他快捷键
            if (isPenToolActive) {
                // 检查是否按下了X键（清屏功能）
                if (e.key === 'x' || e.key === 'X') {
                    e.preventDefault();
                    e.stopPropagation(); // 阻止事件传播
                    e.stopImmediatePropagation(); // 阻止同一元素上的其他事件监听器
                    clearCanvas();
                    // 视觉反馈：清屏按钮闪烁
                    clearBtn.style.background = '#ffd9cc';
                    setTimeout(() => {
                        clearBtn.style.background = '#fff2e6';
                    }, 200);
                    return;
                }

                // 检查是否按下了E键（切换画笔/橡皮擦）
                if (e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                    e.stopPropagation(); // 阻止事件传播
                    e.stopImmediatePropagation(); // 阻止同一元素上的其他事件监听器
                    eraserClick();
                    return;
                }

                // 检查是否按下了Ctrl+Z（撤销）
                if (e.ctrlKey && e.key === 'z') {
                    e.preventDefault();
                    e.stopPropagation(); // 阻止事件传播
                    e.stopImmediatePropagation(); // 阻止同一元素上的其他事件监听器
                    undoClick();
                    return;
                }

                // 检查是否按下了Esc键（关闭工具）
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation(); // 阻止事件传播
                    e.stopImmediatePropagation(); // 阻止同一元素上的其他事件监听器
                    closeCanvas();
                    return;
                }
            }
        };

        // 在捕获阶段添加事件监听器，优先于网站的事件处理
        window.addEventListener('keydown', handleKeyPress, { capture: true });
        resources.eventListeners.push({
            element: window,
            type: 'keydown',
            handler: handleKeyPress
        });

        // 添加全屏事件监听器
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        resources.eventListeners.push({
            element: document,
            type: 'fullscreenchange',
            handler: handleFullscreenChange
        });
    }

    // ===================== 核心清理逻辑（关键） =====================
    function cleanUpAllResources() {
        console.log('开始清理资源...');

        // 1. 移除所有事件监听（避免内存泄漏）
        resources.eventListeners.forEach(item => {
            item.element.removeEventListener(item.type, item.handler);
        });
        resources.eventListeners = [];
        console.log('已移除所有事件监听');

        // 2. 移除所有动态创建的DOM元素
        resources.elements.forEach(el => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        resources.elements = [];
        console.log('已移除所有动态创建的元素');

        // 3. 重置样式（避免影响其他页面）
        document.body.style.cursor = 'default';
    }

    // ===================== 长按鼠标左键加速视频功能 =====================
    function initLongPressMouse() {
        let mouseDownX = 0;
        let mouseDownY = 0;
        let isLongPressActive = false;
        let isLongPressPending = false; // 标记长按定时器是否正在运行
        let longPressTimer = null;
        let originalPlaybackRate = 1;
        const LONG_PRESS_DURATION = 500;
        const MOVE_THRESHOLD = 10;
        const FAST_SPEED = 2.0;

        function getVideoElement() {
            const videos = document.querySelectorAll('video');
            if (videos.length === 0) return null;
            
            // 视口尺寸
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            let bestVideo = null;
            let bestScore = 0;
            
            videos.forEach(video => {
                const rect = video.getBoundingClientRect();
                
                // 检查视频是否在视口内
                const isVisible = (
                    rect.top < viewportHeight &&
                    rect.bottom > 0 &&
                    rect.left < viewportWidth &&
                    rect.right > 0
                );
                
                if (isVisible) {
                    // 计算视频在视口内的面积
                    const overlapWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
                    const overlapHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
                    const overlapArea = overlapWidth * overlapHeight;
                    
                    // 计算视频本身的面积
                    const videoArea = rect.width * rect.height;
                    
                    // 计算可见比例
                    const visibilityRatio = overlapArea / videoArea;
                    
                    // 综合评分：可见面积 + 可见比例
                    const score = overlapArea + visibilityRatio * 1000;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestVideo = video;
                    }
                }
            });
            
            // 如果没有找到在视口内的视频，返回第一个视频
            return bestVideo || videos[0];
        }

        function getSpeedDisplayElement() {
            // 抖音倍速显示元素（根据用户提供的结构）
            const douyinSpeed = document.querySelector('.xgplayer-setting-playbackRatio');
            if (douyinSpeed) return douyinSpeed;

            // B站倍速显示元素
            const bilibiliSpeed = document.querySelector('.bpx-player-ctrl-playbackrate-menu .current');
            if (bilibiliSpeed) return bilibiliSpeed;

            // 其他可能的倍速显示元素
            const speedElements = document.querySelectorAll('[class*=speed], [class*=rate]');
            for (const element of speedElements) {
                if (element.textContent.includes('x')) {
                    return element;
                }
            }

            return null;
        }

        function updateSpeedDisplay(speed) {
            const video = getVideoElement();
            if (!video) return;
            
            // 从当前视频元素开始，向上遍历DOM树，找到对应的倍速显示元素
            let parent = video.parentElement;
            let speedElement = null;
            
            // 向上遍历最多10层，避免无限循环
            for (let i = 0; i < 10 && parent; i++) {
                // 查找当前父元素下的倍速显示元素
                speedElement = parent.querySelector('.xgplayer-setting-playbackRatio');
                if (speedElement) break;
                
                // 查找其他可能的倍速显示元素
                const speedElements = parent.querySelectorAll('[class*=speed], [class*=rate]');
                for (const element of speedElements) {
                    if (element.textContent.includes('倍速')) {
                        speedElement = element;
                        break;
                    }
                }
                if (speedElement) break;
                
                parent = parent.parentElement;
            }
            
            // 如果没有找到，使用原来的方法
            if (!speedElement) {
                speedElement = getSpeedDisplayElement();
            }
            
            if (speedElement) {
                speedElement.textContent = `${speed}.0x`;
            }
        }

        function triggerLongPress() {
            const video = getVideoElement();
            if (!video) {
                console.log('未找到视频元素');
                return;
            }

            if (!isLongPressActive) {
                isLongPressActive = true;
                originalPlaybackRate = video.playbackRate || 1;
                video.playbackRate = FAST_SPEED;
                updateSpeedDisplay(FAST_SPEED);
                console.log(`长按鼠标左键触发，视频速度设置为${FAST_SPEED}倍`);
            }
        }

        function restoreVideoSpeed() {
            const video = getVideoElement();
            if (video && isLongPressActive) {
                video.playbackRate = originalPlaybackRate;
                updateSpeedDisplay(originalPlaybackRate);
                console.log(`鼠标释放，视频速度恢复为${originalPlaybackRate}倍`);
                isLongPressActive = false;
            }
        }

        // 点击事件阻止函数
        const clickPreventHandler = (e) => {
            if (isLongPressActive || isLongPressPending) {
                e.preventDefault();
                e.stopPropagation();
                console.log('长按期间禁止点击事件');
            }
        };

        const mouseDownHandler = (e) => {
            if (e.button !== 0) return;
            
            // 只有在画布激活时才启用视频加速功能
            if (!isPenToolActive) return;

            mouseDownX = e.clientX;
            mouseDownY = e.clientY;
            isLongPressActive = false;
            isLongPressPending = true; // 标记长按定时器开始运行

            longPressTimer = setTimeout(triggerLongPress, LONG_PRESS_DURATION);
        };

        const mouseMoveHandler = (e) => {
            const deltaX = Math.abs(e.clientX - mouseDownX);
            const deltaY = Math.abs(e.clientY - mouseDownY);

            if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                    isLongPressPending = false; // 清除长按待处理状态
                }
            }
        };

        const mouseUpHandler = (e) => {
            if (e.button !== 0) return;

            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                isLongPressPending = false; // 清除长按待处理状态
            }

            restoreVideoSpeed();
        };

        document.addEventListener('mousedown', mouseDownHandler, { capture: true });
        document.addEventListener('mousemove', mouseMoveHandler, { capture: true });
        document.addEventListener('mouseup', mouseUpHandler, { capture: true });
        document.addEventListener('click', clickPreventHandler, { capture: true }); // 阻止点击事件

        resources.eventListeners.push({ element: document, type: 'mousedown', handler: mouseDownHandler });
        resources.eventListeners.push({ element: document, type: 'mousemove', handler: mouseMoveHandler });
        resources.eventListeners.push({ element: document, type: 'mouseup', handler: mouseUpHandler });
        resources.eventListeners.push({ element: document, type: 'click', handler: clickPreventHandler });
    }

    // ===================== 初始化 & 绑定页面销毁事件 =====================
    let isInitialized = false;

    function init() {
        initDrawTool();
        initLongPressMouse();
        isInitialized = true;
        console.log('抖音&哔哩哔哩标注工具已加载完成');
        console.log('快捷键说明：');
        console.log('  Ctrl+Shift+D - 显示/隐藏工具');
        console.log('  X - 清屏');
        console.log('  E - 切换画笔/橡皮擦');
        console.log('  Ctrl+Z - 撤销');
        console.log('  Esc - 关闭工具');
        console.log('  长按鼠标左键 - 视频加速到2倍速');

        // 页面卸载时清理资源
        window.addEventListener('beforeunload', cleanUpAllResources);
    }

    // 页面初次加载时执行一次
    setTimeout(() => {
        console.log('抖音&哔哩哔哩标注工具初始化...');
        init();
    }, 1000);
})();