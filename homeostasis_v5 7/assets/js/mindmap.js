/* ============================================
   稳态之下 思维导图 MindMap v2
   中心向两边延伸 · 可展开折叠 · 全页面拖拽缩放
   ============================================ */

(function() {
  const data = window.__MINDMAP_DATA__;
  if (!data) return;

  const page = document.querySelector('.mindmap-page');
  const canvas = document.getElementById('mindmap-canvas');
  const svg = document.getElementById('mindmap-svg');
  if (!page || !canvas || !svg) return;

  // 节点高度配置
  const NODE_H = { root: 56, level1: 46, level2: 38, level3: 32 };
  const NODE_PAD_X = 36; // 左右padding总和
  const TOGGLE_W = 24; // 展开按钮宽度+间距
  const H_GAP = [240, 210, 190]; // 层级间水平间距
  const V_GAP = 68; // 叶子节点垂直间距（确保节点边缘间有足够间隙）
  const MIN_W = { root: 140, level1: 120, level2: 100, level3: 90 };
  const MAX_W = { root: 220, level1: 260, level2: 280, level3: 260 };

  let scale = 1;
  let panX = 0, panY = 0;
  let isDragging = false;
  let dragMoved = false;
  let dragStartX = 0, dragStartY = 0;
  let panStartX = 0, panStartY = 0;
  let nodePositions = {};
  let expandedSet = new Set();

  // 估算文字宽度
  function estimateTextWidth(text, fontSize) {
    let w = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      if (ch > 0x4e00 && ch < 0x9fff) {
        w += fontSize; // 中文
      } else if (ch > 0xff00 || ch === 0x3000) {
        w += fontSize; // 全角字符
      } else {
        w += fontSize * 0.58; // 英文/数字/半角
      }
    }
    return w;
  }

  // 计算节点宽度（根据文字自适应）
  function calcNodeWidth(node) {
    const level = node._level;
    const key = level === 0 ? 'root' : 'level' + level;
    const fontSize = { root: 20, level1: 15.5, level2: 13.5, level3: 12.5 }[key] || 12.5;
    const hasToggle = node.children && node.children.length > 0;
    // 宽度完全自适应文字，不设最大宽度限制，确保文字完整显示
    let w = estimateTextWidth(node.name, fontSize) + NODE_PAD_X + (hasToggle ? TOGGLE_W : 0);
    w = Math.max(MIN_W[key] || 90, w);
    return Math.round(w);
  }

  // 给每个节点分配唯一id
  let idCounter = 0;
  function assignIds(node, level = 0) {
    node._id = 'n' + (idCounter++);
    node._level = level;
    node._w = calcNodeWidth(node);
    if (node.children) {
      node.children.forEach(c => assignIds(c, level + 1));
    }
  }
  assignIds(data);

  // 默认展开根节点和一级节点
  expandedSet.add(data._id);
  if (data.children) {
    data.children.forEach(c => expandedSet.add(c._id));
  }

  // 计算子树叶子数量
  function countLeaves(node) {
    if (!node.children || node.children.length === 0 || !expandedSet.has(node._id)) {
      return 1;
    }
    return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
  }

  // 确定方向（左右分布）
  function assignDirections(node) {
    if (!node.children) return;
    const total = node.children.length;
    const mid = Math.ceil(total / 2);
    node.children.forEach((child, i) => {
      child._direction = (node._level === 0) ? (i < mid ? 'left' : 'right') : node._direction;
      assignDirections(child);
    });
  }
  assignDirections(data);

  // 布局计算
  function layout() {
    nodePositions = {};
    const rootW = data._w, rootH = NODE_H.root;
    nodePositions[data._id] = { x: -rootW / 2, y: -rootH / 2, w: rootW, h: rootH, direction: 'center' };

    if (!data.children) return;

    const leftChildren = data.children.filter(c => c._direction === 'left');
    const rightChildren = data.children.filter(c => c._direction === 'right');

    function layoutNode(node, direction, level, centerY) {
      const key = 'level' + level;
      const w = node._w;
      const h = NODE_H[key] || NODE_H.level3;
      const parentPos = nodePositions[node.parentId || data._id];
      const xOffset = H_GAP[level - 1] || 160;

      let x = (direction === 'right')
        ? (parentPos.x + parentPos.w) + xOffset
        : parentPos.x - xOffset - w;

      nodePositions[node._id] = { x, y: centerY - h / 2, w, h, direction };

      if (node.children && expandedSet.has(node._id)) {
        const totalLeaves = node.children.reduce((sum, c) => sum + countLeaves(c), 0);
        const totalHeight = totalLeaves * V_GAP;
        let currentY = centerY - totalHeight / 2;
        node.children.forEach(child => {
          child.parentId = node._id;
          const childLeaves = countLeaves(child);
          const childHeight = childLeaves * V_GAP;
          layoutNode(child, direction, level + 1, currentY + childHeight / 2);
          currentY += childHeight;
        });
      }
    }

    function layoutBranch(children, direction) {
      if (children.length === 0) return;
      const totalLeaves = children.reduce((sum, c) => sum + countLeaves(c), 0);
      const totalHeight = totalLeaves * V_GAP;
      let currentY = -totalHeight / 2;
      children.forEach(child => {
        child.parentId = data._id;
        const childLeaves = countLeaves(child);
        const childHeight = childLeaves * V_GAP;
        layoutNode(child, direction, 1, currentY + childHeight / 2);
        currentY += childHeight;
      });
    }

    layoutBranch(leftChildren, 'left');
    layoutBranch(rightChildren, 'right');
  }

  // 渲染节点
  function renderNodes() {
    canvas.querySelectorAll('.mindmap-node').forEach(el => el.remove());

    function renderNode(node) {
      const pos = nodePositions[node._id];
      if (!pos) return;

      const levelClass = node._level === 0 ? 'root' : 'level' + node._level;
      const expanded = expandedSet.has(node._id);
      const hasChildren = node.children && node.children.length > 0;

      const el = document.createElement('div');
      el.className = `mindmap-node ${levelClass} mindmap-node-enter` + (expanded ? ' expanded' : '');
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      el.style.width = pos.w + 'px';
      el.dataset.id = node._id;

      // 根节点不显示toggle按钮，始终展开，文字居中
      if (hasChildren && node._level > 0) {
        const toggle = document.createElement('span');
        toggle.className = 'mindmap-toggle';
        toggle.textContent = expanded ? '−' : '+';
        el.appendChild(toggle);
      }

      const label = document.createElement('span');
      label.className = 'mindmap-node-label';
      label.style.whiteSpace = 'nowrap';
      label.textContent = node.name;
      el.appendChild(label);

      // 单击展开/折叠（拖拽后不触发，根节点不触发）
      el.addEventListener('click', (e) => {
        if (dragMoved) { e.stopPropagation(); return; }
        e.stopPropagation();
        if (!hasChildren || node._level === 0) return;
        if (expandedSet.has(node._id)) expandedSet.delete(node._id);
        else expandedSet.add(node._id);
        render();
      });

      // 双击居中
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        centerOnNode(node);
      });

      canvas.appendChild(el);
      if (node.children && expandedSet.has(node._id)) {
        node.children.forEach(c => renderNode(c));
      }
    }

    renderNode(data);
  }

  // 渲染连线
  function renderLinks() {
    svg.innerHTML = '';
    function drawLinks(node) {
      if (!expandedSet.has(node._id) || !node.children) return;
      const parentPos = nodePositions[node._id];
      if (!parentPos) return;
      node.children.forEach(child => {
        const childPos = nodePositions[child._id];
        if (!childPos) return;
        const direction = childPos.direction;
        const x1 = direction === 'right' ? parentPos.x + parentPos.w : parentPos.x;
        const y1 = parentPos.y + parentPos.h / 2;
        const x2 = direction === 'right' ? childPos.x : childPos.x + childPos.w;
        const y2 = childPos.y + childPos.h / 2;
        const midX = (x1 + x2) / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
        path.style.strokeDasharray = '3000';
        path.style.strokeDashoffset = '1200';
        path.style.animation = 'drawLine 0.4s ease forwards';
        svg.appendChild(path);
        drawLinks(child);
      });
    }
    drawLinks(data);
  }

  // 连线动画
  if (!document.getElementById('mindmap-line-style')) {
    const style = document.createElement('style');
    style.id = 'mindmap-line-style';
    style.textContent = '@keyframes drawLine { to { stroke-dashoffset: 0; } }';
    document.head.appendChild(style);
  }

  // 应用变换
  function applyTransform() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    const info = document.getElementById('mindmap-zoom-info');
    if (info) info.textContent = Math.round(scale * 100) + '%';
  }

  // 居中视图
  function centerView() {
    const rect = page.getBoundingClientRect();
    panX = rect.width / 2;
    panY = rect.height / 2;
    scale = 1;
    applyTransform();
  }

  // 居中到指定节点
  function centerOnNode(node) {
    const pos = nodePositions[node._id];
    if (!pos) return;
    const rect = page.getBoundingClientRect();
    const nodeCenterX = pos.x + pos.w / 2;
    const nodeCenterY = pos.y + pos.h / 2;
    panX = rect.width / 2 - nodeCenterX * scale;
    panY = rect.height / 2 - nodeCenterY * scale;
    applyTransform();
  }

  // 完整渲染
  function render() {
    layout();
    renderNodes();
    renderLinks();
  }

  // ========== 全页面拖拽（绑定在page上，不是canvas上） ==========
  page.addEventListener('mousedown', (e) => {
    // 忽略在工具栏、图例、提示框上的点击
    if (e.target.closest('.mindmap-toolbar') ||
        e.target.closest('.mindmap-legend') ||
        e.target.closest('.mindmap-hint')) return;

    isDragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
    page.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragMoved = true;
    }
    if (dragMoved) {
      panX = panStartX + dx;
      panY = panStartY + dy;
      applyTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      page.style.cursor = '';
      // 延迟重置dragMoved，让click事件能感知到拖拽
      setTimeout(() => { dragMoved = false; }, 50);
    }
  });

  // 离开页面时停止拖拽
  document.addEventListener('mouseleave', () => {
    isDragging = false;
    page.style.cursor = '';
  });

  // ========== 全页面滚轮缩放（绑定在page上） ==========
  page.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.max(0.25, Math.min(3, scale * delta));
    const rect = page.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    panX = mx - (mx - panX) * (newScale / scale);
    panY = my - (my - panY) * (newScale / scale);
    scale = newScale;
    applyTransform();
  }, { passive: false });

  // 阻止Ctrl+滚轮触发浏览器缩放
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  }, { passive: false });

  // ========== 工具栏 ==========
  document.getElementById('mindmap-zoom-in')?.addEventListener('click', () => {
    scale = Math.min(3, scale * 1.2);
    applyTransform();
  });
  document.getElementById('mindmap-zoom-out')?.addEventListener('click', () => {
    scale = Math.max(0.25, scale / 1.2);
    applyTransform();
  });
  document.getElementById('mindmap-center')?.addEventListener('click', centerView);

  document.getElementById('mindmap-expand-all')?.addEventListener('click', () => {
    function expandAll(node) {
      expandedSet.add(node._id);
      if (node.children) node.children.forEach(expandAll);
    }
    expandAll(data);
    render();
  });

  document.getElementById('mindmap-collapse-all')?.addEventListener('click', () => {
    expandedSet.clear();
    expandedSet.add(data._id);
    if (data.children) data.children.forEach(c => expandedSet.add(c._id));
    render();
  });

  // ========== 触摸支持 ==========
  let touchStartDist = 0;
  let touchStartScale = 1;

  page.addEventListener('touchstart', (e) => {
    if (e.target.closest('.mindmap-toolbar') ||
        e.target.closest('.mindmap-legend') ||
        e.target.closest('.mindmap-hint')) return;
    if (e.touches.length === 1) {
      isDragging = true;
      dragMoved = false;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      panStartX = panX;
      panStartY = panY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDist = Math.sqrt(dx * dx + dy * dy);
      touchStartScale = scale;
    }
  }, { passive: true });

  page.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartX;
      const dy = e.touches[0].clientY - dragStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
      if (dragMoved) {
        panX = panStartX + dx;
        panY = panStartY + dy;
        applyTransform();
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      scale = Math.max(0.25, Math.min(3, touchStartScale * (dist / touchStartDist)));
      applyTransform();
    }
  }, { passive: true });

  page.addEventListener('touchend', () => {
    isDragging = false;
    setTimeout(() => { dragMoved = false; }, 50);
  });

  // 初始化
  render();
  setTimeout(centerView, 100);

})();
