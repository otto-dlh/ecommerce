// Catalogo UNICO de endpoints de la API, agrupado como los modulos del servidor (server/modules/*).
// - Cambiar una ruta = cambiar una linea aqui; ningun componente escribe URLs.
// - Los parametros de ruta se codifican siempre en este punto (encodeURIComponent): un id con "/" o ".."
//   nunca puede alterar la ruta que se llama.
// - tests/contract/apiEndpoints.test.mjs verifica que cada endpoint exista en el router del servidor.

/** Arma la URL: reemplaza ":param" (codificado) y agrega la query sin valores vacios. */
export function buildUrl(path, params = {}, query = {}) {
  const url = path.replace(/:(\w+)/g, (_, key) => {
    const value = params[key];
    if (value === undefined || value === null || value === "") throw new Error(`Falta el parámetro "${key}" de ${path}`);
    return encodeURIComponent(String(value));
  });
  const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "")).toString();
  return search ? `${url}?${search}` : url;
}

/** Metodo HTTP + plantilla de ruta (":id" = parametro). */
const endpoint = (method, path) => Object.freeze({ method, path, url: (params, query) => buildUrl(path, params, query) });
const group = (endpoints) => Object.freeze(endpoints);

export const ENDPOINTS = Object.freeze({
  identity: group({
    me: endpoint("GET", "/api/auth/me"),
    login: endpoint("POST", "/api/auth/login"),
    verifyMfa: endpoint("POST", "/api/auth/mfa/verify"),
    register: endpoint("POST", "/api/auth/register"),
    logout: endpoint("POST", "/api/auth/logout"),
    logoutAll: endpoint("POST", "/api/auth/logout-all"),
    changePassword: endpoint("POST", "/api/auth/password"),
    mfaSetup: endpoint("POST", "/api/auth/mfa/setup"),
    mfaEnable: endpoint("POST", "/api/auth/mfa/enable"),
    mfaDisable: endpoint("POST", "/api/auth/mfa/disable"),
    users: endpoint("GET", "/api/admin/users"),
    updateUser: endpoint("PUT", "/api/admin/users/:id"),
    accessSummary: endpoint("GET", "/api/admin/access/summary"),
    sessions: endpoint("GET", "/api/admin/access/sessions"),
    revokeSession: endpoint("DELETE", "/api/admin/access/sessions/:id"),
    lockouts: endpoint("GET", "/api/admin/access/lockouts"),
    failedAttempts: endpoint("GET", "/api/admin/access/attempts"),
    unlock: endpoint("POST", "/api/admin/access/unlock"),
    policy: endpoint("GET", "/api/admin/access/policy"),
    updatePolicy: endpoint("PUT", "/api/admin/access/policy"),
    forcePassword: endpoint("POST", "/api/admin/access/users/:id/force-password"),
    resetMfa: endpoint("POST", "/api/admin/access/users/:id/reset-mfa"),
    revokeUserSessions: endpoint("POST", "/api/admin/access/users/:id/revoke-sessions"),
  }),
  catalog: group({
    products: endpoint("GET", "/api/products"),
    product: endpoint("GET", "/api/products/:id"),
    categories: endpoint("GET", "/api/categories"),
    createReview: endpoint("POST", "/api/products/:id/reviews"),
    adminProducts: endpoint("GET", "/api/admin/products"),
    createProduct: endpoint("POST", "/api/admin/products"),
    updateProduct: endpoint("PUT", "/api/admin/products/:id"),
    adjustStock: endpoint("POST", "/api/admin/products/:id/stock"),
    uploadImage: endpoint("POST", "/api/admin/products/:id/image"),
    removeImage: endpoint("DELETE", "/api/admin/products/:id/image"),
    adminCategories: endpoint("GET", "/api/admin/categories"),
    createCategory: endpoint("POST", "/api/admin/categories"),
    updateCategory: endpoint("PUT", "/api/admin/categories/:id"),
    adminReviews: endpoint("GET", "/api/admin/reviews"),
    hideReview: endpoint("POST", "/api/admin/reviews/:id/hide"),
    restoreReview: endpoint("POST", "/api/admin/reviews/:id/restore"),
  }),
  sales: group({
    publicCoupons: endpoint("GET", "/api/coupons"),
    quote: endpoint("POST", "/api/cart/quote"),
    myOrders: endpoint("GET", "/api/orders"),
    order: endpoint("GET", "/api/orders/:id"),
    placeOrder: endpoint("POST", "/api/orders"),
    cancelOrder: endpoint("POST", "/api/orders/:id/cancel"),
    adminOrders: endpoint("GET", "/api/admin/orders"),
    changeOrderStatus: endpoint("POST", "/api/admin/orders/:id/status"),
    adminCoupons: endpoint("GET", "/api/admin/coupons"),
    createCoupon: endpoint("POST", "/api/admin/coupons"),
    updateCoupon: endpoint("PUT", "/api/admin/coupons/:code"),
    paymentWebhook: endpoint("POST", "/api/payments/webhook"),
  }),
  customers: group({
    addresses: endpoint("GET", "/api/addresses"),
    createAddress: endpoint("POST", "/api/addresses"),
    deleteAddress: endpoint("DELETE", "/api/addresses/:id"),
    customers: endpoint("GET", "/api/admin/customers"),
    customer: endpoint("GET", "/api/admin/customers/:id"),
  }),
  audit: group({
    entries: endpoint("GET", "/api/admin/audit"),
  }),
  reporting: group({
    stats: endpoint("GET", "/api/admin/stats"),
  }),
  // Proveedor externo simulado (otra funcion, otra frontera de confianza): la tarjeta nunca va a /api
  paymentGateway: group({
    pay: endpoint("POST", "/sandbox/pay"),
  }),
});
