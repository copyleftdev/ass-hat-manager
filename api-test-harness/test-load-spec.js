const path = require('path');
const fs = require('fs');
const yaml = require('yaml');

// Load config
const config = require('./test/config');

// Get the project root directory (two levels up from this file)
const projectRoot = path.resolve(__dirname);
const specPath = path.resolve(projectRoot, config.paths.spec);

console.log('Project root:', projectRoot);
console.log('Spec path:', specPath);

// Check if file exists
if (!fs.existsSync(specPath)) {
  console.error(`Error: OpenAPI specification file not found at: ${specPath}`);
  process.exit(1);
}

// Try to read and parse the file
try {
  console.log('Reading spec file...');
  const specContent = fs.readFileSync(specPath, 'utf8');
  console.log('File read successfully, parsing YAML...');
  
  const openApiSpec = yaml.parse(specContent);
  
  if (!openApiSpec) {
    console.error('Error: Failed to parse OpenAPI specification - empty result');
    process.exit(1);
  }
  
  console.log('OpenAPI spec parsed successfully!');
  console.log('OpenAPI version:', openApiSpec.openapi);
  console.log('Title:', openApiSpec.info?.title);
  console.log('Number of paths:', Object.keys(openApiSpec.paths || {}).length);
  
} catch (error) {
  console.error('Error loading OpenAPI specification:');
  console.error(error);
  process.exit(1);
}
