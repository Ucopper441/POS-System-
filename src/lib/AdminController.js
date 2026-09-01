/** Owns Admin menu-management interactions. */
export class AdminController {
  #database;
  #elements;
  #money;

  constructor({ database, elements, formatCurrency }) { this.#database = database; this.#elements = elements; this.#money = formatCurrency; }

  async initialise() {
    this.#elements.form.addEventListener('submit', (event) => this.#saveProduct(event));
    this.#elements.productList.addEventListener('change', (event) => this.#toggleAvailability(event));
    this.#elements.recentOrders.addEventListener('click', (event) => this.#toggleOrderFlag(event));
    await this.refresh();
  }

  async refresh() {
    try {
      const [products, dashboard] = await Promise.all([this.#database.getProducts(), this.#database.getSalesDashboard()]);
      this.#renderProducts(products);
      this.#renderSalesSnapshot(dashboard);
      this.#elements.notice.textContent = 'MENU & LIVE ORDERS · SYNCED';
    }
    catch (error) { this.#elements.notice.textContent = 'SUPABASE CONNECTION REQUIRED'; this.#elements.notice.classList.add('is-error'); console.error(error); }
  }

  async #saveProduct(event) {
    event.preventDefault();
    const form = new FormData(this.#elements.form);
    try { await this.#database.saveProduct({ name: form.get('name'), category: form.get('category'), price: form.get('price'), is_available: true }); this.#elements.form.reset(); await this.refresh(); }
    catch (error) { this.#elements.notice.textContent = error.message; }
  }

  async #toggleAvailability(event) {
    const input = event.target.closest('[data-availability]');
    if (!input) return;
    try { await this.#database.setProductAvailability(input.dataset.availability, input.checked); await this.refresh(); }
    catch (error) { this.#elements.notice.textContent = error.message; }
  }

  async #toggleOrderFlag(event) {
    const button = event.target.closest('[data-flag-order]');
    if (!button) return;
    button.disabled = true;
    try { await this.#database.setOrderFlag(button.dataset.flagOrder, button.dataset.flagged !== 'true'); await this.refresh(); }
    catch (error) { this.#elements.notice.textContent = error.message; button.disabled = false; }
  }

  #renderProducts(products) {
    this.#elements.productList.innerHTML = products.length ? products.map((product) => `<li><div><strong>${this.#escape(product.name)}</strong><small>${this.#escape(product.category)} · ${this.#money(product.price)}</small></div><label class="pixel-toggle"><input data-availability="${product.id}" type="checkbox" ${product.is_available ? 'checked' : ''}><span>${product.is_available ? 'ON' : 'OFF'}</span></label></li>`).join('') : '<li class="muted">No products yet. Add your first menu item.</li>';
  }

  #renderSalesSnapshot({ topSellers, recentOrders }) {
    this.#elements.bestSellers.innerHTML = topSellers.length ? topSellers.map((item, index) => `<li><b>0${index + 1}</b><span>${this.#escape(item.name)}</span><strong>${item.quantity} SOLD</strong></li>`).join('') : '<li class="muted">No valid sales in this period.</li>';
    this.#elements.recentOrders.innerHTML = recentOrders.length ? recentOrders.map((order) => `<tr class="${order.is_flagged ? 'is-flagged' : ''}"><td>#${order.id.slice(0, 6).toUpperCase()}</td><td>${new Date(order.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}</td><td>${this.#escape(order.payment_method)}</td><td>${this.#money(order.total_amount)}</td><td><button class="flag-button" data-flag-order="${order.id}" data-flagged="${order.is_flagged}">${order.is_flagged ? 'RESTORE' : 'RAISE FLAG'}</button></td></tr>`).join('') : '<tr><td colspan="5" class="muted">No orders in this sales period.</td></tr>';
  }

  #escape(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
}
