
-- Private bucket for user CVs
insert into storage.buckets (id, name, public) values ('cvs', 'cvs', false)
on conflict (id) do nothing;

create policy "cvs_select_own" on storage.objects for select
  using (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "cvs_insert_own" on storage.objects for insert
  with check (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "cvs_update_own" on storage.objects for update
  using (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "cvs_delete_own" on storage.objects for delete
  using (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[1]);
