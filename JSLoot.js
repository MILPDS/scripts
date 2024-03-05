const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const urlLib = require('url'); // Node.js URL module

const URLS_FILE_PATH = 'urls.txt';
const SCRIPTS_DIR = 'downloaded_scripts'; // Directory to save scripts
const METADATA_FILE_PATH = 'scripts_metadata.txt'; // File to save metadata

// Ensure the scripts directory exists
if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR);
}

// Clear the metadata file or create it if it doesn't exist
fs.writeFileSync(METADATA_FILE_PATH, '');

const urls = fs.readFileSync(URLS_FILE_PATH, 'utf8').split('\n').filter(Boolean);

urls.forEach((pageUrl, index) => {
    axios.get(pageUrl)
        .then(response => {
            const html = response.data;
            const $ = cheerio.load(html);
            let scriptCounter = 0;

            $('script').each((i, elem) => {
                const src = $(elem).attr('src');
                if (src) {
                    // Resolve the absolute URL of the script
                    const scriptUrl = urlLib.resolve(pageUrl, src);

                    axios.get(scriptUrl, {responseType: 'text'})
                        .then(scriptResponse => {
                            const scriptFileName = `script_${index}_${scriptCounter}.js`;
                            const scriptPath = path.join(SCRIPTS_DIR, scriptFileName);
                            fs.writeFileSync(scriptPath, scriptResponse.data);
                            console.log(`Downloaded script saved to: ${scriptPath}`);

                            // Write metadata entry
                            const metadataEntry = `${scriptFileName}\t${scriptUrl}\n`;
                            fs.appendFileSync(METADATA_FILE_PATH, metadataEntry);

                            scriptCounter++;
                        })
                        .catch(error => console.error(`Error downloading script from ${scriptUrl}: ${error.message}`));
                } else {
                    // Save inline script
                    const inlineScriptContent = $(elem).html();
                    const scriptFileName = `inline_script_${index}_${scriptCounter}.js`;
                    const scriptPath = path.join(SCRIPTS_DIR, scriptFileName);
                    fs.writeFileSync(scriptPath, inlineScriptContent);
                    console.log(`Inline script saved to: ${scriptPath}`);

                    // Write metadata entry for inline script with the page URL as the source
                    const metadataEntry = `${scriptFileName}\t${pageUrl}\n`;
                    fs.appendFileSync(METADATA_FILE_PATH, metadataEntry);

                    scriptCounter++;
                }
            });
        })
        .catch(console.error);
});

