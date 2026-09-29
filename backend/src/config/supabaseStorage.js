import { createClient } from '@supabase/supabase-js';

// Variables requises dans le .env backend :
//   SUPABASE_URL=https://xxxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...   (cle service_role -- PAS la cle anon,
//                                       jamais exposee au frontend)
//   SUPABASE_STORAGE_BUCKET=ads-uploads  (optionnel, valeur par defaut ci-dessous)
//
// Le bucket doit exister et etre configure en PUBLIC dans le dashboard Supabase
// (Storage -> New bucket -> "Public bucket" active), pour que les photos/signatures
// restent affichables sans authentification, comme c'etait le cas avec /uploads.

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'ads-uploads';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
