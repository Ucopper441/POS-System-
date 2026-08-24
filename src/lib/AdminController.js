/** Owns dashboard rendering and menu maintenance interactions. */
export class AdminController {
  #database;
  #elements;
  #money;

  constructor({ database, elements, formatCurrency }) {
    this.#database = database;
    this.#elements = elements;
    this.#money = formatCurrency;
  }

  async initialise() {
    this.#elements.form.addEventListener('submit', (event) => this.#saveProduct(event));
    this.#elements.productList.addEventListener('change', (event) => this.#toggleAvailability(event));
    this.#elements.closeout.addEventListener('click', () => this.#runCloseout());
    await this.refresh();
  }

  async refresh() {
    try {
      const [dashboard, products, closeouts] = await Promise.all([this.#database.getSalesDashboard(), this.#database.getProducts(), this.#database.getCloseoutHistory()]);
      this.#renderDashboard(dashboard);
      this.#renderProducts(products);
      this.#renderCloseoutHistory(closeouts);
      this.#elements.notice.textContent = 'LIVE DATA · SYNCED';
    } catch (error) {
      this.#elements.notice.textContent = 'SUPABASE CONNECTION REQUIRED';
      this.#elements.notice.classList.add('is-error');
      console.error(error);
    }
  }

  async #saveProduct(event) {
    event.preventDefault();
    const form = new FormData(this.#elements.form);
    try {
      await this.#database.saveProduct({ name: form.get('name'), category: form.get('category'), price: form.get('price'), is_available: true });
      this.#elements.form.reset();
      await this.refresh();
    } catch (error) { this.#elements.notice.textContent = error.message; }
  }

  async #toggleAvailability(event) {
    const input = event.target.closest('[data-availability]');
    if (!input) return;
    try { await this.#database.setProductAvailability(input.dataset.availability, input.checked); await this.refresh(); }
    catch (error) { this.#elements.notice.textContent = error.message; }
  }

  async #runCloseout() {
    this.#elements.closeout.disabled = true;
    this.#elements.closeout.textContent = 'COUNTING…';
    try {
      const closeout = await this.#database.closeCurrentSalesPeriod();
      this.#elements.notice.textContent = 'CLOSEOUT SAVED · LIVE SALES RESET';
      await this.refresh();
      this.#elements.closeoutTotal.textContent = this.#money(closeout.total_sales);
      this.#elements.cashTotal.textContent = this.#money(closeout.cash_collected);
      this.#elements.qrTotal.textContent = this.#money(closeout.qr_collected);
      this.#elements.closeoutOrders.textContent = `${closeout.order_count} PAID TICKETS`;
      this.#elements.closeoutReport.hidden = false;
    } catch (error) { this.#elements.notice.textContent = error.message; }
    finally { this.#elements.closeout.disabled = false; this.#elements.closeout.textContent = 'RUN DAILY CLOSEOUT'; }
  }

  #renderDashboard({ revenue, orderCount, cashRevenue, qrRevenue, topSellers, recentOrders }) {
    this.#elements.revenue.textContent = this.#money(revenue);
    this.#elements.orderCount.textContent = String(orderCount);
    this.#elements.average.textContent = this.#money(orderCount ? revenue / orderCount : 0);
    this.#elements.closeoutTotal.textContent = this.#money(revenue);
    this.#elements.cashTotal.textContent = this.#money(cashRevenue);
    this.#elements.qrTotal.textContent = this.#money(qrRevenue);
    this.#elements.closeoutOrders.textContent = `${orderCount} PAID TICKETS`;
    this.#elements.bestSellers.innerHTML = topSellers.length ? topSellers.map((item, index) => `<li><b>0${index + 1}</b><span>${this.#escape(item.name)}</span><strong>${item.quantity} SOLD</strong></li>`).join('') : '<li class="muted">No completed orders today.</li>';
    this.#elements.recentOrders.innerHTML = recentOrders.length ? recentOrders.map((order) => `<tr><td>#${order.id.slice(0, 6).toUpperCase()}</td><td>${new Date(order.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}</td><td>${this.#escape(order.payment_method)}</td><td>${this.#money(order.total_amount)}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No orders yet.</td></tr>';
  }

  #renderProducts(products) {
    this.#elements.productList.innerHTML = products.length ? products.map((product) => `<li><div><strong>${this.#escape(product.name)}</strong><small>${this.#escape(product.category)} · ${this.#money(product.price)}</small></div><label class="pixel-toggle"><input data-availability="${product.id}" type="checkbox" ${product.is_available ? 'checked' : ''}><span>${product.is_available ? 'ON' : 'OFF'}</span></label></li>`).join('') : '<li class="muted">No products yet. Add your first menu item.</li>';
  }

  #renderCloseoutHistory(closeouts) {
    this.#elements.closeoutHistory.innerHTML = closeouts.length ? closeouts.map((closeout) => `<tr><td>${new Date(closeout.closed_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td>${new Date(closeout.closed_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}</td><td>${closeout.order_count}</td><td>${this.#money(closeout.cash_collected)}</td><td>${this.#money(closeout.qr_collected)}</td><td>${this.#money(closeout.total_sales)}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">No sales periods closed yet.</td></tr>';
  }

  #escape(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
}
