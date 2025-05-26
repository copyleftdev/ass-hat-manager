const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Create a new Mocha instance
const mocha = new Mocha({
  timeout: config.test.timeout,
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: path.join(__dirname, 'reports'),
    reportFilename: 'test-report',
    quiet: true,
    json: true,
    html: true
  }
});

// Add test files
const testDir = __dirname;

function addTests(dir) {
  fs.readdirSync(dir)
    .filter(file => {
      // Only keep .js files that are not the runner itself
      return (
        file.substr(-3) === '.js' &&
        file !== 'runner.js' &&
        file !== 'config.js'
      );
    })
    .forEach(file => {
      mocha.addFile(path.join(dir, file));
    });
}

// Add all test files
addTests(testDir);

// Run the tests
mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
  process.exit(process.exitCode);
});
