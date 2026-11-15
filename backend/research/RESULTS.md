# Verique: evaluation results

*Experiments run 19–21 October 2026. Every number below comes from files in
`backend/research/results/` and can be reproduced with `bash research/run_core.sh` and
`bash research/run_remaining.sh`.*

---

## 1. Summary

Verique was tested on **40 real, fact-checked claims** (38 clear-cut, 2 half-true) in 10 setups,
from "no web search at all" to full Verique with SBA, plus ablations, a robustness test, a
date-aware variant and repeat runs.

**The most important finding is about noise.** Running the *same* setup on the *same* evidence
three times gave 72.5%, 82.5% and 80.0% accuracy: about ±5 points, because the verdict model does not
answer identically every time. Most differences between setups are smaller than that, so with 40
claims almost none of them can be called real.

| Question | Answer |
|---|---|
| Does searching the web help? | **Probably.** It is the largest gain measured (65% → 75%), but not statistically significant (10 claims fixed, 6 broken, p = 0.45). |
| Does weighting sources by credibility help? | **No measurable effect on clear-cut claims.** Credibility-aware and credibility-blind setups gave the same answers. |
| Does SBA (the deterministic source-weighted vote) help? | **Not on accuracy.** Over 3 runs and correcting for out-of-date labels, Verique with and without SBA both score **80.7%**. SBA does make results steadier between runs (±2.9 vs ±5.2 points) and confidence better calibrated. |
| Do the ablated components matter (MBFC, recency, one source per domain)? | **No measurable effect.** All ablation differences are within run-to-run noise. Recency could not have mattered: **none of the 461 search results had a publication date**. |
| Can a pile of junk sources outvote the truth? | **Not in this test.** Adding 1–5 fabricated contradicting sources didn't fool the model (accuracy stayed 83–100%). The weak point was SBA itself: it was perfect with 0–2 junk sources but slipped to 89% with 4–5. |
| Is the answer key reliable? | **Not entirely.** Labels date from 2020 and evidence from today; 2 of 40 claims were marked as errors although Verique was right about the present. |
| Does telling the model the claim's date help? | **Partly.** It fixed the clearest out-of-date case but did not change accuracy overall, and made confidence less reliable. |

---

## 2. What was tested

### The claims
40 claims from the **AVeriTeC** dev set (real claims checked by professional fact-checkers;
CC BY-NC 4.0), mostly clear-cut with about 5% difficult claims, picked by a fixed rule
(`research/eval/averitec.py`, seed 0):

| Group | Rule | Count |
|---|---|---|
| Clear-cut, true | label *Supported*, claim type only *Event/Property*, no numeric comparison | 19 |
| Clear-cut, false | label *Refuted*, same type rule | 19 |
| Difficult | label *Conflicting Evidence / Cherrypicking* (half-true) | 2 (5%) |

The type rule leaves out numeric, causal, quote and opinion claims, the borderline kind (like the
Iowa "40% renewables" claim) that flip between verdicts.
*Examples:* "The iPhone 12 won't come with earphones and a charging adapter" (true), "The PLAAF has
shot down an Indian Sukhoi Su-30 fighter jet in Tibet" (false).

### The setups

| ID | Setup | What it does |
|---|---|---|
| **B0** | LLM only | Same verdict model, no web search |
| **B1** | Vanilla RAG | Web search; every source equally credible, no per-domain limit, no credibility shown to the model |
| **B2** | Verique (paper version) | Credibility-aware ranking (hand-curated table), one source per domain, credibility shown to the model |
| **B3** | Verique + SBA | B2, then SBA recomputes each verdict from the cited sources' credibility |
| **B4** | B3 + MBFC | B3 with credibility from the MBFC dataset instead of the hand-curated table |
| **A2** | B3 without recency | Recency score fixed at 0.5 |
| **A3** | B3 without the domain limit | All sources kept, even several from one site |
| **B2p** | Verique as the app runs today | B2 with the app's current credibility lookup (MBFC first, then the table) |
| **B2d** | B2, judged as of the claim's date | The verdict model is told the claim's date and asked to judge it as of then |

