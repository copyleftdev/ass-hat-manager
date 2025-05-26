const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');
const Ajv = require('ajv').default;
const addFormats = require('ajv-formats');
const betterAjvErrors = require('@apideck/better-ajv-errors');
const config = require('../config');

// Load the OpenAPI specification
function loadOpenApiSpec() {
  try {
    // The OpenAPI spec is in the parent directory
    const baseDir = path.resolve(__dirname, '../../../API Docs');
    const specPath = path.join(baseDir, 'openapi.yaml');
    console.log('Loading OpenAPI spec from:', specPath);
    
    if (!fs.existsSync(specPath)) {
      throw new Error(`OpenAPI specification file not found at: ${specPath}`);
    }
    
    // Read the main spec file
    const specContent = fs.readFileSync(specPath, 'utf8');
    const openApiSpec = yaml.parse(specContent);
    
    if (!openApiSpec) {
      throw new Error('Failed to parse OpenAPI specification');
    }
    
    // Ensure paths is an object
    if (!openApiSpec.paths) {
      console.warn('No paths found in OpenAPI spec, initializing empty paths object');
      openApiSpec.paths = {};
    }
    
    // Load paths from the paths directory
    const pathsDir = path.join(baseDir, 'paths');
    if (fs.existsSync(pathsDir) && fs.statSync(pathsDir).isDirectory()) {
      const pathFiles = fs.readdirSync(pathsDir);
      console.log(`Found ${pathFiles.length} path files in ${pathsDir}`);
      
      pathFiles.forEach(file => {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          try {
            const filePath = path.join(pathsDir, file);
            const pathContent = fs.readFileSync(filePath, 'utf8');
            const pathSpec = yaml.parse(pathContent);
            
            if (pathSpec) {
              // The path is the filename without extension (e.g., 'assets' becomes '/assets')
              const pathName = '/' + path.basename(file, path.extname(file));
              console.log(`Adding path: ${pathName}`);
              openApiSpec.paths[pathName] = pathSpec;
              
              // Also add the path with {id} if it's a resource that might have individual items
              if (pathName.endsWith('s') && !pathName.endsWith('ss')) {
                const singlePath = `${pathName}/{id}`;
                console.log(`Adding single item path: ${singlePath}`);
                openApiSpec.paths[singlePath] = {
                  get: { $ref: `${pathName}#/get` },
                  put: { $ref: `${pathName}#/put` },
                  delete: { $ref: `${pathName}#/delete` },
                  patch: { $ref: `${pathName}#/patch` }
                };
              }
            }
          } catch (error) {
            console.error(`Error loading path file ${file}:`, error);
          }
        }
      });
    }
    
    // Ensure components is an object
    if (!openApiSpec.components) {
      console.warn('No components found in OpenAPI spec, initializing empty components object');
      openApiSpec.components = {};
    }
    
    // Load schemas from the components/schemas directory
    const schemasDir = path.join(baseDir, 'components', 'schemas');
    if (fs.existsSync(schemasDir) && fs.statSync(schemasDir).isDirectory()) {
      openApiSpec.components.schemas = openApiSpec.components.schemas || {};
      
      const schemaFiles = fs.readdirSync(schemasDir);
      console.log(`Found ${schemaFiles.length} schema files in ${schemasDir}`);
      
      schemaFiles.forEach(file => {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          try {
            const schemaPath = path.join(schemasDir, file);
            const schemaContent = fs.readFileSync(schemaPath, 'utf8');
            const schema = yaml.parse(schemaContent);
            
            if (schema) {
              const schemaName = path.basename(file, path.extname(file));
              console.log(`Adding schema: ${schemaName}`);
              openApiSpec.components.schemas[schemaName] = schema;
            }
          } catch (error) {
            console.error(`Error loading schema file ${file}:`, error);
          }
        }
      });
    }
  }
  
  return openApiSpec;
}

