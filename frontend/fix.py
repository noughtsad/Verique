import re

with open('src/app/page.tsx', 'r') as f:
    content = f.read()

# Find the start of the SUGGESTIONS & ACTIVITY SIDEBAR
start_idx = content.find('        {/* SUGGESTIONS & ACTIVITY SIDEBAR */}')

if start_idx == -1:
    print("Could not find start index")
    exit(1)

# The correct remaining content:
correct_content = """        {/* SUGGESTIONS & ACTIVITY SIDEBAR */}
        <aside className="w-[340px] bg-[#fdfdfd] border-l border-slate-100 p-6 flex flex-col flex-shrink-0 h-screen overflow-y-auto hidden xl:flex relative z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
               <ActivitySidebarContent />
            </div>
        </aside>

      </div>

      {/* COMPOSER MODAL */}
      {showComposerModal && user && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Share a thought</h2>
              <button onClick={() => setShowComposerModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6">
              <Composer
                busy={createPostMutation.isPending}
                error={createPostMutation.error instanceof Error ? createPostMutation.error.message : null}
                onSubmit={(content, sourceUrl) => createPostMutation.mutate({ content, source_url: sourceUrl || undefined })}
                user={user}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Components ---

function ActivitySidebarContent() {
  return (
    <div className="space-y-10">
      {/* People to Follow */}
      <div>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-slate-800">People to follow</h3>
          <button className="text-xs font-bold text-blue-600">See all</button>
        </div>
        <div className="space-y-5">
          {[
            { name: 'Khoulod Mohamed', handle: '@khmohamed', followed: false },
            { name: 'Mostafa Mohamed', handle: '@mostafa2020', followed: true },
            { name: 'Nada Ahmed', handle: '@nadaahmed', followed: false }
          ].map((person, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${person.name}&backgroundColor=e2e8f0`} alt="avatar" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{person.name}</div>
                  <div className="text-[11px] font-medium text-slate-400">{person.handle}</div>
                </div>
              </div>
              <button className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${person.followed ? "bg-white text-slate-600 border border-slate-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                {person.followed ? 'Followed' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* You Saved Grid */}
      <div>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-slate-800">You Saved</h3>
          <button className="text-xs font-bold text-blue-600">See all</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl bg-gradient-to-tr from-orange-400 to-red-400 overflow-hidden relative">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-white shadow-lg"></div>
          </div>
          <div className="h-24 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-800 overflow-hidden"></div>
          <div className="h-24 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 overflow-hidden"></div>
          <div className="h-24 rounded-2xl bg-slate-200 overflow-hidden flex items-center justify-center relative">
            <div className="absolute w-8 h-16 bg-slate-800 rounded-lg shadow-xl rotate-12"></div>
            <div className="absolute w-4 h-12 bg-slate-700 rounded left-4 -rotate-12"></div>
          </div>
        </div>
      </div>

      {/* Last Activity */}
      <div>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-slate-800">Last Activity</h3>
          <button className="text-xs font-bold text-blue-600">See all</button>
        </div>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5"><MessageCircle className="w-4 h-4 text-blue-500 fill-blue-500" /></div>
            <div className="text-[13px] text-slate-600">You've Commented on Ahmed Mohamed <span className="font-bold text-slate-900">Shot</span></div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5"><Heart className="w-4 h-4 text-red-500 fill-red-500" /></div>
            <div className="text-[13px] text-slate-600">You've Liked Noha Mohamed <span className="font-bold text-slate-900">Shot</span></div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5"><Bookmark className="w-4 h-4 text-slate-400" /></div>
            <div className="text-[13px] text-slate-600">You've Saved Menna <span className="font-bold text-slate-900">Shot</span> to your collection</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none focus:border-blue-400 focus:bg-white transition" />;
}

function Composer({
  onSubmit,
  busy,
  error,
  user
}: {
  onSubmit: (content: string, sourceUrl?: string) => void;
  busy: boolean;
  error: string | null;
  user: User;
}) {
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [showSource, setShowSource] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(content, showSource ? sourceUrl : undefined);
    setContent('');
    setSourceUrl('');
    setShowSource(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="What's on your mind?"
            className="w-full h-32 bg-slate-50 rounded-2xl p-4 text-sm outline-none border border-slate-200 focus:border-blue-300 focus:bg-white transition font-medium resize-none"
          />
        </div>
      </div>

      {showSource && (
        <div className="pl-16">
          <TextInput value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Attach a source URL (optional) for fact-checking" />
        </div>
      )}

      <div className="flex items-center justify-between pl-16 pt-2">
        <div className="flex gap-1 border border-slate-200 rounded-full p-1 bg-white">
          <button type="button" className="w-8 h-8 flex items-center justify-center text-blue-500 hover:bg-blue-50 rounded-full transition" title="Image">
            <ImageIcon className="w-4 h-4" />
          </button>
          <button type="button" className="w-8 h-8 flex items-center justify-center text-blue-500 hover:bg-blue-50 rounded-full transition" title="Video">
            <Video className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setShowSource(!showSource)} className={cn("w-8 h-8 flex items-center justify-center rounded-full transition", showSource ? "bg-emerald-100 text-emerald-600" : "text-emerald-500 hover:bg-emerald-50")} title="Source URL">
            <Globe className="w-4 h-4" />
          </button>
          <button type="button" className="w-8 h-8 flex items-center justify-center text-orange-500 hover:bg-orange-50 rounded-full transition" title="Location">
            <MapPin className="w-4 h-4" />
          </button>
        </div>

        <button disabled={busy || content.trim().length < 5} className="rounded-full bg-blue-600 px-8 py-3 text-sm font-bold text-white disabled:opacity-50 hover:bg-blue-700 transition shadow-lg shadow-blue-600/30">
          {busy ? 'Publishing...' : 'Publish'}
        </button>
      </div>
      {error && <div className="mt-2 pl-16"><ErrorBanner text={error} /></div>}
    </form>
  );
}

function TimelinePostCard({
  post,
  selected,
  canVerify,
  busy,
  onSelect,
  onVerify,
}: {
  post: Post;
  selected: boolean;
  canVerify: boolean;
  busy: boolean;
  onSelect: () => void;
  onVerify: () => void;
}) {
  const verification = post.latest_verification_summary;
  
  // Mock numbers for UI
  const likes = Math.floor(Math.random() * 500) + 10;
  const comments = Math.floor(Math.random() * 50) + 5;
  const isLiked = Math.random() > 0.5;

  return (
    <div 
      className={cn(
        "bg-white border rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all",
        selected ? "border-blue-400 ring-4 ring-blue-50" : "border-slate-200"
      )}
      onClick={onSelect}
    >
      {/* Header (Author) */}
      <div className="p-4 flex items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shadow-sm">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author.username}`} alt="avatar" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-slate-800 leading-tight">{post.author.full_name || post.author.username}</div>
            <div className="text-xs text-slate-500 font-medium">@{post.author.username}</div>
          </div>
        </div>
        {/* Badges */}
        <div className="flex items-center gap-2">
         {verification ? (
            <div className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase border flex items-center gap-1.5 shadow-sm", 
               verification.score && verification.score > 70 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
               verification.score && verification.score < 40 ? "bg-red-50 text-red-700 border-red-200" : 
               "bg-amber-50 text-amber-700 border-amber-200")}
            >
               <ShieldCheck className="w-3.5 h-3.5"/> Fact-Checked: {verification.score}
            </div>
         ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); onVerify(); }}
              disabled={!canVerify || busy}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition shadow-sm"
            >
               {busy ? 'Running AI...' : 'Verify Claim'}
            </button>
         )}
        </div>
      </div>

      {/* Body (Content) */}
      <div className="p-5">
        <p className="text-slate-800 text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
          {post.content}
        </p>
        
        {post.source_url && (
          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2 group/link hover:bg-slate-100 transition">
            <Globe className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <a href={post.source_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[13px] font-semibold text-blue-600 hover:text-blue-700 line-clamp-1">
              {getDomainFromUrl(post.source_url)}
            </a>
          </div>
        )}
      </div>

      {/* Footer (Actions) */}
      <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center gap-6 text-slate-500">
        <div className="flex items-center gap-1.5 group/icon cursor-pointer">
          <Heart className={cn("w-4 h-4 transition", isLiked ? "text-red-500 fill-red-500" : "group-hover/icon:text-red-500")} />
          <span className="text-[13px] font-bold">{likes}</span>
        </div>
        <div className="flex items-center gap-1.5 group/icon cursor-pointer">
          <MessageSquare className="w-4 h-4 transition group-hover/icon:text-blue-500" />
          <span className="text-[13px] font-bold">{comments}</span>
        </div>
        <div className="flex items-center gap-1.5 group/icon cursor-pointer">
          <Share2 className="w-4 h-4 transition group-hover/icon:text-emerald-500" />
          <span className="text-[13px] font-bold">Share</span>
        </div>
      </div>
    </div>
  );
}

function VerificationPanel({
  verification,
  canChallenge,
  challengeReason,
  challengeComment,
  setChallengeReason,
  setChallengeComment,
  onChallenge,
  busy,
  error,
}: {
  verification: VerificationResult;
  canChallenge: boolean;
  challengeReason: string;
  challengeComment: string;
  setChallengeReason: (value: string) => void;
  setChallengeComment: (value: string) => void;
  onChallenge: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-5">
          <ShieldCheck className="w-32 h-32 text-emerald-900" />
        </div>
        <div className="flex items-end justify-between relative z-10">
          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest">Verity Score</div>
            <div className="text-5xl font-black text-emerald-900 mt-1">{verification.score ?? '--'}</div>
          </div>
          <div className="text-right text-xs font-bold text-emerald-800 bg-white/60 backdrop-blur px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm">
            <div>{verification.status}</div>
          </div>
        </div>
        {verification.final_decision_note && <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm border border-emerald-100/50 font-medium leading-relaxed">{verification.final_decision_note}</p>}
      </div>

      <div className="space-y-4">
        {verification.claims.map((claim) => {
          const config = VERDICT_CONFIG[claim.verdict];
          return (
            <div key={claim.id} className="rounded-2xl border border-slate-100 shadow-sm p-5 bg-white transition hover:shadow-md">
              <div className="flex items-center justify-between mb-4">
                <span className={cn('rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest', config.bgColor, config.color)}>{config.label}</span>
                <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{Math.round(claim.confidence * 100)}% conf</span>
              </div>
              <p className="text-sm font-bold text-slate-900 mb-2 leading-relaxed">{claim.text}</p>
              <p className="text-[13px] leading-relaxed text-slate-600 font-medium">{claim.reasoning}</p>

              {(claim.sources.supporting.length > 0 || claim.sources.contradicting.length > 0) && (
                <div className="mt-5 pt-4 border-t border-slate-100 grid gap-4">
                  {claim.sources.supporting.length > 0 && <SourceBox title="Supporting Evidence" sources={claim.sources.supporting} />}
                  {claim.sources.contradicting.length > 0 && <SourceBox title="Contradicting Evidence" sources={claim.sources.contradicting} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-amber-900">
          <AlertCircle className="h-5 w-5" />
          Dispute this verdict
        </div>
        {canChallenge ? (
          <div className="space-y-3">
            <select value={challengeReason} onChange={(event) => setChallengeReason(event.target.value)} className="w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-amber-400 focus:ring-2 ring-amber-100 transition shadow-sm">
              {CHALLENGE_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <textarea
              value={challengeComment}
              onChange={(event) => setChallengeComment(event.target.value)}
              placeholder="Why is this verdict wrong?"
              className="h-24 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-amber-400 focus:ring-2 ring-amber-100 transition resize-none shadow-sm"
            />
            {error && <ErrorBanner text={error} />}
            <button onClick={onChallenge} disabled={busy} className="w-full rounded-xl bg-amber-500 px-4 py-3.5 text-sm font-bold text-white hover:bg-amber-600 transition disabled:opacity-50 shadow-lg shadow-amber-200">
              {busy ? 'Submitting...' : 'Submit Challenge'}
            </button>
          </div>
        ) : (
          <div className="text-xs font-bold text-amber-700 bg-white/60 p-4 rounded-xl text-center border border-amber-200/50">Sign in to challenge verdicts.</div>
        )}
      </div>
    </div>
  );
}

function SourceBox({ title, sources }: { title: string; sources: { url: string; snippet: string }[] }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{title}</div>
      <div className="space-y-2">
        {sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block rounded-xl bg-slate-50 border border-slate-100 p-3 hover:bg-white hover:border-blue-200 hover:shadow-sm transition group">
            <div className="text-[13px] font-bold text-blue-600 flex items-center gap-1.5 mb-1.5 group-hover:text-blue-700"><Globe className="w-3.5 h-3.5" /> {getDomainFromUrl(source.url)}</div>
            <div className="text-[12px] text-slate-600 line-clamp-2 leading-relaxed font-medium">{source.snippet}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ModerationCard({
  review,
  decision,
  note,
  overrideScore,
  overrideSummary,
  setDecision,
  setNote,
  setOverrideScore,
  setOverrideSummary,
  busy,
  onResolve,
}: {
  review: ModerationReview;
  decision: 'uphold' | 'revise' | 'remove_verdict';
  note: string;
  overrideScore: string;
  overrideSummary: string;
  setDecision: (value: 'uphold' | 'revise' | 'remove_verdict') => void;
  setNote: (value: string) => void;
  setOverrideScore: (value: string) => void;
  setOverrideSummary: (value: string) => void;
  busy: boolean;
  onResolve: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="font-bold text-slate-800 text-sm mb-2">@{review.post.author.username}'s post</div>
      <p className="text-sm text-slate-600 line-clamp-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium">{review.post.content}</p>
      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 inline-block px-2.5 py-1.5 rounded-lg mb-4 border border-amber-100">
        Score {review.verification.score ?? '--'} · {review.verification.challenge_count} challenges
      </div>
      <div className="space-y-3">
        <select value={decision} onChange={(event) => setDecision(event.target.value as 'uphold' | 'revise' | 'remove_verdict')} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-400">
          <option value="uphold">Uphold verdict</option>
          <option value="revise">Revise verdict</option>
          <option value="remove_verdict">Remove verdict</option>
        </select>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Moderator note (required)" className="h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none resize-none focus:border-blue-400" />
        <input value={overrideScore} onChange={(event) => setOverrideScore(event.target.value)} placeholder="Override score (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-blue-400" />
        <textarea value={overrideSummary} onChange={(event) => setOverrideSummary(event.target.value)} placeholder="Public override summary (optional)" className="h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none resize-none focus:border-blue-400" />
        <button onClick={onResolve} disabled={busy || note.trim().length < 5} className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white hover:bg-slate-800 transition disabled:opacity-50">
          {busy ? 'Resolving...' : 'Resolve Review'}
        </button>
      </div>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return <div className="flex flex-col items-center justify-center gap-3 text-sm font-bold text-slate-400 py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" />{text}</div>;
}

function ErrorBanner({ text }: { text: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 font-bold shadow-sm">{text}</div>;
}

function tab(active: boolean) {
  return cn('flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all', active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700');
}
"""

new_content = content[:start_idx] + correct_content

with open('src/app/page.tsx', 'w') as f:
    f.write(new_content)

print("Fixed syntax")