A1 (no claim splitting) does not apply: every test claim is already a single claim.

### How it was run
- **Models:** Groq `openai/gpt-oss-120b` (verdicts) and `openai/gpt-oss-20b` (search queries,
  relevance scores); temperature 0. Search: Tavily, DuckDuckGo as fallback.
- **Same evidence for every setup:** each claim's search results were captured once and replayed,
  so setups differ only in how they use the evidence. Relevance scores were computed once and shared.
- **Scoring:** the 7 verdicts are collapsed to 3 classes: *supported / strongly supported* → True,
  *contradicted / outdated* → False, *mixed / weak* → Mixed. *Not verifiable* is an abstention.
- **Runs:** B2 and B3 three times; every other setup once (Groq's free-tier quota). Results were saved
  every 10 claims; when the quota ran out, the run stopped before saving the affected claim and
  resumed later.

### Metrics, in plain words
- **Accuracy (all 40):** share of all claims answered correctly; abstaining counts as wrong.
  This is the main number used below.
- **Accuracy (answered):** share correct among the claims the setup answered.
- **Coverage:** share of claims the setup answered.
- **Macro-F1 (clear-cut):** balances True and False performance on the 38 clear-cut claims (there are
  too few half-true claims for a three-class F1; see §11).
- **Calibration error (ECE):** how far the stated confidence is from actual accuracy; 0 is perfect,
  0.15 means confidence is off by about 15 points on average.
- **Significance:** McNemar's test on paired answers; p < 0.05 would mean "unlikely to be chance".

---

## 3. Main results

| Setup | Accuracy (all 40) | Accuracy (answered) | Coverage | Macro-F1 (clear-cut) | Calibration error |
|---|---|---|---|---|---|
| B0: LLM only | 65.0% | 70.3% | 92.5% | 0.769 | 0.151 |
| B1: Vanilla RAG | 75.0% | 78.9% | 95.0% | 0.883 | 0.132 |
| B2: Verique (paper), 3 runs | **78.3% ± 5.2** | | | 0.898 ± 0.020 | 0.085 ± 0.028 |
| B3: Verique + SBA, 3 runs | **81.7% ± 2.9** | | | | |
| B4: B3 + MBFC | 82.5% | 82.5% | 100% | 0.880 | 0.101 |
| A2: B3 without recency | 85.0% | 85.0% | 100% | 0.907 | 0.039 |
| A3: B3 without domain limit | 82.5% | 86.8% | 95.0% | 0.914 | 0.106 |
| B2p: Verique (app today) | 75.0% | 78.9% | 95.0% | 0.883 | 0.105 |
| B2d: B2 judged as of claim date | 75.0% | 76.9% | 97.5% | 0.856 | 0.169 |

*Raw scores against the 2020 answer key; single runs unless marked. Corrected scores are in §5.5.*

### First runs of B2 and B3 in detail (the runs the other setups are compared against)

| Setup | Accuracy (all 40) | Accuracy (answered) | Coverage | Macro-F1 (clear-cut) | Calibration error |
|---|---|---|---|---|---|
| B2, run 1 | 72.5% | 78.4% | 92.5% | 0.878 | 0.078 |
| B3, run 1 | 80.0% | 86.5% | 92.5% | 0.935 | 0.047 |

### Per-class precision and recall (first runs, all 40)
*Precision: when it says X, how often X is right. Recall: of the real X claims, how many it found.*

| Setup | True: P / R | False: P / R | Mixed: P / R |
|---|---|---|---|
| B0 | 0.92 / 0.67 | 0.72 / 0.76 | 0.17 / 0.50 |
| B1 | 0.88 / 0.79 | 0.88 / 0.88 | 0.00 / 0.00 |
| B2 | 0.89 / 0.84 | 0.87 / 0.81 | 0.00 / 0.00 |
| B3 | 0.90 / 1.00 | 0.93 / 0.81 | 0.00 / 0.00 |
| B2p | 0.88 / 0.79 | 0.88 / 0.88 | 0.00 / 0.00 |

### Confusion matrices (first runs)
Rows: the true label. Columns: Verique's answer (True / False / Mixed / abstained).

| Setup | Truth = True | Truth = False | Truth = Mixed |
|---|---|---|---|
| B0 | 12 / 4 / 2 / 1 | 1 / 13 / 3 / 2 | 0 / 1 / 1 / 0 |
| B1 | 15 / 1 / 3 / 0 | 1 / 15 / 1 / 2 | 1 / 1 / 0 / 0 |
| B2 | 16 / 1 / 2 / 0 | 1 / 13 / 2 / 3 | 1 / 1 / 0 / 0 |
| B3 | 19 / 0 / 0 / 0 | 1 / 13 / 2 / 3 | 1 / 1 / 0 / 0 |
| B2p | 15 / 1 / 3 / 0 | 1 / 15 / 1 / 2 | 1 / 1 / 0 / 0 |

Errors on true claims are mostly hedging (answering "Mixed"); errors on false claims are split
between hedging and abstaining. Half-true claims are never recognised by any search-based setup.

---

## 4. How much is noise? (repeat runs)

B2 was run three times on identical evidence. B3 is SBA applied to each of those runs.

| Run | B2 accuracy | B3 accuracy |
|---|---|---|
| 1 | 72.5% | 80.0% |
| 2 | 82.5% | 85.0% |
| 3 | 80.0% | 80.0% |
| **Mean ± std** | **78.3% ± 5.2** | **81.7% ± 2.9** |

- **5 of the 40 claims got a different answer in different runs**, despite identical input and
  temperature 0. The verdict model is not fully deterministic.
- **A natural check confirms it.** Because no search result had a date (§6), A2 ("no recency") showed
  the model exactly the same evidence as B3 on all 40 claims. It still answered 4 claims differently
  (3 better, 1 worse). That difference is pure run-to-run noise.
- **Consequence:** with 40 claims and one run, a gap of up to about 4 claims (10 points) between two
  setups can appear by chance. This applies to every single-run comparison in this report.
- **SBA reduces the noise.** Its spread between runs is ±2.9 points against ±5.2 for B2, because a
  fixed rule over the cited sources smooths out some of the model's wavering.

---

## 5. What the results mean

### 5.1 Web search is the biggest gain, but not proven
B0 → B1: **+10 points** accuracy, **+0.11** macro-F1. Without search, the model misses true claims
(recall 0.67 vs 0.79) and abstains on claims it has never heard of. This points the way the paper's
"freshness problem" argument expects. It is not significant, though: search fixed 10 claims but broke
6 the LLM alone got right (p = 0.45).

### 5.2 Credibility weighting changes nothing on clear-cut claims
B1 (credibility-blind) and B2p (the app today) gave **the same final answer on all 40 claims**,
although they saw different source lists on every claim and differed in confidence on 30. B2
(hand-curated table) differs from B1 on 3 claims, 1 better and 2 worse (p = 1.0). When the sources agree, as
they do on clear-cut claims, how much each one is trusted does not change the answer. Credibility
weighting does improve calibration (B2 0.078, B2p 0.105, B1 0.132).

### 5.3 SBA: no accuracy gain, but steadier and better calibrated
Raw first-run scores make SBA look strong (72.5% → 80.0%, 4 fixed, 1 broken, p = 0.375). Three things
take most of that away:
1. **Repeat runs:** across 3 runs the gap is **+3.4 points** (78.3% vs 81.7%), within noise.
2. **Out-of-date labels (§5.5):** excluding the 2 out-of-date claims, B2 and B3 both average **80.7%**
   over the 3 runs. No difference.
3. **How it scored on those claims:** on "Fly swatters are now available on Joe Biden's online store",
   Verique answered *outdated* ("on sale in October 2020, no evidence it still is"). That is right
   today. SBA replaced it with *supported*, matching the 2020 label. SBA cannot output *outdated*, so
   it discards Verique's time judgment.

**Worked example (real run).** On the fly-swatter claim the model cited all 5 sources (Business
Insider, Newsweek, WSAV, CBS17, CBS News) as supporting, each at the neutral credibility 0.5 because
the hand-curated table rates none of them. SBA computes V = (2.5 − 0) / 2.5 = **1.00** (conflict
I = 0) → *supported*, overriding the model's *outdated* (confidence 0.80).

What SBA does deliver: steadier results between runs (±2.9 vs ±5.2) and the best calibration measured
(0.047 on its first run). Side effect: SBA can only output supported, contradicted or mixed, so 9
"strongly supported" verdicts became "supported". The answers stay right, but the app's post scores
would come out lower.

### 5.4 The app today (B2p) vs the paper version (B2)
Same accuracy. The difference is **credibility coverage**: the app's MBFC-first lookup has a rating
for **67%** of the domains searches returned, the paper's hand-curated table only **36%** (the rest get
a neutral 0.5).

