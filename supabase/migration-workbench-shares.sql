-- Optional additional guard for the private bucket bv-workbench-shares.
-- Provision the bucket through Storage with public=false, a 1 MiB object limit
-- and application/json as the allowed MIME type. The application uses only
-- server-side service_role credentials for objects in this bucket.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'workbench shares server access only'
  ) then
    create policy "workbench shares server access only" on storage.objects
      as restrictive for all to anon, authenticated
      using (bucket_id <> 'bv-workbench-shares')
      with check (bucket_id <> 'bv-workbench-shares');
  end if;
end $$;
