const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { expect } = require('chai');

describe('Minimal OpenAPI Spec Loading Test', function() {
  let openApiSpec;
  
  before(function() {
    console.log('Starting minimal OpenAPI spec loading test');
    
    // Load the OpenAPI spec
    const baseDir = path.resolve(__dirname, '../../../API Docs');
    const specPath = path.join(baseDir, 'openapi.yaml');
    console.log('Loading OpenAPI spec from:', specPath);
    
    if (!fs.existsSync(specPath)) {
      throw new Error(`OpenAPI specification file not found at: ${specPath}`);
    }
    
    // Read the main spec file
    const specContent = fs.readFileSync(specPath, 'utf8');
    openApiSpec = yaml.parse(specContent);
    
    if (!openApiSpec) {
      throw new Error('Failed to parse OpenAPI specification');
    }
    
    console.log('Successfully loaded OpenAPI spec with:', {
      openapi: openApiSpec.openapi,
      info: openApiSpec.info,
      servers: openApiSpec.servers,
      pathsCount: openApiSpec.paths ? Object.keys(openApiSpec.paths).length : 0,
      components: openApiSpec.components ? Object.keys(openApiSpec.components) : []
    });
  });
  
  it('should load the OpenAPI spec', function() {
    expect(openApiSpec).to.be.an('object');
    expect(openApiSpec.openapi).to.be.a('string');
    expect(openApiSpec.info).to.be.an('object');
    expect(openApiSpec.paths).to.be.an('object');
  });
  
  it('should have valid paths', function() {
    const paths = openApiSpec.paths;
    expect(paths).to.be.an('object');
    
    const pathKeys = Object.keys(paths);
    console.log('Available paths:', pathKeys);
    
    expect(pathKeys.length).to.be.greaterThan(0);
    
    // Check a sample path
    const samplePath = pathKeys[0];
    const pathItem = paths[samplePath];
    console.log(`Sample path (${samplePath}):`, Object.keys(pathItem));
    
    expect(pathItem).to.be.an('object');
  });
});
