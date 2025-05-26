const { expect } = require('chai');
const chai = require('chai');
const chaiHttp = require('chai-http');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');
const Ajv = require('ajv').default;
const addFormats = require('ajv-formats');
const betterAjvErrors = require('@apideck/better-ajv-errors');
const config = require('../config');

// Configure chai
chai.use(chaiHttp);
const { request } = chai;

describe('API Integration Tests', function() {
  this.timeout(config.test.timeout);
  
  let openApiSpec;
  let ajv;
  
  before(async function() {
    if (!config.test.groups.integration) {
      return this.skip();
    }
    
    // Load the OpenAPI specification
    const specPath = path.resolve(__dirname, '../..', config.paths.spec);
    const specContent = fs.readFileSync(specPath, 'utf8');
    openApiSpec = yaml.parse(specContent);
    
    // Initialize AJV with OpenAPI support
    ajv = new Ajv({
      strict: false,
      allErrors: true,
      validateFormats: true,
      strictSchema: false,
      strictTypes: false,
      strictRequired: false,
    });
    
    // Add OpenAPI formats
    addFormats(ajv);
    ajv.addFormat('int32', /^-?\d{1,10}$/);
    ajv.addFormat('int64', /^-?\d{1,19}$/);
    ajv.addFormat('float', /^-?\d+\.?\d*$/);
    ajv.addFormat('double', /^-?\d+\.?\d*$/);
    ajv.addFormat('byte', /^[\w+\/]*=*$/);
    ajv.addFormat('binary', /^[\u0000-\u00FF]*$/);
    ajv.addFormat('password', /^.*$/);
  });
  
  // Helper function to resolve JSON references
  function resolveRefs(obj, root = null) {
    if (root === null) root = openApiSpec;
    
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        return obj.map(item => resolveRefs(item, root));
      }
      
      if (obj.$ref) {
        // Resolve the reference
        const parts = obj.$ref.split('/').filter(Boolean);
        let ref = root;
        
        for (const part of parts) {
          ref = ref[part];
          if (ref === undefined) {
            throw new Error(`Invalid reference: ${obj.$ref}`);
          }
        }
        
        // Return a deep copy to avoid modifying the original
        return JSON.parse(JSON.stringify(ref));
      }
      
      // Process all properties
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = resolveRefs(value, root);
      }
      return result;
    }
    
    return obj;
  }
  
  // Helper function to validate response against schema
  function validateResponse(response, schema) {
    const validate = ajv.compile(schema);
    const valid = validate(response.body);
    
    if (!valid) {
      const errors = betterAjvErrors(schema, response.body, validate.errors, { format: 'js' });
      const errorMessages = errors.map(err => 
        `${err.error} at ${err.path || 'root'}`
      ).join('\n');
      throw new Error(`Response validation failed:\n${errorMessages}`);
    }
  }
  
  // Helper function to get auth headers
  function getAuthHeaders() {
    return {
      'Authorization': `Bearer ${config.auth.token}`,
      'Content-Type': 'application/json'
    };
  }
  
  // Test each endpoint in the OpenAPI spec
  describe('Endpoints', function() {
    Object.entries(openApiSpec.paths || {}).forEach(([path, pathItem]) => {
      describe(`${path}`, function() {
        Object.entries(pathItem).forEach(([method, operation]) => {
          if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return;
          
          const operationId = operation.operationId || `${method.toUpperCase()}_${path.replace(/[\{\}/-]/g, '_')}`;
          
          describe(`${method.toUpperCase()} ${path}`, function() {
            // Skip if the operation is marked as deprecated
            if (operation.deprecated) {
              it('should be marked as deprecated', function() {
                // This is just a placeholder to indicate the endpoint is deprecated
                this.skip();
              });
              return;
            }
            
            // Test each response defined for this operation
            Object.entries(operation.responses || {}).forEach(([statusCode, response]) => {
              // Skip 204 No Content responses as they don't have a schema
              if (statusCode === '204') return;
              
              // Get the schema for the response
              const contentType = response.content ? Object.keys(response.content)[0] : null;
              const responseSchema = contentType ? response.content[contentType].schema : null;
              
              if (!responseSchema) {
                // Skip if no schema is defined for this response
                return;
              }
              
              it(`should return ${statusCode} with valid response schema`, async function() {
                // Build the request URL with path parameters
                let requestUrl = path;
                const pathParams = [];
                
                // Extract path parameters
                const pathParamMatches = path.match(/\{([^}]+)\}/g) || [];
                pathParamMatches.forEach(param => {
                  const paramName = param.slice(1, -1);
                  const paramSchema = operation.parameters?.find(p => 
                    p.in === 'path' && p.name === paramName
                  )?.schema;
                  
                  // Generate a test value for the path parameter
                  const testValue = paramSchema?.type === 'integer' 
                    ? '123' 
                    : 'test';
                  
                  requestUrl = requestUrl.replace(param, testValue);
                  pathParams.push({ name: paramName, value: testValue });
                });
                
                // Build the request query parameters
                const queryParams = {};
                const queryParamsList = operation.parameters?.filter(p => p.in === 'query') || [];
                queryParamsList.forEach(param => {
                  if (param.schema?.type === 'integer') {
                    queryParams[param.name] = '123';
                  } else if (param.schema?.type === 'boolean') {
                    queryParams[param.name] = 'true';
                  } else {
                    queryParams[param.name] = 'test';
                  }
                });
                
                // Build the request body if needed
                let requestBody = null;
                if (operation.requestBody?.content) {
                  const requestContentType = Object.keys(operation.requestBody.content)[0];
                  const requestSchema = operation.requestBody.content[requestContentType].schema;
                  
                  if (requestSchema) {
                    // Generate a simple test request body based on the schema
                    requestBody = {};
                    const resolvedSchema = resolveRefs(requestSchema);
                    
                    if (resolvedSchema.properties) {
                      Object.entries(resolvedSchema.properties).forEach(([propName, propSchema]) => {
                        const resolvedPropSchema = resolveRefs(propSchema);
                        
                        if (resolvedPropSchema.type === 'string') {
                          requestBody[propName] = 'test';
                        } else if (resolvedPropSchema.type === 'integer') {
                          requestBody[propName] = 123;
                        } else if (resolvedPropSchema.type === 'boolean') {
                          requestBody[propName] = true;
                        } else if (resolvedPropSchema.type === 'array') {
                          requestBody[propName] = [];
                        } else if (resolvedPropSchema.type === 'object') {
                          requestBody[propName] = {};
                        }
                      });
                    }
                  }
                }
                
                // Make the request
                const req = request(config.baseUrl)
                  [method.toLowerCase()](requestUrl)
                  .set(getAuthHeaders());
                
                // Add query parameters
                if (Object.keys(queryParams).length > 0) {
                  req.query(queryParams);
                }
                
                // Add request body if present
                if (requestBody) {
                  req.send(requestBody);
                }
                
                // Execute the request
                const res = await req;
                
                // Check the response status code
                expect(res).to.have.status(parseInt(statusCode));
                
                // Validate the response against the schema
                if (contentType && res.headers['content-type']?.includes(contentType)) {
                  const resolvedSchema = resolveRefs(responseSchema);
                  validateResponse(res, resolvedSchema);
                }
              });
            });
          });
        });
      });
    });
  });
});
