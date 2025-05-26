const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');
const { validate } = require('swagger-parser');
const config = require('../config');

// Load the OpenAPI specification
function loadOpenApiSpec() {
  // Get the project root directory (two levels up from this file)
  const projectRoot = path.resolve(__dirname, '../..');
  const specPath = path.resolve(projectRoot, config.paths.spec);
  
  if (!fs.existsSync(specPath)) {
    throw new Error(`OpenAPI specification file not found at: ${specPath}`);
  }
  
  console.log(`Loading OpenAPI spec from: ${specPath}`);
  const specContent = fs.readFileSync(specPath, 'utf8');
  const openApiSpec = yaml.parse(specContent);
  
  if (!openApiSpec) {
    throw new Error('Failed to parse OpenAPI specification');
  }
  
  return openApiSpec;
}

describe('OpenAPI Specification Validation', function() {
  this.timeout(config.test.timeout);
  
  let openApiSpec;
  
  before(async function() {
    if (!config.test.groups.validation) {
      return this.skip();
    }
    
    try {
      // Load the OpenAPI specification
      openApiSpec = loadOpenApiSpec();
    } catch (error) {
      console.error('Failed to load OpenAPI specification:', error.message);
      throw error;
    }
  });
  
  it('should be a valid OpenAPI 3.1.0 document', async function() {
    try {
      // This will throw if the spec is invalid
      await validate(openApiSpec);
      expect(openApiSpec.openapi).to.equal('3.1.0');
    } catch (err) {
      throw new Error(`Invalid OpenAPI specification: ${err.message}`);
    }
  });
  
  it('should have required top-level fields', function() {
    const requiredFields = ['info', 'paths'];
    requiredFields.forEach(field => {
      expect(openApiSpec).to.have.property(field);
    });
  });
  
  it('should have valid info object', function() {
    const { info } = openApiSpec;
    expect(info).to.have.property('title').that.is.a('string').and.not.empty;
    expect(info).to.have.property('version').that.is.a('string').and.not.empty;
    expect(info).to.have.property('description').that.is.a('string').and.not.empty;
  });
  
  it('should have valid paths', function() {
    const { paths } = openApiSpec;
    expect(paths).to.be.an('object');
    
    // Check that paths start with a forward slash
    Object.keys(paths).forEach(path => {
      expect(path).to.match(/^\//, `Path '${path}' should start with a forward slash`);
    });
  });
  
  it('should have valid operations', function() {
    const { paths } = openApiSpec;
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
    
    Object.entries(paths).forEach(([path, pathItem]) => {
      Object.keys(pathItem).forEach(method => {
        if (httpMethods.includes(method)) {
          const operation = pathItem[method];
          
          // Check operation has required fields
          expect(operation).to.have.property('summary').that.is.a('string').and.not.empty;
          expect(operation).to.have.property('description').that.is.a('string').and.not.empty;
          expect(operation).to.have.property('responses').that.is.an('object').and.not.empty;
          
          // Check for operationId if present
          if (operation.operationId) {
            expect(operation.operationId).to.match(
              /^[a-zA-Z0-9\.\-_]+$/, 
              `operationId '${operation.operationId}' should be alphanumeric with dots, hyphens, or underscores`
            );
          }
          
          // Check for tags
          if (operation.tags) {
            expect(operation.tags).to.be.an('array').and.not.empty;
            operation.tags.forEach(tag => {
              expect(tag).to.be.a('string').and.not.empty;
            });
          }
        }
      });
    });
  });
  
  it('should have valid security schemes', function() {
    if (!openApiSpec.components || !openApiSpec.components.securitySchemes) {
      return this.skip('No security schemes defined');
    }
    
    const { securitySchemes } = openApiSpec.components;
    expect(securitySchemes).to.be.an('object');
    
    Object.entries(securitySchemes).forEach(([name, scheme]) => {
      expect(scheme).to.have.property('type').that.is.a('string').and.not.empty;
      
      if (scheme.type === 'http') {
        expect(scheme).to.have.property('scheme').that.is.a('string').and.not.empty;
      } else if (scheme.type === 'oauth2') {
        expect(scheme).to.have.property('flows').that.is.an('object').and.not.empty;
      } else if (scheme.type === 'apiKey') {
        expect(scheme).to.have.property('name').that.is.a('string').and.not.empty;
        expect(scheme).to.have.property('in').that.is.a('string').and.match(/^(header|query|cookie)$/);
      }
    });
  });
  
  it('should have consistent parameter naming', function() {
    const { paths } = openApiSpec;
    const parameterNames = new Set();
    
    // Collect all parameter names
    Object.values(paths).forEach(pathItem => {
      Object.values(pathItem).forEach(operation => {
        if (operation.parameters) {
          operation.parameters.forEach(param => {
            if (param.$ref) {
              // Handle references
              const refName = param.$ref.split('/').pop();
              parameterNames.add(refName);
            } else if (param.name) {
              parameterNames.add(param.name);
            }
          });
        }
      });
    });
    
    // Check naming convention (camelCase or snake_case)
    parameterNames.forEach(name => {
      expect(name).to.match(
        /^[a-z][a-zA-Z0-9]*$|^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, 
        `Parameter name '${name}' should be in camelCase or snake_case`
      );
    });
  });
  
  it('should have proper response schemas', function() {
    const { paths } = openApiSpec;
    
    Object.values(paths).forEach(pathItem => {
      Object.values(pathItem).forEach(operation => {
        if (operation.responses) {
          Object.entries(operation.responses).forEach(([statusCode, response]) => {
            // Skip 204 No Content responses as they don't have a body
            if (statusCode === '204') return;
            
            if (response.content && response.content['application/json']) {
              const schema = response.content['application/json'].schema;
              expect(schema, `Response schema for ${statusCode} should be defined`).to.exist;
              
              // If it's a reference, check that it exists
              if (schema.$ref) {
                const refPath = schema.$ref.split('/').slice(1);
                let current = openApiSpec;
                
                for (const part of refPath) {
                  expect(
                    current[part],
                    `Invalid reference: ${schema.$ref}`
                  ).to.exist;
                  current = current[part];
                }
              }
            }
          });
        }
      });
    });
  });
});
