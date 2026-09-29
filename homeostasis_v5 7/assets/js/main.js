/* ============================================
   稳态之下 Beneath Homeostasis v5
   交互脚本：明暗切换 + TOC只显示当前章
   ============================================ */

// ============ 主题切换 ============
(function() {
  const toggle = document.getElementById('theme-toggle');
  const html = document.documentElement;

  // 初始化主题（优先localStorage，否则跟随系统）
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    html.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    html.setAttribute('data-theme', 'dark');
  }

  function updateToggleIcon() {
    if (!toggle) return;
    const isDark = html.getAttribute('data-theme') === 'dark';
    toggle.innerHTML = isDark
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  updateToggleIcon();

  if (toggle) {
    toggle.addEventListener('click', () => {
      const isDark = html.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateToggleIcon();
    });
  }
})();

// ============ 阅读进度条 + 回到顶部 ============
(function() {
  const bar = document.getElementById('progress-bar');
  const btt = document.getElementById('back-to-top');

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (bar) bar.style.width = progress + '%';
    if (btt) {
      if (scrollTop > 400) btt.classList.add('visible');
      else btt.classList.remove('visible');
    }
  });

  if (btt) {
    btt.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();

// ============ 左侧导航树 ============
(function() {
  const groups = document.querySelectorAll('.nav-group');
  const chapterLinks = document.querySelectorAll('.nav-chapter');
  if (groups.length === 0) return;

  groups.forEach(group => {
    const header = group.querySelector('.nav-volume-header');
    if (!header) return;
    header.addEventListener('click', () => {
      group.classList.toggle('open');
    });
  });

  chapterLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      chapterLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const group = link.closest('.nav-group');
      if (group) group.classList.add('open');
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('active');
    });
  });

  // 滚动跟随
  let scrollTimeout = null;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const headings = document.querySelectorAll('.doc-content-inner h1[id], .doc-content-inner h2[id]');
      let currentId = null;
      for (const heading of headings) {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 100) {
          currentId = heading.id;
        }
      }
      if (currentId) {
        chapterLinks.forEach(l => {
          if (l.dataset.target === currentId) {
            l.classList.add('active');
            const group = l.closest('.nav-group');
            if (group) group.classList.add('open');
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
              const linkRect = l.getBoundingClientRect();
              const sidebarRect = sidebar.getBoundingClientRect();
              if (linkRect.top < sidebarRect.top + 50 || linkRect.bottom > sidebarRect.bottom - 10) {
                l.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }
            }
          } else {
            l.classList.remove('active');
          }
        });
      }
    }, 80);
  });
})();

// ============ 右侧TOC（只显示当前章） ============
(function() {
  const tocGroups = document.querySelectorAll('.toc-chapter-group');
  const tocLinks = document.querySelectorAll('.toc-link');
  if (tocGroups.length === 0) return;

  // 点击TOC链接跳转
  tocLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // 滚动时：检测当前章，只显示该章的TOC组；同时高亮当前小节
  let tocTimeout = null;
  window.addEventListener('scroll', () => {
    clearTimeout(tocTimeout);
    tocTimeout = setTimeout(() => {
      // 获取所有h2（章标题）
      const h2s = document.querySelectorAll('.doc-content-inner h2[id]');
      let currentChapterId = null;
      for (const h2 of h2s) {
        const rect = h2.getBoundingClientRect();
        if (rect.top <= 120) {
          currentChapterId = h2.id;
        }
      }

      // 只显示当前章的TOC组
      if (currentChapterId) {
        tocGroups.forEach(group => {
          if (group.dataset.chapter === currentChapterId) {
            group.classList.add('active');
          } else {
            group.classList.remove('active');
          }
        });
      }

      // 高亮当前小节
      const visibleGroup = document.querySelector('.toc-chapter-group.active');
      if (visibleGroup) {
        const groupLinks = visibleGroup.querySelectorAll('.toc-link');
        let currentSubId = null;
        for (const link of groupLinks) {
          const el = document.getElementById(link.dataset.target);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.top <= 140) {
            currentSubId = link.dataset.target;
          }
        }
        groupLinks.forEach(l => {
          if (l.dataset.target === currentSubId) {
            l.classList.add('active');
          } else {
            l.classList.remove('active');
          }
        });
      }
    }, 80);
  });
})();

