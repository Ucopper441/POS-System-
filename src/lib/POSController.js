import { CartManager } from './CartManager.js';

/** Connects POS interactions to a CartManager without exposing cart state to the UI. */
export class POSController {
  #cart;
  #elements;
  #formatCurrency;
  #database;
  #selectedPayment = null;

  constructor({ cart = new CartManager(), elements, formatCurrency, database = null }) {
    this.#cart = cart;
    this.#elements = elements;
    this.#formatCurrency = formatCurrency;
    this.#database = database;
  }

  async initialise() {
    this.#elements.items.addEventListener('click', (event) => this.#handleQuantityChange(event));
    this.#elements.checkout.addEventListener('click', () => this.#openPaymentDialog());
    this.#elements.paymentOptions.forEach((button) => button.addEventListener('click', () => this.#selectPayment(button)));
    this.#elements.confirmPayment.addEventListener('click', () => this.#checkout());
    this.#elements.cancelPayment.addEventListener('click', () => this.#elements.paymentDialog.close());
    this.render();
    await this.#loadProducts();
  }

  #bindProductButtons() {
    this.#elements.products.querySelectorAll('[data-product]').forEach((button) => {
      button.addEventListener('click', () => {
        this.#cart.addProduct(JSON.parse(button.dataset.product));
        this.render();
      });
    });
  }

  async #loadProducts() {
    if (!this.#database) {
      this.#elements.products.innerHTML = '<p class="catalogue-message">CONNECT SUPABASE TO LOAD YOUR MENU.</p>';
      return;
    }
    try {
      const products = await this.#database.getAvailableProducts();
      const groups = Object.groupBy(products, ({ category }) => category);
      this.#elements.products.innerHTML = products.length ? Object.entries(groups).map(([category, group]) => `<section class="product-group"><h2>${this.#escape(category)}</h2><div class="product-grid">${group.map((product) => `<button class="product-button" type="button" data-product="${this.#escape(JSON.stringify(product))}"><span>${this.#escape(product.name)}</span><strong>${this.#formatCurrency(product.price)}</strong></button>`).join('')}</div></section>`).join('') : '<p class="catalogue-message">NO PRODUCTS ARE ON THE MENU. ADD ONE IN ADMIN MODE.</p>';
      this.#bindProductButtons();
    } catch (error) {
      this.#elements.products.innerHTML = '<p class="catalogue-message">COULD NOT LOAD MENU. CHECK THE SUPABASE CONNECTION.</p>';
      console.error(error);
    }
  }

  render() {
    const items = this.#cart.getItems();
    this.#elements.count.textContent = String(this.#cart.getItemCount());
    this.#elements.total.textContent = this.#formatCurrency(this.#cart.getSubtotal());
    this.#elements.checkout.disabled = items.length === 0;
    this.#elements.items.innerHTML = items.length ? items.map((item) => this.#cartItemTemplate(item)).join('') : '<p class="empty-cart">SELECT A SPUD TO START.</p>';
  }

  #handleQuantityChange(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const item = this.#cart.getItems().find(({ id }) => id === button.dataset.id);
    if (!item) return;
    this.#cart.updateQuantity(item.id, item.quantity + (button.dataset.action === 'increase' ? 1 : -1));
    this.render();
  }

  #openPaymentDialog() {
    this.#selectedPayment = null;
    this.#elements.paymentOptions.forEach((button) => button.classList.remove('is-selected'));
    this.#elements.confirmPayment.disabled = true;
    this.#elements.paymentTotal.textContent = this.#formatCurrency(this.#cart.getSubtotal());
    this.#elements.paymentDialog.showModal();
  }

  #selectPayment(button) {
    this.#selectedPayment = button.dataset.payment;
    this.#elements.paymentOptions.forEach((option) => option.classList.toggle('is-selected', option === button));
    this.#elements.confirmPayment.disabled = false;
  }

  async #checkout() {
    if (!this.#database || !this.#cart.getItemCount()) return;
    this.#elements.paymentDialog.close();
    this.#elements.checkout.disabled = true;
    this.#elements.checkout.textContent = 'SAVING ORDER…';
    try {
      await this.#database.createOrder({ items: this.#cart.getItems(), totalAmount: this.#cart.getSubtotal(), paymentMethod: this.#selectedPayment });
      this.#elements.checkout.textContent = 'ORDER LOCKED!';
      this.#cart.clear();
    } catch (error) {
      this.#elements.checkout.textContent = 'SAVE FAILED';
      console.error(error);
    }
    window.setTimeout(() => { this.#elements.checkout.innerHTML = 'CHECKOUT <span>→</span>'; this.render(); }, 700);
  }

  #cartItemTemplate(item) {
    const safeName = item.name.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    return `<article class="cart-item"><div><strong>${safeName}</strong><small>${this.#formatCurrency(item.price)} EA</small></div><div class="quantity-control"><button data-action="decrease" data-id="${item.id}" aria-label="Remove one ${safeName}">−</button><b>${item.quantity}</b><button data-action="increase" data-id="${item.id}" aria-label="Add one ${safeName}">+</button></div><strong>${this.#formatCurrency(item.subtotal)}</strong></article>`;
  }

  #escape(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
}
