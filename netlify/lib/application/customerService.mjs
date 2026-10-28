// Clientes (solo lectura): resumen de compras y detalle con pedidos y direcciones.
// Consultar el detalle de un cliente expone datos personales, por eso queda auditado.
import { NotFoundError } from "../domain/errors.mjs";
import * as v from "../domain/validate.mjs";
import { PAID_STATUSES } from "../domain/orderStateMachine.mjs";

function summarize(customer, orders) {
  const paid = orders.filter((o) => PAID_STATUSES.includes(o.status));
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    active: customer.active,
    createdAt: customer.createdAt,
    lastLoginAt: customer.lastLoginAt ?? null,
    orders: orders.length,
    totalSpent: paid.reduce((sum, o) => sum + o.total, 0),
    lastOrderAt: orders[0]?.createdAt ?? null,
  };
}

export function createCustomerService({ users, orders, addresses, audit }) {
  async function list() {
    const [customers, allOrders] = await Promise.all([users.list({ role: "cliente" }), orders.list()]);
    const byUser = new Map();
    for (const order of allOrders) byUser.set(order.userId, [...(byUser.get(order.userId) ?? []), order]);
    return customers.map((c) => summarize(c, byUser.get(c.id) ?? [])).sort((a, b) => b.totalSpent - a.totalSpent || a.email.localeCompare(b.email));
  }

  async function detail(ctx, rawId) {
    const customer = await users.findById(v.id(rawId));
    if (!customer || customer.role !== "cliente") throw new NotFoundError("Cliente no encontrado");
    const [customerOrders, customerAddresses] = await Promise.all([orders.listByUser(customer.id), addresses.listByUser(customer.id)]);
    await audit.record(ctx, "customer.view", { target: `user:${customer.id}` });
    return { customer: summarize(customer, customerOrders), orders: customerOrders, addresses: customerAddresses };
  }

  return { list, detail };
}