### 5.5 Out-of-date labels, and judging as of the claim's date
The labels date from 2020; the searches return today's web. Every claim that any search-based setup
got wrong (13) was reviewed by hand:

| Cause | Claims | Notes |
|---|---|---|
| **Out-of-date label**: Verique right about today | 2 | *Fly swatters on Biden's store* (true in 2020; Verique: "outdated"). *Biden showing signs of dementia* (refuted in 2020; Verique: "mixed", citing later reports). |
| Different reading of the claim, defensible but not about time | 3 | A Trump quote that Trump did say, though its content is cherry-picked; a real *Scientific American* opinion post titled "We Have No Reason to Believe 5G Is Safe"; the iPhone 12 exception for France. Kept as errors. |
| Genuine Verique mistakes | 7 | No evidence linking the facts (abstained), misled by low-quality sources, missed a nuance. |
| Bug | 1 | Malformed-JSON verdict (§11). |

Accuracy with and without the 2 out-of-date claims:

| Setup | All 40 | Excluding the 2 out-of-date claims |
|---|---|---|
| B0 | 65.0% | 65.8% |
| B1 | 75.0% | 76.3% |
| B2 (3-run mean) | 78.3% | 80.7% |
| B3 (3-run mean) | 81.7% | 80.7% |
| B2p | 75.0% | 76.3% |
| B2d | 75.0% | 76.3% |

