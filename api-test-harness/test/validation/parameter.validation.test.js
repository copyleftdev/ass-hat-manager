const { expect } = require('chai');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Configure Ajv with OpenAPI support
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  validateFormats: true,
  strictSchema: false
});
addFormats(ajv);

// Load the OpenAPI spec
function loadOpenApiSpec() {
  const baseDir = path.resolve(__dirname, '../../../API Docs');
  const specPath = path.join(baseDir, 'openapi.yaml');
  
  try {
    const specContent = fs.readFileSync(specPath, 'utf8');
    return yaml.load(specContent);
  } catch (error) {
    console.error('Error loading OpenAPI spec:', error);
    throw error;
  }
}

// Get all parameters for an operation
function getOperationParameters(openApiSpec, path, method) {
  const pathItem = openApiSpec.paths[path];
  if (!pathItem) return [];
  
  const operation = pathItem[method.toLowerCase()];
  if (!operation) return [];
  
  // Combine path, operation, and global parameters
  const parameters = [
    ...(pathItem.parameters || []),
    ...(operation.parameters || [])
  ];
  
  return parameters.map(param => {
    // Resolve $ref parameters
    if (param.$ref) {
      const refPath = param.$ref.split('/').slice(1);
      return refPath.reduce((obj, key) => obj && obj[key], openApiSpec);
    }
    return param;
  });
}

// Validate a parameter value against its schema
function validateParameter(param, value) {
  if (!param.schema) return { valid: true };
  
  try {
    const validate = ajv.compile(param.schema);
    const valid = validate(value);
    
    return {
      valid,
      errors: validate.errors || []
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ message: `Validation error: ${error.message}` }]
    };
  }
}

describe('API Parameter Validation', function() {
  let openApiSpec;
  
  before(function() {
    openApiSpec = loadOpenApiSpec();
    
    // Add schemas to Ajv
    if (openApiSpec.components && openApiSpec.components.schemas) {
      ajv.addSchema(openApiSpec.components.schemas, 'components/schemas');
    }
  });
  
  it('should validate all parameter definitions', function() {
    const paths = openApiSpec.paths || {};
    const pathKeys = Object.keys(paths);
    
    if (pathKeys.length === 0) {
      throw new Error('No API paths found in the OpenAPI specification');
    }
    
    // For each path
    pathKeys.forEach(path => {
      const pathItem = paths[path];
      const methods = Object.keys(pathItem).filter(m => 
        ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(m.toLowerCase())
      );
      
      // For each HTTP method
      methods.forEach(method => {
        const operation = pathItem[method];
        
        // Skip if operation is a reference
        if (operation.$ref) {
          console.log(`Skipping ${method.toUpperCase()} ${path} as it's a reference to ${operation.$ref}`);
          return;
        }
        
        describe(`${method.toUpperCase()} ${path}`, function() {
          const parameters = getOperationParameters(openApiSpec, path, method);
          
          if (parameters.length === 0) {
            it('has no parameters to validate', function() {
              // No parameters to test for this operation
            });
            return;
          }
          
          parameters.forEach(param => {
            it(`should validate ${param.in} parameter '${param.name}'`, function() {
              // Check required fields
              expect(param).to.have.property('name');
              expect(param).to.have.property('in').oneOf(['query', 'header', 'path', 'cookie']);
              
              // Check schema or content is defined
              expect(param.schema || param.content, 'Parameter must have either schema or content').to.exist;
              
              if (param.schema) {
                // Test with a sample value based on the schema
                let testValue;
                
                // Generate a sample value based on the schema type
                if (param.schema.type) {
                  switch (param.schema.type) {
                    case 'string':
                      testValue = param.schema.example || 'test';
                      if (param.schema.enum) {
                        testValue = param.schema.enum[0];
                      }
                      break;
                    case 'number':
                    case 'integer':
                      testValue = param.schema.example || 0;
                      break;
                    case 'boolean':
                      testValue = true;
                      break;
                    case 'array':
                      testValue = [];
                      if (param.schema.items) {
                        if (param.schema.items.type === 'string') {
                          testValue = ['item1', 'item2'];
                        } else if (param.schema.items.type === 'number') {
                          testValue = [1, 2, 3];
                        }
                      }
                      break;
                    case 'object':
                      testValue = {};
                      break;
                    default:
                      testValue = null;
                  }
                }
                
                // Validate the test value
                const validation = validateParameter(param, testValue);
                
                // Log validation result
                console.log(`Validated ${param.in} parameter '${param.name}':`, {
                  type: param.schema.type,
                  required: param.required || false,
                  testValue,
                  valid: validation.valid,
                  errors: validation.errors ? validation.errors.map(e => e.message) : []
                });
                
                // If the parameter is required, the test value should be valid
                if (param.required) {
                  expect(validation.valid, `Required parameter '${param.name}' validation failed`).to.be.true;
                }
              }
            });
          });
        });
      });
    });
  });
});
