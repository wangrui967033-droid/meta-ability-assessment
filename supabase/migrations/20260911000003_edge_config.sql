-- Project-specific encryption secrets live in Supabase Vault, never in OSS files.
-- Idempotent: do not rotate keys when rerunning; stored phones depend on them.
do $$
begin
  if not exists (select 1 from vault.secrets where name='meta-ability-assessment:phone-encryption') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'meta-ability-assessment:phone-encryption');
  end if;
  if not exists (select 1 from vault.secrets where name='meta-ability-assessment:phone-lookup') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'meta-ability-assessment:phone-lookup');
  end if;
end;
$$;

create or replace function public.assessment_runtime_config()
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'phoneEncryptionKey',(select decrypted_secret from vault.decrypted_secrets where name='meta-ability-assessment:phone-encryption'),
    'phoneLookupSecret',(select decrypted_secret from vault.decrypted_secrets where name='meta-ability-assessment:phone-lookup')
  );
$$;
revoke all on function public.assessment_runtime_config() from public,anon,authenticated;
grant execute on function public.assessment_runtime_config() to service_role;
