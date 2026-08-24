/**
 * Owns the active POS cart. UI code should interact only through this API.
 */
export class CartManager {
  #items = new Map();

  addProduct(product) {
    this.#assertProduct(product);
    const item = this.#items.get(product.id);

    if (item) {
      item.quantity += 1;
    } else {
      this.#items.set(product.id, {
        id: product.id,
        name: product.name,
        category: product.category,
        price: Number(product.price),
        quantity: 1,
      });
    }

    return this.getItems();
  }

  updateQuantity(productId, quantity) {
    const item = this.#items.get(productId);
    if (!item) return this.getItems();

    const nextQuantity = Number(quantity);
    if (!Number.isInteger(nextQuantity)) {
      throw new TypeError('Quantity must be a whole number.');
    }

    if (nextQuantity <= 0) {
      this.#items.delete(productId);
    } else {
      item.quantity = nextQuantity;
    }

    return this.getItems();
  }

  removeProduct(productId) {
    this.#items.delete(productId);
    return this.getItems();
  }

  clear() {
    this.#items.clear();
  }

  getItems() {
    return Array.from(this.#items.values(), (item) => ({
      ...item,
      subtotal: item.price * item.quantity,
    }));
  }

  getSubtotal() {
    return this.getItems().reduce((total, item) => total + item.subtotal, 0);
  }

  getItemCount() {
    return this.getItems().reduce((count, item) => count + item.quantity, 0);
  }

  #assertProduct(product) {
    if (!product?.id || !product?.name || !Number.isFinite(Number(product.price))) {
      throw new TypeError('A product needs an id, name, and valid price.');
    }
  }
}
