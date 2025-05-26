const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

describe('OpenAPI Schema Validation', function() {
  let openApiSpec;
  
  before(function() {
    // Load the main OpenAPI spec file
    const baseDir = path.resolve(__dirname, '../../../API Docs');
    const specPath = path.join(baseDir, 'openapi.yaml');
    
    if (!fs.existsSync(specPath)) {
      throw new Error(`OpenAPI spec not found at: ${specPath}`);
    }
    
    const specContent = fs.readFileSync(specPath, 'utf8');
    openApiSpec = yaml.parse(specContent);
    
    if (!openApiSpec) {
      throw new Error('Failed to parse OpenAPI spec');
    }
    
    // Load paths from the paths directory
    const pathsDir = path.join(baseDir, 'paths');
    if (fs.existsSync(pathsDir)) {
      openApiSpec.paths = openApiSpec.paths || {};
      
      const pathFiles = fs.readdirSync(pathsDir);
      pathFiles.forEach(file => {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const filePath = path.join(pathsDir, file);
          const pathContent = fs.readFileSync(filePath, 'utf8');
          const pathSpec = yaml.parse(pathContent);
          
          if (pathSpec) {
            const pathName = '/' + path.basename(file, path.extname(file));
            openApiSpec.paths[pathName] = pathSpec;
          }
        }
      });
    }
  });
  
  it('should load the OpenAPI spec', function() {
    expect(openApiSpec).to.be.an('object');
    expect(openApiSpec.openapi).to.be.a('string');
    expect(openApiSpec.info).to.be.an('object');
    expect(openApiSpec.paths).to.be.an('object');
  });
  
  it('should have valid paths', function() {
    const paths = openApiSpec.paths || {};
    expect(Object.keys(paths).length).to.be.greaterThan(0);
    
    Object.entries(paths).forEach(([path, pathItem]) => {
      expect(path).to.be.a('string');
      expect(pathItem).to.be.an('object');
      
      // Check each HTTP method in the path
      Object.entries(pathItem).forEach(([method, operation]) => {
        if (['get', 'put', 'post', 'delete', 'patch'].includes(method)) {
          expect(operation).to.be.an('object');
          expect(operation.responses).to.be.an('object');
          
          // Check request body if present
          if (operation.requestBody) {
            expect(operation.requestBody).to.be.an('object');
            if (operation.requestBody.content) {
              expect(operation.requestBody.content).to.be.an('object');
            }
          }
          
          // Check responses
          Object.entries(operation.responses).forEach(([statusCode, response]) => {
            expect(response).to.be.an('object');
            if (response.content) {
              expect(response.content).to.be.an('object');
            }
          });
        }
      });
    });
  });
});
