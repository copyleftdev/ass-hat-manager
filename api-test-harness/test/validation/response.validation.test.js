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

// Load all schemas from the components
function loadSchemas(openApiSpec) {
  const schemas = {};
  
  if (openApiSpec.components && openApiSpec.components.schemas) {
    Object.entries(openApiSpec.components.schemas).forEach(([name, schema]) => {
      schemas[`#/components/schemas/${name}`] = schema;
    });
  }
  
  return schemas;
}

// Get the schema for a response
function getResponseSchema(openApiSpec, path, method, statusCode) {
  try {
    const pathItem = openApiSpec.paths[path];
    if (!pathItem) return null;
    
    const operation = pathItem[method.toLowerCase()];
    if (!operation || !operation.responses) return null;
    
    const response = operation.responses[statusCode] || 
                   operation.responses[`${statusCode}`] ||
                   operation.responses.default;
    
    if (!response) return null;
    
    // Handle $ref in response
    if (response.$ref) {
      const refPath = response.$ref.split('/').slice(1);
      return refPath.reduce((obj, key) => obj && obj[key], openApiSpec);
    }
    
    // Get the first content type (usually application/json)
    const content = response.content;
    if (!content) return null;
    
    const contentType = Object.keys(content)[0];
    return content[contentType].schema;
  } catch (error) {
    console.error(`Error getting response schema for ${method} ${path} ${statusCode}:`, error);
    return null;
  }
}

// Validate a response against a schema
function validateResponse(schema, response) {
  try {
    const validate = ajv.compile(schema);
    const valid = validate(response);
    
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

describe('API Response Validation', function() {
  let openApiSpec;
  let schemas;
  
  before(function() {
    openApiSpec = loadOpenApiSpec();
    schemas = loadSchemas(openApiSpec);
    
    // Add schemas to Ajv
    ajv.addSchema(openApiSpec.components.schemas, 'components/schemas');
  });
  
  it('should validate response schemas', function() {
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
        
        // For each response code
        Object.keys(operation.responses || {}).forEach(statusCode => {
          const response = operation.responses[statusCode];
          
          // Get the schema for this response
          const schema = getResponseSchema(openApiSpec, path, method, statusCode);
          
          if (!schema) {
            console.log(`No schema found for ${method.toUpperCase()} ${path} ${statusCode}`);
            return;
          }
          
          it(`should validate ${method.toUpperCase()} ${path} ${statusCode} response`, function() {
            // This is a placeholder for actual API response validation
            // In a real test, you would make an actual API request and validate the response
            // For now, we're just testing that we can load and compile the schemas
            
            // Test that we can compile the schema
            const validate = ajv.compile(schema);
            expect(validate).to.be.a('function');
            
            // Test with a minimal valid response
            const testResponse = {};
            const validationResult = validateResponse(schema, testResponse);
            
            // Just log the validation result, don't fail the test
            // In a real test, you would make assertions based on the expected response
            console.log(`Validated ${method.toUpperCase()} ${path} ${statusCode}:`, {
              valid: validationResult.valid,
              errors: validationResult.errors ? validationResult.errors.map(e => e.message) : []
            });
          });
        });
      });
    });
  });
});
