// ==UserScript==
// @name         粉笔试题、试卷页标注、全屏工具
// @namespace    http://tampermonkey.net/
// @version      0.0.3
// @description  试题、试卷页标注、全屏工具
// @author       spl
// @match        https://spa.fenbi.com/*/exam/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ========== 全局存储需要清理的资源 ==========
    const resources = {
        elements: [],         // 动态创建的DOM元素
        eventListeners: []    // 绑定的事件监听
    };



    // ===================== 右下角按钮组（带清理） =====================
    function createControlButtons() {

        // 1. 全屏按钮容器
        const fullscreenContainer = document.createElement('div');
        fullscreenContainer.style.cssText = `
            position: fixed; right: 0; bottom: 20px;
            width: 50px; height: 50px; border-radius: 50% 0 0 50%; overflow: hidden;
            z-index: 9999; transition: all 0.3s ease;
        `;
        fullscreenContainer.id = 'fullscreen-container';
        resources.elements.push(fullscreenContainer); // 加入清理列表

        // 全屏按钮
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.style.cssText = `
            position: absolute; right: -40px; top: 0; width: 50px; height: 50px;
            border-radius: 50%; background: #409eff; color: white; border: none;
            font-size: 14px; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: all 0.3s ease; display: flex; align-items: center; justify-content: center;
        `;
        fullscreenBtn.innerText = '全屏';
        fullscreenBtn.id = 'custom-fullscreen-btn';
        fullscreenContainer.appendChild(fullscreenBtn);

        // hover事件
        const fullscreenHoverIn = () => { fullscreenBtn.style.right = '0'; };
        const fullscreenHoverOut = () => { fullscreenBtn.style.right = '-40px'; };
        fullscreenContainer.addEventListener('mouseenter', fullscreenHoverIn);
        fullscreenContainer.addEventListener('mouseleave', fullscreenHoverOut);
        resources.eventListeners.push({
            element: fullscreenContainer,
            type: 'mouseenter',
            handler: fullscreenHoverIn
        });
        resources.eventListeners.push({
            element: fullscreenContainer,
            type: 'mouseleave',
            handler: fullscreenHoverOut
        });

        // 点击事件
        const fullscreenClick = () => {
            const isFull = document.fullscreenElement;
            if (!isFull) {
                document.documentElement.requestFullscreen() || document.documentElement.webkitRequestFullscreen();
                fullscreenBtn.innerText = '退出';
            } else {
                document.exitFullscreen() || document.documentElement.webkitExitFullscreen();
                fullscreenBtn.innerText = '全屏';
            }
        };
        fullscreenBtn.addEventListener('click', fullscreenClick);
        resources.eventListeners.push({
            element: fullscreenBtn,
            type: 'click',
            handler: fullscreenClick
        });

        // 添加到页面（避免重复）
        if (!document.querySelector('#fullscreen-container')) {
            document.body.appendChild(fullscreenContainer);
        }

    }

    // ===================== 标注工具（带清理） =====================
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
        let isDrawing = false;
        let isPenToolActive = false;
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

        // fullscreenchange事件
        const fullscreenResize = () => {
            resizeCanvas();
            // 更新全屏按钮文本
            const isFull = document.fullscreenElement;
            const fullscreenBtn = document.querySelector('#custom-fullscreen-btn');
            if (isFull) {
                if (fullscreenBtn) fullscreenBtn.innerText = '退出';
            } else {
                if (fullscreenBtn) fullscreenBtn.innerText = '全屏';
            }
        };
        window.addEventListener('fullscreenchange', fullscreenResize);
        resources.eventListeners.push({
            element: window,
            type: 'fullscreenchange',
            handler: fullscreenResize
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
            position: fixed; right: 20px; top: 20px;
            width: 50px; height: 50px; border-radius: 50%; overflow: visible;
            z-index: 9999; transition: none; user-select: none;
        `;
        drawCtrlPanel.id = 'draw-control-panel';
        resources.elements.push(drawCtrlPanel); // 加入清理列表

        // 圆球按钮（收缩状态的主按钮）
        const penBtn = document.createElement('button');
        penBtn.style.cssText = `
            position: absolute; right: -23px; top: 100px; width: 50px; height: 50px;
            border-radius: 50%; background: #409eff; color: white; border: none;
            font-size: 14px; cursor: move; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: background 0.2s ease; display: flex; align-items: center; justify-content: center;
            text-align: center; padding: 0; user-select: none;
        `;
        penBtn.innerText = '笔';
        penBtn.id = 'pen-tool-btn';

        // 展开的按钮容器（默认隐藏，悬停时显示）
        const expandedButtonsContainer = document.createElement('div');
        expandedButtonsContainer.style.cssText = `
            position: absolute; right: 60px; top: 0;
            display: none; flex-direction: column; gap: 5px;
            padding: 5px; border-radius: 4px;
            background: rgba(255,255,255,0.95); box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            transition: opacity 0.2s ease; pointer-events: auto;
        `;
        expandedButtonsContainer.id = 'expanded-buttons-container';
        resources.elements.push(expandedButtonsContainer); // 加入清理列表

        // 子按钮容器（用于存放橡皮擦和撤销）
        const subButtonsContainer = document.createElement('div');
        subButtonsContainer.style.cssText = `
            display: flex; flex-direction: column; gap: 5px;
        `;
        subButtonsContainer.id = 'sub-buttons-container';
        resources.elements.push(subButtonsContainer); // 加入清理列表

        // 橡皮擦按钮
        const eraserBtn = document.createElement('button');
        eraserBtn.style.cssText = `
            width: 90px; height: 30px; border: none; border-radius: 4px;
            background: #909399; color: white; cursor: pointer; transition: all 0.2s ease;
            font-size: 14px;
        `;
        eraserBtn.innerText = '🧽 橡皮擦';
        eraserBtn.id = 'eraser-btn';

        // 撤销按钮
        const undoBtn = document.createElement('button');
        undoBtn.style.cssText = `
            width: 90px; height: 30px; border: none; border-radius: 4px;
            background: #f56c6c; color: white; cursor: pointer; transition: all 0.2s ease;
            font-size: 14px;
        `;
        undoBtn.innerText = '↩ 撤销';
        undoBtn.id = 'undo-btn';

        // 组装子按钮容器
        subButtonsContainer.append(eraserBtn, undoBtn);

        // 光标定义
        const penCursorUrl = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyOCcgaGVpZ2h0PScyOCcgdmlld0JveD0nMCAwIDI4IDI4Jz48cGF0aCBkPSdNMTkuOCAyLjJjLjYtLjYgMS42LS42IDIuMiAwbDMuOCAzLjhjLjYuNi42IDEuNiAwIDIuMkwxMSAyM2wtNiAxLjggMS44LTUuOCAxMy0xNi44eicgZmlsbD0nIzU1NTU1NScvPjxwYXRoIGQ9J00xOC42IDMuNGw0IDQnIHN0cm9rZT0nI2ZmZicgc3Ryb2tlLXdpZHRoPScxLjInIG9wYWNpdHk9Jy42Jy8+PC9zdmc+") 4 24, auto';
        // 橡皮擦光标：圆形虚线框（半径10px，直径30px）
        const eraserCursorUrl = 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTUiIGN5PSIxNSIgcj0iMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzU1NSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSIzLDMiLz48L3N2Zz4=") 15 15, auto';

        // 拖动功能
        let isDragging = false;
        let hasDragged = false; // 标记是否发生了拖动
        let dragStartX = 0;
        let dragStartY = 0;
        let panelStartX = 0;
        let panelStartY = 0;

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
        };

        const doDrag = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;
            
            // 如果移动距离超过5px，认为发生了拖动
            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                hasDragged = true;
            }
            
            const newX = panelStartX + deltaX;
            const newY = panelStartY + deltaY;
            
            // 限制在可视区域内
            const maxX = window.innerWidth - 50;
            const maxY = window.innerHeight - 50;
            const finalX = Math.max(0, Math.min(newX, maxX));
            const finalY = Math.max(0, Math.min(newY, maxY));
            
            drawCtrlPanel.style.left = finalX + 'px';
            drawCtrlPanel.style.top = finalY + 'px';
            drawCtrlPanel.style.right = 'auto';
            drawCtrlPanel.style.bottom = 'auto';
        };

        const stopDrag = (e) => {
            if (isDragging) {
                isDragging = false;
                penBtn.style.cursor = isPenToolActive ? 'pointer' : 'move';
                // 如果发生了拖动，延迟重置 hasDragged，避免触发点击事件
                if (hasDragged) {
                    setTimeout(() => {
                        hasDragged = false;
                    }, 100);
                }
            }
        };

        penBtn.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
        resources.eventListeners.push({ element: penBtn, type: 'mousedown', handler: startDrag });
        resources.eventListeners.push({ element: document, type: 'mousemove', handler: doDrag });
        resources.eventListeners.push({ element: document, type: 'mouseup', handler: stopDrag });

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
                penBtn.style.background = '#66b1ff';
                penBtn.innerText = '笔';
                penBtn.style.cursor = 'pointer';
                canvas.style.display = 'block';
                resizeCanvas();
                canvas.style.cursor = penCursorUrl;
                document.body.style.cursor = penCursorUrl;
                drawCtrlPanel.style.display = 'block';
                // 重置橡皮擦按钮样式
                eraserBtn.style.background = '#909399';
            } else if (currentMode === 'eraser') {
                // 从橡皮擦模式切换回笔模式
                currentMode = 'pen';
                eraserBtn.style.background = '#909399';
                canvas.style.cursor = penCursorUrl;
                document.body.style.cursor = penCursorUrl;
            } else {
                // 关闭笔工具（当前是笔模式）
                closeCanvas();
            }
        };
        penBtn.addEventListener('click', penClick);
        resources.eventListeners.push({ element: penBtn, type: 'click', handler: penClick });

        // 右键快速打开/关闭笔工具功能
        const rightClickToTogglePen = (e) => {
            // 如果点击的是 canvas 元素，不处理（canvas 有自己的右键关闭功能）
            if (e.target === canvas || canvas.contains(e.target)) {
                return;
            }

            // 检查目标元素是否为可交互元素
            const target = e.target;
            const tagName = target.tagName.toUpperCase();
            
            // 排除可交互元素类型
            const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'];
            if (interactiveTags.includes(tagName)) {
                return;
            }

            // 检查元素是否有 onclick 事件处理器
            if (target.onclick) {
                return;
            }

            // 检查鼠标样式是否为手型（pointer）
            const computedStyle = window.getComputedStyle(target);
            if (computedStyle.cursor === 'pointer') {
                return;
            }

            // 检查父元素是否为可交互元素
            if (target.closest('button, a, [onclick], [role="button"], input, select, textarea')) {
                return;
            }

            // 满足条件，阻止默认右键菜单并根据状态切换
            e.preventDefault();
            if (isPenToolActive) {
                // 如果笔工具已激活，关闭画布
                closeCanvas();
            } else {
                // 如果笔工具未激活，激活画布
                penClick();
            }
        };
        document.addEventListener('contextmenu', rightClickToTogglePen);
        resources.eventListeners.push({ element: document, type: 'contextmenu', handler: rightClickToTogglePen });

        // 橡皮擦按钮点击事件
        const eraserClick = () => {
            if (currentMode === 'pen') {
                // 切换到橡皮擦模式
                currentMode = 'eraser';
                eraserBtn.style.background = '#e6a23c'; // 橙色高亮
                canvas.style.cursor = eraserCursorUrl;
                document.body.style.cursor = eraserCursorUrl;
            } else if (currentMode === 'eraser') {
                // 切换回笔模式
                currentMode = 'pen';
                eraserBtn.style.background = '#909399'; // 灰色
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

            // 视觉反馈：按钮闪烁
            undoBtn.style.background = '#f78989';
            setTimeout(() => {
                undoBtn.style.background = '#f56c6c';
            }, 200);
        };

        undoBtn.addEventListener('click', undoClick);
        resources.eventListeners.push({ element: undoBtn, type: 'click', handler: undoClick });

        // 清屏按钮（优先显示）
        const clearBtn = document.createElement('button');
        clearBtn.style.cssText = `
            width: 90px; height: 60px; border: none; border-radius: 4px;
            background: #f56c6c; color: white; cursor: pointer; transition: all 0.2s ease;
            font-size: 14px;
        `;
        clearBtn.innerText = '清屏（×）';
        clearBtn.id = 'clear-btn';

        // 清屏点击事件
        const clearClick = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 清空历史记录
            drawHistory.length = 0;
            // 只清除画布内容，不关闭画布
        };
        clearBtn.addEventListener('click', clearClick);
        resources.eventListeners.push({ element: clearBtn, type: 'click', handler: clearClick });

        // 关闭画布按钮（X按钮）
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            width: 90px; height: 30px; border: none; border-radius: 4px;
            background: #f56c6c; color: white; cursor: pointer; transition: all 0.2s ease;
            font-size: 14px;
        `;
        closeBtn.innerText = 'X';
        closeBtn.id = 'close-canvas-btn';
        resources.elements.push(closeBtn); // 加入清理列表

        // 关闭画布函数（统一关闭逻辑）
        const closeCanvas = () => {
            isPenToolActive = false;
            currentMode = null;
            penBtn.style.background = '#409eff';
            penBtn.innerText = '笔';
            penBtn.style.cursor = 'move';
            canvas.style.display = 'none';
            canvas.style.cursor = 'default';
            document.body.style.cursor = 'default';
            // 清除隐藏定时器
            clearHideTimer();
            // 隐藏展开容器，但保留圆球显示
            expandedButtonsContainer.style.display = 'none';
            // 重置橡皮擦按钮样式
            eraserBtn.style.background = '#909399';
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
            const containerWidth = 100; // 展开容器宽度（包含padding）
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
        
        // 初始状态：显示圆球（但隐藏展开的按钮列表）
        drawCtrlPanel.style.display = 'block';
        expandedButtonsContainer.style.display = 'none';
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

    // ===================== 初始化 & 绑定页面销毁事件 =====================
    let isInitialized = false;

    function init() {
        createControlButtons();
        initDrawTool();
        isInitialized = true;
        console.log('试题、试卷页标注、全屏工具已加载完成');

        // 页面卸载时清理资源
        window.addEventListener('beforeunload', cleanUpAllResources);
    }

    // 检查URL是否匹配目标页面
    function isCurrentPageMatch() {
        return /\/exam\//.test(window.location.href);
    }

    // URL变化时的处理逻辑
    function onUrlChange() {
        console.log('检测到 URL 变化:', location.href);

        if (isCurrentPageMatch()) {
            if (!isInitialized) {
                console.log('URL 匹配，初始化脚本...');
                init();
            }
        } else {
            if (isInitialized) {
                console.log('URL 不匹配，清理资源...');
                cleanUpAllResources();
                isInitialized = false;
            }
        }
    }

    // 劫持 pushState / replaceState
    const originalPushState = history.pushState;
    history.pushState = function() {
        console.log('pushState 被调用', arguments);
        originalPushState.apply(this, arguments);
        window.dispatchEvent(new Event('urlchange'));
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        console.log('replaceState 被调用', arguments);
        originalReplaceState.apply(this, arguments);
        window.dispatchEvent(new Event('urlchange'));
    };

    // 监听浏览器前进/后退
    window.addEventListener('popstate', (e) => {
        console.log('popstate 事件触发', e);
        window.dispatchEvent(new Event('urlchange'));
    });

    // 监听 hash 变化
    window.addEventListener('hashchange', (e) => {
        console.log('hashchange 事件触发', e);
        window.dispatchEvent(new Event('urlchange'));
    });

    // 监听自定义 urlchange 事件
    window.addEventListener('urlchange', onUrlChange);

    // 定时检测 URL（兜底方案，每1秒检查一次）
    // let lastUrl = location.href;
    // setInterval(() => {
    //     if (location.href !== lastUrl) {
    //         console.log('定时检测到 URL 变化:', lastUrl, '->', location.href);
    //         lastUrl = location.href;
    //         onUrlChange();
    //     }
    // }, 1000);

    // 页面初次加载时执行一次
    setTimeout(() => {
        console.log('初次加载，当前 URL:', location.href);
        if (isCurrentPageMatch()) {
            console.log('初次加载，URL 匹配，初始化脚本...');
            init();
        } else {
            console.log('初次加载，URL 不匹配，等待路由变化...');
        }
    }, 1000);
})();