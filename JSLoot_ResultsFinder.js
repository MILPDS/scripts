const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const SCRIPTS_DIR = 'downloaded_scripts';
const OUTPUT_FILE = 'urls.output';
const XSS_OUTPUT_FILE = 'xss.output';
const SQL_OUTPUT_FILE = 'sql.output'; // Output file for potential SQL injection vectors
const SCOPE_OUTPUT_FILE = 'scope.output'; // Output file for URLs matching domain partially
const INTERESTING_OUTPUT_FILE = 'Interesting.output'; // New output file for hardcoded credentials and APIs
const METADATA_FILE_PATH = 'scripts_metadata.txt';
const EXTRACTED_HOSTS_FILE = 'extracted_hosts.txt'; // File containing hosts to check against

if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR);
}
fs.writeFileSync(OUTPUT_FILE, '');
fs.writeFileSync(XSS_OUTPUT_FILE, '');
fs.writeFileSync(SQL_OUTPUT_FILE, ''); // Initialize the SQL output file
fs.writeFileSync(SCOPE_OUTPUT_FILE, ''); // Initialize the scope output file
fs.writeFileSync(INTERESTING_OUTPUT_FILE, ''); // Initialize the Interesting output file

const scriptSources = new Map();
const foundUrls = new Set();
const validHosts = new Set(fs.readFileSync(EXTRACTED_HOSTS_FILE, 'utf8').split('\n').filter(Boolean));

fs.readFileSync(METADATA_FILE_PATH, 'utf8').split('\n').filter(Boolean).forEach(line => {
    const [filename, sourceUrl] = line.split('\t');
    scriptSources.set(filename, sourceUrl);
});

const patterns = {
    hardcodedApiKey: {
        regex: /\b(apiKey|api_key|API_KEY)\s*=\s*['"]([a-zA-Z0-9]{32,})['"]/g,
        message: 'Hardcoded API key found: ',
        capture: true,
        interesting: true
    },
    httpUrls: {
        regex: /(http:\/\/[a-zA-Z0-9./?=_-]+)/g,
        message: 'HTTP URL found: ',
        capture: true
    },
    httpsUrls: {
        regex: /(https:\/\/[a-zA-Z0-9./?=_-]+)/g,
        message: 'HTTPS URL found: ',
        capture: true
    },
    sqlInjection: {
        regex: /https?:\/\/[^\s]+[?&]id=\S*/ig,
        message: 'Potential SQL injection point found: ',
        capture: true
    },
    hardcodedPassword: {
        regex: /\b(password|passwd|pwd|root|admin|Administrator|changeme)\s*=\s*['"][a-zA-Z0-9@#$%^&*()_+]{3,}['"]/g,
        message: 'Hardcoded password found: ',
        capture: true,
        interesting: true
    },
    generalUrls: {
        regex: /(https?:\/\/[^\s]+)/g, // Capture all URLs for scope checking
        message: 'URL found for scope checking: ',
        capture: true,
        outputToFile: 'scope' // Specify custom output for general URLs
    },
    insecureDocumentManipulation: {
        regex: /document\.write\(|innerHTML\s*=|outerHTML\s*=/g,
        message: 'Potential insecure document manipulation which could lead to XSS vulnerabilities.',
        capture: false
    }
};

function appendUrlToFile(url, outputFile = OUTPUT_FILE) {
    fs.appendFileSync(outputFile, url + '\n');
}

function appendXSSFindingsToFile(filePath, count) {
    const entry = `${filePath}: ${count} potential insecure document manipulation(s) found\n`;
    fs.appendFileSync(XSS_OUTPUT_FILE, entry);
}

function appendInterestingFindingsToFile(findings, filePath) {
    const sourceUrl = scriptSources.get(path.basename(filePath)) || 'Unknown source';
    const entry = findings.map(finding => `${finding} in ${sourceUrl}\n`).join('');
    fs.appendFileSync(INTERESTING_OUTPUT_FILE, entry);
}

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let findings = [];
    let interestingFindings = [];
    let urlsFound = 0;
    let documentManipulations = 0;
    Object.entries(patterns).forEach(([concern, {regex, message, capture, interesting}]) => {
        const matches = [...content.matchAll(regex)];
        matches.forEach(match => {
            if (capture) {
                const specificFinding = match[0]; // Use the whole match for URL patterns
                if (interesting) {
                    interestingFindings.push(chalk.red(message + specificFinding));
                } else if (concern === 'httpUrls' || concern === 'httpsUrls' || concern === 'generalUrls') {
                    if (!foundUrls.has(specificFinding)) {
                        foundUrls.add(specificFinding);
                        const outputFile = concern === 'generalUrls' ? SCOPE_OUTPUT_FILE : OUTPUT_FILE;
                        appendUrlToFile(specificFinding, outputFile);
                        urlsFound++;
                    }
                } else if (concern === 'sqlInjection') {
                    appendUrlToFile(specificFinding, SQL_OUTPUT_FILE); // Append potential SQL injection points to file
                } else {
                    findings.push(chalk.red(message + specificFinding));
                }
            } else if (concern === 'insecureDocumentManipulation') {
                documentManipulations += matches.length;
            }
        });
    });

    if (documentManipulations > 0) {
        appendXSSFindingsToFile(filePath, documentManipulations);
    }

    if (interestingFindings.length > 0) {
        appendInterestingFindingsToFile(interestingFindings, filePath);
    }

    if (urlsFound > 0 || documentManipulations > 0 || interestingFindings.length > 0) {
        findings.push(`${urlsFound} URL(s) found`);
        findings.push(`${documentManipulations} potential insecure document manipulation(s) which could lead to XSS vulnerabilities found`);
    }

    return findings;
}

function scanDirectory(directory) {
    const files = fs.readdirSync(directory);
    files.forEach(file => {
        if (path.extname(file) === '.js') {
            const filePath = path.join(directory, file);
            const findings = scanFile(filePath);
            if (findings.length > 0) {
                const sourceUrl = scriptSources.get(file) || 'Unknown source';
                console.log(chalk.blue(`Issues found in ${file} from ${sourceUrl}:`));
                findings.forEach(finding => console.log(finding));
                console.log('---');
            }
        }
    });
}

scanDirectory(SCRIPTS_DIR);
