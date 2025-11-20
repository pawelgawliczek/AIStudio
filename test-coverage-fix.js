// Quick test to verify the coverage endpoint after localPath fix
const fs = require('fs');
const path = require('path');

const projectLocalPath = '/app/backend'; // Updated path
const coveragePath = path.join(projectLocalPath, 'coverage', 'coverage-summary.json');

console.log('Testing coverage file read...');
console.log('Coverage path:', coveragePath);

try {
  const coverageData = fs.readFileSync(coveragePath, 'utf-8');
  const coverage = JSON.parse(coverageData);
  const coveragePercentage = coverage.total?.lines?.pct || 0;

  console.log('\n✓ Coverage file read successfully');
  console.log('  Coverage percentage:', coveragePercentage + '%');
  console.log('  Expected: 11.88%');
  console.log('  Match:', Math.abs(coveragePercentage - 11.88) < 0.01 ? '✓ YES' : '✗ NO');

} catch (error) {
  console.log('\n✗ Error reading coverage file:',  error.message);
  process.exit(1);
}
