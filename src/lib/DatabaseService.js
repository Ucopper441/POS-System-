import { createClient } from '@supabase/supabase-js';

/** Single boundary for PostgREST access used by POS and dashboard controllers. */
export class DatabaseService {
  #client;

  constructor(url, anonKey) {
    if (!url || !anonKey) throw new Error('Supabase URL and anon key are required.');
    this.#client = createClient(url, anonKey);
  }

  async getAvailableProducts() {
    const { data, error } = await this.#client.from('products').select('id, name, category, price, is_available').eq('is_available', true).order('category').order('name');
    if (error) throw error;
    return data;
  }

  async getProducts() {
    const { data, error } = await this.#client.from('products').select('id, name, category, price, is_available').order('category').order('name');
    if (error) throw error;
    return data;
  }

  async saveProduct(product) {
    const payload = { name: product.name.trim(), category: product.category.trim(), price: Number(product.price), is_available: Boolean(product.is_available) };
    if (!payload.name || !payload.category || !Number.isFinite(payload.price) || payload.price < 0) {
      throw new TypeError('Product name, category, and a valid price are required.');
    }
    const query = product.id
      ? this.#client.from('products').update(payload).eq('id', product.id)
      : this.#client.from('products').insert(payload);
    const { data, error } = await query.select('id, name, category, price, is_available').single();
    if (error) throw error;
    return data;
  }

  async setProductAvailability(productId, isAvailable) {
    const { error } = await this.#client.from('products').update({ is_available: isAvailable }).eq('id', productId);
    if (error) throw error;
  }

  async createOrder({ items, totalAmount, paymentMethod = 'cash' }) {
    const { data: order, error: orderError } = await this.#client.from('orders').insert({ total_amount: totalAmount, payment_method: paymentMethod, status: 'completed' }).select('id').single();
    if (orderError) throw orderError;

    const orderItems = items.map((item) => ({ order_id: order.id, product_id: item.id, quantity: item.quantity, subtotal: item.subtotal }));
    const { error: itemError } = await this.#client.from('order_items').insert(orderItems);
    if (itemError) throw itemError;
    return order;
  }

  async getTodaySummary() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data, error } = await this.#client.from('orders').select('id, total_amount').eq('status', 'completed').gte('created_at', startOfDay.toISOString());
    if (error) throw error;
    return { revenue: data.reduce((sum, order) => sum + Number(order.total_amount), 0), orderCount: data.length };
  }

  async getSalesDashboard() {
    const { data: latestCloseout, error: closeoutError } = await this.#client.from('daily_closeouts').select('closed_at').order('closed_at', { ascending: false }).limit(1).maybeSingle();
    if (closeoutError) throw closeoutError;
    const startAt = latestCloseout?.closed_at ?? new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const { data: orders, error: orderError } = await this.#client.from('orders').select('id, created_at, total_amount, payment_method, status').eq('status', 'completed').gt('created_at', startAt).order('created_at', { ascending: false });
    if (orderError) throw orderError;

    const orderIds = orders.map(({ id }) => id);
    const { data: items, error: itemError } = orderIds.length
      ? await this.#client.from('order_items').select('order_id, product_id, quantity, subtotal, products(name)').in('order_id', orderIds)
      : { data: [], error: null };
    if (itemError) throw itemError;

    const bestSellers = new Map();
    items.forEach((item) => {
      const name = item.products?.name ?? 'Removed product';
      const current = bestSellers.get(name) ?? { name, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += Number(item.subtotal);
      bestSellers.set(name, current);
    });
    const paymentTotals = orders.reduce((totals, order) => {
      totals[order.payment_method] = (totals[order.payment_method] ?? 0) + Number(order.total_amount);
      return totals;
    }, { cash: 0, qr: 0 });
    return {
      revenue: orders.reduce((sum, order) => sum + Number(order.total_amount), 0),
      orderCount: orders.length,
      cashRevenue: paymentTotals.cash,
      qrRevenue: paymentTotals.qr,
      recentOrders: orders.slice(0, 8),
      topSellers: [...bestSellers.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 3),
    };
  }

  async closeCurrentSalesPeriod() {
    const summary = await this.getSalesDashboard();
    if (summary.orderCount === 0) throw new Error('There are no completed sales to close out.');
    const { data, error } = await this.#client.from('daily_closeouts').insert({ total_sales: summary.revenue, cash_collected: summary.cashRevenue, qr_collected: summary.qrRevenue, order_count: summary.orderCount }).select('id, closed_at, total_sales, cash_collected, qr_collected, order_count').single();
    if (error) throw error;
    return data;
  }

  async getCloseoutHistory() {
    const { data, error } = await this.#client.from('daily_closeouts').select('id, closed_at, total_sales, cash_collected, qr_collected, order_count').order('closed_at', { ascending: false }).limit(30);
    if (error) throw error;
    return data;
  }
}
