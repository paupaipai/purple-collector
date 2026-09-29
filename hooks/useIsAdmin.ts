import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

/**
 * Si la persona con sesion es admin.
 *
 * Lee su propia fila de `user_profiles`, que es lo unico que la RLS le permite
 * desde SR-2 y SR-7. Y desde SR-8 `is_admin` no se puede escribir por PostgREST
 * ni sobre la propia fila, asi que este valor no es falsificable desde el
 * cliente: sirve para MOSTRAR u ocultar la entrada de moderacion, mientras el
 * permiso real lo imponen las policies y la edge function.
 */
export function useIsAdmin(userId: string | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setIsAdmin(data?.is_admin === true);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId]);

  return { isAdmin, loading };
}