// Main test suite
describe('OpenAPI Schema Validation', function() {
  let openApiSpec;
  
  before(function() {
    console.log('Loading OpenAPI specification...');
    openApiSpec = loadOpenApiSpec();
    console.log('OpenAPI spec loaded successfully');
  });

  // Log basic info about the loaded spec
  before(function() {
    console.log('OpenAPI spec loaded with:', {
      openapi: openApiSpec.openapi,
      info: openApiSpec.info,
      servers: openApiSpec.servers,
      pathsCount: Object.keys(openApiSpec.paths || {}).length,
      components: Object.keys(openApiSpec.components || {})
    });
    
    // Log available paths
    console.log('Available paths:', Object.keys(openApiSpec.paths || {}));
  });
  
  // Test setup
  describe('Specification Loading', function() {
    it('should load the OpenAPI specification', function() {
      expect(openApiSpec).to.be.an('object');
      expect(openApiSpec.openapi).to.be.a('string');
      expect(openApiSpec.info).to.be.an('object');
      expect(openApiSpec.paths).to.be.an('object');
    });
  });
  
  // Test each path and method
  describe('Endpoints', function() {
    it('should have valid endpoints', function() {
      const paths = openApiSpec.paths || {};
      
      // Check that we have at least one path
      expect(Object.keys(paths).length).to.be.greaterThan(0);
      
      // Check each path
      Object.entries(paths).forEach(([path, pathItem]) => {
        expect(path).to.be.a('string');
        expect(pathItem).to.be.an('object');
        
        // Check each method in the path
        Object.entries(pathItem).forEach(([method, operation]) => {
          if (['get', 'put', 'post', 'delete', 'patch'].includes(method)) {
            expect(operation).to.be.an('object');
            expect(operation.responses).to.be.an('object');
            
            // Check for required fields
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
  
  // Test schema validation
  describe('Schema Validation', function() {
    it('should have valid schemas', function() {
      const schemas = openApiSpec.components?.schemas || {};
      
      // Check that we have at least one schema
      expect(Object.keys(schemas).length).to.be.greaterThan(0);
      
      // Log basic info about the loaded spec
      console.log('OpenAPI spec info:', {
        openapi: openApiSpec.openapi,
        info: openApiSpec.info,
        servers: openApiSpec.servers,
        pathsCount: Object.keys(openApiSpec.paths || {}).length,
        components: Object.keys(openApiSpec.components || {})
      });
      
      // Log available paths
      console.log('Available paths:', Object.keys(openApiSpec.paths || {}));
    });
    
    // Test that the spec is loaded correctly
    describe('Specification Loading', function() {
      it('should load the OpenAPI specification', function() {
        expect(openApiSpec).to.be.an('object');
        expect(openApiSpec.openapi).to.be.a('string');
        expect(openApiSpec.info).to.be.an('object');
        expect(openApiSpec.paths).to.be.an('object');
      });
    });
    
    // Test each path and method
    describe('Endpoints', function() {
      Object.entries(openApiSpec.paths || {}).forEach(([path, pathItem]) => {
        describe(`Path: ${path}`, function() {
          Object.entries(pathItem).forEach(([method, operation]) => {
            if (['get', 'put', 'post', 'delete', 'patch'].includes(method)) {
              it(`should have a valid ${method.toUpperCase()} operation`, function() {
                expect(operation).to.be.an('object');
                expect(operation.responses).to.be.an('object');
                
                // Check for required fields
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
              });
            }
          });
        });
      });
    });
  });
  
  describe('Request/Response Schema Validation', function() {
    console.log('Starting Request/Response Schema Validation tests');
    let resolveRefs;
    let paths;
    
    before(function() {
      console.log('Running before hook');
      // Log basic info about the loaded spec
      console.log('OpenAPI spec loaded with:', {
        openapi: openApiSpec?.openapi,
        info: openApiSpec?.info,
        pathsCount: openApiSpec?.paths ? Object.keys(openApiSpec.paths).length : 0,
        components: openApiSpec?.components ? Object.keys(openApiSpec.components) : []
      });
      
      if (!openApiSpec) {
        console.error('openApiSpec is undefined');
        throw new Error('OpenAPI specification is missing');
      }
      
      // Log detailed paths information
      if (openApiSpec.paths) {
        console.log('Available paths:', Object.keys(openApiSpec.paths));
      } else {
        console.error('No paths found in OpenAPI spec');
        console.log('OpenAPI spec keys:', Object.keys(openApiSpec));
        throw new Error('OpenAPI specification is missing paths');
      }
      
      // Log the first path as an example
      const firstPath = Object.keys(openApiSpec.paths || {})[0];
      if (firstPath) {
        console.log(`First path (${firstPath}):`, Object.keys(openApiSpec.paths[firstPath]));
      }
      
      // Define resolveRefs function with access to openApiSpec
      resolveRefs = function(obj, root = null) {
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
                console.warn(`Warning: Could not resolve reference: ${obj.$ref}`);
                return obj; // Return the original object with $ref if reference can't be resolved
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
      };
      
      // Ensure paths is defined and is an object
      if (!openApiSpec.paths || typeof openApiSpec.paths !== 'object') {
        console.error('Error: openApiSpec.paths is not an object:', openApiSpec.paths);
        throw new Error('OpenAPI specification is missing valid paths');
      }
      
      paths = openApiSpec.paths;
    });
    
    Object.entries(paths).forEach(([path, pathItem]) => {
      describe(`Path: ${path}`, function() {
        Object.entries(pathItem).forEach(([method, operation]) => {
          if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return;
          
          describe(`${method.toUpperCase()} ${path}`, function() {
            // Test request body schemas
            if (operation.requestBody && operation.requestBody.content) {
              Object.entries(operation.requestBody.content).forEach(([contentType, content]) => {
                if (content.schema) {
                  it(`should validate ${contentType} request body schema`, function() {
                    const schema = resolveRefs(content.schema, openApiSpec);
                    const validate = ajv.compile(schema);
                    
                    // If there are examples, validate them
                    if (content.example) {
                      const valid = validate(content.example);
                      const errors = betterAjvErrors(schema, content.example, validate.errors, { format: 'js' });
                      
                      if (!valid) {
                        const errorMessages = errors.map(err => 
                          `${err.error} at ${err.path || 'root'}`
                        ).join('\n');
                        throw new Error(`Example request body is invalid:\n${errorMessages}`);
                      }
                    }
                    
                    // If there are examples in the schema, validate them
                    if (schema.examples && Array.isArray(schema.examples)) {
                      schema.examples.forEach((example, index) => {
                        const valid = validate(example);
                        if (!valid) {
                          const errors = betterAjvErrors(schema, example, validate.errors, { format: 'js' });
                          const errorMessages = errors.map(err => 
                            `${err.error} at ${err.path || 'root'}`
                          ).join('\n');
                          throw new Error(`Example ${index + 1} in schema is invalid:\n${errorMessages}`);
                        }
                      });
                    }
                  });
                }
              });
            }
            
            // Test response schemas
            if (operation.responses) {
              Object.entries(operation.responses).forEach(([statusCode, response]) => {
                // Skip 204 No Content responses
                if (statusCode === '204') return;
                
                if (response.content) {
                  Object.entries(response.content).forEach(([contentType, content]) => {
                    if (content.schema) {
                      it(`should validate ${statusCode} ${contentType} response schema`, function() {
                        const schema = resolveRefs(content.schema, openApiSpec);
                        const validate = ajv.compile(schema);
                        
                        // If there are examples, validate them
                        if (content.example) {
                          const valid = validate(content.example);
                          const errors = betterAjvErrors(schema, content.example, validate.errors, { format: 'js' });
                          
                          if (!valid) {
                            const errorMessages = errors.map(err => 
                              `${err.error} at ${err.path || 'root'}`
                            ).join('\n');
                            throw new Error(`Example response body is invalid for status ${statusCode}:\n${errorMessages}`);
                          }
                        }
                        
                        // If there are examples in the schema, validate them
                        if (schema.examples && Array.isArray(schema.examples)) {
                          schema.examples.forEach((example, index) => {
                            const valid = validate(example);
                            if (!valid) {
                              const errors = betterAjvErrors(schema, example, validate.errors, { format: 'js' });
                              const errorMessages = errors.map(err => 
                                `${err.error} at ${err.path || 'root'}`
                              ).join('\n');
                              throw new Error(`Example ${index + 1} in schema is invalid for status ${statusCode}:\n${errorMessages}`);
                            }
                          });
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        });
      });
    });
  });
  
  describe('Component Schemas', function() {
    if (!openApiSpec.components || !openApiSpec.components.schemas) {
      return this.skip('No component schemas defined');
    }
    
    Object.entries(openApiSpec.components.schemas).forEach(([schemaName, schema]) => {
      describe(`Schema: ${schemaName}`, function() {
        it('should be a valid schema', function() {
          const resolvedSchema = resolveRefs(schema, openApiSpec);
          
          // Compile the schema to validate it
          const validate = ajv.compile(resolvedSchema);
          
          // If the schema has examples, validate them
          if (resolvedSchema.examples && Array.isArray(resolvedSchema.examples)) {
            resolvedSchema.examples.forEach((example, index) => {
              const valid = validate(example);
              if (!valid) {
                const errors = betterAjvErrors(resolvedSchema, example, validate.errors, { format: 'js' });
                const errorMessages = errors.map(err => 
                  `${err.error} at ${err.path || 'root'}`
                ).join('\n');
                throw new Error(`Example ${index + 1} is invalid:\n${errorMessages}`);
              }
            });
          }
          
          // If the schema has a default value, validate it
          if ('default' in resolvedSchema) {
            const valid = validate(resolvedSchema.default);
            if (!valid) {
              const errors = betterAjvErrors(resolvedSchema, resolvedSchema.default, validate.errors, { format: 'js' });
              const errorMessages = errors.map(err => 
                `${err.error} at ${err.path || 'root'}`
              ).join('\n');
              throw new Error(`Default value is invalid:\n${errorMessages}`);
            }
          }
        });
      });
    });
  });
});
