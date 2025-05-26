const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');
const config = require('../config');

console.log('Starting minimal test...');

// Load the OpenAPI specification
function loadOpenApiSpec() {
  // The OpenAPI spec is in the parent directory
  const specPath = path.resolve(__dirname, '../../../API Docs/openapi.yaml');
  
  console.log('Current directory:', __dirname);
  console.log('Spec path:', specPath);
  console.log('File exists:', fs.existsSync(specPath));
  
  // List the directory contents for debugging
  const dirPath = path.dirname(specPath);
  console.log('Directory contents:', fs.readdirSync(dirPath));
  
  if (!fs.existsSync(specPath)) {
    throw new Error(`OpenAPI specification file not found at: ${specPath}`);
  }
  
  const specContent = fs.readFileSync(specPath, 'utf8');
  const openApiSpec = yaml.parse(specContent);
  
  if (!openApiSpec) {
    throw new Error('Failed to parse OpenAPI specification');
  }
  
  return openApiSpec;
}

describe('Minimal API Test', function() {
  this.timeout(10000);
  
  let openApiSpec;
  
  before(function() {
    console.log('Before hook running...');
    openApiSpec = loadOpenApiSpec();
    console.log('OpenAPI spec loaded:', !!openApiSpec);
    if (openApiSpec) {
      console.log('OpenAPI version:', openApiSpec.openapi);
      console.log('OpenAPI paths:', Object.keys(openApiSpec.paths || {}));
    }
  });
  
  it('should load the OpenAPI spec', function() {
    console.log('Test running...');
    expect(openApiSpec).to.exist;
    expect(openApiSpec.openapi).to.match(/^3\.\d+\.\d+$/);
  });
  
  it('should have paths defined', function() {
    expect(openApiSpec.paths).to.exist;
    expect(openApiSpec.paths).to.be.an('object');
  });
});
