const fs = require('fs');
const JSONStream = require('JSONStream');

// Function to check if URL matches our CDN pattern
function isCdnUrl(url) {
    return url.match(/cdn.*\.reblogme\.com\//);
}

// Create a Set to store unique CDN URLs
const cdnUrls = new Set();

// Create read stream and JSON parser
const fileStream = fs.createReadStream('reblogme.com.har', {encoding: 'utf8'});
const jsonParser = JSONStream.parse('log.entries.*');

// Process entries as they come in
fileStream.pipe(jsonParser)
    .on('data', entry => {
        const url = entry.request.url;
        if (isCdnUrl(url)) {
            cdnUrls.add(url);
        }
    })
    .on('end', () => {
        // Write results to file
        const outputPath = './extracted-cdn-urls.txt';
        fs.writeFileSync(outputPath, Array.from(cdnUrls).join('\n'));
        
        console.log(`Found ${cdnUrls.size} unique CDN URLs`);
        console.log(`Results written to ${outputPath}`);
    })
    .on('error', error => {
        console.error('Error processing HAR file:', error);
        process.exit(1);
    }); 