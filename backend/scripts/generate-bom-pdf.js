#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const exportService = require('../services/exportService');

function printUsageAndExit() {
  console.error('Usage: node backend/scripts/generate-bom-pdf.js --json <quotation.json> [--ref <PQyymmxxxx>] [--strip-pq]');
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') {
      args.json = argv[++i];
    } else if (a === '--ref') {
      args.ref = argv[++i];
    } else if (a === '--strip-pq') {
      args.stripPQ = true;
    } else {
      console.error(`Unknown argument: ${a}`);
      printUsageAndExit();
    }
  }
  return args;
}

(async () => {
  try {
    const { json, ref, stripPQ } = parseArgs(process.argv);
    const jsonPath = json || process.env.QUOTATION_JSON;
    const quoteRef = ref || process.env.QUOTE_REF;
    const strip = typeof stripPQ !== 'undefined' ? stripPQ : (process.env.STRIP_PQ === '1' || process.env.STRIP_PQ === 'true');

    if (!jsonPath) {
      console.error('Error: --json <quotation.json> (or QUOTATION_JSON env) is required');
      printUsageAndExit();
    }

    const absJsonPath = path.isAbsolute(jsonPath) ? jsonPath : path.join(process.cwd(), jsonPath);
    if (!fs.existsSync(absJsonPath)) {
      console.error(`Error: JSON file not found: ${absJsonPath}`);
      process.exit(2);
    }

    const raw = fs.readFileSync(absJsonPath, 'utf8');
    const quotationData = JSON.parse(raw);

    // Ensure quoteRef
    if (!quotationData.quoteRef && !quoteRef) {
      console.error('Error: quotationData.quoteRef missing and --ref not provided');
      process.exit(3);
    }

    const filePath = await exportService.exportBOMToPDF(quotationData, { quoteRef: quoteRef || quotationData.quoteRef, stripPQ: strip });
    console.log(filePath);
  } catch (err) {
    console.error(err);
    process.exit(4);
  }
})();