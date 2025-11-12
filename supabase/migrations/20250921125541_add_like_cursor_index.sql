CREATE INDEX "likes_createdAt_id_idx" ON public.likes USING btree ("createdAt" DESC, id DESC);


