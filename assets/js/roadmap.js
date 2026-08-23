(function () {
    const FILE = './assets/data/roadmap.json?v=20260818-search-fetch-update-2';
    const state = {
        data: null,
        lang: 'zh-CN',
        activeTop: 'roadmap',
        projectView: 'now',
        roadmapView: 'branches',
        activeBranch: 0
    };
    let activeArchiveItem = null;
    let archiveDocumentRequestId = 0;

    function ui(key, fallback) {
        return typeof I18N !== 'undefined' && I18N.t ? I18N.t(key, fallback) : (fallback || key);
    }

    function formatUi(key, values, fallback) {
        let text = ui(key, fallback);
        Object.entries(values || {}).forEach(([name, value]) => {
            text = text.replace(new RegExp('\\{' + name + '\\}', 'g'), String(value));
        });
        return text;
    }

    function resolveLang(obj) {
        if (typeof obj === 'string') return obj;
        if (!obj || typeof obj !== 'object') return '';
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null;
        const lang = (typeof I18N !== 'undefined' && I18N.state && I18N.state.lang) || stored || state.lang || 'en-US';
        state.lang = lang;
        if (obj[lang]) return obj[lang];
        if (lang.startsWith('en') && obj['en-US']) return obj['en-US'];
        if (lang.startsWith('zh') && obj['zh-CN']) return obj['zh-CN'];
        if (lang.startsWith('ja') && obj['ja-JP']) return obj['ja-JP'];
        return Object.values(obj)[0] || '';
    }

    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function getContentChain() {
        const lang = state.lang || 'en-US';
        if (lang.startsWith('zh')) return ['cn', 'en', 'jp'];
        if (lang.startsWith('ja')) return ['jp', 'en', 'cn'];
        return ['en', 'cn', 'jp'];
    }

    function resolveContentPath(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        const chain = getContentChain();
        for (const key of chain) {
            if (content[key]) return content[key];
        }
        return Object.values(content).find(Boolean) || '';
    }

    function isDone(item) {
        return String(item && item.status || '').toLowerCase() === 'done';
    }

    function isAborted(item) {
        return String(item && item.status || '').toLowerCase() === 'aborted';
    }

    function getStatusLabel(item) {
        if (isDone(item)) return ui('status.completed', 'COMPLETED');
        if (isAborted(item)) return ui('status.suspended', 'SUSPENDED · AWAITING RESTART');
        return ui('status.inProgress', 'IN PROGRESS');
    }

    function getTypeLabel(type) {
        return ui('status.type.' + type, String(type || 'project').toUpperCase());
    }

    function getRoadmapItems() {
        if (!state.data) return [];
        let items;
        if (Array.isArray(state.data.items)) {
            items = state.data.items;
        } else {
            const currentItems = Array.isArray(state.data.current) ? state.data.current : [];
            const completedItems = Array.isArray(state.data.completed) ? state.data.completed : [];
            items = [...currentItems, ...completedItems];
        }

        return items
            .map((item, index) => ({ item, index }))
            .sort((a, b) => {
                const aAborted = isAborted(a.item) ? 0 : 1;
                const bAborted = isAborted(b.item) ? 0 : 1;
                return aAborted - bAborted || a.index - b.index;
            })
            .map(entry => entry.item);
    }

    function findItem(itemId) {
        return getRoadmapItems().find(item => item.id === itemId);
    }

    /* ========== US Letter portrait file card ========== */
    function createFileCard(item) {
        const card = document.createElement('div');
        const done = isDone(item);
        const aborted = isAborted(item);
        card.className = 'file-card file-stacked';
        if (aborted) card.classList.add('file-aborted');
        if (item.featured) card.classList.add('file-featured');

        const type = item.type || 'project';
        const isClassified = type === 'classified';
        if (isClassified) card.classList.add('file-classified');
        card.setAttribute('data-open-label', ui('roadmap.card.open', 'OPEN RECORD ↗'));
        if (isClassified) card.setAttribute('data-classified-label', ui('status.type.classified', 'CLASSIFIED'));
        const typeLabel = getTypeLabel(type);

        // --- Full card face (US Letter layout) — always rendered, clipped when stacked ---
        const face = document.createElement('div');
        face.className = 'file-face';

        // Top: classification stripe
        const stripe = document.createElement('div');
        stripe.className = 'file-stripe';
        const stripeType = document.createElement('span');
        stripeType.className = 'stripe-type file-type-' + type;
        stripeType.textContent = typeLabel;
        stripe.appendChild(stripeType);
        const stripeVer = document.createElement('span');
        stripeVer.className = 'stripe-version';
        stripeVer.textContent = item.version;
        stripe.appendChild(stripeVer);
        if (item.featured) {
            const pin = document.createElement('span');
            pin.className = 'stripe-pin';
            stripe.appendChild(pin);
        }
        face.appendChild(stripe);

        // Title block
        const titleBlock = document.createElement('div');
        titleBlock.className = 'file-title-block';
        const title = document.createElement('h4');
        title.className = 'file-title';
        title.textContent = resolveLang(item.title);
        titleBlock.appendChild(title);
        face.appendChild(titleBlock);

        // Description
        const desc = document.createElement('p');
        desc.className = 'file-desc';
        if (isClassified) {
            desc.classList.add('redacted');
            desc.textContent = resolveLang(item.desc);
        } else {
            desc.textContent = resolveLang(item.desc);
        }
        face.appendChild(desc);

        // Mid section: progress or completion
        if (!done && !aborted && item.percent != null && !isClassified) {
            const progressWrap = document.createElement('div');
            progressWrap.className = 'file-progress-wrap';

            const pctLabel = document.createElement('span');
            pctLabel.className = 'file-pct';
            pctLabel.textContent = item.percent + '%';
            progressWrap.appendChild(pctLabel);

            const bar = document.createElement('div');
            bar.className = 'file-bar';
            const fill = document.createElement('div');
            fill.className = 'file-fill' + (item.status === 'done' ? ' done' : ' progress');
            fill.style.width = Math.max(0, Math.min(100, Number(item.percent) || 0)) + '%';
            bar.appendChild(fill);
            progressWrap.appendChild(bar);

            face.appendChild(progressWrap);
        }

        if (done && !isClassified) {
            const stamp = document.createElement('div');
            stamp.className = 'file-stamp-block';
            stamp.innerHTML = '<span class="stamp-check">✓</span> ' + escapeHtml(ui('status.completed', 'COMPLETED'));
            face.appendChild(stamp);
        }

        if (aborted && !isClassified) {
            const stamp = document.createElement('div');
            stamp.className = 'file-stamp-block file-aborted-stamp';
            stamp.innerHTML = '<span class="stamp-check">Ⅱ</span> ' + escapeHtml(getStatusLabel(item));
            face.appendChild(stamp);
        }

        // Classified: redacted progress
        if (isClassified && !done) {
            const pWrap = document.createElement('div');
            pWrap.className = 'file-progress-wrap classified-progress';
            const pctLabel = document.createElement('span');
            pctLabel.className = 'file-pct';
            pctLabel.textContent = '██%';
            pWrap.appendChild(pctLabel);
            const bar = document.createElement('div');
            bar.className = 'file-bar redacted-bar';
            pWrap.appendChild(bar);
            face.appendChild(pWrap);
        }

        // Footer
        const footer = document.createElement('div');
        footer.className = 'file-footer';

        if (item.github && !isClassified) {
            const gh = document.createElement('a');
            gh.href = item.github;
            gh.target = '_blank';
            gh.rel = 'noopener noreferrer';
            gh.className = 'file-link';
            gh.textContent = ui('document.github', 'GitHub →');
            gh.addEventListener('click', (e) => e.stopPropagation());
            footer.appendChild(gh);
        }

        const idLabel = document.createElement('span');
        idLabel.className = 'file-id';
        idLabel.textContent = isClassified
            ? '████-' + (item.id || '').toUpperCase()
            : (item.id || '').toUpperCase();
        footer.appendChild(idLabel);

        face.appendChild(footer);
        card.appendChild(face);

        // Click → open document (classified opens too, but with redacted overlay content)
        card.addEventListener('click', () => { openArchiveDoc(item); });

        return card;
    }

    /* ========== Open document overlay ========== */
    function openArchiveDoc(item) {
        let overlay = document.querySelector('.project-overlay');
        if (!overlay) return;
        activeArchiveItem = item;
        overlay.dataset.documentOwner = 'roadmap';
        const requestId = ++archiveDocumentRequestId;

        const name = resolveLang(item.title);
        const desc = resolveLang(item.desc);
        const type = item.type || 'project';
        const isClassified = type === 'classified';
        const typeLabel = getTypeLabel(type);
        const contentPath = resolveContentPath(item.content);
        const githubUrl = !isClassified && item.github ? item.github : '';

        const releaseEl = overlay.querySelector('.nasa-doc-release-no');
        if (releaseEl) {
            releaseEl.textContent = isClassified
                ? ui('document.releaseNo', 'RELEASE NO:') + '  ████-██-████'
                : ui('document.releaseNo', 'RELEASE NO:') + '  CYBER-' + new Date().getFullYear().toString().slice(-2) + '-' + (item.id || '000').toUpperCase();
        }

        const titleEl = overlay.querySelector('.nasa-doc-title');
        if (titleEl) titleEl.textContent = contentPath ? '' : name;

        // Update masthead label to match type
        const mastheadLabel = overlay.querySelector('.masthead-label');
        if (mastheadLabel) {
            if (isClassified) mastheadLabel.textContent = ui('document.masthead.classified', 'CLASSIFIED');
            else if (type === 'experiment') mastheadLabel.textContent = ui('document.masthead.experiment', 'EXPERIMENT');
            else mastheadLabel.textContent = ui('document.masthead.projects', 'PROJECTS');
        }

        const githubBtn = overlay.querySelector('.nasa-doc-github');
        if (githubBtn) {
            if (githubUrl) {
                githubBtn.href = githubUrl;
                githubBtn.hidden = false;
            } else {
                githubBtn.removeAttribute('href');
                githubBtn.hidden = true;
            }
        }

        const body = overlay.querySelector('.nasa-doc-body');
        if (body) {
            if (isClassified) {
                body.innerHTML = `
                    <p style="color:var(--orange);font-weight:700;letter-spacing:2px;">⬛ ${escapeHtml(typeLabel)}</p>
                    <p>${escapeHtml(desc)}</p>
                    <p><strong>${escapeHtml(ui('document.version', 'VERSION:'))}</strong> ████</p>
                    <p><strong>${escapeHtml(ui('document.status', 'STATUS:'))}</strong> ██████████</p>
                    <p><strong>${escapeHtml(ui('document.clearance', 'CLEARANCE: RESTRICTED'))}</strong></p>
                    <p style="margin-top:12px;color:var(--text-faint);font-style:italic;">
                    ${escapeHtml(ui('document.classifiedCopy', 'This document is classified under CyberYimein Internal Policy. Details have been redacted in accordance with organizational security protocols.'))}</p>
                `;
            } else {
                body.innerHTML = `
                    <p><strong>${escapeHtml(ui('document.type', 'TYPE:'))}</strong> ${escapeHtml(typeLabel)}</p>
                    <p>${escapeHtml(desc)}</p>
                    <p><strong>${escapeHtml(ui('document.version', 'VERSION:'))}</strong> ${escapeHtml(item.version || '—')}</p>
                    <p><strong>${escapeHtml(ui('document.status', 'STATUS:'))}</strong> ${escapeHtml(getStatusLabel(item))}</p>
                    ${item.statusReason ? `<p><strong>${escapeHtml(ui('document.statusNote', 'STATUS NOTE:'))}</strong> ${escapeHtml(resolveLang(item.statusReason))}</p>` : ''}
                    ${item.currentFocus ? `<p><strong>${escapeHtml(ui('document.currentFocus', 'CURRENT FOCUS:'))}</strong> ${escapeHtml(resolveLang(item.currentFocus))}</p>` : ''}
                    ${item.percent != null ? `<p><strong>${escapeHtml(ui('document.progress', 'PROGRESS:'))}</strong> ${item.percent}%</p>` : ''}
                    ${item.github ? `<p><strong>${escapeHtml(ui('document.repository', 'REPOSITORY:'))}</strong> <a href="${escapeHtml(item.github)}" target="_blank" rel="noopener" style="color:var(--orange);text-decoration:none;font-weight:700;">${escapeHtml(item.github)}</a></p>` : ''}
                `;
            }

            if (contentPath && window.MD) {
                MD.fetch(contentPath).then(md => {
                    if (requestId !== archiveDocumentRequestId) return;
                    if (!md) return;
                    const parsed = MD.parse(md);
                    if (parsed.html) {
                        const prefix = isClassified
                            ? '<p style="color:var(--orange);font-weight:700;letter-spacing:2px;">⬛ ' + escapeHtml(typeLabel) + '</p>'
                            : '';
                        body.innerHTML = prefix + parsed.html;
                    }
                });
            }
        }

        requestAnimationFrame(() => {
            // Add/remove classified watermark on document
            const doc = overlay.querySelector('.nasa-document');
            if (doc) {
                doc.classList.toggle('nasa-doc-classified', isClassified);
                doc.setAttribute('data-classified-label', ui('status.type.classified', 'CLASSIFIED'));
            }
            overlay.classList.add('active');
        });
    }

    function createElement(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text != null) el.textContent = text;
        return el;
    }

    function createWorkbenchNav() {
        const nav = createElement('div', 'workbench-primary-nav');
        nav.setAttribute('role', 'tablist');
        nav.setAttribute('aria-label', ui('nav.aria', 'Workbench sections'));

        [
            ['projects', ui('nav.projects.label', 'PROJECTS'), ui('nav.projects.hint', 'Projects')],
            ['roadmap', ui('nav.roadmap.label', 'ROADMAP'), ui('nav.roadmap.hint', 'Roadmap')]
        ].forEach(([id, label, hint]) => {
            const button = createElement('button', 'workbench-primary-button');
            button.type = 'button';
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', String(state.activeTop === id));
            button.classList.toggle('active', state.activeTop === id);
            button.innerHTML = `<span>${label}</span><small>${hint}</small>`;
            button.addEventListener('click', () => {
                state.activeTop = id;
                render();
            });
            nav.appendChild(button);
        });

        return nav;
    }

    function createSectionNav() {
        const nav = createElement('div', 'roadmap-nav');
        nav.setAttribute('role', 'tablist');
        const isProjects = state.activeTop === 'projects';
        nav.setAttribute('aria-label', isProjects
            ? ui('view.projects.aria', 'Project views')
            : ui('view.roadmap.aria', 'Roadmap views'));

        const items = isProjects
            ? [
                ['now', ui('view.now.label', 'NOW'), ui('view.now.hint', 'Current')],
                ['archive', ui('view.archive.label', 'ARCHIVE'), ui('view.archive.hint', 'Project archive')]
            ]
            : [
                ['wander', ui('view.wander.label', 'WANDER'), ui('view.wander.hint', 'Free exploration')],
                ['branches', ui('view.branches.label', 'BRANCHES'), ui('view.branches.hint', 'Goal branch')]
            ];
        const activeView = isProjects ? state.projectView : state.roadmapView;

        items.forEach(([id, label, hint]) => {
            const button = createElement('button', 'roadmap-nav-button');
            button.type = 'button';
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', String(activeView === id));
            button.classList.toggle('active', activeView === id);
            button.innerHTML = `<span>${label}</span><small>${hint}</small>`;
            button.addEventListener('click', () => {
                if (isProjects) state.projectView = id;
                else state.roadmapView = id;
                render();
            });
            nav.appendChild(button);
        });

        return nav;
    }

    function createNowCard(item) {
        const card = createElement('article', 'roadmap-now-card');
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        const header = createElement('div', 'roadmap-now-header');
        header.appendChild(createElement('span', 'roadmap-node-code', item.id));
        header.appendChild(createElement('span', 'roadmap-live-signal', ui('roadmap.card.live', 'LIVE')));
        card.appendChild(header);

        card.appendChild(createElement('h3', '', resolveLang(item.title)));
        card.appendChild(createElement('p', 'roadmap-now-desc', resolveLang(item.desc)));

        const focus = createElement('div', 'roadmap-now-focus');
        focus.appendChild(createElement('span', '', ui('roadmap.card.focus', 'CURRENT FOCUS')));
        focus.appendChild(createElement('p', '', resolveLang(item.currentFocus) || ui('roadmap.active.desc', 'Projects still evolving.')));
        card.appendChild(focus);

        const footer = createElement('div', 'roadmap-now-footer');
        footer.appendChild(createElement('span', 'roadmap-version', item.version || '—'));
        if (item.percent != null) {
            const meter = createElement('div', 'roadmap-now-meter');
            const fill = createElement('i', '');
            fill.style.width = Math.max(0, Math.min(100, Number(item.percent) || 0)) + '%';
            meter.appendChild(fill);
            footer.appendChild(meter);
            footer.appendChild(createElement('strong', '', item.percent + '%'));
        } else {
            footer.appendChild(createElement('strong', '', ui('roadmap.card.active', 'ACTIVE')));
        }
        card.appendChild(footer);
        card.addEventListener('click', () => openArchiveDoc(item));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openArchiveDoc(item);
            }
        });
        return card;
    }

    function createBranchNode(data, modifier) {
        const node = createElement('article', 'roadmap-branch-node ' + (modifier || ''));
        node.setAttribute('data-open-label', ui('roadmap.card.open', 'OPEN RECORD ↗'));
        node.appendChild(createElement('span', 'roadmap-node-eyebrow', resolveLang(data.eyebrow)));
        node.appendChild(createElement('h4', '', resolveLang(data.title)));
        node.appendChild(createElement('p', '', resolveLang(data.desc)));
        if (data.status) node.appendChild(createElement('span', 'roadmap-node-status', resolveLang(data.status)));

        if (data.itemId) {
            const item = findItem(data.itemId);
            if (item) {
                node.classList.add('is-clickable');
                if (item.updated) {
                    node.classList.add('is-updated');
                    const updateBadge = createElement(
                        'span',
                        'roadmap-update-badge',
                        (resolveLang(item.updateLabel) || ui('roadmap.card.updated', 'UPDATED'))
                        + ' / ' + (item.previousVersion || '—')
                        + ' → ' + (item.version || '—')
                    );
                    updateBadge.setAttribute('aria-label', updateBadge.textContent);
                    node.appendChild(updateBadge);
                }
                node.setAttribute('role', 'button');
                node.tabIndex = 0;
                node.addEventListener('click', () => openArchiveDoc(item));
                node.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openArchiveDoc(item);
                    }
                });
            }
        }
        return node;
    }

    function renderNow(sectionNav) {
        const view = createElement('div', 'roadmap-view roadmap-now-view');
        const intro = createElement('div', 'roadmap-view-intro');
        const copy = createElement('div', 'roadmap-view-copy');
        copy.appendChild(createElement('span', 'roadmap-kicker', ui('roadmap.active.kicker', 'MISSION CONTROL / ACTIVE')));
        copy.appendChild(createElement('p', '', ui('roadmap.active.desc', 'Projects still evolving. Open a task card to read its complete record.')));
        intro.appendChild(copy);
        intro.appendChild(sectionNav);
        view.appendChild(intro);

        const grid = createElement('div', 'roadmap-now-grid');
        getRoadmapItems()
            .filter(item => item.type === 'project' && !isDone(item) && !isAborted(item))
            .forEach(item => grid.appendChild(createNowCard(item)));
        view.appendChild(grid);
        return view;
    }

    function createWanderCard(item, index) {
        const type = item.type || 'project';
        const card = createElement('article', 'roadmap-wander-card wander-pattern-' + (index % 5));
        card.setAttribute('role', 'button');
        card.tabIndex = 0;

        const header = createElement('div', 'roadmap-wander-header');
        header.appendChild(createElement(
            'span',
            'roadmap-wander-type type-' + type,
            getTypeLabel(type)
        ));
        header.appendChild(createElement('span', 'roadmap-wander-version', item.version || '—'));
        card.appendChild(header);
        card.appendChild(createElement('h4', '', resolveLang(item.title)));
        card.appendChild(createElement('p', '', resolveLang(item.desc)));

        const footer = createElement('div', 'roadmap-wander-footer');
        footer.appendChild(createElement('span', '', item.id || '—'));
        footer.appendChild(createElement('strong', '', getStatusLabel(item)));
        card.appendChild(footer);

        card.addEventListener('click', () => openArchiveDoc(item));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openArchiveDoc(item);
            }
        });
        return card;
    }

    function renderWander(sectionNav) {
        const view = createElement('div', 'roadmap-view roadmap-wander-view');
        const intro = createElement('div', 'roadmap-wander-intro');
        const copy = createElement('div', '');
        copy.appendChild(createElement('span', 'roadmap-kicker', ui('roadmap.wander.kicker', 'OPEN PLAYGROUND / NO FIXED MISSION')));
        copy.appendChild(createElement('h3', '', ui('roadmap.wander.title', 'WANDER')));
        copy.appendChild(createElement('p', '', ui('roadmap.wander.desc', 'Projects and experiments remain mixed here until they connect with another capability.')));
        intro.appendChild(copy);
        const controls = createElement('div', 'roadmap-header-controls');
        controls.appendChild(sectionNav);
        controls.appendChild(createElement(
            'span',
            'roadmap-wander-count',
            formatUi('roadmap.wander.records', { count: String(getRoadmapItems().length).padStart(2, '0') }, 'RECORDS: ' + getRoadmapItems().length)
        ));
        intro.appendChild(controls);
        view.appendChild(intro);

        const grid = createElement('div', 'roadmap-wander-grid');
        getRoadmapItems().forEach((item, index) => {
            grid.appendChild(createWanderCard(item, index));
        });
        view.appendChild(grid);
        return view;
    }

    function renderBranches(sectionNav) {
        const branches = Array.isArray(state.data.branches) ? state.data.branches : [];
        const branch = branches[state.activeBranch];
        const specializations = branch && Array.isArray(branch.specializations)
            ? branch.specializations
            : [];
        const view = createElement('div', 'roadmap-view roadmap-branches-view');
        if (!branch) return view;

        const branchHeader = createElement('div', 'roadmap-branch-header');
        const heading = createElement('div', '');
        heading.appendChild(createElement('span', 'roadmap-kicker', branch.code + ' / ' + ui('roadmap.branch.kicker', 'EVOLUTION TRACE')));
        heading.appendChild(createElement('h3', '', resolveLang(branch.title)));
        heading.appendChild(createElement('p', '', resolveLang(branch.summary)));
        branchHeader.appendChild(heading);

        const pager = createElement('div', 'roadmap-branch-pager');
        const previous = createElement('button', '', '←');
        const next = createElement('button', '', '→');
        previous.type = next.type = 'button';
        previous.disabled = branches.length < 2;
        next.disabled = branches.length < 2;
        previous.setAttribute('aria-label', ui('roadmap.branch.previous', 'Previous branch'));
        next.setAttribute('aria-label', ui('roadmap.branch.next', 'Next branch'));
        previous.addEventListener('click', () => {
            state.activeBranch = (state.activeBranch - 1 + branches.length) % branches.length;
            render();
        });
        next.addEventListener('click', () => {
            state.activeBranch = (state.activeBranch + 1) % branches.length;
            render();
        });
        pager.appendChild(previous);
        pager.appendChild(createElement('span', '', String(state.activeBranch + 1).padStart(2, '0') + ' / ' + String(branches.length).padStart(2, '0')));
        pager.appendChild(next);
        const controls = createElement('div', 'roadmap-header-controls');
        controls.appendChild(sectionNav);
        controls.appendChild(pager);
        branchHeader.appendChild(controls);
        view.appendChild(branchHeader);

        const map = createElement('div', 'roadmap-branch-map');
        const experimentLane = createElement('div', 'roadmap-experiment-lane');
        experimentLane.appendChild(createElement('span', 'roadmap-lane-label', ui('roadmap.branch.lane.experiment', 'EXPERIMENT CHAIN / CAPABILITY CONTINUATION')));

        const chain = createElement('div', 'roadmap-experiment-chain');
        [branch.origin, ...branch.capabilities].forEach((nodeData, index, nodes) => {
            chain.appendChild(createBranchNode(
                nodeData,
                index === 0 ? 'roadmap-origin-node' : 'roadmap-capability-node'
            ));
            if (index < nodes.length - 1) {
                const connector = createElement('div', 'roadmap-chain-connector');
                connector.innerHTML = `<i></i><span>${escapeHtml(ui(index === 0 ? 'roadmap.branch.connector.origin' : 'roadmap.branch.connector.capability', index === 0 ? 'Experience' : 'Capability'))}</span>`;
                chain.appendChild(connector);
            }
        });
        experimentLane.appendChild(chain);
        experimentLane.appendChild(createElement('span', 'roadmap-relation-label', resolveLang(branch.origin.relation)));
        map.appendChild(experimentLane);

        const merge = createElement('div', 'roadmap-merge-mark');
        merge.innerHTML = '<span>' + escapeHtml(ui('roadmap.branch.converge', 'CONVERGE')) + '</span><i></i>';
        map.appendChild(merge);

        const destinationLane = createElement('div', 'roadmap-destination-lane');
        destinationLane.appendChild(createElement('span', 'roadmap-lane-label', ui('roadmap.branch.lane.system', 'SYSTEM BASE / DOMAIN SPECIALIZATIONS')));

        const systemTree = createElement('div', 'roadmap-system-tree');
        systemTree.appendChild(createBranchNode(branch.destination, 'roadmap-destination-node'));
        if (specializations.length) {
            const fork = createElement('div', 'roadmap-specialization-fork');
            fork.innerHTML = `<span>${escapeHtml(ui('roadmap.branch.connector.specialization', 'SPECIALIZE'))}</span><i></i>`;
            systemTree.appendChild(fork);

            const specializationGrid = createElement('div', 'roadmap-specialization-grid');
            specializations.forEach(nodeData => {
                specializationGrid.appendChild(createBranchNode(nodeData, 'roadmap-specialization-node'));
            });
            systemTree.appendChild(specializationGrid);
        }
        destinationLane.appendChild(systemTree);
        map.appendChild(destinationLane);
        view.appendChild(map);

        const legend = createElement('div', 'roadmap-branch-legend');
        legend.innerHTML = '<span><i class="solid"></i>' + escapeHtml(ui('roadmap.branch.legend.merge', 'CAPABILITY MERGE')) + '</span>'
            + (specializations.length ? '<span><i class="specialization"></i>' + escapeHtml(ui('roadmap.branch.legend.specialization', 'DOMAIN SPECIALIZATION')) + '</span>' : '')
            + '<span><i class="dashed"></i>' + escapeHtml(ui('roadmap.branch.legend.experience', 'EXPERIENCE CONTINUITY, NOT CODE REUSE')) + '</span>';
        view.appendChild(legend);
        return view;
    }

    function renderArchive(sectionNav) {
        const view = createElement('div', 'roadmap-view roadmap-archive-view');
        const intro = createElement('div', 'roadmap-view-intro');
        const copy = createElement('div', 'roadmap-view-copy');
        copy.appendChild(createElement('span', 'roadmap-kicker', ui('roadmap.archive.kicker', 'RECORD STORAGE / CLOSED')));
        copy.appendChild(createElement('p', '', ui('roadmap.archive.desc', 'Completed, suspended, or archived project records. Open a file to read the article.')));
        intro.appendChild(copy);
        intro.appendChild(sectionNav);
        view.appendChild(intro);

        const grid = createElement('div', 'roadmap-archive-grid');
        getRoadmapItems()
            .filter(item => item.type === 'project' && (isDone(item) || isAborted(item)))
            .forEach(item => grid.appendChild(createFileCard(item)));
        view.appendChild(grid);
        return view;
    }

    /* ========== Render ========== */
    function render() {
        const cabinet = document.querySelector('#archive-cabinet');
        if (!cabinet) return;
        cabinet.innerHTML = '';
        if (!state.data) return;

        const primaryHost = document.querySelector('#workbench-primary-nav-host');
        const primaryNav = createWorkbenchNav();
        if (primaryHost) primaryHost.replaceChildren(primaryNav);
        else cabinet.appendChild(primaryNav);
        const sectionNav = createSectionNav();

        if (state.activeTop === 'projects') {
            cabinet.appendChild(state.projectView === 'archive' ? renderArchive(sectionNav) : renderNow(sectionNav));
        } else {
            cabinet.appendChild(state.roadmapView === 'wander' ? renderWander(sectionNav) : renderBranches(sectionNav));
        }
    }

    async function load() {
        try {
            const res = await fetch(FILE);
            if (!res.ok) throw new Error(res.status);
            state.data = await res.json();
            render();
        } catch (e) {
            console.error('[roadmap] load failed', e);
            state.data = null;
            render();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        state.lang = (typeof I18N !== 'undefined' && I18N.state && I18N.state.lang) || state.lang;
        load();
    });

    document.addEventListener('languageChanged', (evt) => {
        const next = (evt && evt.detail && evt.detail.lang) || (typeof I18N !== 'undefined' && I18N.state && I18N.state.lang);
        if (next) state.lang = next;
        if (state.data) render();
        const overlay = document.querySelector('.project-overlay');
        if (activeArchiveItem && overlay && overlay.dataset.documentOwner === 'roadmap' && overlay.classList.contains('active')) {
            openArchiveDoc(activeArchiveItem);
        }
    });
})();
