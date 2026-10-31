// Acceso a la API del modulo de ventas: cupones, cotizacion, pedidos y su administracion.
import { ENDPOINTS } from "./endpoints.js";
import { callEndpoint } from "./callEndpoint.js";

const E = ENDPOINTS.sales;
const byId = (id) => ({ params: { id } });

export const cartApi = {
  /** Importes calculados por el servidor: el carrito solo envia productos y cantidades. */
  quote: (items, coupon) => callEndpoint(E.quote, { body: { items, coupon: coupon || undefined } }),
  publicCoupons: () => callEndpoint(E.publicCoupons),
};

export const ordersApi = {
  listMine: () => callEndpoint(E.myOrders),
  get: (id) => callEndpoint(E.order, byId(id)),
  place: ({ items, coupon, address }) => callEndpoint(E.placeOrder, { body: { items, coupon: coupon || undefined, address } }),
  cancel: (id) => callEndpoint(E.cancelOrder, byId(id)),
};

export const salesAdminApi = {
  orders: () => callEndpoint(E.adminOrders),
  changeOrderStatus: (id, status) => callEndpoint(E.changeOrderStatus, { ...byId(id), body: { status } }),
  coupons: () => callEndpoint(E.adminCoupons),
  createCoupon: (coupon) => callEndpoint(E.createCoupon, { body: coupon }),
  updateCoupon: (code, changes) => callEndpoint(E.updateCoupon, { params: { code }, body: changes }),
};
