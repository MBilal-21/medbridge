-- Admins verify doctors. Kept in its own migration because a new enum value
-- must be committed before policies can use it.
alter type public.user_role add value if not exists 'admin';
