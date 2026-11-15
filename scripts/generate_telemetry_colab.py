"""
ExoVitals — Generador Científico de Telemetría Clínica (1 Hz · 120 segundos)
=============================================================================
Script diseñado para Google Colab (y ejecutable localmente en Python 3) que
simula la evolución fisiológica y ambiental de un astronauta a 1 Hz (120 ticks)
para alimentar `public/data/scenario_ridge_critical.json`.

Fases clínicas simuladas (alineadas con `types/telemetry.ts` y `utils/clinicalEngine.ts`):
  1. Ticks  0–29 : Baseline nominal en microgravedad (0 alertas).
  2. Ticks 30–59 : Deriva renal oculta en 0G (`cistatinaC > 1.15`, `calcioIonico > 1.25`,
                   mientras `creatinina <= 1.1` permanece enmascarada por sarcopenia).
  3. Ticks 60–89 : Tormenta de partículas solares / SPE (`radiationRate > 50 µSv/h`,
                   `linfocitos < 1000 cél/µL`, `NLR > 3.0`, estrés con `cortisol > 18 ng/mL`).
  4. Ticks 90–119: Saturación del depurador ECLSS / Bolsillo de CO2 (`co2Level > 3500 ppm`
                   con `spO2 >= 96%` conservada, taquicardia compensatoria).
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

try:
    import numpy as np  # type: ignore[import-not-found]
    import pandas as pd  # type: ignore[import-not-found]

    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

SEED = 2026
TOTAL_TICKS = 120
OUTPUT_FILENAME = "scenario_ridge_critical.json"


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _lerp(start: float, end: float, progress: float) -> float:
    t = _clamp(progress, 0.0, 1.0)
    return start + (end - start) * t


def _generate_rows_with_pandas() -> tuple[list[dict[str, float | int]], str]:
    rng = np.random.default_rng(SEED)
    ticks = np.arange(TOTAL_TICKS, dtype=float)

    heart_rate = np.empty(TOTAL_TICKS, dtype=int)
    spo2 = np.empty(TOTAL_TICKS, dtype=int)
    cistatina_c = np.empty(TOTAL_TICKS, dtype=float)
    creatinina = np.empty(TOTAL_TICKS, dtype=float)
    calcio_ionico = np.empty(TOTAL_TICKS, dtype=float)
    linfocitos = np.empty(TOTAL_TICKS, dtype=int)
    neutrofilos = np.empty(TOTAL_TICKS, dtype=int)
    cortisol = np.empty(TOTAL_TICKS, dtype=float)
    co2_level = np.empty(TOTAL_TICKS, dtype=int)
    radiation_rate = np.empty(TOTAL_TICKS, dtype=float)
    radiation_accumulated = np.empty(TOTAL_TICKS, dtype=float)

    acc_rad = 45.0

    for i, t in enumerate(ticks):
        if t < 30:
            # Fase 1: Baseline nominal
            p = t / 29.0
            hr = 71 + 2.0 * math.sin(t * 0.35) + rng.normal(0, 1.4)
            o2 = 99 - (1 if rng.random() < 0.2 else 0)
            cis = _lerp(0.79, 0.90, p) + rng.normal(0, 0.015)
            cr = _lerp(1.09, 1.05, p) + rng.normal(0, 0.015)
            ca = _lerp(1.10, 1.17, p) + rng.normal(0, 0.012)
            linf = _lerp(1510, 1420, p) + rng.normal(0, 22)
            neut = _lerp(2980, 3140, p) + rng.normal(0, 45)
            cort = _lerp(9.8, 11.4, p) + rng.normal(0, 0.35)
            co2 = _lerp(610, 720, p) + rng.normal(0, 18)
            rad_rate = _lerp(15.5, 20.5, p) + rng.normal(0, 1.1)
            acc_rad += 0.10
        elif t < 60:
            # Fase 2: Nefropatía oculta y desmineralización ósea (isRenalWarning)
            p = (t - 30) / 29.0
            hr = _lerp(72, 78, p) + rng.normal(0, 1.6)
            o2 = 98 + (1 if rng.random() < 0.35 else 0)
            cis = _lerp(0.93, 1.40, p) + rng.normal(0, 0.018)
            cr = _lerp(1.04, 0.89, p) + rng.normal(0, 0.014)
            ca = _lerp(1.18, 1.40, p) + rng.normal(0, 0.012)
            linf = _lerp(1400, 1210, p) + rng.normal(0, 22)
            neut = _lerp(3160, 3440, p) + rng.normal(0, 45)
            cort = _lerp(11.6, 15.6, p) + rng.normal(0, 0.4)
            co2 = _lerp(730, 1140, p) + rng.normal(0, 22)
            rad_rate = _lerp(21.0, 31.0, p) + rng.normal(0, 1.5)
            acc_rad += 0.12
        elif t < 90:
            # Fase 3: Tormenta solar SPE e inmunosupresión (isRadiationWarning)
            p = (t - 60) / 29.0
            hr = _lerp(79, 89, p) + rng.normal(0, 1.8)
            o2 = 97 + (1 if rng.random() < 0.45 else 0)
            cis = _lerp(1.40, 1.46, p) + rng.normal(0, 0.015)
            cr = _lerp(0.89, 0.87, p) + rng.normal(0, 0.012)
            ca = _lerp(1.40, 1.44, p) + rng.normal(0, 0.012)
            linf = _lerp(1170, 700, p) + rng.normal(0, 24)
            neut = _lerp(3480, 4180, p) + rng.normal(0, 50)
            cort = _lerp(16.0, 21.8, p) + rng.normal(0, 0.45)
            co2 = _lerp(1180, 2150, p) + rng.normal(0, 30)
            rad_rate = _lerp(46.0, 134.0, p) + rng.normal(0, 3.2)
            acc_rad += 0.88
        else:
            # Fase 4: Saturación scrubber ECLSS / Bolsillo CO2 (isCo2Warning)
            p = (t - 90) / 29.0
            hr = _lerp(90, 108, p) + rng.normal(0, 2.0)
            o2 = int(round(_clamp(_lerp(97.8, 96.4, p) + rng.normal(0, 0.35), 96, 99)))
            cis = _lerp(1.46, 1.53, p) + rng.normal(0, 0.015)
            cr = _lerp(0.87, 0.85, p) + rng.normal(0, 0.012)
            ca = _lerp(1.44, 1.49, p) + rng.normal(0, 0.012)
            linf = _lerp(695, 620, p) + rng.normal(0, 20)
            neut = _lerp(4190, 4460, p) + rng.normal(0, 50)
            cort = _lerp(22.0, 27.5, p) + rng.normal(0, 0.45)
            co2 = _lerp(2250, 4320, p) + rng.normal(0, 40)
            rad_rate = _lerp(130.0, 118.0, p) + rng.normal(0, 3.0)
            acc_rad += 0.60

        heart_rate[i] = int(round(_clamp(hr, 55, 135)))
        spo2[i] = int(_clamp(o2, 95, 100))
        cistatina_c[i] = round(float(_clamp(cis, 0.65, 2.2)), 2)
        creatinina[i] = round(float(_clamp(cr, 0.60, 1.4)), 2)
        calcio_ionico[i] = round(float(_clamp(ca, 1.00, 1.7)), 2)
        linfocitos[i] = int(round(_clamp(linf, 400, 2200)))
        neutrofilos[i] = int(round(_clamp(neut, 2000, 6000)))
        cortisol[i] = round(float(_clamp(cort, 6.0, 35.0)), 1)
        co2_level[i] = int(round(_clamp(co2, 400, 5000)))
        radiation_rate[i] = round(float(_clamp(rad_rate, 10.0, 200.0)), 1)
        radiation_accumulated[i] = round(float(acc_rad), 1)

    df = pd.DataFrame(
        {
            "heartRate": heart_rate,
            "spO2": spo2,
            "cistatinaC": cistatina_c,
            "creatinina": creatinina,
            "calcioIonico": calcio_ionico,
            "linfocitos": linfocitos,
            "neutrofilos": neutrofilos,
            "cortisol": cortisol,
            "co2Level": co2_level,
            "radiationRate": radiation_rate,
            "radiationAccumulated": radiation_accumulated,
        }
    )

    nlr = df["neutrofilos"] / df["linfocitos"]
    renal_hits = int(
        ((df["creatinina"] <= 1.1) & (df["cistatinaC"] > 1.15) & (df["calcioIonico"] > 1.25)).sum()
    )
    rad_hits = int(
        (
            ((df["radiationRate"] > 50.0) | (df["radiationAccumulated"] > 50.0))
            & (df["linfocitos"] < 1000)
            & (nlr > 3.0)
        ).sum()
    )
    co2_hits = int(((df["co2Level"] > 3500) & (df["spO2"] >= 96)).sum())

    summary = (
        f"[Pandas] Frames={len(df)} | R1_Renal={renal_hits} | "
        f"R2_Radiacion={rad_hits} | R3_CO2={co2_hits}"
    )
    records = df.to_dict(orient="records")
    return records, summary


def _generate_rows_stdlib() -> tuple[list[dict[str, float | int]], str]:
    rng = random.Random(SEED)
    rows: list[dict[str, float | int]] = []
    acc_rad = 45.0

    for t in range(TOTAL_TICKS):
        if t < 30:
            p = t / 29.0
            hr = 71 + 2.0 * math.sin(t * 0.35) + rng.gauss(0, 1.4)
            o2 = 99 - (1 if rng.random() < 0.2 else 0)
            cis = _lerp(0.79, 0.90, p) + rng.gauss(0, 0.015)
            cr = _lerp(1.09, 1.05, p) + rng.gauss(0, 0.015)
            ca = _lerp(1.10, 1.17, p) + rng.gauss(0, 0.012)
            linf = _lerp(1510, 1420, p) + rng.gauss(0, 22)
            neut = _lerp(2980, 3140, p) + rng.gauss(0, 45)
            cort = _lerp(9.8, 11.4, p) + rng.gauss(0, 0.35)
            co2 = _lerp(610, 720, p) + rng.gauss(0, 18)
            rad_rate = _lerp(15.5, 20.5, p) + rng.gauss(0, 1.1)
            acc_rad += 0.10
        elif t < 60:
            p = (t - 30) / 29.0
            hr = _lerp(72, 78, p) + rng.gauss(0, 1.6)
            o2 = 98 + (1 if rng.random() < 0.35 else 0)
            cis = _lerp(0.93, 1.40, p) + rng.gauss(0, 0.018)
            cr = _lerp(1.04, 0.89, p) + rng.gauss(0, 0.014)
            ca = _lerp(1.18, 1.40, p) + rng.gauss(0, 0.012)
            linf = _lerp(1400, 1210, p) + rng.gauss(0, 22)
            neut = _lerp(3160, 3440, p) + rng.gauss(0, 45)
            cort = _lerp(11.6, 15.6, p) + rng.gauss(0, 0.4)
            co2 = _lerp(730, 1140, p) + rng.gauss(0, 22)
            rad_rate = _lerp(21.0, 31.0, p) + rng.gauss(0, 1.5)
            acc_rad += 0.12
        elif t < 90:
            p = (t - 60) / 29.0
            hr = _lerp(79, 89, p) + rng.gauss(0, 1.8)
            o2 = 97 + (1 if rng.random() < 0.45 else 0)
            cis = _lerp(1.40, 1.46, p) + rng.gauss(0, 0.015)
            cr = _lerp(0.89, 0.87, p) + rng.gauss(0, 0.012)
            ca = _lerp(1.40, 1.44, p) + rng.gauss(0, 0.012)
            linf = _lerp(1170, 700, p) + rng.gauss(0, 24)
            neut = _lerp(3480, 4180, p) + rng.gauss(0, 50)
            cort = _lerp(16.0, 21.8, p) + rng.gauss(0, 0.45)
            co2 = _lerp(1180, 2150, p) + rng.gauss(0, 30)
            rad_rate = _lerp(46.0, 134.0, p) + rng.gauss(0, 3.2)
            acc_rad += 0.88
        else:
            p = (t - 90) / 29.0
            hr = _lerp(90, 108, p) + rng.gauss(0, 2.0)
            o2 = int(round(_clamp(_lerp(97.8, 96.4, p) + rng.gauss(0, 0.35), 96, 99)))
            cis = _lerp(1.46, 1.53, p) + rng.gauss(0, 0.015)
            cr = _lerp(0.87, 0.85, p) + rng.gauss(0, 0.012)
            ca = _lerp(1.44, 1.49, p) + rng.gauss(0, 0.012)
            linf = _lerp(695, 620, p) + rng.gauss(0, 20)
            neut = _lerp(4190, 4460, p) + rng.gauss(0, 50)
            cort = _lerp(22.0, 27.5, p) + rng.gauss(0, 0.45)
            co2 = _lerp(2250, 4320, p) + rng.gauss(0, 40)
            rad_rate = _lerp(130.0, 118.0, p) + rng.gauss(0, 3.0)
            acc_rad += 0.60

        rows.append(
            {
                "heartRate": int(round(_clamp(hr, 55, 135))),
                "spO2": int(_clamp(o2, 95, 100)),
                "cistatinaC": round(_clamp(cis, 0.65, 2.2), 2),
                "creatinina": round(_clamp(cr, 0.60, 1.4), 2),
                "calcioIonico": round(_clamp(ca, 1.00, 1.7), 2),
                "linfocitos": int(round(_clamp(linf, 400, 2200))),
                "neutrofilos": int(round(_clamp(neut, 2000, 6000))),
                "cortisol": round(_clamp(cort, 6.0, 35.0), 1),
                "co2Level": int(round(_clamp(co2, 400, 5000))),
                "radiationRate": round(_clamp(rad_rate, 10.0, 200.0), 1),
                "radiationAccumulated": round(acc_rad, 1),
            }
        )

    renal_hits = sum(
        1
        for r in rows
        if r["creatinina"] <= 1.1 and r["cistatinaC"] > 1.15 and r["calcioIonico"] > 1.25
    )
    rad_hits = sum(
        1
        for r in rows
        if (r["radiationRate"] > 50.0 or r["radiationAccumulated"] > 50.0)
        and r["linfocitos"] < 1000
        and (r["neutrofilos"] / r["linfocitos"]) > 3.0
    )
    co2_hits = sum(1 for r in rows if r["co2Level"] > 3500 and r["spO2"] >= 96)

    summary = (
        f"[Stdlib fallback] Frames={len(rows)} | R1_Renal={renal_hits} | "
        f"R2_Radiacion={rad_hits} | R3_CO2={co2_hits}"
    )
    return rows, summary


def main() -> None:
    if HAS_PANDAS:
        records, summary = _generate_rows_with_pandas()
    else:
        records, summary = _generate_rows_stdlib()

    if "__file__" in globals():
        repo_target = Path(__file__).resolve().parent.parent / "public" / "data" / OUTPUT_FILENAME
        output_path = repo_target if repo_target.parent.exists() else Path(OUTPUT_FILENAME)
    else:
        output_path = Path(OUTPUT_FILENAME)
    output_path.write_text(json.dumps(records, separators=(",", ":")), encoding="utf-8")

    print(summary)
    print(f"Archivo generado en: {output_path}")

    # En Google Colab, dispara automáticamente la descarga al navegador
    try:
        from google.colab import files  # type: ignore[import-not-found]

        files.download(str(output_path))
    except ImportError:
        pass


if __name__ == "__main__":
    main()
