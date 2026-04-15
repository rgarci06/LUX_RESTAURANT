document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const categories = Array.from(document.querySelectorAll('.menu-category'));
    const MENU_STORAGE_KEY = 'lux_menu_data_v1';
    const ADMIN_EMAIL = 'ddelpe@insdanielblanxart.cat';

    const defaultMenuData = {
        starters: [
            {
                id: 'starter-1',
                name: 'Carpaccio de Wagyu',
                price: '28€',
                description: 'Finas láminas de Wagyu A5, parmesano reggiano de 24 meses y aceite de trufa blanca.',
                badge: ''
            },
            {
                id: 'starter-2',
                name: 'Vieiras Reales',
                price: '24€',
                description: 'Marcadas a la plancha sobre puré de coliflor trufado y crujiente de jamón ibérico.',
                badge: 'S/G'
            },
            {
                id: 'starter-3',
                name: 'Foie Gras Mi-Cuit',
                price: '26€',
                description: 'Con reducción de Pedro Ximénez, higos confitados y pan de especias tostado.',
                badge: ''
            },
            {
                id: 'starter-4',
                name: 'Tartar de Atún Rojo',
                price: '30€',
                description: 'Atún Balfegó, aguacate, emulsión de wasabi suave y perlas de soja.',
                badge: ''
            }
        ],
        mains: [
            {
                id: 'main-1',
                name: 'Solomillo Rossini',
                price: '45€',
                description: 'Solomillo de ternera, escalope de foie poêlé y salsa de trufa negra.',
                badge: ''
            },
            {
                id: 'main-2',
                name: 'Lubina Salvaje',
                price: '38€',
                description: 'Asada a la sal, con verduras de temporada glaseadas y aceite de hierbas.',
                badge: ''
            },
            {
                id: 'main-3',
                name: 'Risotto de Oro',
                price: '32€',
                description: 'Arroz Carnaroli, azafrán de La Mancha y láminas de oro comestible de 24k.',
                badge: 'VEG'
            },
            {
                id: 'main-4',
                name: 'Pato a la Naranja',
                price: '36€',
                description: 'Magret de pato, reducción de cítricos y puré de boniato asado.',
                badge: ''
            }
        ],
        desserts: [
            {
                id: 'dessert-1',
                name: 'Coulant de Chocolate',
                price: '14€',
                description: 'Chocolate belga 70%, helado de vainilla de Madagascar y frutos rojos.',
                badge: ''
            },
            {
                id: 'dessert-2',
                name: 'Tiramisú de la Casa',
                price: '12€',
                description: 'Nuestra versión clásica con mascarpone italiano y café espresso.',
                badge: ''
            }
        ],
        wines: [
            {
                id: 'wine-1',
                name: 'Moët & Chandon Imperial',
                price: '85€',
                description: 'Champagne Brut. Notas de manzana verde y cítricos.',
                badge: ''
            },
            {
                id: 'wine-2',
                name: 'Vega Sicilia Único',
                price: '450€',
                description: 'Ribera del Duero. La joya de la corona española.',
                badge: ''
            }
        ]
    };

    function readSession(storage) {
        return {
            token: storage.getItem('lux_token') || '',
            email: storage.getItem('lux_email') || '',
            rol: storage.getItem('lux_rol') || ''
        };
    }

    function resolveCurrentSession() {
        const sessionData = readSession(sessionStorage);
        if (sessionData.token && sessionData.email) {
            return sessionData;
        }

        const localData = readSession(localStorage);
        if (localData.token && localData.email) {
            return localData;
        }

        return sessionData.token || sessionData.email || sessionData.rol
            ? sessionData
            : localData;
    }

    function makeId() {
        if (window.crypto?.randomUUID) {
            return `menu-${window.crypto.randomUUID()}`;
        }

        return `menu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function cloneDefaultMenu() {
        return JSON.parse(JSON.stringify(defaultMenuData));
    }

    function normalizeItem(item) {
        const source = item && typeof item === 'object' ? item : {};
        return {
            id: String(source.id || makeId()),
            name: String(source.name || '').trim(),
            price: String(source.price || '').trim(),
            description: String(source.description || source.desc || '').trim(),
            badge: String(source.badge || '').trim()
        };
    }

    function normalizeMenuData(data) {
        const normalized = cloneDefaultMenu();

        Object.keys(normalized).forEach((categoryKey) => {
            const items = Array.isArray(data?.[categoryKey]) ? data[categoryKey] : normalized[categoryKey];
            normalized[categoryKey] = items.map(normalizeItem).filter((item) => item.name && item.price && item.description);
        });

        return normalized;
    }

    function loadMenuData() {
        try {
            const raw = localStorage.getItem(MENU_STORAGE_KEY);
            if (!raw) {
                return cloneDefaultMenu();
            }

            const parsed = JSON.parse(raw);
            return normalizeMenuData(parsed);
        } catch {
            return cloneDefaultMenu();
        }
    }

    const currentSession = resolveCurrentSession();
    const normalizedRole = String(currentSession.rol || '').toLowerCase();
    const isAdmin = normalizedRole === 'admin' || String(currentSession.email || '').toLowerCase() === ADMIN_EMAIL;

    const categoryTitles = {
        starters: 'Para comenzar la experiencia',
        mains: 'El corazón de nuestra cocina',
        desserts: 'El dulce final',
        wines: 'Selección del Sumiller'
    };

    const state = {
        menuData: loadMenuData(),
        editingItemId: null,
        creatingCategory: null
    };

    function saveMenuData() {
        localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(state.menuData));
    }

    function setActiveCategory(categoryKey) {
        categories.forEach((category) => {
            category.classList.toggle('active', category.id === categoryKey);
        });

        tabs.forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.target === categoryKey);
        });
    }

    function renderMenuItem(categoryKey, item) {
        return `
            <article class="menu-item ${isAdmin ? 'menu-item-admin' : ''}" data-item-id="${escapeHtml(item.id)}">
                <div class="item-header">
                    <h3 class="item-name">${escapeHtml(item.name)}${item.badge ? ` <span class="badge">${escapeHtml(item.badge)}</span>` : ''}</h3>
                    <span class="item-price">${escapeHtml(item.price)}</span>
                </div>
                <p class="item-desc">${escapeHtml(item.description)}</p>
                ${isAdmin ? `
                    <div class="menu-item-actions">
                        <button type="button" class="menu-admin-btn menu-admin-btn-small" disabled>Editar</button>
                        <button type="button" class="menu-admin-btn menu-admin-btn-small menu-admin-btn-danger" disabled>Eliminar</button>
                    </div>
                ` : ''}
            </article>
        `;
    }

    function renderCategory(categoryEl) {
        const categoryKey = categoryEl.id;
        const items = state.menuData[categoryKey] || [];

        categoryEl.innerHTML = `
            <h2 class="category-title">${escapeHtml(categoryTitles[categoryKey] || categoryKey)}</h2>
            ${isAdmin ? `
                <div class="menu-admin-toolbar">
                    <p class="menu-admin-note">Solo el administrador puede modificar la carta.</p>
                    <button type="button" class="menu-admin-btn menu-admin-btn-primary" disabled>Añadir plato</button>
                </div>
            ` : ''}
            <div class="menu-grid">
                ${items.length > 0
                    ? items.map((item) => renderMenuItem(categoryKey, item)).join('')
                    : `<div class="menu-empty">Todavía no hay platos en esta sección.</div>`}
            </div>
        `;
    }

    function renderMenu() {
        categories.forEach(renderCategory);
        bindAdminMenuControls();
    }

    function startCreate(categoryKey) {
        // Funcionalidad deshabilitada temporalmente
    }

    function startEdit(categoryKey, itemId) {
        // Funcionalidad deshabilitada temporalmente
    }

    function stopEditing() {
        // Funcionalidad deshabilitada temporalmente
    }

    function upsertMenuItem(categoryKey, itemId, itemData) {
        // Funcionalidad deshabilitada temporalmente
    }

    function deleteMenuItem(categoryKey, itemId) {
        // Funcionalidad deshabilitada temporalmente
    }

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            setActiveCategory(tab.dataset.target);
        });
    });

    function bindAdminMenuControls() {
        // Funcionalidad de edición deshabilitada temporalmente
    }

    renderMenu();
    setActiveCategory('starters');
});