'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Compass, House, Languages, Moon, Orbit, ScanLine } from 'lucide-react';
import { useIntroStore } from '../store/useIntroStore';
import { useActiveProfile } from '../store/useProfileStore';
import CrewAvatar from './profile/CrewAvatar';
import { MISSION_CHOICES, saveChoice, type MissionSlug } from '../utils/missionChoice';
import { useT } from '../i18n/I18nContext';

const SLUGS: MissionSlug[] = ['luna', 'marte'];
const SECTION_IDS = ['cuerpo', 'mando'] as const;
type SectionId = (typeof SECTION_IDS)[number];

/**
 * Barra fija de navegación: salta entre secciones, abre el tour guiado `/demo`,
 * cambia de misión (Luna / Marte) y alterna el idioma (ES / EN).
 */
export function AppNav({ mision }: { mision?: MissionSlug }) {
  const pathname = usePathname();
  const isPanel = pathname === '/panel';
  const isDemo = pathname === '/demo';
  const showIntro = useIntroStore((s) => s.show);
  const profile = useActiveProfile();
  const { t, lang, setLang } = useT();
  const [active, setActive] = useState<SectionId>('cuerpo');

  useEffect(() => {
    if (mision) saveChoice(mision);
  }, [mision]);

  useEffect(() => {
    if (!isPanel) return;
    const els = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => !!el
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id as SectionId);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isPanel]);

  const goTo = (id: SectionId) => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
  };

  const sectionItems = [
    { id: 'cuerpo' as const, label: t.nav.sectionBody, icon: ScanLine },
    { id: 'mando' as const, label: t.nav.sectionCommand, icon: Activity },
  ];

  const missionQuery = mision ? `?mision=${mision}` : '';
  const missionBasePath = isDemo ? '/demo' : '/panel';

  return (
    <nav
      aria-label="ExoVitals Navigation"
      className="sticky top-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-800 bg-slate-950/90 backdrop-blur px-4 sm:px-6 py-2 font-mono text-xs"
    >
      <Link
        href={`/panel${missionQuery}`}
        onClick={(e) => {
          if (!isPanel) return;
          e.preventDefault();
          const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
        }}
        className="min-h-[44px] inline-flex items-center gap-2 font-display font-bold uppercase tracking-[0.2em] text-slate-200 hover:text-cyan-300 transition cursor-pointer"
      >
        <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" aria-hidden />
        ExoVitals
      </Link>

      <div className="flex flex-wrap items-center gap-1">
        {sectionItems.map(({ id, label, icon: Icon }) => {
          const on = isPanel && active === id;
          const className = `min-h-[44px] inline-flex items-center gap-1.5 rounded-md px-3 py-2 transition ${
            on ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`;
          return isPanel ? (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                goTo(id);
              }}
              aria-current={on ? 'location' : undefined}
              className={className}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </a>
          ) : (
            <Link key={id} href={`/panel${missionQuery}#${id}`} className={className}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </Link>
          );
        })}

        <Link
          href={`/demo${missionQuery}`}
          aria-current={isDemo ? 'page' : undefined}
          className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-md px-3 py-2 transition ${
            isDemo
              ? 'bg-cyan-500/15 text-cyan-200'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
        >
          <Compass className="h-3.5 w-3.5" aria-hidden />
          {t.nav.sectionDemo}
        </Link>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="hidden lg:inline text-slate-400">{t.nav.destinationLabel}</span>
        <div
          role="radiogroup"
          aria-label={t.nav.destinationLabel}
          className="flex rounded-full border border-slate-700 p-0.5"
        >
          {SLUGS.map((slug) => {
            const choice = MISSION_CHOICES[slug];
            const Icon = slug === 'luna' ? Moon : Orbit;
            const on = mision === slug;
            const missionText = slug === 'luna' ? t.common.moon : t.common.mars;
            return (
              <Link
                key={slug}
                href={`${missionBasePath}?mision=${slug}`}
                scroll={false}
                replace
                role="radio"
                aria-checked={on}
                title={choice.tagline}
                onClick={() => saveChoice(slug)}
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
                  on
                    ? slug === 'marte'
                      ? 'bg-orange-500/20 text-orange-100'
                      : 'bg-slate-200/15 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {missionText}
              </Link>
            );
          })}
        </div>

        <div
          role="group"
          aria-label={t.nav.languageLabel}
          className="flex items-center rounded-full border border-slate-700 p-0.5"
        >
          <Languages className="h-3.5 w-3.5 text-slate-400 mx-1.5 hidden sm:inline" aria-hidden />
          <button
            type="button"
            onClick={() => setLang('es')}
            aria-pressed={lang === 'es'}
            className={`min-h-[38px] min-w-[40px] rounded-full px-2.5 py-1 font-bold transition cursor-pointer ${
              lang === 'es'
                ? 'bg-cyan-500/25 text-cyan-200'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {t.nav.languageToggleEs}
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            className={`min-h-[38px] min-w-[40px] rounded-full px-2.5 py-1 font-bold transition cursor-pointer ${
              lang === 'en'
                ? 'bg-cyan-500/25 text-cyan-200'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {t.nav.languageToggleEn}
          </button>
        </div>

        {profile && (
          <button
            type="button"
            onClick={() => showIntro('profiles')}
            title={t.nav.switchCrew}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-full border border-slate-700 py-0.5 pl-0.5 pr-3 text-slate-300 hover:border-slate-400 hover:text-white transition cursor-pointer"
          >
            <CrewAvatar profile={profile} className="h-7 w-7 rounded-full" />
            <span className="hidden sm:inline">{profile.name}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => showIntro('title')}
          title={t.nav.replayIntroTitle}
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 px-3 text-cyan-200 hover:bg-cyan-500/15 transition cursor-pointer"
        >
          <House className="h-3.5 w-3.5" aria-hidden />
          {t.nav.home}
        </button>
      </div>
    </nav>
  );
}

export default AppNav;
