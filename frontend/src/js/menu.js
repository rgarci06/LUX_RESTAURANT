import { MenuService } from './services/api.js';

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const categories = Array.from(document.querySelectorAll('.menu-category'));
    const ADMIN_EMAIL = 'ddelpe@insdanielblanxart.cat';

    const categoryTitles = {
        starters: 'Para comenzar la experiencia',
        mains: 'El corazón de nuestra cocina',
        desserts: 'El dulce final',
        wines: 'Selección del Sumiller'
    };

    const emptyMenuData = {
        starters: [],
        mains: [],
        desserts: [],
        wines: []
    };

    const state = {
        menuData: { ...emptyMenuData },
        loading: true,
        activeCategory: 'starters',
        modalOpen: false,
        modalMode: 'create',
        modalCategory: 'starters',
        modalItemId: ''
    };

    // Leo la sesion desde donde toque.
    function readSession(storage) {
        return {
            token: storage.getItem('lux_token') || '',
            email: storage.getItem('lux_email') || '',
            rol: storage.getItem('lux_rol') || ''
        };
    }

    // Primero uso sessionStorage y luego localStorage.
    function resolveCurrentSession() {
        const sessionData = readSession(sessionStorage);
        if (sessionData.token && sessionData.email) {
            return sessionData;
        }

        const localData = readSession(localStorage);
        if (localData.token && localData.email) {
            return localData;
        }

        return sessionData.token || sessionData.email || sessionData.rol ? sessionData : localData;
    }

    const currentSession = resolveCurrentSession();
    const token = currentSession.token || '';
    const normalizedRole = String(currentSession.rol || '').toLowerCase();
    const isAdmin = normalizedRole === 'admin' || String(currentSession.email || '').toLowerCase() === ADMIN_EMAIL;

    // Escape simple para pintar texto sin problemas.
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Preparo cada plato con valores seguros.
    function normalizeItem(item) {
        return {
            id: String(item?.id || ''),
            name: String(item?.name || '').trim(),
            description: String(item?.description || '-').trim() || '-',
            price: String(item?.price || '-').trim() || '-',
            badge: String(item?.badge || '').trim()
        };
    }

    // Paso la respuesta del backend al formato del front.
    function normalizeMenuData(data) {
        const normalized = { ...emptyMenuData };

        Object.keys(normalized).forEach((categoryKey) => {
            const items = Array.isArray(data?.[categoryKey]) ? data[categoryKey] : [];
            normalized[categoryKey] = items
                .map(normalizeItem)
                .filter((item) => item.name);
        });

        return normalized;
    }

    // Cambio la categoria activa.
    function setActiveCategory(categoryKey) {
        state.activeCategory = categoryKey;

        categories.forEach((category) => {
            category.classList.toggle('active', category.id === categoryKey);
        });

        tabs.forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.target === categoryKey);
        });
    }

    // Devuelvo los platos de una categoria.
    function getItems(categoryKey) {
        return state.menuData[categoryKey] || [];
    }

    // Busco un plato por id.
    function findItem(itemId) {
        for (const categoryKey of Object.keys(state.menuData)) {
            const item = state.menuData[categoryKey].find((dish) => dish.id === itemId);
            if (item) {
                return { categoryKey, item };
            }
        }

        return null;
    }

    // Creo la ventana de editar/crear solo una vez.
    function ensureMenuModal() {
        if (!isAdmin || document.querySelector('[data-menu-modal]')) return;

        const modal = document.createElement('div');
        modal.className = 'menu-modal-backdrop';
        modal.dataset.menuModal = 'true';
        modal.innerHTML = `
            <div class="menu-modal" role="dialog" aria-modal="true" aria-labelledby="menu-modal-title">
                <div class="menu-modal-header">
                    <div>
                        <p class="menu-modal-kicker">Panel de carta</p>
                        <h3 id="menu-modal-title">Nuevo plato</h3>
                    </div>
                    <button type="button" class="menu-modal-close" data-menu-modal-close aria-label="Cerrar">&times;</button>
                </div>
                <form class="menu-modal-form" data-menu-modal-form>
                    <div class="menu-modal-grid">
                        <label class="menu-modal-field">
                            <span>Categoria</span>
                            <select name="category" required>
                                <option value="starters">Entrantes</option>
                                <option value="mains">Principales</option>
                                <option value="desserts">Postres</option>
                                <option value="wines">Bodega</option>
                            </select>
                        </label>
                        <label class="menu-modal-field">
                            <span>Etiqueta</span>
                            <input type="text" name="badge" placeholder="VEG / S/G">
                        </label>
                        <label class="menu-modal-field menu-modal-field-full">
                            <span>Nombre</span>
                            <input type="text" name="name" placeholder="Nombre del plato" required>
                        </label>
                        <label class="menu-modal-field menu-modal-field-full">
                            <span>Descripcion</span>
                            <textarea name="description" rows="4" placeholder="Descripcion del plato" required></textarea>
                        </label>
                        <label class="menu-modal-field">
                            <span>Precio</span>
                            <input type="text" name="price" placeholder="28€" required>
                        </label>
                    </div>
                    <div class="menu-modal-actions">
                        <button type="button" class="menu-admin-btn" data-menu-modal-close>Cancelar</button>
                        <button type="submit" class="menu-admin-btn menu-admin-btn-primary" data-menu-modal-save>Guardar</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Abro el modal con datos vacios o con el plato actual.
    function openMenuModal(mode, categoryKey, item = null) {
        ensureMenuModal();

        const modal = document.querySelector('[data-menu-modal]');
        const title = document.getElementById('menu-modal-title');
        const form = document.querySelector('[data-menu-modal-form]');
        const categoryInput = form?.querySelector('select[name="category"]');
        const nameInput = form?.querySelector('input[name="name"]');
        const descriptionInput = form?.querySelector('textarea[name="description"]');
        const priceInput = form?.querySelector('input[name="price"]');
        const badgeInput = form?.querySelector('input[name="badge"]');

        if (!modal || !form || !categoryInput || !nameInput || !descriptionInput || !priceInput || !badgeInput) return;

        state.modalOpen = true;
        state.modalMode = mode;
        state.modalCategory = categoryKey || 'starters';
        state.modalItemId = item?.id || '';

        title.textContent = mode === 'edit' ? 'Editar plato' : 'Nuevo plato';
        categoryInput.value = state.modalCategory;
        categoryInput.disabled = mode === 'edit';
        nameInput.value = item?.name || '';
        descriptionInput.value = item?.description || '';
        priceInput.value = item?.price || '';
        badgeInput.value = item?.badge || '';

        modal.classList.add('is-open');
        setTimeout(() => nameInput.focus(), 50);
    }

    // Cierro la ventana del formulario.
    function closeMenuModal() {
        const modal = document.querySelector('[data-menu-modal]');
        const form = document.querySelector('[data-menu-modal-form]');
        const categoryInput = form?.querySelector('select[name="category"]');

        if (modal) modal.classList.remove('is-open');
        if (categoryInput) categoryInput.disabled = false;

        state.modalOpen = false;
        state.modalMode = 'create';
        state.modalItemId = '';
    }

    // Leo lo que pone el usuario en el modal.
    function readMenuModalData() {
        const form = document.querySelector('[data-menu-modal-form]');
        if (!form) return null;

        const formData = new FormData(form);
        // En modo editar el select puede estar deshabilitado y no viaja en FormData.
        const category = String(formData.get('category') || state.modalCategory || '').trim();
        const name = String(formData.get('name') || '').trim();
        const description = String(formData.get('description') || '').trim();
        const price = String(formData.get('price') || '').trim();
        const badge = String(formData.get('badge') || '').trim();

        if (!category || !name || !description || !price) return null;

        return { category, name, description, price, badge };
    }

    // Guardo un plato desde el modal.
    async function saveMenuModal(event) {
        event.preventDefault();

        const data = readMenuModalData();
        if (!data) {
            alert('Rellena categoria, nombre, descripcion y precio.');
            return;
        }

        const result = state.modalMode === 'edit'
            ? await MenuService.updateMenuItem(state.modalItemId, data, token)
            : await MenuService.createMenuItem(data, token);

        if (!result.ok) {
            alert(result.dades?.detail || 'No se pudo guardar el plato.');
            return;
        }

        closeMenuModal();
        await loadMenu();
    }

    // Borro un plato despues de confirmar.
    async function deleteDish(itemId) {
        if (!confirm('¿Seguro que quieres borrar este plato?')) return;

        const result = await MenuService.deleteMenuItem(itemId, token);
        if (!result.ok) {
            alert(result.dades?.detail || 'No se pudo borrar el plato.');
            return;
        }

        await loadMenu();
    }

    // Pinto un plato.
    function renderMenuItem(item) {
        return `
            <article class="menu-item ${isAdmin ? 'menu-item-admin' : ''}" data-item-id="${escapeHtml(item.id)}" ${isAdmin ? 'title="Doble click para editar"' : ''}>
                <div class="item-header">
                    <h3 class="item-name">${escapeHtml(item.name)}${item.badge ? ` <span class="badge">${escapeHtml(item.badge)}</span>` : ''}</h3>
                    <span class="item-price">${escapeHtml(item.price)}</span>
                </div>
                <p class="item-desc">${escapeHtml(item.description)}</p>
                ${isAdmin ? `
                    <div class="menu-item-actions">
                        <button type="button" class="menu-admin-btn menu-admin-btn-small" data-action="edit-dish" data-id="${escapeHtml(item.id)}">Editar</button>
                        <button type="button" class="menu-admin-btn menu-admin-btn-small menu-admin-btn-danger" data-action="delete-dish" data-id="${escapeHtml(item.id)}">Eliminar</button>
                    </div>
                ` : ''}
            </article>
        `;
    }

    // Pinto una categoria entera.
    function renderCategory(categoryEl) {
        const categoryKey = categoryEl.id;
        const items = getItems(categoryKey);

        categoryEl.innerHTML = `
            <h2 class="category-title">${escapeHtml(categoryTitles[categoryKey] || categoryKey)}</h2>
            ${isAdmin ? `
                <div class="menu-admin-toolbar">
                    <p class="menu-admin-note">El admin puede añadir, editar y borrar platos.</p>
                    <button type="button" class="menu-admin-btn menu-admin-btn-primary menu-admin-btn-add" data-action="add-dish" data-category="${escapeHtml(categoryKey)}">＋ Añadir plato</button>
                </div>
            ` : ''}
            <div class="menu-grid">
                ${state.loading
                    ? '<div class="menu-empty">Cargando carta...</div>'
                    : items.length > 0
                        ? items.map((item) => renderMenuItem(item)).join('')
                        : '<div class="menu-empty">Todavía no hay platos en esta sección.</div>'}
            </div>
        `;
    }

    // Repinto toda la carta.
    function renderMenu() {
        categories.forEach(renderCategory);
        setActiveCategory(state.activeCategory);
        bindAdminActions();
        bindModalActions();
    }

    // Pongo los botones del admin a funcionar otra vez.
    function bindAdminActions() {
        if (!isAdmin) return;

        document.querySelectorAll('[data-action="add-dish"]').forEach((button) => {
            button.onclick = () => {
                const categoryKey = button.dataset.category;
                if (categoryKey) {
                    openMenuModal('create', categoryKey);
                }
            };
        });

        document.querySelectorAll('[data-action="edit-dish"]').forEach((button) => {
            button.onclick = () => {
                const itemId = button.dataset.id;
                const found = itemId ? findItem(itemId) : null;
                if (found) {
                    openMenuModal('edit', found.categoryKey, found.item);
                }
            };
        });

        document.querySelectorAll('[data-action="delete-dish"]').forEach((button) => {
            button.onclick = () => {
                const itemId = button.dataset.id;
                if (itemId) {
                    deleteDish(itemId);
                }
            };
        });

        document.querySelectorAll('.menu-item-admin').forEach((article) => {
            article.ondblclick = () => {
                const itemId = article.dataset.itemId;
                const found = itemId ? findItem(itemId) : null;
                if (found) {
                    openMenuModal('edit', found.categoryKey, found.item);
                }
            };
        });
    }

    // La ventana del modal tambien necesita eventos.
    function bindModalActions() {
        if (!isAdmin) return;

        const modal = document.querySelector('[data-menu-modal]');
        const form = document.querySelector('[data-menu-modal-form]');
        const closeButtons = document.querySelectorAll('[data-menu-modal-close]');

        if (modal && !modal.dataset.bound) {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    closeMenuModal();
                }
            });
            modal.dataset.bound = 'true';
        }

        if (form && !form.dataset.bound) {
            form.addEventListener('submit', saveMenuModal);
            form.dataset.bound = 'true';
        }

        closeButtons.forEach((button) => {
            button.onclick = closeMenuModal;
        });
    }

    // Cargo la carta desde el backend.
    async function loadMenu() {
        state.loading = true;
        renderMenu();

        try {
            const result = await MenuService.listMenu();
            if (result.ok && result.dades?.data) {
                state.menuData = normalizeMenuData(result.dades.data);
            } else {
                state.menuData = { ...emptyMenuData };
            }
        } catch (error) {
            console.error('Error cargando carta:', error);
            state.menuData = { ...emptyMenuData };
        } finally {
            state.loading = false;
            renderMenu();
        }
    }

    // Cambio de pestaña al hacer click.
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.target;
            if (target) {
                setActiveCategory(target);
            }
        });
    });

    if (isAdmin) {
        ensureMenuModal();
    }

    loadMenu();
    setActiveCategory('starters');
});
