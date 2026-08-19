const fs = require('fs');
const content = fs.readFileSync('src/app/page.tsx', 'utf-8');

const rightSidebarMatch = content.match(/<aside className="w-full lg:w-\[380px\] xl:w-\[420px\] bg-\[#f8f9fc\] border-l border-slate-100 p-8 flex flex-col flex-shrink-0 h-screen overflow-y-auto hidden md:flex relative z-10">([\s\S]*?)<\/aside>/);

if (!rightSidebarMatch) {
    console.error("Could not find right sidebar");
    process.exit(1);
}

const originalRightSidebar = rightSidebarMatch[0];
const topActionsMatch = originalRightSidebar.match(/<div className="flex items-center gap-3 mb-10">[\s\S]*?<\/div>\s*<\/button>\s*<\/div>/);
const topActionsHtml = topActionsMatch ? topActionsMatch[0] : '';
const topActionsXlOnly = topActionsHtml;
const topActionsLgOnly = topActionsHtml.replace('className="flex items-center gap-3 mb-10"', 'className="flex xl:hidden items-center gap-3 mb-10"');

const activityMatch = originalRightSidebar.match(/<div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-300">([\s\S]*?)<\/div>\s*\)\s*:\s*\(/);
const activityHtml = activityMatch ? activityMatch[1] : '';

const factCheckMatch = originalRightSidebar.match(/<div className="space-y-6 flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">([\s\S]*?)<\/div>\s*\)\}\s*<\/aside>/);
const factCheckHtml = factCheckMatch ? factCheckMatch[1] : '';

const newLayout = `
        {/* FACT CHECK SIDEBAR */}
        <aside className={cn(
            "w-full lg:w-[360px] bg-white border-l border-slate-100 p-6 flex-col flex-shrink-0 h-screen overflow-y-auto relative z-10 shadow-sm",
            selectedPostId ? "flex" : "hidden lg:flex"
        )}>
            ${topActionsLgOnly}
            
            {!selectedPostId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60 mt-20">
                    <ShieldCheck className="w-16 h-16 text-slate-300 mb-4" />
                    <p className="text-sm font-semibold text-slate-500">Select a post to view<br/>fact-check details.</p>
                </div>
            ) : (
                <div className="space-y-6 flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                    ${factCheckHtml}
                </div>
            )}
        </aside>

        {/* SUGGESTIONS & ACTIVITY SIDEBAR */}
        <aside className="w-[340px] bg-[#fdfdfd] border-l border-slate-100 p-6 flex flex-col flex-shrink-0 h-screen overflow-y-auto hidden xl:flex relative z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
            ${topActionsXlOnly}
            
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-300">
                ${activityHtml}
            </div>
        </aside>
`;

fs.writeFileSync('src/app/page.tsx', content.replace(originalRightSidebar, newLayout));
console.log("Patched layout");
