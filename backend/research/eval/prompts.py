"""Verdict prompts for the baselines, derived from the app's production prompt."""
from app.agents.verification import VERIFICATION_PROMPT

# B0: same verdict set and JSON schema, but no evidence. {evidence_text} is unused.
LLM_ONLY_PROMPT = """You are an expert fact-checker. Judge this claim from your own knowledge only; no evidence is provided.

CLAIM TO VERIFY:
{claim_text}

Choose a verdict:
- strongly_supported: you are certain the claim is true
- supported: the claim is probably true
- mixed: partly true, or true in some respects only
- weak: little reason to believe it
- contradicted: the claim is false
- outdated: it was once true but no longer is
- not_verifiable: you cannot judge it

Give a confidence from 0.0 to 1.0 and 2-3 sentences of reasoning.

Respond in JSON format:
{{
    "verdict": "...",
    "confidence": 0.X,
    "reasoning": "...",
    "supporting_sources": [],
    "contradicting_sources": [],
    "caveats": []
}}

Return ONLY valid JSON, no other text"""

# B1: the production prompt with every mention of source reputation removed. Each
# replacement must match exactly, so drift in the production prompt fails loudly.
_NO_REPUTATION = [
    ("3+ high-reputation sources (0.9+) fully agree", "3+ sources fully agree"),
    ("2+ high-reputation sources agree", "2+ sources agree"),
    ("1 high-reputation source OR 2+ medium sources (0.7+) agree", "1 source OR 2+ sources agree"),
    ("Single medium-reputation source", "Single source"),
    ("Weak evidence, low-reputation sources, or mostly contradicting",
     "Weak evidence or mostly contradicting"),
    ("   - Consider source quality differences (high-reputation sources weigh more)\n", ""),
    ("- Higher source reputation (shown in evidence) = more weight in verdict\n", ""),
    ("- When sources disagree, check their reputation scores\n", ""),
]


def _without_reputation(prompt: str) -> str:
    for old, new in _NO_REPUTATION:
        if old not in prompt:
            raise RuntimeError(f"app verification prompt changed; update research/eval/prompts.py: {old!r}")
        prompt = prompt.replace(old, new)
    if "reputation" in prompt:
        raise RuntimeError("reputation wording still present in the B1 prompt")
    return prompt


NO_REPUTATION_PROMPT = _without_reputation(VERIFICATION_PROMPT)
