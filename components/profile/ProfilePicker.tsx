'use client';

import { useState } from 'react';
import { ArrowLeft, Camera, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { AvatarId, BloodType, CrewProfile, CrewScenario } from '../../types/profile';
import { DEMO_PROFILES, useProfileStore } from '../../store/useProfileStore';
import AstroAvatar, { AVATARS, AVATAR_IDS } from './AstroAvatar';
import CrewAvatar from './CrewAvatar';

const SCENARIO_BADGE: Record<CrewScenario, { label: string; cls: string }> = {
  critical: { label: 'Escenario crítico', cls: 'border-red-400/60 bg-red-500/15 text-red-200' },
  stable: { label: 'Escenario estable', cls: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200' },
  live: { label: 'Telemetría en vivo', cls: 'border-cyan-400/60 bg-cyan-500/10 text-cyan-200' },
};

/** Recorta al centro y reduce la foto a 256×256 para guardarla en el navegador. */
function toSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Sin canvas'));
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/webp', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

const ROLES = ['Comandante', 'Piloto', 'Especialista de misión', 'Ingeniero de vuelo', 'Médico de a bordo'];
const BLOOD: BloodType[] = ['O+', 'O−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−'];

/* ------------------------------------------------------------------ */

function ProfileTile({
  profile,
  managing,
  onPick,
  onDelete,
}: {
  profile: CrewProfile;
  managing: boolean;
  onPick: () => void;
  onDelete: () => void;
}) {
  const badge = SCENARIO_BADGE[profile.scenario];
  const deletable = managing && !profile.demo;
  return (
    <li className="profile-tile flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={deletable ? onDelete : onPick}
        disabled={managing && profile.demo}
        aria-label={deletable ? `Borrar el perfil de ${profile.name}` : `Entrar como ${profile.name}, ${profile.role}`}
        className="group relative block h-28 w-28 sm:h-36 sm:w-36 rounded-xl outline-none ring-offset-4 ring-offset-black transition hover:scale-105 focus-visible:ring-4 focus-visible:ring-white disabled:opacity-50 disabled:hover:scale-100 cursor-pointer disabled:cursor-not-allowed"
      >
        <CrewAvatar profile={profile} className="h-full w-full rounded-xl border-2 border-transparent transition group-hover:border-white" />
        {deletable && (
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
            <Trash2 className="h-8 w-8 text-red-300" aria-hidden />
          </span>
        )}
      </button>
      <div className="text-center">
        <p className="text-base sm:text-lg text-slate-200 group-hover:text-white">{profile.name}</p>
        <p className="text-xs text-slate-400">{profile.role} · {profile.agency}</p>
        <span className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */

const field =
  'w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none';
const label = 'block text-xs uppercase tracking-wider text-slate-400 mb-1';

function CreateProfile({ onDone, onCancel }: { onDone: (p: CrewProfile) => void; onCancel: () => void }) {
  const addProfile = useProfileStore((s) => s.addProfile);
  const [avatar, setAvatar] = useState<AvatarId>('oceano');
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo tiene que ser una imagen.');
      return;
    }
    try {
      setPhoto(await toSquareDataUrl(file));
      setError(null);
    } catch {
      setError('No se pudo cargar esa imagen. Prueba con otra.');
    }
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    if (!name) {
      setError('Escribe el nombre del tripulante.');
      return;
    }
    const num = (k: string, d: number) => {
      const v = Number(fd.get(k));
      return Number.isFinite(v) && v > 0 ? v : d;
    };
    const profile = addProfile({
      name,
      role: String(fd.get('role')),
      avatar,
      photo,
      age: num('age', 35),
      heightCm: num('height', 175),
      weightKg: num('weight', 70),
      bloodType: String(fd.get('blood')) as BloodType,
      allergies: String(fd.get('allergies') ?? '').trim() || 'Ninguna',
      history: String(fd.get('history') ?? '').trim() || 'Sin antecedentes registrados.',
      agency: String(fd.get('agency') ?? '').trim() || 'Independiente',
      scenario: String(fd.get('scenario')) as CrewScenario,
    });
    onDone(profile);
  };

  return (
    <form onSubmit={submit} className="w-full max-w-2xl space-y-6 text-left" noValidate>
      <div>
        <h2 className="font-brand text-3xl sm:text-4xl text-white">Nuevo tripulante</h2>
        <p className="font-lead text-base text-slate-300 mt-1">
          Estos datos acompañan a cualquier alerta médica que se envíe a Tierra. Se guardan en este dispositivo.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="h-24 w-24 overflow-hidden rounded-xl border border-slate-600">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa de una foto local
            <img src={photo} alt="Vista previa de la foto" className="h-full w-full object-cover" />
          ) : (
            <AstroAvatar id={avatar} className="h-full w-full" />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-500 px-3 py-2 text-sm text-slate-200 hover:border-white transition">
              <Camera className="h-4 w-4" aria-hidden /> {photo ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept="image/*" onChange={onPhoto} className="sr-only" />
            </label>
            {photo && (
              <button type="button" onClick={() => setPhoto(undefined)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white transition cursor-pointer">
                <X className="h-4 w-4" aria-hidden /> Quitar
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">Opcional. Usa una foto tuya o de alguien que te haya dado permiso.</p>
        </div>
      </div>

      <fieldset>
        <legend className={label}>{photo ? 'Avatar (si quitas la foto)' : 'Avatar'}</legend>
        <div className="flex flex-wrap gap-3">
          {AVATAR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAvatar(id)}
              aria-pressed={avatar === id}
              aria-label={`Avatar ${AVATARS[id].label}`}
              className={`relative h-16 w-16 rounded-lg transition cursor-pointer ${avatar === id ? 'ring-4 ring-white' : 'opacity-70 hover:opacity-100'}`}
            >
              <AstroAvatar id={id} className="h-full w-full rounded-lg" />
              {avatar === id && (
                <span className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5">
                  <Check className="h-3 w-3 text-black" aria-hidden />
                </span>
              )}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="pf-name" className={label}>Nombre</label>
          <input id="pf-name" name="name" className={field} placeholder="Nombre y apellido" autoFocus />
        </div>
        <div>
          <label htmlFor="pf-role" className={label}>Rol a bordo</label>
          <select id="pf-role" name="role" className={field} defaultValue="Especialista de misión">
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pf-agency" className={label}>Agencia</label>
          <input id="pf-agency" name="agency" className={field} placeholder="NASA, ESA, JAXA…" />
        </div>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <div>
            <label htmlFor="pf-age" className={label}>Edad</label>
            <input id="pf-age" name="age" type="number" min={18} max={80} className={field} placeholder="35" />
          </div>
          <div>
            <label htmlFor="pf-height" className={label}>Altura (cm)</label>
            <input id="pf-height" name="height" type="number" min={120} max={220} className={field} placeholder="175" />
          </div>
          <div>
            <label htmlFor="pf-weight" className={label}>Peso (kg)</label>
            <input id="pf-weight" name="weight" type="number" min={35} max={150} className={field} placeholder="70" />
          </div>
        </div>
        <div>
          <label htmlFor="pf-blood" className={label}>Grupo sanguíneo</label>
          <select id="pf-blood" name="blood" className={field} defaultValue="O+">
            {BLOOD.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pf-allergies" className={label}>Alergias</label>
          <input id="pf-allergies" name="allergies" className={field} placeholder="Ninguna" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pf-history" className={label}>Antecedentes y medicación</label>
          <textarea id="pf-history" name="history" rows={2} className={field} placeholder="Opcional" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pf-scenario" className={label}>Telemetría de la demo</label>
          <select id="pf-scenario" name="scenario" className={field} defaultValue="live">
            <option value="live">En vivo (dataset de sensores)</option>
            <option value="stable">Escenario estable (molestias leves)</option>
            <option value="critical">Escenario crítico (alerta automática a Tierra)</option>
          </select>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="rounded-lg bg-white px-6 py-2.5 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-200 transition cursor-pointer">
          Crear y entrar
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-500 px-6 py-2.5 text-sm uppercase tracking-wider text-slate-300 hover:border-white hover:text-white transition cursor-pointer">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

/**
 * «¿Quién está a bordo?»: elige el tripulante con el que se entra a la app,
 * al estilo de los perfiles de una plataforma de streaming.
 */
export function ProfilePicker({ onPick, onBack }: { onPick: (p: CrewProfile) => void; onBack: () => void }) {
  const custom = useProfileStore((s) => s.custom);
  const removeProfile = useProfileStore((s) => s.removeProfile);
  const [mode, setMode] = useState<'pick' | 'manage' | 'create'>('pick');
  const profiles = [...DEMO_PROFILES, ...custom];
  const managing = mode === 'manage';

  return (
    <div className="profile-screen relative h-[100svh] w-full overflow-y-auto bg-[#03020b] text-white">
      <div className="profile-bg" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center gap-10 px-5 py-16 text-center">
        <button
          type="button"
          onClick={mode === 'create' ? () => setMode('pick') : onBack}
          className="absolute left-5 top-5 inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> {mode === 'create' ? 'Perfiles' : 'Misiones'}
        </button>

        {mode === 'create' ? (
          <CreateProfile onDone={onPick} onCancel={() => setMode('pick')} />
        ) : (
          <>
            <div className="space-y-2 profile-rise">
              <h1 className="font-brand text-4xl sm:text-6xl text-white">
                {managing ? 'Administrar perfiles' : '¿Quién está a bordo?'}
              </h1>
              <p className="font-lead text-lg text-slate-300">
                {managing
                  ? 'Toca un perfil creado para borrarlo. Los de la demo no se pueden borrar.'
                  : 'Elige el tripulante. Cada uno tiene sus datos médicos y su propia misión.'}
              </p>
            </div>

            <ul className="profile-rise flex flex-wrap items-start justify-center gap-6 sm:gap-10" style={{ animationDelay: '0.15s' }}>
              {profiles.map((p) => (
                <ProfileTile
                  key={p.id}
                  profile={p}
                  managing={managing}
                  onPick={() => onPick(p)}
                  onDelete={() => removeProfile(p.id)}
                />
              ))}
              {!managing && (
                <li className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('create')}
                    aria-label="Añadir tripulante"
                    className="flex h-28 w-28 sm:h-36 sm:w-36 items-center justify-center rounded-xl border-2 border-dashed border-slate-500 text-slate-400 transition hover:scale-105 hover:border-white hover:text-white cursor-pointer"
                  >
                    <Plus className="h-12 w-12" aria-hidden />
                  </button>
                  <p className="text-base sm:text-lg text-slate-400">Añadir tripulante</p>
                </li>
              )}
            </ul>

            {(custom.length > 0 || managing) && (
              <button
                type="button"
                onClick={() => setMode(managing ? 'pick' : 'manage')}
                className="profile-rise inline-flex items-center gap-2 border border-slate-500 px-6 py-2 text-sm uppercase tracking-[0.25em] text-slate-300 hover:border-white hover:text-white transition cursor-pointer"
                style={{ animationDelay: '0.3s' }}
              >
                {managing ? <><Check className="h-4 w-4" aria-hidden /> Listo</> : <><Pencil className="h-4 w-4" aria-hidden /> Administrar perfiles</>}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ProfilePicker;
