alter table public.company_profiles
  add column if not exists industry text not null default '',
  add column if not exists address text not null default '',
  add column if not exists employee_count text not null default '',
  add column if not exists common_roles text[] not null default '{}',
  add column if not exists hiring_priorities text[] not null default '{}',
  add column if not exists logo_url text not null default '',
  add column if not exists website_url text not null default '',
  add column if not exists linkedin_url text not null default '',
  add column if not exists instagram_url text not null default '',
  add column if not exists facebook_url text not null default '',
  add column if not exists tiktok_url text not null default '',
  add column if not exists x_url text not null default '';
