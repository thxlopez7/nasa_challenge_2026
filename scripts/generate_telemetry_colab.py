"""
ExoVitals — Generador Híbrido de Telemetría Clínica (1 Hz + Cartuchos POC / Spot)
=================================================================================
Script diseñado para Google Colab (y ejecutable localmente en Python 3) que
genera `public/data/scenario_ridge_critical.json` (120 frames):

- Sensores continuos a 1 Hz (`heartRate`, `spO2`, `hrvRmssdMs`, `co2Level`,
  `radiationRate`, `radiationAccumulated`): fluctúan segundo a segundo.
- Determinaciones por Cartucho Point-of-Care (POC) y Medición Rápida Spot
  (`cistatinaC`, `creatinina`, `calcioIonico`, `linfocitos`, `neutrofilos`,
  `cortisol`, `ctxNtxIndex`, `p1npIndex`, `aredLoadPct`, `systolicMmHg`,
  `diastolicMmHg`, `glucoseMgDl`, `glucoseContext`, `bodyTempC`,
  `orthostaticDeltaHr`, `orthostaticDeltaSys`): operan en 4 escalones discretos
  (Sample & Hold cada 30 ticks) sin oscilación irreal segundo a segundo.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path
from typing import Any

try:
    import numpy as np  # type: ignore[import-not-found]
    import pandas as pd  # type: ignore[import-not-found]

    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

SEED = 2026
TOTAL_TICKS = 120
OUTPUT_FILENAME = "scenario_ridge_critical.json"

POC_BATCHES: list[dict[str, float | int | str]] = [
    # Lote 1 (Ticks 0–29 · Control Basal Nominal)
    {
        "cistatinaC": 0.82,
        "creatinina": 1.06,
        "calcioIonico": 1.12,
        "linfocitos": 1480,
        "neutrofilos": 3020,
        "cortisol": 10.4,
        "systolicMmHg": 118,
        "diastolicMmHg": 76,
        "glucoseMgDl": 91,
        "glucoseContext": "fasting",
        "bodyTempC": 36.6,
        "ctxNtxIndex": 1.04,
        "p1npIndex": 0.98,
        "aredLoadPct": 95,
        "orthostaticDeltaHr": 9,
        "orthostaticDeltaSys": -3,
    },
    # Lote 2 (Ticks 30–59 · Cartucho POC detecta Riesgo Renal Oculto R1 + Resorción Ósea)
    {
        "cistatinaC": 1.34,
        "creatinina": 0.92,
        "calcioIonico": 1.36,
        "linfocitos": 1310,
        "neutrofilos": 3280,
        "cortisol": 14.2,
        "systolicMmHg": 124,
        "diastolicMmHg": 80,
        "glucoseMgDl": 98,
        "glucoseContext": "fasting",
        "bodyTempC": 36.8,
        "ctxNtxIndex": 1.52,
        "p1npIndex": 0.86,
        "aredLoadPct": 74,
        "orthostaticDeltaHr": 15,
        "orthostaticDeltaSys": -7,
    },
    # Lote 3 (Ticks 60–89 · Cartucho POC tras Tormenta Solar SPE detecta Inmunosupresión R2)
    {
        "cistatinaC": 1.44,
        "creatinina": 0.88,
        "calcioIonico": 1.42,
        "linfocitos": 780,
        "neutrofilos": 3940,
        "cortisol": 20.5,
        "systolicMmHg": 131,
        "diastolicMmHg": 85,
        "glucoseMgDl": 109,
        "glucoseContext": "fasting",
        "bodyTempC": 37.2,
        "ctxNtxIndex": 1.68,
        "p1npIndex": 0.82,
        "aredLoadPct": 68,
        "orthostaticDeltaHr": 21,
        "orthostaticDeltaSys": -12,
    },
    # Lote 4 (Ticks 90–119 · Control durante saturación de CO2 y desacondicionamiento)
    {
        "cistatinaC": 1.51,
        "creatinina": 0.85,
        "calcioIonico": 1.47,
        "linfocitos": 640,
        "neutrofilos": 4380,
        "cortisol": 26.2,
        "systolicMmHg": 136,
        "diastolicMmHg": 88,
        "glucoseMgDl": 115,
        "glucoseContext": "fasting",
        "bodyTempC": 37.4,
        "ctxNtxIndex": 1.78,
        "p1npIndex": 0.78,
        "aredLoadPct": 62,
        "orthostaticDeltaHr": 25,
        "orthostaticDeltaSys": -15,
    },
]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _lerp(start: float, end: float, progress: float) -> float:
    t = _clamp(progress, 0.0, 1.0)
    return start + (end - start) * t


def _generate_rows(use_pandas: bool) -> tuple[list[dict[str, Any]], str]:
    rng_np = np.random.default_rng(SEED) if use_pandas else None
    rng_std = random.Random(SEED) if not use_pandas else None

    def gauss(std: float) -> float:
        if rng_np is not None:
            return float(rng_np.normal(0.0, std))
        assert rng_std is not None
        return rng_std.gauss(0.0, std)

    def rand01() -> float:
        if rng_np is not None:
            return float(rng_np.random())
        assert rng_std is not None
        return rng_std.random()

    rows: list[dict[str, Any]] = []
    acc_rad = 45.0

    for t in range(TOTAL_TICKS):
        poc = POC_BATCHES[min(t // 30, 3)]

        if t < 30:
            p = t / 29.0
            hr = 71 + 2.0 * math.sin(t * 0.35) + gauss(1.2)
            o2 = 99 - (1 if rand01() < 0.18 else 0)
            hrv = _lerp(52.0, 48.0, p) + gauss(1.1)
            co2 = _lerp(610, 720, p) + gauss(15)
            rad_rate = _lerp(15.5, 20.5, p) + gauss(1.0)
            acc_rad += 0.10
        elif t < 60:
            p = (t - 30) / 29.0
            hr = _lerp(73, 79, p) + gauss(1.4)
            o2 = 98 + (1 if rand01() < 0.35 else 0)
            hrv = _lerp(46.0, 39.0, p) + gauss(1.2)
            co2 = _lerp(740, 1140, p) + gauss(20)
            rad_rate = _lerp(21.0, 32.0, p) + gauss(1.4)
            acc_rad += 0.12
        elif t < 90:
            p = (t - 60) / 29.0
            hr = _lerp(80, 90, p) + gauss(1.6)
            o2 = 97 + (1 if rand01() < 0.45 else 0)
            hrv = _lerp(37.0, 29.0, p) + gauss(1.2)
            co2 = _lerp(1180, 2150, p) + gauss(28)
            rad_rate = _lerp(54.0, 134.0, p) + gauss(3.0)
            acc_rad += 0.88
        else:
            p = (t - 90) / 29.0
            hr = _lerp(91, 108, p) + gauss(1.8)
            o2 = int(round(_clamp(_lerp(97.8, 96.4, p) + gauss(0.3), 96, 99)))
            hrv = _lerp(28.0, 21.0, p) + gauss(1.0)
            co2 = _lerp(2300, 4320, p) + gauss(35)
            rad_rate = _lerp(130.0, 118.0, p) + gauss(2.8)
            acc_rad += 0.60

        rows.append(
            {
                "heartRate": int(round(_clamp(hr, 55, 135))),
                "spO2": int(_clamp(o2, 96, 100)),
                "hrvRmssdMs": round(float(_clamp(hrv, 12.0, 90.0)), 1),
                "co2Level": int(round(_clamp(co2, 400, 5000))),
                "radiationRate": round(float(_clamp(rad_rate, 10.0, 200.0)), 1),
                "radiationAccumulated": round(float(acc_rad), 1),
                "cistatinaC": poc["cistatinaC"],
                "creatinina": poc["creatinina"],
                "calcioIonico": poc["calcioIonico"],
                "linfocitos": poc["linfocitos"],
                "neutrofilos": poc["neutrofilos"],
                "cortisol": poc["cortisol"],
                "ctxNtxIndex": poc["ctxNtxIndex"],
                "p1npIndex": poc["p1npIndex"],
                "aredLoadPct": poc["aredLoadPct"],
                "systolicMmHg": poc["systolicMmHg"],
                "diastolicMmHg": poc["diastolicMmHg"],
                "glucoseMgDl": poc["glucoseMgDl"],
                "glucoseContext": poc["glucoseContext"],
                "bodyTempC": poc["bodyTempC"],
                "orthostaticDeltaHr": poc["orthostaticDeltaHr"],
                "orthostaticDeltaSys": poc["orthostaticDeltaSys"],
            }
        )

    if use_pandas:
        df = pd.DataFrame(rows)
        nlr = df["neutrofilos"] / df["linfocitos"]
        r1_hits = int(
            ((df["creatinina"] <= 1.1) & (df["cistatinaC"] > 1.15) & (df["calcioIonico"] > 1.25)).sum()
        )
        r2_hits = int(
            (
                ((df["radiationRate"] > 50.0) | (df["radiationAccumulated"] > 50.0))
                & (df["linfocitos"] < 1000)
                & (nlr > 3.0)
            ).sum()
        )
        r3_hits = int(((df["co2Level"] > 3500) & (df["spO2"] >= 96)).sum())
        records = df.to_dict(orient="records")
        mode = "Pandas"
    else:
        r1_hits = sum(
            1
            for r in rows
            if float(r["creatinina"]) <= 1.1
            and float(r["cistatinaC"]) > 1.15
            and float(r["calcioIonico"]) > 1.25
        )
        r2_hits = sum(
            1
            for r in rows
            if (float(r["radiationRate"]) > 50.0 or float(r["radiationAccumulated"]) > 50.0)
            and float(r["linfocitos"]) < 1000
            and (float(r["neutrofilos"]) / float(r["linfocitos"])) > 3.0
        )
        r3_hits = sum(1 for r in rows if float(r["co2Level"]) > 3500 and float(r["spO2"]) >= 96)
        records = rows
        mode = "Stdlib fallback"

    summary = (
        f"[{mode} Híbrido] Frames={len(records)} | R1_Renal={r1_hits} | "
        f"R2_Radiacion={r2_hits} | R3_CO2={r3_hits}"
    )
    return records, summary


def main() -> None:
    records, summary = _generate_rows(HAS_PANDAS)

    if "__file__" in globals():
        repo_target = Path(__file__).resolve().parent.parent / "public" / "data" / OUTPUT_FILENAME
        output_path = repo_target if repo_target.parent.exists() else Path(OUTPUT_FILENAME)
    else:
        output_path = Path(OUTPUT_FILENAME)
    output_path.write_text(json.dumps(records, separators=(",", ":")), encoding="utf-8")

    print(summary)
    print(f"Archivo generado en: {output_path}")

    try:
        from google.colab import files  # type: ignore[import-not-found]

        files.download(str(output_path))
    except ImportError:
        pass


if __name__ == "__main__":
    main()
