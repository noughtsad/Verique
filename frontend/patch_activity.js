const fs = require('fs');
const content = fs.readFileSync('src/app/page.tsx', 'utf-8');

// Extract the activity content
const activityMatch = content.match(/\{\/\* People to Follow \*\/\}[\s\S]*?\{\/\* Last Activity \*\/\}[\s\S]*?<\/div>\s*<\/div>/);
if (!activityMatch) {
    console.error("Could not find activity content");
    process.exit(1);
}
const activityHtml = activityMatch[0];

// 1. Create the new component at the bottom of the file
const componentCode = `
function ActivitySidebarContent() {
  return (
    <div className="space-y-10">
      ${activityHtml}
    </div>
  );
}
`;

// Append the component to the file
let newContent = content + '\n' + componentCode;

// 2. Replace the activity content in the Activity sidebar with the component
newContent = newContent.replace(
  /<div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-300">\s*\{\/\* People to Follow \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
  '<div className="animate-in fade-in slide-in-from-right-4 duration-300"><ActivitySidebarContent /></div>'
);

// 3. Replace the placeholder in the Fact-Check sidebar with the responsive dual-view
const placeholderMatch = newContent.match(/<div className="flex-1 flex flex-col items-center justify-center text-center opacity-60 mt-20">\s*<ShieldCheck className="w-16 h-16 text-slate-300 mb-4" \/>\s*<p className="text-sm font-semibold text-slate-500">Select a post to view<br\/>fact-check details\.<\/p>\s*<\/div>/);

if (!placeholderMatch) {
    console.error("Could not find placeholder");
    process.exit(1);
}

const newPlaceholder = `
                <>
                  <div className="hidden xl:flex flex-1 flex-col items-center justify-center text-center opacity-60 mt-20">
                      <ShieldCheck className="w-16 h-16 text-slate-300 mb-4" />
                      <p className="text-sm font-semibold text-slate-500">Select a post to view<br/>fact-check details.</p>
                  </div>
                  <div className="xl:hidden flex-1 overflow-y-auto no-scrollbar animate-in fade-in duration-300">
                      <ActivitySidebarContent />
                  </div>
                </>
`;

newContent = newContent.replace(placeholderMatch[0], newPlaceholder);

fs.writeFileSync('src/app/page.tsx', newContent);
console.log("Patched Activity Pane");
