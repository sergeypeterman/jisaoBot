const fs = require('fs');

const urls = fs.readFileSync('./extracted-cdn-urls.txt', 'utf8').split('\n').filter(url => url.trim());

let downloadCommands = '';
let counter = 1;

urls.forEach(url => {
    if (!url) return;
    
    // Extract file extension from URL
    const extension = url.split('.').pop();
    
    // Create the curl command for Windows
    // Using ^ to escape special characters and quotes for Windows
    const command = `curl -H "Referer: https://reblogme.com/" -o "media${counter}.${extension}" "${url}"\r\n`;
    
    downloadCommands += command;
    counter++;
});

// Write commands to a batch file
fs.writeFileSync('download-media.bat', downloadCommands);

console.log('Created download-media.bat with', urls.length, 'commands'); 