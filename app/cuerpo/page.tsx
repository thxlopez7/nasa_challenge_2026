import { redirect } from 'next/navigation';

/** El cuerpo 3D ahora es la primera sección de la página única. */
export default function Cuerpo() {
  redirect('/panel#cuerpo');
}