// ============ 全局搜索 ============
(function() {
  const searchInput = document.getElementById('topbar-search-input');
  const searchModal = document.getElementById('search-modal');
  const modalInput = document.getElementById('search-modal-input');
  const modalClose = document.getElementById('search-modal-close');
  const resultsContainer = document.getElementById('search-results-list');

  if (!searchModal) return;

  const searchData = window.__SEARCH_DATA__ || [];

  function openModal() {
    searchModal.classList.add('active');
    setTimeout(() => modalInput && modalInput.focus(), 100);
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    searchModal.classList.remove('active');
    document.body.style.overflow = '';
    if (modalInput) modalInput.value = '';
    if (resultsContainer) resultsContainer.innerHTML = '<div class="search-no-results">输入关键词搜索全部内容</div>';
  }

  if (searchInput) {
    searchInput.addEventListener('focus', openModal);
    searchInput.addEventListener('click', openModal);
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);

  searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchModal.classList.contains('active')) closeModal();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openModal();
    }
  });

  let searchTimeout = null;
  if (modalInput) {
    modalInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim().toLowerCase();
      if (query.length < 2) {
        resultsContainer.innerHTML = '<div class="search-no-results">输入至少2个字符开始搜索</div>';
        return;
      }
      searchTimeout = setTimeout(() => doSearch(query), 200);
    });
  }

  function doSearch(query) {
    const results = [];

    searchData.forEach(item => {
      if (item.title.toLowerCase().includes(query)) {
        results.push({
          vol: item.vol,
          title: item.title,
          snippet: item.summary || '',
          targetId: item.targetId
        });
      }

      if (item.contentText) {
        const text = item.contentText;
        const idx = text.toLowerCase().indexOf(query);
        if (idx >= 0) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + query.length + 80);
          let snippet = text.substring(start, end);
          if (start > 0) snippet = '...' + snippet;
          if (end < text.length) snippet = snippet + '...';
          const highlighted = snippet.replace(new RegExp(query, 'gi'), m => '<mark>' + m + '</mark>');

          results.push({
            vol: item.vol,
            title: item.title,
            snippet: highlighted,
            targetId: item.targetId
          });
        }
      }
    });

    const unique = [];
    const seen = new Set();
    results.forEach(r => {
      const key = r.targetId + '-' + r.snippet.substring(0, 30);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
    });

    if (unique.length === 0) {
      resultsContainer.innerHTML = '<div class="search-no-results">没有找到与 "' + query + '" 相关的内容</div>';
      return;
    }

    resultsContainer.innerHTML = unique.slice(0, 50).map(r => `
      <div class="search-result-item" data-target="${r.targetId}">
        <div class="search-result-vol">${r.vol}</div>
        <div class="search-result-title">${r.title}</div>
        <div class="search-result-snippet">${r.snippet}</div>
      </div>
    `).join('');

    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const target = item.dataset.target;
        closeModal();
        if (!document.querySelector('.doc-content')) {
          window.location.href = 'doc.html#' + target;
        } else {
          const el = document.getElementById(target);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }
})();

// ============ 移动端菜单 ============
(function() {
  const btn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!btn || !sidebar) return;

  btn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('active');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
})();

// ============ 打字机效果 ============
(function() {
  const el = document.getElementById('typewriter-text');
  if (!el) return;
  const text = '从神经回路到文明秩序的底层法则';
  let i = 0;
  function type() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(type, 120);
    }
  }
  setTimeout(type, 600);
})();

// ============ 初始化 ============
(function() {
  const firstGroup = document.querySelector('.nav-group');
  if (firstGroup) firstGroup.classList.add('open');

  // 页面加载后主动触发一次滚动事件，让TOC立即显示当前章内容
  setTimeout(() => {
    window.dispatchEvent(new Event('scroll'));
  }, 100);

  if (window.location.hash) {
    const targetId = window.location.hash.substring(1);
    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }
})();
