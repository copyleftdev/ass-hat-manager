const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Initialize AJV with OpenAPI support
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  validateFormats: true,
  strictSchema: false
});
addFormats(ajv);

// Helper to load and parse YAML files
function loadYamlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.parse(content);
  } catch (error) {
    console.error(`Error loading YAML file ${filePath}:`, error);
    throw error;
  }
}

// Load the OpenAPI spec
function loadOpenApiSpec() {
  const baseDir = path.resolve(__dirname, '../../../API Docs');
  const specPath = path.join(baseDir, 'openapi.yaml');
  
  // Load main spec
  const openApiSpec = loadYamlFile(specPath);
  if (!openApiSpec) {
    throw new Error('Failed to load main OpenAPI spec');
  }
  
  // Initialize paths if not exists
  if (!openApiSpec.paths) {
    openApiSpec.paths = {};
  }
  
  // Load paths from paths directory
  const pathsDir = path.join(baseDir, 'paths');
  if (fs.existsSync(pathsDir)) {
    const pathFiles = fs.readdirSync(pathsDir);
    
    pathFiles.forEach(file => {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const filePath = path.join(pathsDir, file);
        const pathSpec = loadYamlFile(filePath);
        
        if (pathSpec) {
          const pathName = '/' + path.basename(file, path.extname(file));
          openApiSpec.paths[pathName] = pathSpec;
          
          // Add path with {id} for resource endpoints
          if (pathName.endsWith('s') && !pathName.endsWith('ss')) {
            const singlePath = `${pathName}/{id}`;
            openApiSpec.paths[singlePath] = {
              get: { $ref: `${pathName}#/get` },
              put: { $ref: `${pathName}#/put` },
              delete: { $ref: `${pathName}#/delete` },
              patch: { $ref: `${pathName}#/patch` }
            };
          }
        }
      }
    });
  }
  
  return openApiSpec;
}

// Test suite
describe('OpenAPI Endpoint Validation', function() {
  let openApiSpec;
  
  before(function() {
    try {
      console.log('Loading OpenAPI spec...');
      openApiSpec = loadOpenApiSpec();
      console.log('OpenAPI spec loaded successfully');
      
      if (!openApiSpec) {
        throw new Error('Failed to load OpenAPI spec: openApiSpec is undefined');
      }
      
      if (!openApiSpec.paths) {
        console.warn('No paths found in OpenAPI spec, initializing empty paths object');
        openApiSpec.paths = {};
      }
      
      console.log('OpenAPI spec structure:', {
        openapi: openApiSpec.openapi,
        info: openApiSpec.info ? openApiSpec.info.title : 'No info',
        pathCount: Object.keys(openApiSpec.paths || {}).length
      });
    } catch (error) {
      console.error('Error in before hook:', error);
      throw error;
    }
  });

  // Test each endpoint
  describe('Endpoint Validation', function() {
    // Test that the spec was loaded
    it('should load the OpenAPI spec with paths', function() {
      if (!openApiSpec) {
        throw new Error('OpenAPI spec is not loaded');
      }
      if (!openApiSpec.paths) {
        throw new Error('OpenAPI spec does not contain any paths');
      }
      
      const paths = openApiSpec.paths;
      const pathKeys = Object.keys(paths);
      
      console.log(`Found ${pathKeys.length} paths in the OpenAPI spec`);
      console.log('Available paths:', pathKeys);
      
      if (pathKeys.length === 0) {
        throw new Error('No API paths found in the OpenAPI specification');
      }
    });
    
    // Test paths if they exist
    describe('Path Validation', function() {
      before(function() {
        if (!openApiSpec?.paths) {
          this.skip();
        }
      });
      
      it('should have valid path definitions', function() {
        const paths = openApiSpec.paths || {};
        const pathKeys = Object.keys(paths);
        
        if (pathKeys.length === 0) {
          throw new Error('No API paths found in the OpenAPI specification');
        }
        
        // Test each path
        pathKeys.forEach(path => {
          const methods = Object.keys(paths[path] || {});
          
          if (methods.length === 0) {
            throw new Error(`No HTTP methods defined for path: ${path}`);
          }
          
          // Test each HTTP method for this path
          methods.forEach(method => {
            // Skip non-HTTP methods (like parameters)
            if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
              const operation = paths[path][method];
              
              if (!operation) {
                throw new Error(`No operation defined for ${method.toUpperCase()} ${path}`);
              }
              
              // Test for required operation fields
              if (!operation.responses) {
                // Check if this is a reference to another path
                if (operation.$ref) {
                  console.log(`Skipping ${method.toUpperCase()} ${path} as it's a reference to ${operation.$ref}`);
                  return;
                }
                throw new Error(`No responses defined for ${method.toUpperCase()} ${path}`);
              }
              
              // Test for at least one response
              const responseCodes = Object.keys(operation.responses || {});
              if (responseCodes.length === 0) {
                throw new Error(`No response codes defined for ${method.toUpperCase()} ${path}`);
              }
            }
          });
        });
      });
    }); // End of Path Validation describe
  }); // End of Endpoint Validation describe
}); // End of OpenAPI Endpoint Validation describe
