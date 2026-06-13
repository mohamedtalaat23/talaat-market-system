const fs = require('fs');
const path = require('path');
const glob = require('glob'); // Need to check if glob is installed, if not we can use a simple recursive walk

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory()) {
            walkSync(filePath, callback);
        }
    });
}

walkSync('/home/talaat/Documents/Talaat Market System/packages/client/src/features', function(filePath) {
    if (!filePath.endsWith('Modal.tsx')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if already has createPortal
    if (content.includes('createPortal(')) return;
    
    // Skip if not a typical fixed inset-0 modal
    if (!content.includes('fixed inset-0')) return;

    console.log(`Patching ${filePath}...`);
    
    // Add import { createPortal } from 'react-dom';
    // We add it right after the first import statement
    content = content.replace(/import {?[^;]+;/, match => match + "\nimport { createPortal } from 'react-dom';");

    // Wrap the return statement
    // Find: `return (` followed by `<div className="fixed inset-0`
    // It could be `return (` or `return (\n`
    content = content.replace(/return\s*\(\s*(<div[^>]*className=["'][^"']*fixed inset-0[^"']*["'][^>]*>)/, "return createPortal(\n    $1");

    // Close the createPortal at the end
    // It's usually the last `</div>\n    </div>\n  );\n}`
    // Let's just find `  );\n}` at the end of the file and replace it.
    const parts = content.split(');');
    if (parts.length > 1) {
        // Replace the last instance of `\n  );` or `\n  )` with `\n  ),\n    document.body\n  );`
        content = content.replace(/\n\s*\);\n}\n?$/, ",\n    document.body\n  );\n}\n");
    }
    
    fs.writeFileSync(filePath, content);
});
console.log('Finished patching modals!');
