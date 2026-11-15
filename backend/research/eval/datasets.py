"""
Dataset loading. Every dataset is normalised to JSONL, one example per line:

  {"id": "...", "text": "...", "label": "True|False|Mixed",
   "decompose": false,                       # optional; default: atomic claim, no decomposition
   "evidence": [{"url","domain","title","snippet","published_at"}]}   # optional

`evidence` is for datasets that ship their own evidence (CONFACT pairs claims with
conflicting evidence); it seeds the snapshot so no live search is made for it.

Converters for CONFACT / AVeriTeC / FEVER are deliberately not included: their file
formats, label sets and licences must be confirmed from the source before conversion.
For the in-domain social set, two annotators label independently; see agreement.py.
"""
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from research.eval.labels import CLASSES


@dataclass
class Example:
    id: str
    text: str
    label: str
    decompose: bool = False
    evidence: Optional[List[Dict[str, Any]]] = None
    claim_date: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)


def load_jsonl(path: Path) -> List[Example]:
    examples = []
    for line_no, line in enumerate(Path(path).read_text().splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("label") not in CLASSES:
            raise ValueError(f"{path}:{line_no}: label must be one of {CLASSES}, got {row.get('label')!r}")
        examples.append(Example(
            id=str(row["id"]),
            text=row["text"],
            label=row["label"],
            decompose=bool(row.get("decompose", False)),
            evidence=row.get("evidence"),
            claim_date=row.get("claim_date"),
        ))
    return examples
