import { redirect } from 'next/navigation';

/**
 * La raíz lleva al centro de mando. La intro (IntroGate, en el layout) se
 * muestra encima al abrir la app y lleva a la misión elegida.
 */
export default function Home() {
  redirect('/panel');
}
