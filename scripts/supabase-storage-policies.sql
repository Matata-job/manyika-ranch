-- Run once in Supabase → SQL Editor (if photos upload but don't display in browser)

-- Public read access for animal photos bucket
CREATE POLICY "Public read animal photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'animal-photos');

-- Allow authenticated uploads (service role bypasses RLS; this helps dashboard uploads)
CREATE POLICY "Authenticated upload animal photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'animal-photos');
