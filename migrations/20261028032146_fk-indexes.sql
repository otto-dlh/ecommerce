-- Indices para llaves foraneas sin cubrir (hallazgos missing-fk-index del advisor):
-- aceleran los borrados en cascada y las consultas por usuario o pedido.
CREATE INDEX IF NOT EXISTS reviews_user_idx ON public.reviews (user_id);
CREATE INDEX IF NOT EXISTS reviews_moderated_by_idx ON public.reviews (moderated_by) WHERE moderated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS mfa_challenges_user_idx ON public.mfa_challenges (user_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_order_idx ON public.coupon_redemptions (order_id);
