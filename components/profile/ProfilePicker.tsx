'use client';

import { useState } from 'react';
import { ArrowLeft, Camera, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { AvatarId, BloodType, CrewProfile, CrewScenario } from '../../types/profile';
import { DICTS } from '../../i18n/I18nContext';
import type { TranslationDict } from '../../i18n/es';
import { DEMO_PROFILES, useProfileStore } from '../../store/useProfileStore';
import { ROLE_IDS, crewText } from './crewText';
import AstroAvatar, { AVATAR_IDS } from './AstroAvatar';
import CrewAvatar from './CrewAvatar';

const SCENARIO_BADGE: Record<CrewScenario, string> = {
  critical: 'border-red-400/60 bg-red-500/15 text-red-200',
  stable: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200',
  live: 'border-cyan-400/60 bg-cyan-500/10 text-cyan-200',
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

const BLOOD: BloodType[] = ['O+', 'O−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−'];

/* ------------------------------------------------------------------ */

function ProfileTile({
  profile,
  managing,
  onPick,
  onDelete,
  t,
}: {
  profile: CrewProfile;
  managing: boolean;
  onPick: () => void;
  onDelete: () => void;
  t: TranslationDict;
}) {
  const role = crewText(profile, t).role;
  const deletable = managing && !profile.demo;
  return (
    <li className="profile-tile flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={deletable ? onDelete : onPick}
        disabled={managing && profile.demo}
        aria-label={deletable ? t.profiles.deleteAria(profile.name) : t.profiles.enterAs(profile.name, role)}
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
        <p className="text-xs text-slate-400">{role} · {profile.agency}</p>
        <span className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${SCENARIO_BADGE[profile.scenario]}`}>
          {t.profiles.badges[profile.scenario]}
        </span>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */

const field =
  'min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none';
const label = 'block text-xs uppercase tracking-wider text-slate-400 mb-1';

function CreateProfile({ onDone, onCancel }: { onDone: (p: CrewProfile) => void; onCancel: () => void }) {
  // La intro no tiene selector de idioma: siempre en inglés.
  const t = DICTS.en;
  const f = t.profiles.form;
  const addProfile = useProfileStore((s) => s.addProfile);
  const [avatar, setAvatar] = useState<AvatarId>('oceano');
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(f.errImage);
      return;
    }
    try {
      setPhoto(await toSquareDataUrl(file));
      setError(null);
    } catch {
      setError(f.errLoad);
    }
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    if (!name) {
      setError(f.errName);
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
      allergies: String(fd.get('allergies') ?? '').trim() || f.defaultAllergies,
      history: String(fd.get('history') ?? '').trim() || f.defaultHistory,
      agency: String(fd.get('agency') ?? '').trim() || f.defaultAgency,
      scenario: String(fd.get('scenario')) as CrewScenario,
    });
    onDone(profile);
  };

  return (
    <form onSubmit={submit} className="w-full max-w-2xl space-y-6 text-left" noValidate>
      <div>
        <h2 className="font-heading font-bold text-3xl sm:text-4xl tracking-tight text-white">{f.title}</h2>
        <p className="font-lead text-base text-slate-300 mt-1">
          {f.intro}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="h-24 w-24 overflow-hidden rounded-xl border border-slate-600">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa de una foto local
            <img src={photo} alt={f.photoPreviewAlt} className="h-full w-full object-cover" />
          ) : (
            <AstroAvatar id={avatar} className="h-full w-full" />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-500 px-3 py-2 text-sm text-slate-200 hover:border-white transition">
              <Camera className="h-4 w-4" aria-hidden /> {photo ? f.changePhoto : f.uploadPhoto}
              <input type="file" accept="image/*" onChange={onPhoto} className="sr-only" />
            </label>
            {photo && (
              <button type="button" onClick={() => setPhoto(undefined)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white transition cursor-pointer">
                <X className="h-4 w-4" aria-hidden /> {f.removePhoto}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">{f.photoHint}</p>
        </div>
      </div>

      <fieldset>
        <legend className={label}>{photo ? f.avatarLegendWithPhoto : f.avatarLegend}</legend>
        <div className="flex flex-wrap gap-3">
          {AVATAR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAvatar(id)}
              aria-pressed={avatar === id}
              aria-label={t.profiles.avatarAria(t.profiles.avatars[id])}
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
          <label htmlFor="pf-name" className={label}>{f.name}</label>
          <input id="pf-name" name="name" className={field} placeholder={f.namePlaceholder} autoFocus />
        </div>
        <div>
          <label htmlFor="pf-role" className={label}>{f.role}</label>
          <select id="pf-role" name="role" className={field} defaultValue="missionSpecialist">
            {ROLE_IDS.map((r) => <option key={r} value={r}>{t.profiles.roles[r]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pf-agency" className={label}>{f.agency}</label>
          <input id="pf-agency" name="agency" className={field} placeholder={f.agencyPlaceholder} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:col-span-2">
          <div>
            <label htmlFor="pf-age" className={label}>{f.age}</label>
            <input id="pf-age" name="age" type="number" min={18} max={80} className={field} placeholder="35" />
          </div>
          <div>
            <label htmlFor="pf-height" className={label}>{f.height}</label>
            <input id="pf-height" name="height" type="number" min={120} max={220} className={field} placeholder="175" />
          </div>
          <div>
            <label htmlFor="pf-weight" className={label}>{f.weight}</label>
            <input id="pf-weight" name="weight" type="number" min={35} max={150} className={field} placeholder="70" />
          </div>
        </div>
        <div>
          <label htmlFor="pf-blood" className={label}>{f.blood}</label>
          <select id="pf-blood" name="blood" className={field} defaultValue="O+">
            {BLOOD.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pf-allergies" className={label}>{f.allergies}</label>
          <input id="pf-allergies" name="allergies" className={field} placeholder={f.allergiesPlaceholder} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pf-history" className={label}>{f.history}</label>
          <textarea id="pf-history" name="history" rows={2} className={field} placeholder={f.historyPlaceholder} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pf-scenario" className={label}>{f.scenario}</label>
          <select id="pf-scenario" name="scenario" className={field} defaultValue="live">
            <option value="live">{f.scenarioLive}</option>
            <option value="stable">{f.scenarioStable}</option>
            <option value="critical">{f.scenarioCritical}</option>
          </select>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="min-h-[44px] flex-1 sm:flex-initial rounded-lg bg-white px-6 py-2.5 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-200 transition cursor-pointer">
          {f.submit}
        </button>
        <button type="button" onClick={onCancel} className="min-h-[44px] flex-1 sm:flex-initial rounded-lg border border-slate-500 px-6 py-2.5 text-sm uppercase tracking-wider text-slate-300 hover:border-white hover:text-white transition cursor-pointer">
          {f.cancel}
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
  // La intro no tiene selector de idioma: siempre en inglés.
  const t = DICTS.en;
  const pt = t.profiles;
  const custom = useProfileStore((s) => s.custom);
  const removeProfile = useProfileStore((s) => s.removeProfile);
  const [mode, setMode] = useState<'pick' | 'manage' | 'create'>('pick');
  const profiles = [...DEMO_PROFILES, ...custom];
  const managing = mode === 'manage';

  return (
    <div className="profile-screen relative h-[100svh] w-full overflow-y-auto bg-[#03020b] text-white">
      <div className="profile-bg" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center gap-6 sm:gap-10 px-4 sm:px-5 pt-16 pb-10 sm:py-16 text-center">
        <button
          type="button"
          onClick={mode === 'create' ? () => setMode('pick') : onBack}
          className="min-h-[44px] absolute left-4 top-3 sm:left-5 sm:top-5 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-slate-400 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> {mode === 'create' ? pt.backProfiles : pt.backMissions}
        </button>

        {mode === 'create' ? (
          <CreateProfile onDone={onPick} onCancel={() => setMode('pick')} />
        ) : (
          <>
            <div className="space-y-2 profile-rise">
              <h1 className="font-heading font-bold text-3xl sm:text-6xl tracking-tight text-white">
                {managing ? pt.titleManage : pt.title}
              </h1>
              <p className="font-lead text-base sm:text-lg text-slate-300">
                {managing
                  ? pt.subtitleManage
                  : pt.subtitle}
              </p>
            </div>

            <ul className="profile-rise grid grid-cols-2 sm:flex sm:flex-wrap items-start justify-center gap-4 sm:gap-10 w-full max-w-md sm:max-w-none" style={{ animationDelay: '0.15s' }}>
              {profiles.map((p) => (
                <ProfileTile
                  key={p.id}
                  profile={p}
                  managing={managing}
                  onPick={() => onPick(p)}
                  onDelete={() => removeProfile(p.id)}
                  t={t}
                />
              ))}
              {!managing && (
                <li className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('create')}
                    aria-label={pt.addCrew}
                    className="flex h-28 w-28 sm:h-36 sm:w-36 items-center justify-center rounded-xl border-2 border-dashed border-slate-500 text-slate-400 transition hover:scale-105 hover:border-white hover:text-white cursor-pointer"
                  >
                    <Plus className="h-12 w-12" aria-hidden />
                  </button>
                  <p className="text-base sm:text-lg text-slate-400">{pt.addCrew}</p>
                </li>
              )}
            </ul>

            {(custom.length > 0 || managing) && (
              <button
                type="button"
                onClick={() => setMode(managing ? 'pick' : 'manage')}
                className="profile-rise min-h-[44px] inline-flex items-center gap-2 border border-slate-500 px-6 py-2 text-sm uppercase tracking-[0.25em] text-slate-300 hover:border-white hover:text-white transition cursor-pointer"
                style={{ animationDelay: '0.3s' }}
              >
                {managing ? <><Check className="h-4 w-4" aria-hidden /> {pt.done}</> : <><Pencil className="h-4 w-4" aria-hidden /> {pt.manage}</>}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ProfilePicker;
