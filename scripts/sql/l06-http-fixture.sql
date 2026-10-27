-- DevStaging only. One new disposable identity; clean it through the account API.
with fixture as (select gen_random_uuid() id,gen_random_uuid()::text||gen_random_uuid()::text password),
created as (
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
 confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,reauthentication_token,created_at,updated_at,is_super_admin)
 select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-l06-http-'||id||'@example.invalid',
 extensions.crypt(password,extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"role":"youth"}',
 '','','','','','',now(),now(),false from fixture returning id,email
)
select jsonb_build_object('id',c.id,'email',c.email,'password',f.password) config from created c join fixture f using(id);
