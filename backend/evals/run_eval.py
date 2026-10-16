"""Score the parse schema against labeled gold examples.

Run from /backend:

    python -m evals.run_eval
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models import ParseVerdict, RequirementRecord  # noqa: E402
from app.parse import build_prompt, make_llm  # noqa: E402


async def score() -> None:
    gold_path = Path(__file__).with_name("parse_gold.json")
    cases = json.loads(gold_path.read_text(encoding="utf-8"))
    llm = make_llm()
    hits = 0
    for case in cases:
        prompt = build_prompt(
            case["worker_name"],
            RequirementRecord(
                name=case["requirement_name"],
                type=case["requirement_type"],
                path="eval",
            ),
            case["document"],
        )
        verdict: ParseVerdict = await llm.ainvoke(prompt)
        expected = case["expected"]
        ok = (
            verdict.is_there_one == expected["is_there_one"]
            and verdict.result == expected["result"]
        )
        hits += int(ok)
        mark = "PASS" if ok else "FAIL"
        print(
            f"{mark} {case['id']}: got "
            f"is_there_one={verdict.is_there_one} result={verdict.result} "
            f"expected {expected}"
        )
    total = len(cases)
    print(f"\n{hits}/{total} exact matches ({hits / total:.0%})")
    # Keep RequirementRecord imported so evals stay aligned with production types.
    _ = RequirementRecord


if __name__ == "__main__":
    asyncio.run(score())