**B2d (told the claim's date):** the fly-swatter claim became *supported* (matching the label) and
the model stopped using *outdated* altogether. The dementia claim stayed *mixed*. Overall: 3 claims
better, 2 worse than B2 (p = 1.0), more claims answered (97.5% vs 92.5%), but **worse calibration
(0.169 vs 0.078)**: told to ignore later evidence, the model stays confident while being wrong more
often. For benchmark scoring a date instruction is the fairer setup; for the app, which judges posts
*now*, it is not wanted.

### 5.6 Confidence
**Reliability by confidence band (first runs, answered claims):**

| Confidence band | B0 | B1 | B2 | B3 |
|---|---|---|---|---|
| 0.6–0.7 | 1 claim, 0% right | 1, 0% | 2, 0% | 2, 100% |
| 0.7–0.8 | 6, 33% | 3, 33% | 10, 70% | 10, 80% |
| 0.8–0.9 | 6, 83% | 5, 40% | 10, 80% | 10, 80% |
| 0.9–1.0 | 21, 86% | 29, 93% | 15, 93% | 15, 93% |

Above 0.9, every setup is right about 90% of the time. The overconfidence sits in the 0.7–0.9 band,
worst for B0 and B1 (around 33–40% right at 0.7–0.9 for B1). Verique (B2) is close to its stated
confidence in every band.

---

## 6. Ablations (B4, A2, A3)

All three are B3 variants, so they are compared with B3 (first run, 80.0%):

| Setup | Accuracy (all 40) | vs B3: fixed / broken | p |
|---|---|---|---|
| B4: MBFC credibility | 82.5% | 3 / 2 | 1.0 |
| A2: no recency | 85.0% | 3 / 1 | 0.63 |
| A3: no domain limit | 82.5% | 3 / 2 | 1.0 |

None of these differences is larger than the run-to-run noise in §4, so **no component's
contribution can be measured with this sample**. Two specific findings:

- **Recency does nothing in practice.** Not one of the 461 search results carried a publication
  date (neither Tavily's basic search nor DuckDuckGo returned one for these queries), so the recency
  score was a constant 0.5 for every source and A2 saw exactly the same evidence as B3. The paper's
  time-sensitive recency decay never takes effect in the current pipeline.
- **MBFC vs hand-curated table:** B4 rates far more domains (§5.4) but reached the same accuracy. On
  clear-cut claims, which sources get credibility makes no difference.

---

## 7. Robustness test: can junk sources outvote the truth?

For all 19 true claims, 1–5 fabricated sources contradicting the claim were added to the evidence
(fixed templates such as *"Debunked: … Our investigation found this claim to be completely
fabricated."*, each from its own invented domain). Credibility-aware setups rate them 0.15; the
credibility-blind B1 sees 0.5, the same as every source.

Accuracy on the 19 true claims, among the claims answered (one run each; one claim ≈ 5.3 points):

| Junk sources added (k) | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| B1: Vanilla RAG | 78.9% | 83.3% | 83.3% | 84.2% | 89.5% | 89.5% |
| B2: Verique | 84.2% | 84.2% | 89.5% | 89.5% | 89.5% | 89.5% |
| B3: Verique + SBA | 100% | 94.7% | 100% | 94.7% | 89.5% | 89.5% |

*k = 0 is the first core run; B3 is SBA applied to B2's verdicts at each k.*

What it shows:
- **The expected failure did not happen.** The paper predicts credibility-blind RAG (B1) falls fastest
  as junk piles up. It did not fall at all: all setups stay between 79% and 100%, and the small upward
  drift for B1 and B2 is within noise. The verdict model recognises these fabricated snippets as
  unreliable from their content, even when it is told nothing about their credibility.
- **SBA is the one that weakens.** It is perfect or near-perfect with 0–3 junk sources, then drops to
  89.5% at 4–5. SBA adds up credibility, so enough low-credibility contradicting sources eventually
  tip the balance for claims whose real support is thin. This is the weakness predicted for SBA's
  sum-based vote.
- **Caveat: the junk is obvious.** The templates read like hoax posts. Realistic misinformation that
  looks like a news report could fool the model where these did not. Junk rated as an unknown site
  (0.5 instead of 0.15) was not tested; it would make SBA's weakness worse.

---

## 8. The difficult claims (2)

| Claim | Truth | B0 | B1 | B2 | B2p |
|---|---|---|---|---|---|
| "America went from 75,000 flu deaths in 2019 to almost 0 in 2020" | Mixed | contradicted | contradicted | contradicted | contradicted |
| Trump quote: "Biden also vowed to oppose school choice…" | Mixed | weak ✓ | strongly supported | supported | strongly supported |

Every setup with web search got both wrong; only the LLM alone hedged correctly once. Half-true claims
remain Verique's weak spot: it prefers a clear yes or no. With 2 such claims, no class-level conclusion
can be drawn.

---

## 9. Earlier test: the app before the fixes (34 harder claims)

On 18 October the app as it then was ran on **34 AVeriTeC claims** with the normal label mix (13 true,
14 false, 7 Mixed, including numeric and causal claims):

| | Accuracy (all) | Accuracy (answered) | Coverage | Macro-F1 | Calibration error |
|---|---|---|---|---|---|
| App as it was | 50.0% | 65.4% | 76.5% | 0.569 | 0.254 |
| + SBA | 52.9% | 69.2% | 76.5% | 0.533 | 0.215 |

SBA fixed 2 claims and broke 1 (a Mixed claim). That test exposed **three bugs**, since fixed in the app:

1. **Relevance scoring never worked.** The model got 10 tokens to answer but needs ~70 to reason
   first, so every source scored the fallback 0.5. *Fixed* (token budget raised).
2. **Some verdicts were cut off** when the 1,000-token budget ran out mid-answer, causing 3 of that
   test's 8 abstentions. *Fixed* (budget raised to 2,500).
3. **Errors were shown as opinions.** A failed AI call made the post read "Opinion / Unverifiable".
   *Fixed*: it now shows "Verification failed due to an error" with a retry.

The two tests are not comparable (different claims and difficulty, bug fixes in between).

---

## 10. Cost

| | LLM calls per verification | Tokens per verification |
|---|---|---|
| B2 (full Verique) | ~11 | ~8,200 |
| — relevance scoring (one call per source) | ~10 | ~5,500 |
| — verdict | 1 | ~2,700 |
| B0 (LLM only) | 1 | ~650 |

Relevance scoring dominates the cost (10 of 11 calls). Query-planner calls are not included in these
counts. Latency was measured but is not usable: it includes waits for Groq's free-tier rate limits.

---

## 11. Limitations

- **Small sample:** 40 claims; one claim moves accuracy by 2.5 points, and run-to-run noise is about
  ±5 points (§4).
- **Nothing is statistically significant.** McNemar p-values: web search 0.45, source awareness 1.0,
  SBA 0.375 (first run), ablations 0.63–1.0.
- **Mostly clear-cut claims by design;** only 2 half-true claims, so the Mixed class is untested and
  three-class macro-F1 is unstable (all 40: 0.568–0.606).
- **Out-of-date labels:** at least 2 of 40 claims were scored against Verique for being right about
  the present; the review was done by hand and may have missed subtler cases.
- **Repeat runs only for B2/B3;** all other setups ran once.
- **One B2 claim failed** (the verdict model returned malformed JSON); it counts as an abstention, as
  the app would show it, and also affects B3.
- **Answers may be online:** searches can find the original fact-check article, which makes the task
  easier than a brand-new claim; this affects every search-based setup equally.
- **Robustness junk is obvious;** realistic misinformation was not tested.
- **Prompt version:** the verdict prompt includes the numeric-claims rule added on 19 October.

---

## 12. Not done yet

| Experiment | Purpose | Cost on the free tier |
|---|---|---|
| Larger sample (≥150 claims) | Only way to make differences of 5–10 points significant | ~450k tokens per setup |
| Robustness with realistic misinformation, and junk rated as unknown (0.5) | The real test of the outvoting threat | ~550k tokens per variant |
| Repeat runs of B0, B1, B4, A2, A3, B2p, B2d | Mean ± std for every setup | ~116k tokens per run |
| CONFACT | The paper's primary benchmark | Blocked: no licence, data only as unsafe pickle files |
| In-domain social set + Cohen's κ | Realistic social-media posts | Needs two human annotators |
| A1 (no claim splitting) | Needs multi-claim posts (e.g. the social set) | — |
| Cache-hit latency | The post *Verify* path has no cache yet | Needs an app change |
| User study + usability survey (SUS) | The challenge/appeal path | Needs participants and ethics approval |

---

## 13. Files

| File | Contents |
|---|---|
| `results/core40-{B0,B1,B2,B2p}/predictions.jsonl` | Core runs: every claim's verdict, confidence, reasoning, evidence |
| `results/core40-B3_sba_rescore.json` | SBA vs B2, claim by claim (first run) |
| `results/rem-B2d/`, `rem-B4/`, `rem-A2/`, `rem-A3/` | Date-aware run and ablations |
| `results/rem-B2x3/` | B2, three runs |
| `results/rem-robust/` | Robustness test, per k (`robustness.json` + per-claim files) |
| `results/core40.log`, `results/remaining.log` | Full run logs, including quota pauses |
| `data/averitec_simple40.jsonl` | The 40 claims and their labels |
| `snapshots/simple40.json` | Captured search results and relevance scores (makes reruns reproducible) |
| `results/baseline34/` | The earlier 34-claim test (§9) |

---

## 14. Status against the original evaluation plan

The plan is Section V ("Experimental Setup") and the Section VI discussion checklist of *Verique
Research Paper Draft & Submission Plan* (10 Oct 2026). Status as of 21 Oct 2026.

**Legend:** ✅ done · 🟡 partly done · ❌ not done · ➖ not applicable

### Datasets

| Planned | Status | Notes |
|---|---|---|
| CONFACT (primary benchmark) | ❌ | No published licence; data ships only as Python pickle files, unsafe to load. AVeriTeC used instead. |
| In-domain social set: 100–200 posts, two annotators, Cohen's κ | ❌ | Not collected; the κ tool is ready (`research/eval/agreement.py`). |
| AVeriTeC or FEVER subset (optional) | ✅ | AVeriTeC dev: 40 claims (main runs) and 34 claims (earlier run, §9). |

### Method

| Planned | Status | Notes |
|---|---|---|
| 7 verdicts → 3 classes; *not verifiable* as abstention, coverage reported | ✅ | |
| Capture search results once, replay for every setup | ✅ | Relevance scores also shared |
| Temperature 0 | ✅ | |
| Mean ± standard deviation over 3 runs | 🟡 | B2 and B3 only; other setups ran once |

### Configurations (Table III)

| Setup | Status | Notes |
|---|---|---|
| B0 LLM only | ✅ | |
| B1 Vanilla RAG | ✅ | |
| B2 Verique (prompt) | ✅ | 3 runs |
| B3 Verique + SBA | ✅ | SBA applied to B2's verdicts; 3 runs |
| B4 Verique + SBA + MBFC | ✅ | |
| A1 without claim decomposition | ➖ | Every test claim is already a single claim |
| A2 without recency | ✅ | No search result had a date, so recency was inactive in every setup |
| A3 without per-domain limit | ✅ | |

### Metrics

| Planned | Status | Notes |
|---|---|---|
| Accuracy, macro-F1 | ✅ | Macro-F1 on the 38 clear-cut claims |
| Per-class precision and recall | ✅ | §3 |
| Expected calibration error (ECE) | ✅ | Plus reliability by confidence band (§5.6) |
| Coverage | ✅ | |
| p50 / p95 latency, cold runs | 🟡 | Measured but not usable (includes free-tier rate-limit waits) |
| Latency on cache hits | ❌ | The post *Verify* path has no cache |
| LLM tokens and API calls per verification | 🟡 | §10; query-planner calls not counted |
| Share of retrieved domains covered by the credibility source | ✅ | 36% (table) vs 67% (MBFC-first) |

### Robustness test and user study

| Planned | Status | Notes |
|---|---|---|
| Robustness: inject 1–5 junk contradicting snippets into true claims; accuracy vs k for B1, B2, B3 (Fig. 3) | 🟡 | Done on 19 true claims (plan: ~50), junk rated low (0.15) only; reported as a table (§7), not yet plotted |
| Fail-safe user study (15–30 participants, seeded wrong verdicts) | ❌ | Needs participants and materials |
| System Usability Scale (SUS) | ❌ | Part of the user study |
| Institutional ethics approval or exemption | ❌ | Required before the user study |

### Discussion checklist (Section VI)

| Planned | Status | Notes |
|---|---|---|
| Table IV: verdict quality per setup | ✅ | §3 (mean ± std for B2/B3, single runs otherwise) |
| Table V: latency and cost (cold vs cache hit) | 🟡 | Cost done (§10); latency not usable; no cache hit possible yet |
| Fig. 3: accuracy vs number of injected junk snippets | 🟡 | Data in §7; not yet drawn as a figure |
| Gain from source awareness (B2 − B1) with McNemar | ✅ | No difference (p = 1.0) |
| Gain from SBA (B3 − B2) with McNemar | ✅ | +7.5 points first run (p = 0.375); +3.4 over 3 runs; 0 after correcting out-of-date labels |
| Where errors concentrate, with a confusion matrix | ✅ | §3, §5.5, §8 |
| Reliability diagram | ✅ | As a table by confidence band (§5.6) |
| Cost: which stage dominates | ✅ | Relevance scoring, 10 of 11 calls (§10) |
| Worked example from a real logged run | ✅ | Fly-swatter claim with sources and SBA scores (§5.3) |
| Tag the commit used for all reported numbers | ❌ | Nothing committed yet (by request) |

### Added beyond the plan

| Experiment | Status | Why |
|---|---|---|
| B2p: the app as it runs today | ✅ | The draft's B2 describes an older credibility lookup |
| Audit of out-of-date labels | ✅ | Found 2 claims scored against Verique for being right about the present (§5.5) |
| B2d: judged as of the claim's date | ✅ | Separates "right then" from "right now" (§5.5) |
| Run-to-run noise check | ✅ | B2 × 3 plus the A2 natural check (§4) |
