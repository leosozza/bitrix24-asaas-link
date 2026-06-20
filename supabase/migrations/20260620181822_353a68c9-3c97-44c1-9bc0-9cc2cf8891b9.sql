
CREATE POLICY "tenant_read_contract_pdf" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "tenant_write_contract_pdf" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "tenant_update_contract_pdf" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contracts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "tenant_delete_contract_pdf" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contracts' AND (storage.foldername(name))[1] = auth.uid()::text);
