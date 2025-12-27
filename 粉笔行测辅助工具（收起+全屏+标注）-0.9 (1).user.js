// ==UserScript==
// @name         粉笔行测辅助工具（收起+全屏+标注）
// @namespace    http://tampermonkey.net/
// @version      0.2.0
// @description  自动点击粉笔行测错题页收起按钮；全屏吸附+右上角可拖动笔工具/橡皮擦/撤销/清屏按钮；手动触发收起按钮（含内存清理）
// @author       You
// @match        https://www.fenbi.com/*/exam/error/practice/xingce/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ========== 全局存储需要清理的资源 ==========
    const resources = {
        timer: null,          // 自动收起定时器
        elements: [],         // 动态创建的DOM元素
        eventListeners: []    // 绑定的事件监听
    };

    // ===================== 核心收起逻辑 =====================
    const collapseBtnSelector = 'button.expend-btn:not(.expend-btn-rotate)';
    const clickedMarkClass = 'auto-clicked-collapse-btn';

    // 通用收起函数
    function collapseTargetButtons(manual = false) {
        let selector = collapseBtnSelector;
        if (!manual) {
            selector = `${collapseBtnSelector}:not(.${clickedMarkClass})`;
        }
        const collapseBtns = document.querySelectorAll(selector);

        if (collapseBtns.length > 0) {
            collapseBtns.forEach(btn => {
                const isVisible = window.getComputedStyle(btn).display !== 'none' &&
                                  window.getComputedStyle(btn).visibility !== 'hidden';
                if (isVisible) {
                    if (!manual) btn.classList.add(clickedMarkClass);
                    btn.click();
                }
            });
            const logText = manual ? `手动收起：` : `自动收起：`;
            console.log(`${logText}共点击 ${collapseBtns.length} 个收起按钮`);
        } else if (manual) {
            console.log('暂无需要收起的按钮');
        }
    }

    // ===================== 自动收起功能（带清理） =====================
    function startAutoCollapse() {
        // 启动定时器并存储引用
        resources.timer = setInterval(() => {
            collapseTargetButtons(false);
        }, 300);
        console.log('自动收起定时器已启动');
    }

    // ===================== 右下角按钮组（带清理） =====================
    function createControlButtons() {
        // 1. 收起按钮容器
        const collapseManualContainer = document.createElement('div');
        collapseManualContainer.style.cssText = `
            position: fixed; right: 0; bottom: 80px;
            width: 50px; height: 50px; border-radius: 50% 0 0 50%; overflow: hidden;
            z-index: 9999; transition: all 0.3s ease;
        `;
        collapseManualContainer.id = 'collapse-manual-container';
        resources.elements.push(collapseManualContainer); // 加入清理列表

        // 收起按钮
        const collapseManualBtn = document.createElement('button');
        collapseManualBtn.style.cssText = `
            position: absolute; right: -40px; top: 0; width: 50px; height: 50px;
            border-radius: 50%; background: #67c23a; color: white; border: none;
            font-size: 14px; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: all 0.3s ease; display: flex; align-items: center; justify-content: center;
            text-align: center; padding: 0 5px;
        `;
        collapseManualBtn.innerText = '收起';
        collapseManualBtn.id = 'custom-collapse-manual-btn';
        collapseManualContainer.appendChild(collapseManualBtn);

        // hover事件（存储监听引用，方便销毁）
        const collapseHoverIn = () => { collapseManualBtn.style.right = '0'; };
        const collapseHoverOut = () => { collapseManualBtn.style.right = '-40px'; };
        collapseManualContainer.addEventListener('mouseenter', collapseHoverIn);
        collapseManualContainer.addEventListener('mouseleave', collapseHoverOut);
        resources.eventListeners.push({
            element: collapseManualContainer,
            type: 'mouseenter',
            handler: collapseHoverIn
        });
        resources.eventListeners.push({
            element: collapseManualContainer,
            type: 'mouseleave',
            handler: collapseHoverOut
        });

        // 点击事件
        const collapseClick = () => {
            collapseTargetButtons(true);
            collapseManualBtn.style.background = '#85ce61';
            setTimeout(() => {
                collapseManualBtn.style.background = '#67c23a';
            }, 300);
        };
        collapseManualBtn.addEventListener('click', collapseClick);
        resources.eventListeners.push({
            element: collapseManualBtn,
            type: 'click',
            handler: collapseClick
        });

        // 2. 全屏按钮容器
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
        if (!document.querySelector('#collapse-manual-container')) {
            document.body.appendChild(collapseManualContainer);
        }
        if (!document.querySelector('#fullscreen-container')) {
            document.body.appendChild(fullscreenContainer);
        }
    }

    // ===================== 标注工具（带清理） =====================
    function initDrawTool() {
        // Canvas图层
        const canvas = document.createElement('canvas');
        canvas.id = 'custom-draw-canvas';
        canvas.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            z-index: 9998; background: rgba(50,50,50,0.1);
            cursor: default; border: none; display: none;
        `;
        resources.elements.push(canvas); // 加入清理列表
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');

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
        const fullscreenResize = () => { resizeCanvas(); };
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
            // 将滚轮事件传递给页面
            e.preventDefault();
            window.scrollBy(0, e.deltaY);
        };
        canvas.addEventListener('wheel', wheelEvent, { passive: false });
        resources.eventListeners.push({ element: canvas, type: 'wheel', handler: wheelEvent });

        // 标注面板
        const drawCtrlPanel = document.createElement('div');
        drawCtrlPanel.style.cssText = `
            position: fixed; top: 170px; right: 43px;
            display: flex; flex-direction: column; gap: 5px;
            z-index: 9999; padding: 5px; border-radius: 4px;
            background: rgba(255,255,255,0.9); box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        drawCtrlPanel.id = 'draw-control-panel';
        resources.elements.push(drawCtrlPanel); // 加入清理列表

        // 笔工具按钮（主按钮）
        const penBtn = document.createElement('button');
        penBtn.style.cssText = `
            width: 90px; height: 30px; border: none; border-radius: 4px;
            background: #409eff; color: white; cursor: pointer; transition: all 0.2s ease;
            font-size: 14px;
        `;
        penBtn.innerText = '笔工具';

        // 子按钮容器（默认隐藏）
        const subButtonsContainer = document.createElement('div');
        subButtonsContainer.style.cssText = `
            display: none; flex-direction: column; gap: 5px;
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

        // 笔工具点击事件
        const penClick = () => {
            if (!isPenToolActive) {
                // 激活笔工具（默认笔模式）
                isPenToolActive = true;
                currentMode = 'pen';
                penBtn.style.background = '#66b1ff';
                penBtn.innerText = '关闭笔';
                canvas.style.display = 'block';
                resizeCanvas();
                canvas.style.cursor = penCursorUrl;
                document.body.style.cursor = penCursorUrl;
                // 显示子按钮
                subButtonsContainer.style.display = 'flex';
                // 重置橡皮擦按钮样式
                eraserBtn.style.background = '#909399';
            } else {
                // 关闭笔工具
                isPenToolActive = false;
                currentMode = null;
                penBtn.style.background = '#409eff';
                penBtn.innerText = '笔工具';
                canvas.style.display = 'none';
                canvas.style.cursor = 'default';
                document.body.style.cursor = 'default';
                // 隐藏子按钮
                subButtonsContainer.style.display = 'none';
            }
        };
        penBtn.addEventListener('click', penClick);
        resources.eventListeners.push({ element: penBtn, type: 'click', handler: penClick });

        // 橡皮擦按钮点击事件
        const eraserClick = () => {
            if (currentMode === 'pen') {
                // 切换到橡皮擦模式
                currentMode = 'eraser';
                penBtn.innerText = '切换笔';
                eraserBtn.style.background = '#e6a23c'; // 橙色高亮
                canvas.style.cursor = eraserCursorUrl;
                document.body.style.cursor = eraserCursorUrl;
            } else if (currentMode === 'eraser') {
                // 切换回笔模式
                currentMode = 'pen';
                penBtn.innerText = '关闭笔';
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

        // 清屏按钮
        const clearBtn = document.createElement('button');
        clearBtn.style.cssText = `
            width: 90px; height: 30px; border: none; border-radius: 4px;
            background: #f56c6c; color: white; cursor: pointer; transition: all 0.2s ease;
            font-size: 14px;
        `;
        clearBtn.innerText = '清屏（×）';

        // 清屏点击事件
        const clearClick = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 清空历史记录
            drawHistory.length = 0;
            isPenToolActive = false;
            currentMode = null;
            penBtn.style.background = '#409eff';
            penBtn.innerText = '笔工具';
            canvas.style.display = 'none';
            canvas.style.cursor = 'default';
            document.body.style.cursor = 'default';
            // 隐藏子按钮
            subButtonsContainer.style.display = 'none';
            // 重置橡皮擦按钮样式
            eraserBtn.style.background = '#909399';
        };
        clearBtn.addEventListener('click', clearClick);
        resources.eventListeners.push({ element: clearBtn, type: 'click', handler: clearClick });

        // 面板拖动逻辑
        let isDragging = false;
        let offsetX, offsetY;
        const panelMouseDown = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            offsetX = e.clientX - drawCtrlPanel.getBoundingClientRect().left;
            offsetY = e.clientY - drawCtrlPanel.getBoundingClientRect().top;
            drawCtrlPanel.style.zIndex = '10000';
            drawCtrlPanel.style.cursor = 'move';
            e.preventDefault();
        };
        const panelMouseMove = (e) => {
            if (!isDragging) return;
            const newLeft = e.clientX - offsetX;
            const newTop = e.clientY - offsetY;
            const maxLeft = window.innerWidth - drawCtrlPanel.offsetWidth;
            const maxTop = window.innerHeight - drawCtrlPanel.offsetHeight;
            const finalLeft = Math.max(0, Math.min(maxLeft, newLeft));
            const finalTop = Math.max(0, Math.min(maxTop, newTop));
            drawCtrlPanel.style.left = `${finalLeft}px`;
            drawCtrlPanel.style.top = `${finalTop}px`;
            drawCtrlPanel.style.right = 'auto';
            drawCtrlPanel.style.bottom = 'auto';
        };
        const panelMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                drawCtrlPanel.style.cursor = 'default';
            }
        };

        // 绑定拖动事件并存储
        drawCtrlPanel.addEventListener('mousedown', panelMouseDown);
        document.addEventListener('mousemove', panelMouseMove);
        document.addEventListener('mouseup', panelMouseUp);
        resources.eventListeners.push({ element: drawCtrlPanel, type: 'mousedown', handler: panelMouseDown });
        resources.eventListeners.push({ element: document, type: 'mousemove', handler: panelMouseMove });
        resources.eventListeners.push({ element: document, type: 'mouseup', handler: panelMouseUp });

        // 组装面板
        drawCtrlPanel.append(penBtn, subButtonsContainer, clearBtn);
        document.body.appendChild(drawCtrlPanel);
    }

    // ===================== 核心清理逻辑（关键） =====================
    function cleanUpAllResources() {
        console.log('开始清理资源...');

        // 1. 清除定时器
        if (resources.timer) {
            clearInterval(resources.timer);
            resources.timer = null;
            console.log('已清除自动收起定时器');
        }

        // 2. 移除所有事件监听（避免内存泄漏）
        resources.eventListeners.forEach(item => {
            item.element.removeEventListener(item.type, item.handler);
        });
        resources.eventListeners = [];
        console.log('已移除所有事件监听');

        // 3. 移除所有动态创建的DOM元素
        resources.elements.forEach(el => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        resources.elements = [];
        console.log('已移除所有动态创建的元素');

        // 4. 重置样式（避免影响其他页面）
        document.body.style.cursor = 'default';
    }

    // ===================== 初始化 & 绑定页面销毁事件 =====================
    let isInitialized = false;

    function init() {
        startAutoCollapse();
        createControlButtons();
        initDrawTool();
        isInitialized = true;
        console.log('粉笔行测辅助工具已加载完成');

        // 页面卸载时清理资源
        window.addEventListener('beforeunload', cleanUpAllResources);
    }

    // 检查URL是否匹配目标页面
    function isCurrentPageMatch() {
        return /\/exam\/error\/practice\/xingce\//.test(window.location.href);
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