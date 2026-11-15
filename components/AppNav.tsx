'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Compass, House, Languages, Menu, Moon, Orbit, ScanLine, X } from 'lucide-react';
import { useIntroStore } from '../store/useIntroStore';
import { useActiveProfile } from '../store/useProfileStore';
import CrewAvatar from './profile/CrewAvatar';
import { MISSION_CHOICES, saveChoice, type MissionSlug } from '../utils/missionChoice';
import { useT } from '../i18n/I18nContext';

const SLUGS: MissionSlug[] = ['luna', 'marte'];
const SECTION_IDS = ['cuerpo', 'mando'] as const;
type SectionId = (typeof SECTION_IDS)[number];

/**
 * Barra fija de navegación (Mobile-First):
 * En teléfonos (<768px) muestra una fila compacta con conmutador Cuerpo/Mando,
 * selector ES/EN y menú desplegable para Destino, Tour guiado, Tripulante e Inicio.
 * En tabletas y PC (>=768px) despliega la barra horizontal completa.
 */
export function AppNav({ mision }: { mision?: MissionSlug }) {
  const pathname = usePathname();
  const isPanel = pathname === '/panel';
  const isDemo = pathname === '/demo';
  const showIntro = useIntroStore((s) => s.show);
  const profile = useActiveProfile();
  const { t, lang, setLang } = useT();
  const [active, setActive] = useState<SectionId>('cuerpo');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setMobileMenuOpen(false);
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
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur font-mono text-xs">
      <nav
        aria-label="ExoVitals Navigation"
        className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 px-3 sm:px-6 py-1.5"
      >
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <Link
            href={`/panel${missionQuery}`}
            onClick={(e) => {
              setMobileMenuOpen(false);
              if (!isPanel) return;
              e.preventDefault();
              const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
            }}
            className="min-h-[44px] shrink-0 inline-flex items-center gap-1.5 sm:gap-2 font-display font-bold uppercase tracking-[0.16em] sm:tracking-[0.2em] text-slate-200 hover:text-cyan-300 transition cursor-pointer"
          >
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" aria-hidden />
            <span>ExoVitals</span>
          </Link>

          {/* Conmutador rápido en teléfono (<768px) */}
          <div className="flex md:hidden items-center gap-1 min-w-0">
            {sectionItems.map(({ id, label, icon: Icon }) => {
              const on = isPanel && active === id;
              const className = `min-h-[40px] inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] transition truncate ${
                on ? 'bg-cyan-500/15 text-cyan-200 font-semibold' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
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
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{label}</span>
                </a>
              ) : (
                <Link key={id} href={`/panel${missionQuery}#${id}`} className={className}>
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>

          {/* Secciones completas en tablet y PC (>=768px) */}
          <div className="hidden md:flex flex-wrap items-center gap-1">
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
        </div>

        {/* Controles derechos en teléfono (<768px): ES/EN + Menú */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <div
            role="group"
            aria-label={t.nav.languageLabel}
            className="flex items-center rounded-full border border-slate-700 p-0.5"
          >
            <button
              type="button"
              onClick={() => setLang('es')}
              aria-pressed={lang === 'es'}
              className={`min-h-[38px] min-w-[34px] rounded-full px-2 py-1 font-bold transition cursor-pointer ${
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
              className={`min-h-[38px] min-w-[34px] rounded-full px-2 py-1 font-bold transition cursor-pointer ${
                lang === 'en'
                  ? 'bg-cyan-500/25 text-cyan-200'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {t.nav.languageToggleEn}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-expanded={mobileMenuOpen}
            aria-label="ExoVitals Menu"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500/50 cursor-pointer transition"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-cyan-300" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>

        {/* Controles derechos en tablet y PC (>=768px) */}
        <div className="hidden md:flex ml-auto flex-wrap items-center gap-2">
          <span className="hidden xl:inline text-slate-400">{t.nav.destinationLabel}</span>
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
                  className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
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
            <Languages className="h-3.5 w-3.5 text-slate-400 mx-1.5 hidden lg:inline" aria-hidden />
            <button
              type="button"
              onClick={() => setLang('es')}
              aria-pressed={lang === 'es'}
              className={`min-h-[40px] min-w-[40px] rounded-full px-2.5 py-1 font-bold transition cursor-pointer ${
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
              className={`min-h-[40px] min-w-[40px] rounded-full px-2.5 py-1 font-bold transition cursor-pointer ${
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
              <span className="hidden lg:inline">{profile.name}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => showIntro('title')}
            title={t.nav.replayIntroTitle}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 px-3 text-cyan-200 hover:bg-cyan-500/15 transition cursor-pointer"
          >
            <House className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden lg:inline">{t.nav.home}</span>
          </button>
        </div>
      </nav>

      {/* Menú desplegable móvil (<768px) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/98 px-3 py-3 space-y-3 shadow-2xl">
          <div className="grid grid-cols-3 gap-1.5">
            {sectionItems.map(({ id, label, icon: Icon }) => {
              const on = isPanel && active === id;
              const className = `min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center transition ${
                on ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40' : 'text-slate-300 bg-slate-900/80 border border-slate-800'
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
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{label}</span>
                </a>
              ) : (
                <Link
                  key={id}
                  href={`/panel${missionQuery}#${id}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={className}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}

            <Link
              href={`/demo${missionQuery}`}
              onClick={() => setMobileMenuOpen(false)}
              aria-current={isDemo ? 'page' : undefined}
              className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center transition ${
                isDemo
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                  : 'text-slate-300 bg-slate-900/80 border border-slate-800'
              }`}
            >
              <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{t.nav.sectionDemo}</span>
            </Link>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 shrink-0">
              {t.nav.destinationLabel}
            </span>
            <div
              role="radiogroup"
              aria-label={t.nav.destinationLabel}
              className="grid grid-cols-2 gap-1.5 flex-1 max-w-[240px]"
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
                    onClick={() => {
                      saveChoice(slug);
                      setMobileMenuOpen(false);
                    }}
                    className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 font-bold transition ${
                      on
                        ? slug === 'marte'
                          ? 'border-orange-400/50 bg-orange-500/20 text-orange-100'
                          : 'border-cyan-400/50 bg-slate-200/15 text-white'
                        : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{missionText}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            {profile && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  showIntro('profiles');
                }}
                title={t.nav.switchCrew}
                className="min-h-[44px] flex-1 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-slate-200 hover:border-slate-400 hover:text-white transition cursor-pointer"
              >
                <CrewAvatar profile={profile} className="h-6 w-6 rounded-full shrink-0" />
                <span className="truncate font-semibold">{profile.name}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                showIntro('title');
              }}
              title={t.nav.replayIntroTitle}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-1.5 text-cyan-200 hover:bg-cyan-500/20 transition cursor-pointer shrink-0"
            >
              <House className="h-3.5 w-3.5" aria-hidden />
              <span>{t.nav.home}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default AppNav;
