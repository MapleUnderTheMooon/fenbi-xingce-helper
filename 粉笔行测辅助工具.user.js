// ==UserScript==
// @name         粉笔行测辅助工具（收起+全屏+标注+时钟）
// @namespace    http://tampermonkey.net/
// @version      0.4.4
// @description  自动点击粉笔行测错题页收起按钮；全屏吸附+右上角可拖动笔工具/橡皮擦/撤销/清屏按钮；手动触发收起按钮（含内存清理）；全屏模式下显示可拖动时钟（支持边缘吸附和悬停滑出）
// @author       spl
// @match        https://www.fenbi.com/*/exam/error/practice/xingce/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ========== 全局存储需要清理的资源 ==========
    const resources = {
        timer: null,          // 自动收起定时器
        clockTimer: null,     // 时钟更新定时器
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
            // 注意：时钟的显示/隐藏由 fullscreenchange 事件统一处理
        };
        fullscreenBtn.addEventListener('click', fullscreenClick);
        resources.eventListeners.push({
            element: fullscreenBtn,
            type: 'click',
            handler: fullscreenClick
        });

        // 3. 向下滚动按钮
        const scrollDownContainer = document.createElement('div');
        scrollDownContainer.style.cssText = `
            position: fixed; right: 23px; top: 50%;
            transform: translateY(-50%);
            z-index: 9999; transition: all 0.3s ease;
        `;
        scrollDownContainer.id = 'scroll-down-container';
        resources.elements.push(scrollDownContainer); // 加入清理列表

        // 向下滚动按钮
        const scrollDownBtn = document.createElement('button');
        scrollDownBtn.style.cssText = `
            width: 48px; height: 48px;
            background: white; border: none; border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            cursor: pointer; transition: all 0.2s ease;
            display: flex; align-items: center; justify-content: center;
            padding: 0; outline: none;
        `;
        scrollDownBtn.id = 'custom-scroll-down-btn';
        
        // 创建向下箭头图标（SVG）
        const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        arrowSvg.setAttribute('width', '20');
        arrowSvg.setAttribute('height', '20');
        arrowSvg.setAttribute('viewBox', '0 0 20 20');
        arrowSvg.style.cssText = 'fill: #6b7280;';
        
        const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrowPath.setAttribute('d', 'M10 14L5 9l1.41-1.41L10 11.17l3.59-3.58L15 9l-5 5z');
        arrowSvg.appendChild(arrowPath);
        scrollDownBtn.appendChild(arrowSvg);

        // hover效果
        const scrollDownHoverIn = () => {
            scrollDownBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            scrollDownBtn.style.transform = 'scale(1.05)';
        };
        const scrollDownHoverOut = () => {
            scrollDownBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            scrollDownBtn.style.transform = 'scale(1)';
        };
        scrollDownBtn.addEventListener('mouseenter', scrollDownHoverIn);
        scrollDownBtn.addEventListener('mouseleave', scrollDownHoverOut);
        resources.eventListeners.push({
            element: scrollDownBtn,
            type: 'mouseenter',
            handler: scrollDownHoverIn
        });
        resources.eventListeners.push({
            element: scrollDownBtn,
            type: 'mouseleave',
            handler: scrollDownHoverOut
        });

        // 点击事件：平滑滚动到底部
        const scrollDownClick = () => {
            const scrollToBottomFenbiStyle = () => {
                const el = document.getElementById('fenbi-web-exams');
                if (!el) return;
            
                const mid = el.scrollTop + el.clientHeight * 0.9;
                const end = el.scrollHeight;
            
                // 第一跳
                el.scrollTop = mid;
            
                // 极短停顿，再跳到底
                setTimeout(() => {
                    el.scrollTop = end;
                }, 120);
            };

            scrollToBottomFenbiStyle();
            
            // 视觉反馈
            scrollDownBtn.style.background = '#f3f4f6';
            setTimeout(() => {
                scrollDownBtn.style.background = 'white';
            }, 200);
        };
        scrollDownBtn.addEventListener('click', scrollDownClick);
        resources.eventListeners.push({
            element: scrollDownBtn,
            type: 'click',
            handler: scrollDownClick
        });

        scrollDownContainer.appendChild(scrollDownBtn);

        // 添加到页面（避免重复）
        if (!document.querySelector('#collapse-manual-container')) {
            document.body.appendChild(collapseManualContainer);
        }
        if (!document.querySelector('#fullscreen-container')) {
            document.body.appendChild(fullscreenContainer);
        }
        if (!document.querySelector('#scroll-down-container')) {
            document.body.appendChild(scrollDownContainer);
        }
    }

    // ===================== 全屏时钟功能（带清理） =====================
    function createClock() {
        // 时钟容器
        const clockContainer = document.createElement('div');
        clockContainer.id = 'fullscreen-clock';
        clockContainer.style.cssText = `
            position: fixed; top: 75px; right: 55px;
            width: 80px; height: 80px; z-index: 9997;
            display: none; cursor: move;
            transition: all 0.3s ease;
        `;

        // 时钟表盘
        const clockFace = document.createElement('div');
        clockFace.className = 'clock-face';
        clockFace.style.cssText = `
            position: relative; width: 100%; height: 100%;
            border-radius: 50%; 
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            border: 2px solid #1a252f;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3), inset 0 0 20px rgba(0,0,0,0.1);
        `;

        // 创建小时刻度线（12个）
        for (let i = 0; i < 12; i++) {
            const tick = document.createElement('div');
            const angle = (i * 30 - 90) * (Math.PI / 180);
            const isMainTick = i % 3 === 0; // 每3小时一个主刻度
            const length = isMainTick ? 6 : 3;
            const width = isMainTick ? 2 : 1;
            const x1 = 50 + 35 * Math.cos(angle);
            const y1 = 50 + 35 * Math.sin(angle);
            const x2 = 50 + (35 - length) * Math.cos(angle);
            const y2 = 50 + (35 - length) * Math.sin(angle);
            
            tick.style.cssText = `
                position: absolute; left: ${x1}%; top: ${y1}%;
                width: ${width}px; height: ${length}px;
                background: rgba(255,255,255,0.8);
                transform-origin: 0 0;
                transform: translate(-50%, -50%) rotate(${i * 30}deg);
                border-radius: 1px;
            `;
            clockFace.appendChild(tick);
        }

        // 创建 12 个数字刻度（往外扩，更靠近边缘）
        const numbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        numbers.forEach((num, index) => {
            const number = document.createElement('span');
            number.className = 'number';
            number.textContent = num;
            const angle = (index * 30 - 90) * (Math.PI / 180); // 转换为弧度
            const radius = 38; // 距离中心的距离（从30增加到38，更靠近边缘）
            const x = 50 + radius * Math.cos(angle); // 50% 是中心点
            const y = 50 + radius * Math.sin(angle);
            number.style.cssText = `
                position: absolute; left: ${x}%; top: ${y}%;
                transform: translate(-50%, -50%);
                color: #ffffff; font-size: 11px; font-weight: 600;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-shadow: 0 1px 3px rgba(0,0,0,0.5);
            `;
            clockFace.appendChild(number);
        });

        // 时针（更优雅的设计）
        const hourHand = document.createElement('div');
        hourHand.className = 'hand hour-hand';
        hourHand.style.cssText = `
            position: absolute; left: 50%; top: 50%;
            width: 2.5px; height: 18px;
            background: linear-gradient(to top, #ffffff 0%, rgba(255,255,255,0.8) 100%);
            border-radius: 2px 2px 0 0;
            transform-origin: bottom center;
            transform: translate(-50%, -100%) rotate(0deg);
            z-index: 3;
            box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        `;

        // 分针（更细长）
        const minuteHand = document.createElement('div');
        minuteHand.className = 'hand minute-hand';
        minuteHand.style.cssText = `
            position: absolute; left: 50%; top: 50%;
            width: 1.5px; height: 26px;
            background: linear-gradient(to top, #ffffff 0%, rgba(255,255,255,0.8) 100%);
            border-radius: 1px 1px 0 0;
            transform-origin: bottom center;
            transform: translate(-50%, -100%) rotate(0deg);
            z-index: 2;
            box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        `;

        // 秒针（红色，更细）
        const secondHand = document.createElement('div');
        secondHand.className = 'hand second-hand';
        secondHand.style.cssText = `
            position: absolute; left: 50%; top: 50%;
            width: 0.8px; height: 30px;
            background: #ff4757;
            border-radius: 0.5px;
            transform-origin: bottom center;
            transform: translate(-50%, -100%) rotate(0deg);
            z-index: 1;
            box-shadow: 0 0 2px rgba(255,71,87,0.6);
        `;

        // 中心点（更精致）
        const centerDot = document.createElement('div');
        centerDot.style.cssText = `
            position: absolute; left: 50%; top: 50%;
            width: 6px; height: 6px;
            background: #ffffff;
            border: 2px solid #ff4757;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            z-index: 5;
            box-shadow: 0 0 4px rgba(0,0,0,0.3);
        `;

        // 组装时钟
        clockFace.appendChild(hourHand);
        clockFace.appendChild(minuteHand);
        clockFace.appendChild(secondHand);
        clockFace.appendChild(centerDot);
        clockContainer.appendChild(clockFace);

        // 状态管理
        let isDraggingClock = false;
        let clockOffsetX, clockOffsetY;
        let isSnapped = false;
        let snapEdge = null; // 'left' | 'right' | 'top' | 'bottom' | null
        let isHovering = false;

        // 拖动功能
        const clockMouseDown = (e) => {
            // 如果点击的是指针，不触发拖动
            if (e.target.classList.contains('hand')) {
                return;
            }
            isDraggingClock = true;
            const rect = clockContainer.getBoundingClientRect();
            clockOffsetX = e.clientX - rect.left;
            clockOffsetY = e.clientY - rect.top;
            clockContainer.style.cursor = 'grabbing';
            clockContainer.style.transition = 'none'; // 拖动时禁用过渡
            clockContainer.style.opacity = '0.8';
            isSnapped = false; // 拖动时取消吸附状态
            snapEdge = null;
            e.preventDefault();
        };

        const clockMouseMove = (e) => {
            if (!isDraggingClock) {
                // 悬停检测（仅在非拖动状态下）
                if (isSnapped && snapEdge) {
                    const rect = clockContainer.getBoundingClientRect();
                    const mouseX = e.clientX;
                    const mouseY = e.clientY;
                    const hoverThreshold = 30; // 悬停触发距离
                    let shouldHover = false;

                    // 根据吸附边缘检测鼠标是否靠近
                    if (snapEdge === 'left') {
                        // 吸附在左边缘，检查鼠标是否在右边缘附近
                        shouldHover = mouseX >= rect.left && mouseX <= rect.right + hoverThreshold && 
                                     mouseY >= rect.top && mouseY <= rect.bottom;
                    } else if (snapEdge === 'right') {
                        // 吸附在右边缘，检查鼠标是否在左边缘附近
                        shouldHover = mouseX <= rect.right && mouseX >= rect.left - hoverThreshold && 
                                     mouseY >= rect.top && mouseY <= rect.bottom;
                    } else if (snapEdge === 'top') {
                        // 吸附在上边缘，检查鼠标是否在下边缘附近
                        shouldHover = mouseY >= rect.top && mouseY <= rect.bottom + hoverThreshold && 
                                     mouseX >= rect.left && mouseX <= rect.right;
                    } else if (snapEdge === 'bottom') {
                        // 吸附在下边缘，检查鼠标是否在上边缘附近
                        shouldHover = mouseY <= rect.bottom && mouseY >= rect.top - hoverThreshold && 
                                     mouseX >= rect.left && mouseX <= rect.right;
                    }

                    if (shouldHover && !isHovering) {
                        isHovering = true;
                        clockContainer.style.transition = 'all 0.3s ease';
                        if (snapEdge === 'left') {
                            clockContainer.style.left = '0';
                            clockContainer.style.right = 'auto';
                        } else if (snapEdge === 'right') {
                            clockContainer.style.right = '0';
                            clockContainer.style.left = 'auto';
                        } else if (snapEdge === 'top') {
                            clockContainer.style.top = '0';
                            clockContainer.style.bottom = 'auto';
                        } else if (snapEdge === 'bottom') {
                            clockContainer.style.bottom = '0';
                            clockContainer.style.top = 'auto';
                        }
                    } else if (!shouldHover && isHovering) {
                        isHovering = false;
                        clockContainer.style.transition = 'all 0.3s ease';
                        // 恢复吸附状态
                        const clockWidth = clockContainer.offsetWidth;
                        const clockHeight = clockContainer.offsetHeight;
                        const snapOffset = clockWidth * 0.75; // 隐藏3/4
                        if (snapEdge === 'left') {
                            clockContainer.style.left = `-${snapOffset}px`;
                            clockContainer.style.right = 'auto';
                        } else if (snapEdge === 'right') {
                            clockContainer.style.right = `-${snapOffset}px`;
                            clockContainer.style.left = 'auto';
                        } else if (snapEdge === 'top') {
                            clockContainer.style.top = `-${snapOffset}px`;
                            clockContainer.style.bottom = 'auto';
                        } else if (snapEdge === 'bottom') {
                            clockContainer.style.bottom = `-${snapOffset}px`;
                            clockContainer.style.top = 'auto';
                        }
                    }
                }
                return;
            }

            // 拖动逻辑
            const newLeft = e.clientX - clockOffsetX;
            const newTop = e.clientY - clockOffsetY;
            const maxLeft = window.innerWidth - clockContainer.offsetWidth;
            const maxTop = window.innerHeight - clockContainer.offsetHeight;
            const finalLeft = Math.max(0, Math.min(maxLeft, newLeft));
            const finalTop = Math.max(0, Math.min(maxTop, newTop));
            clockContainer.style.left = `${finalLeft}px`;
            clockContainer.style.top = `${finalTop}px`;
            clockContainer.style.right = 'auto';
            clockContainer.style.bottom = 'auto';
        };

        const clockMouseUp = () => {
            if (isDraggingClock) {
                isDraggingClock = false;
                clockContainer.style.cursor = 'move';
                clockContainer.style.opacity = '1';
                clockContainer.style.transition = 'all 0.3s ease'; // 恢复过渡

                // 边缘吸附逻辑
                const rect = clockContainer.getBoundingClientRect();
                const clockWidth = clockContainer.offsetWidth;
                const clockHeight = clockContainer.offsetHeight;
                const snapThreshold = 30; // 吸附阈值
                const snapOffset = clockWidth * 0.75; // 隐藏3/4，露出1/4

                // 检查是否靠近左边缘
                if (rect.left < snapThreshold) {
                    isSnapped = true;
                    snapEdge = 'left';
                    clockContainer.style.left = `-${snapOffset}px`;
                    clockContainer.style.right = 'auto';
                    clockContainer.style.top = `${rect.top}px`;
                    clockContainer.style.bottom = 'auto';
                }
                // 检查是否靠近右边缘
                else if (rect.right > window.innerWidth - snapThreshold) {
                    isSnapped = true;
                    snapEdge = 'right';
                    clockContainer.style.right = `-${snapOffset}px`;
                    clockContainer.style.left = 'auto';
                    clockContainer.style.top = `${rect.top}px`;
                    clockContainer.style.bottom = 'auto';
                }
                // 检查是否靠近上边缘
                else if (rect.top < snapThreshold) {
                    isSnapped = true;
                    snapEdge = 'top';
                    clockContainer.style.top = `-${snapOffset}px`;
                    clockContainer.style.bottom = 'auto';
                    clockContainer.style.left = `${rect.left}px`;
                    clockContainer.style.right = 'auto';
                }
                // 检查是否靠近下边缘
                else if (rect.bottom > window.innerHeight - snapThreshold) {
                    isSnapped = true;
                    snapEdge = 'bottom';
                    clockContainer.style.bottom = `-${snapOffset}px`;
                    clockContainer.style.top = 'auto';
                    clockContainer.style.left = `${rect.left}px`;
                    clockContainer.style.right = 'auto';
                } else {
                    // 不在边缘，取消吸附状态
                    isSnapped = false;
                    snapEdge = null;
                    isHovering = false;
                }
            }
        };

        // 绑定拖动事件并存储
        clockContainer.addEventListener('mousedown', clockMouseDown);
        document.addEventListener('mousemove', clockMouseMove);
        document.addEventListener('mouseup', clockMouseUp);
        resources.eventListeners.push({ element: clockContainer, type: 'mousedown', handler: clockMouseDown });
        resources.eventListeners.push({ element: document, type: 'mousemove', handler: clockMouseMove });
        resources.eventListeners.push({ element: document, type: 'mouseup', handler: clockMouseUp });

        // 添加到页面
        document.body.appendChild(clockContainer);
        resources.elements.push(clockContainer);

        return clockContainer;
    }

    // 更新时钟指针
    function updateClock() {
        const clockContainer = document.querySelector('#fullscreen-clock');
        if (!clockContainer || clockContainer.style.display === 'none') return;

        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        // 计算角度（从12点方向开始，顺时针）
        const secondAngle = (seconds / 60) * 360;
        const minuteAngle = (minutes / 60) * 360 + (seconds / 60) * 6;
        const hourAngle = ((hours % 12) / 12) * 360 + (minutes / 60) * 30;

        // 更新指针
        const hourHand = clockContainer.querySelector('.hour-hand');
        const minuteHand = clockContainer.querySelector('.minute-hand');
        const secondHand = clockContainer.querySelector('.second-hand');

        if (hourHand) hourHand.style.transform = `translate(-50%, -100%) rotate(${hourAngle}deg)`;
        if (minuteHand) minuteHand.style.transform = `translate(-50%, -100%) rotate(${minuteAngle}deg)`;
        if (secondHand) secondHand.style.transform = `translate(-50%, -100%) rotate(${secondAngle}deg)`;
    }

    // 显示时钟并启动更新
    function showClock() {
        let clockContainer = document.querySelector('#fullscreen-clock');
        if (!clockContainer) {
            clockContainer = createClock();
        }
        clockContainer.style.display = 'block';
        updateClock(); // 立即更新一次
        // 启动定时器
        if (resources.clockTimer) {
            clearInterval(resources.clockTimer);
        }
        resources.clockTimer = setInterval(updateClock, 1000);
    }

    // 隐藏时钟并停止更新
    function hideClock() {
        const clockContainer = document.querySelector('#fullscreen-clock');
        if (clockContainer) {
            clockContainer.style.display = 'none';
        }
        if (resources.clockTimer) {
            clearInterval(resources.clockTimer);
            resources.clockTimer = null;
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
        let isPenToolActive = false;
        let isPenToolVisible = true; // 新增：控制工具是否可见，默认显示
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

        // fullscreenchange事件
        const fullscreenResize = () => {
            resizeCanvas();
            // 处理时钟显示/隐藏和按钮文本更新
            const isFull = document.fullscreenElement;
            const fullscreenBtn = document.querySelector('#custom-fullscreen-btn');
            if (isFull) {
                showClock();
                if (fullscreenBtn) fullscreenBtn.innerText = '退出';
            } else {
                hideClock();
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
            position: fixed; right: 65px; top: 160px;
            width: 50px; height: 50px; border-radius: 50%; overflow: visible;
            z-index: 9999; transition: none; user-select: none;
            display: block;
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
        eraserBtn.innerHTML = '🧽 橡皮擦';
        eraserBtn.id = 'eraser-btn';

        // 撤销按钮 - 蓝色系（直观表示返回操作）
        const undoBtn = document.createElement('button');
        undoBtn.style.cssText = buttonStyle + `
            background: #e6f2ff;
            color: #0066cc;
        `;
        undoBtn.innerHTML = '↩ 撤销';
        undoBtn.id = 'undo-btn';

        // 组装子按钮容器
        subButtonsContainer.append(eraserBtn, undoBtn);

        // 光标定义
        const penCursorUrl = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyOCcgaGVpZ2h0PScyOCcgdmlld0JveD0nMCAwIDI4IDI4Jz48cGF0aCBkPSdNMTkuOCAyLjJjLjYtLjYgMS42LS42IDIuMiAwbDMuOCAzLjhjLjYuNi42IDEuNiAwIDIuMkwxMSAyM2wtNiAxLjggMS44LTUuOCAxMy0xNi44eicgZmlsbD0nIzU1NTU1NScvPjxwYXRoIGQ9J00xOC42IDMuNGw0IDQnIHN0cm9rZT0nI2ZmZicgc3Ryb2tlLXdpZHRoPScxLjInIG9wYWNpdHk9Jy42Jy8+PC9zdmc+") 4 24, auto';
        // 橡皮擦光标：圆形虚线框（半径10px，直径30px）
        const eraserCursorUrl = 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTUiIGN5PSIxNSIgcj0iMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzU1NSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSIzLDMiLz48L3N2Zz4=") 15 15, auto';

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
        clearBtn.style.cssText = `
            width: 100px; height: 60px; border: none; border-radius: 12px;
            font-size: 14px; font-weight: 500; cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex; align-items: center; justify-content: center;
            gap: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            background: #fff2e6;
            color: #ff6600;
        `;
        clearBtn.innerHTML = '🗑️ 清屏';
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

        // 关闭画布按钮（X按钮） - 红色系（直观表示关闭操作）
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = buttonStyle + `
            background: #ffe6e6;
            color: #cc0000;
        `;
        closeBtn.innerHTML = '❌ 关闭';
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
        
        // 初始状态：默认显示面板
        drawCtrlPanel.style.display = 'block';
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

        // 键盘快捷键：Ctrl+Shift+D（避免抖音监控的键）
        const handleKeyPress = (e) => {
            // 检查是否按下了Ctrl+Shift+D
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                toggleToolVisibility();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
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

        // 1. 清除定时器
        if (resources.timer) {
            clearInterval(resources.timer);
            resources.timer = null;
            console.log('已清除自动收起定时器');
        }
        if (resources.clockTimer) {
            clearInterval(resources.clockTimer);
            resources.clockTimer = null;
            console.log('已清除时钟更新定时器');
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
        createClock(); // 创建时钟元素（初始隐藏）
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