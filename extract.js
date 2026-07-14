const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('/home/turronmantecoso/.gemini/antigravity-cli/brain/a904c7a7-1c85-4bf7-bae8-5b7e78d78486/.system_generated/logs/transcript_full.jsonl'),
  crlfDelay: Infinity
});

let found = null;
rl.on('line', (line) => {
  if (line.includes('replace_file_content') && line.includes('frontend/src/App.tsx')) {
    try {
      const data = JSON.parse(line);
      if (data.tool_calls) {
        for (const call of data.tool_calls) {
          if (call.name === 'default_api:replace_file_content' && call.arguments.TargetFile.endsWith('frontend/src/App.tsx')) {
            // Find the biggest replacement, which was probably the full file replacement or the massive chunk replacement
            if (!found || call.arguments.ReplacementContent.length > found.length) {
              found = call.arguments.ReplacementContent;
            }
          }
        }
      }
    } catch(e) {}
  }
});

rl.on('close', () => {
  if (found) {
    fs.writeFileSync('/home/turronmantecoso/Escritorio/ArquitecturaWork/frontend/src/App.tsx.extracted', found);
    console.log('Successfully extracted ReplacementContent!');
  } else {
    console.log('Not found in replace_file_content either.');
  }
});
