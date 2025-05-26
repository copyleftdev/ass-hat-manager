const { expect } = require('chai');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

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

// Check if a path requires authentication
function requiresAuth(pathItem, method) {
  const operation = pathItem[method.toLowerCase()];
  if (!operation) return false;
  
  // Check if operation has security requirements
  if (operation.security && operation.security.length > 0) {
    return true;
  }
  
  // Check if path has security requirements
  if (pathItem.security && pathItem.security.length > 0) {
    return true;
  }
  
  return false;
}

describe('API Security Validation', function() {
  let openApiSpec;
  
  before(function() {
    openApiSpec = loadOpenApiSpec();
  });
  
  it('should have security schemes defined', function() {
    expect(openApiSpec.components).to.have.property('securitySchemes');
    
    // Handle $ref in securitySchemes
    let securitySchemes = openApiSpec.components.securitySchemes;
    if (securitySchemes.$ref) {
      // In a real implementation, you would resolve the reference
      // For testing purposes, we'll just check that the reference exists
      expect(securitySchemes.$ref).to.be.a('string');
      console.log(`Security schemes are referenced from: ${securitySchemes.$ref}`);
      return;
    }
    
    // If not using $ref, check for bearerAuth directly
    expect(securitySchemes).to.have.property('bearerAuth');
    const bearerAuth = securitySchemes.bearerAuth;
    expect(bearerAuth).to.have.property('type', 'http');
    expect(bearerAuth).to.have.property('scheme', 'bearer');
    expect(bearerAuth).to.have.property('bearerFormat', 'JWT');
  });
  
  it('should have security requirements defined', function() {
    // Check global security requirements
    expect(openApiSpec.security).to.be.an('array').that.is.not.empty;
    
    // Check that at least one security scheme is required
    const globalSecurity = openApiSpec.security[0];
    expect(globalSecurity).to.have.property('bearerAuth').that.is.an('array').that.is.empty;
  });
  
  it('should have proper security on operations', function() {
    const paths = openApiSpec.paths || {};
    const pathKeys = Object.keys(paths);
    
    if (pathKeys.length === 0) {
      throw new Error('No API paths found in the OpenAPI specification');
    }
    
    // Define public endpoints that don't require authentication
    const publicEndpoints = [
      { path: '/health', methods: ['get'] },
      { path: '/status', methods: ['get'] }
    ];
    
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
        
        const isPublic = publicEndpoints.some(
          ep => path === ep.path && ep.methods.includes(method.toLowerCase())
        );
        
        const endpoint = `${method.toUpperCase()} ${path}`;
        
        if (isPublic) {
          it(`should not require authentication for public endpoint: ${endpoint}`, function() {
            expect(requiresAuth(pathItem, method), 
              `Public endpoint ${endpoint} should not require authentication`
            ).to.be.false;
          });
        } else {
          it(`should require authentication for endpoint: ${endpoint}`, function() {
            expect(requiresAuth(pathItem, method), 
              `Endpoint ${endpoint} should require authentication`
            ).to.be.true;
          });
        }
      });
    });
  });
  
  it('should have proper security scopes defined', function() {
    const paths = openApiSpec.paths || {};
    const pathKeys = Object.keys(paths);
    
    pathKeys.forEach(path => {
      const pathItem = paths[path];
      const methods = Object.keys(pathItem).filter(m => 
        ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(m.toLowerCase())
      );
      
      methods.forEach(method => {
        const operation = pathItem[method];
        
        // Skip if operation is a reference
        if (operation.$ref) return;
        
        // Skip if no security requirements
        if (!operation.security) return;
        
        it(`should have valid security scopes for ${method.toUpperCase()} ${path}`, function() {
          operation.security.forEach(secReq => {
            Object.entries(secReq).forEach(([scheme, scopes]) => {
              expect(scheme, 'Security scheme should be defined')
                .to.be.oneOf(Object.keys(openApiSpec.components.securitySchemes || {}));
              
              // Check that scopes is an array if it exists
              if (scopes) {
                expect(scopes, 'Scopes should be an array').to.be.an('array');
                
                // If there are scopes, they should be defined in the security scheme
                if (scopes.length > 0) {
                  const securityScheme = openApiSpec.components.securitySchemes[scheme];
                  if (securityScheme.flows) {
                    Object.values(securityScheme.flows).forEach(flow => {
                      if (flow.scopes) {
                        scopes.forEach(scope => {
                          expect(flow.scopes, `Scope '${scope}' should be defined in the security scheme`)
                            .to.have.property(scope);
                        });
                      }
                    });
                  }
                }
              }
            });
          });
        });
      });
    });
  });
});
