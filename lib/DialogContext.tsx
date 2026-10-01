import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import AppDialog from '../components/AppDialog';

/**
 * Los avisos y confirmaciones de la app, con su propio aspecto.
 *
 * POR QUE NO Alert.alert
 *
 * `Alert.alert` abre un UIAlertController de iOS, y React Native no expone
 * NINGUNA forma de darle color: sale blanco --o gris oscuro, declarando
 * userInterfaceStyle-- con el azul del sistema, encima de una app morada.
 *
 * Y hay un motivo que no es estetico: el alert nativo es una presentacion de
 * UIKit, igual que un Modal. iOS la rechaza si hay otra en curso, en silencio.
 * Varios de estos avisos salen justo despues de cerrarse el selector de fotos
 * --"Enviada a revision"-- que es exactamente ese momento. Esto se dibuja
 * dentro del arbol que ya existe, asi que no presenta nada y no puede chocar.
 *
 * La firma imita a la de Alert.alert a proposito, para que los sitios que lo
 * usaban cambien solo el nombre de la funcion y no su forma.
 */

export interface DialogButton {
  text: string;
  onPress?: () => void;
  /** 'destructive' va en rosa; 'cancel' apagado. Igual que en el nativo. */
  style?: 'default' | 'cancel' | 'destructive';
}

export interface DialogRequest {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

interface DialogApi {
  alert: (title: string, message?: string, buttons?: DialogButton[]) => void;
}

const DialogContext = createContext<DialogApi>({ alert: () => {} });

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);

  const alert = useCallback(
    (title: string, message?: string, buttons?: DialogButton[]) => {
      setRequest({
        title,
        message,
        // Sin botones, uno de aceptar: es lo que hace el nativo y evita un
        // aviso del que no se pueda salir.
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
      });
    },
    [],
  );

  const handlePress = useCallback((button: DialogButton) => {
    setRequest(null);
    // La accion se ejecuta DESPUES de cerrar, como en el nativo: varias abren
    // la galeria o navegan, y hacerlo con el aviso todavia en pantalla deja una
    // capa por encima de lo que se acaba de abrir.
    setTimeout(() => button.onPress?.(), 0);
  }, []);

  return (
    <DialogContext.Provider value={{ alert }}>
      {children}
      <AppDialog request={request} onPress={handlePress} />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}
