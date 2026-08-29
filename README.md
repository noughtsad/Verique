# 🔍 TrustLens – AI Trust & Context Layer for Web Content

<div align="center">

![TrustLens](https://img.shields.io/badge/TrustLens-AI%20Trust%20Layer-00875A?style=for-the-badge&logo=shield&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19+-61DAFB?style=flat-square&logo=react&logoColor=black)
![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-FF6B6B?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

**Transform how people evaluate online information with transparent, evidence-based verification.**

[Demo](#-quick-start) • [API Docs](#-api-usage) • [Architecture](#-architecture) • [Extension](#-browser-extension)

</div>

---

## 🎯 What is TrustLens?

TrustLens is an AI-powered multi-agent system that adds a transparent "trust overlay" to any webpage. Instead of blindly trusting online content or spending hours manually fact-checking, TrustLens:

- **Extracts factual claims** from any webpage or text
- **Retrieves evidence** from authoritative sources across the web
- **Rates each claim** with confidence scores and reasoning
- **Highlights claims** with intuitive color-coding
- **Shows you the evidence** so YOU decide what to believe

### 🎨 Visual Verdict System

| Color          | Verdict            | Meaning                                |
| -------------- | ------------------ | -------------------------------------- |
| 🟢 Dark Green  | Strongly Supported | Multiple authoritative sources confirm |
| 🟢 Light Green | Supported          | Evidence generally supports the claim  |
| 🟡 Yellow      | Mixed/Uncertain    | Conflicting evidence or outdated       |
| 🟠 Orange      | Weak               | Limited or unreliable support          |
| 🔴 Red         | Contradicted       | Evidence contradicts the claim         |
| ⚪ Gray        | Not Verifiable     | Opinion or cannot be fact-checked      |

### 🚫 What We're NOT

- **NOT a content moderator** – We don't block or censor anything
- **NOT a political truth arbiter** – We focus on objective, verifiable claims
- **NOT overconfident** – We show uncertainty clearly and always link to sources

## 🎪 Focus Verticals (MVP)

1. **E-commerce & SaaS** – Product claims, warranties, customer counts
2. **Learning & Technical Content** – Blog posts, tutorials, educational content
3. **Professional Content** – LinkedIn posts, reports, whitepapers

---

## 🗽 Architecture

### Multi-Agent System (LangGraph)

```text
User Input (text or URL)
  ↓
1. Ingestion Agent
   - Strips HTML tags and normalizes whitespace
   - Counts words and prepares clean text

2. Claim Decomposer [Groq LLM - GPT-OSS 120B]
   - Extracts factual statements from text
   - Tags claim type, topic, and time sensitivity
   - Returns claims with character span offsets

3. Claim Classifier [Groq LLM - GPT-OSS 20B]
   - Filters claims to only verifiable ones
   - Marks each claim as verifiable or not verifiable

4. Query Planner [Groq LLM - GPT-OSS 20B]
   - Generates targeted web search queries per claim

5. Retrieval Agent [parallel]
   - Uses DuckDuckGo by default
   - Optionally uses SerpAPI / Google CSE when configured
   - Fetches and scores candidate evidence

6. Evidence Ranker
   - Ranks evidence by relevance and domain reputation
   - Keeps top results per claim

7. Verification Agent [Groq LLM - GPT-OSS 120B]
   - Produces verdict, confidence, and reasoning for each claim

8. Explanation / Response Assembly
   - Builds the final API response
   - Separates supporting and contradicting sources

9. Verification Service
   - Calculates overall page score
   - Generates verdict summary counts

API Response -> Next.js Frontend / Chrome Extension
