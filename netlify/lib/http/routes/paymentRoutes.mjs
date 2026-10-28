// Webhook de la pasarela (frontera F4): sin sesion ni CSRF; se autentica por firma HMAC.

export function registerPaymentRoutes({ add }, { payments }) {
  add("POST", "/api/payments/webhook", { webhook: true }, (ctx) =>
    payments.handleWebhook(ctx, { rawBody: ctx.raw, signatureHeader: ctx.req.headers.get("sandbox-signature"), event: ctx.body }),
  );
}
