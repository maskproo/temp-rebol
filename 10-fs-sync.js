const { readFileSync, writeFileSync } = require('fs');
console.log("start ");
const first = readFileSync('./content/first.txt', 'utf-8');
const second = readFileSync('./content/second.txt', 'utf-8');
console.log(first, second);
writeFileSync('./content/result-sync.txt',
    `the result file system: ${first} , ${second}`,
    { flag: 'a' },
    console.log("prossing app")
)

console.log("done app");