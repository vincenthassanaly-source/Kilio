-- Retire les règles de stockage ouvertes à tout le monde (2026-10-26).
--
-- ÉTAT : déjà appliqué sur la base de production le 2026-10-26 (à la main, éditeur
-- SQL Supabase). Ce fichier est la trace dans le dépôt ; ne pas le rejouer sans
-- avoir vérifié l'état réel de la base.
--
-- Contexte : 9 règles de storage.objects donnaient au rôle `public` (donc sans
-- connexion, avec la seule clé anon) le droit de lire, déposer et supprimer des
-- fichiers dans collection-images, documents-fichiers et tache-images.
-- L'app passe uniquement par la clé de service (qui contourne la RLS) : ces règles
-- ne lui servaient pas. Les buckets restent publics : les fichiers restent lisibles
-- par leur adresse, seuls le listage, le dépôt et la suppression anonymes sont bloqués.

drop policy if exists "collection_images_delete" on storage.objects;
drop policy if exists "collection_images_insert" on storage.objects;
drop policy if exists "collection_images_select" on storage.objects;
drop policy if exists "documents_fichiers_delete" on storage.objects;
drop policy if exists "documents_fichiers_insert" on storage.objects;
drop policy if exists "documents_fichiers_select" on storage.objects;
drop policy if exists "tache_images_delete" on storage.objects;
drop policy if exists "tache_images_insert" on storage.objects;
drop policy if exists "tache_images_select" on storage.objects;

-- Retour arrière (recrée les 9 règles à l'identique) :
--
-- create policy "collection_images_select" on storage.objects for select to public using (bucket_id = 'collection-images');
-- create policy "collection_images_insert" on storage.objects for insert to public with check (bucket_id = 'collection-images');
-- create policy "collection_images_delete" on storage.objects for delete to public using (bucket_id = 'collection-images');
-- create policy "documents_fichiers_select" on storage.objects for select to public using (bucket_id = 'documents-fichiers');
-- create policy "documents_fichiers_insert" on storage.objects for insert to public with check (bucket_id = 'documents-fichiers');
-- create policy "documents_fichiers_delete" on storage.objects for delete to public using (bucket_id = 'documents-fichiers');
-- create policy "tache_images_select" on storage.objects for select to public using (bucket_id = 'tache-images');
-- create policy "tache_images_insert" on storage.objects for insert to public with check (bucket_id = 'tache-images');
-- create policy "tache_images_delete" on storage.objects for delete to public using (bucket_id = 'tache-images');
