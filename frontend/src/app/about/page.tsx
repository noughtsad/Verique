import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/app/components/Sidebar';

export const metadata: Metadata = {
  title: 'How Verique works',
  description: 'Verique is a social app where any post can be fact-checked against live web evidence, and every verdict can be challenged.',
};

const STEPS = [
  {
    title: 'Split the post into claims',
    body: 'A language model pulls out each separate statement of fact, so a post that mixes a true claim and a false one gets judged claim by claim.',
  },
  {
    title: 'Set opinions aside',
    body: 'Feelings, predictions and opinions can’t be checked against evidence, so they get no score. A post made only of opinions is labelled as such.',
  },
  {
    title: 'Search for and against',
    body: 'For each claim, Verique runs two searches looking for direct evidence and one looking specifically for refutations and fact-checks.',
  },
  {
    title: 'Weigh the sources',
    body: 'Results are ranked by how relevant they are and how reliable the site is, using Media Bias/Fact Check ratings. Each site counts once, so volume can’t outvote quality.',
  },
  {
    title: 'Give a verdict with its evidence',
    body: 'Each claim gets one of seven verdicts, from strongly supported to contradicted, with the sources it rests on. The post gets a Verique score from 0 to 100.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6 sm:px-8">
        <Link href="/" aria-label="Verique home">
          <Logo withName />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link href="/login" className="rounded-md px-4 py-2 text-ink-2 hover:text-ink">
            Log in
          </Link>
          <Link href="/login" className="rounded-md bg-accent px-4 py-2 text-accent-ink hover:bg-accent-strong">
            Sign up
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-8">
        <section className="py-12 sm:py-20">
          <h1 className="max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-6xl">
            Check a claim in the place you read it.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-3">
            Verique is a social app where every post has a Verify button. Tap it and the post’s factual claims are checked
            against evidence from the web, right there in the feed.
          </p>
        </section>

        <section aria-labelledby="why" className="border-t border-line py-12">
          <h2 id="why" className="text-2xl font-bold text-ink">Why it exists</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-2">
            False claims spread faster than fact-checkers can answer them, and checking one usually means leaving the app to
            search on your own. AI models can help, but on their own they don’t know recent events and they treat every web
            page as equally trustworthy. Verique searches the live web for each check and weighs sources by their track
            record.
          </p>
        </section>

        <section aria-labelledby="how" className="border-t border-line py-12">
          <h2 id="how" className="text-2xl font-bold text-ink">What happens when you tap Verify</h2>
          <ol className="mt-8 space-y-8">
            {STEPS.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-sm font-bold tabular-nums text-link">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1 leading-relaxed text-ink-3">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="challenge" className="border-t border-line py-12">
          <h2 id="challenge" className="text-2xl font-bold text-ink">When a verdict is wrong</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-2">
            Any verdict can be challenged. A challenge goes to a human moderator, who can uphold it, revise it or remove it,
            and their decision is shown on the post. Every check is kept, so re-verifying a post adds a new result instead of
            erasing the old one.
          </p>
        </section>

        <section aria-labelledby="limits" className="border-t border-line py-12">
          <h2 id="limits" className="text-2xl font-bold text-ink">What it can’t do</h2>
          <ul className="mt-4 max-w-2xl list-disc space-y-2 pl-5 leading-relaxed text-ink-2">
            <li>It can be wrong. A verdict is a summary of the evidence it found, not the final word, which is why every verdict shows its sources.</li>
            <li>Half-true and cherry-picked claims are hard for it; it tends to answer yes or no.</li>
            <li>It reads English only, and checks text, not images or video.</li>
            <li>A check takes about a minute, because it searches and reads the web each time.</li>
          </ul>
        </section>

        <section className="border-t border-line py-12">
          <Link href="/login" className="inline-flex h-11 items-center rounded-md bg-accent px-6 font-semibold text-accent-ink hover:bg-accent-strong">
            Create an account
          </Link>
        </section>
      </main>
    </div>
  );
}
