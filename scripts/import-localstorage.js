//Imports a node-localstorage directory (one file per key) into the SQLite db.
//Usage: node scripts/import-localstorage.js ../scratch
//Idempotent: every row is upserted, so it can be run repeatedly.
const fs = require("fs");
const path = require("path");

const srcArg = process.argv[2];
if (!srcArg) {
  console.error("Usage: node scripts/import-localstorage.js <localstorage-dir>");
  process.exit(1);
}
const srcDir = path.resolve(srcArg);
if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
  console.error(`import-localstorage: ${srcDir} is not a directory`);
  process.exit(1);
}

const { putKV, putUserRow, dbPath } = require("../src/db");
console.log(`import-localstorage: ${srcDir} -> ${dbPath}`);

let imported = 0;
let skipped = 0;
for (const fileName of fs.readdirSync(srcDir).sort()) {
  const filePath = path.join(srcDir, fileName);
  if (!fs.statSync(filePath).isFile()) continue;

  //node-localstorage percent-encodes some characters in key file names
  let key = fileName;
  try {
    key = decodeURIComponent(fileName);
  } catch (err) {
    //not valid percent-encoding, keep the raw name
  }

  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`skip ${key}: not valid JSON (${err.message})`);
    skipped++;
    continue;
  }

  if (key === "limits") {
    putKV("limits", value);
    console.log(`kv    limits`);
  } else {
    if (!value || typeof value !== "object") {
      console.error(`skip ${key}: not a JSON object`);
      skipped++;
      continue;
    }
    //prefer the userID stored in the record, fall back to the file name
    if (value.userID === undefined || value.userID === null || value.userID === "") {
      value.userID = key;
    }
    putUserRow(value);
    console.log(`user  ${value.userID}`);
  }
  imported++;
}

console.log(`import-localstorage: imported ${imported} key(s), skipped ${skipped}`);
