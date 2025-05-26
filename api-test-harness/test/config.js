module.exports = {
  // Base URL for the API (can be overridden with environment variables)
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  
  // Authentication
  auth: {
    // For testing, you can use a test token or basic auth
    token: process.env.API_TOKEN || 'test-token',
    username: process.env.API_USERNAME || 'testuser',
    password: process.env.API_PASSWORD || 'testpass'
  },
  
  // Test configuration
  test: {
    // Timeout for test cases (in milliseconds)
    timeout: 10000,
    // Enable/disable test groups
    groups: {
      validation: true,    // API spec validation
      schema: true,        // Request/response schema validation
      contract: true,      // Contract testing
      integration: false   // Integration tests (requires running server)
    }
  },
  
  // Paths
  paths: {
    // Path to the OpenAPI specification (relative to project root)
    spec: '../API Docs/openapi.yaml',
    // Test data directory (relative to project root)
    testData: 'test/data',
    // Test reports directory
    reports: './test/reports'
  },
  
  // Test data generation
  testData: {
    // Number of test cases to generate for fuzz testing
    fuzzTestCases: 5,
    // Default values for path/query parameters
    defaults: {
      limit: 10,
      page: 1
    }
  },
  
  // Validation options
  validation: {
    // Strict mode (fail on warnings)
    strict: true,
    // Additional validation rules
    rules: {
      no_empty_descriptions: 'error',
      no_undefined_security_schemes: 'error',
      path_parameters_required: 'error',
      no_undefined_server_variable: 'error'
    },
    // Ignore specific validation rules
    ignore: {
      // Example: 'operation_operation_id'
    }
  },
  
  // Mock server configuration (for contract testing)
  mockServer: {
    port: 3001,
    host: 'localhost',
    // Enable/disable mock server features
    features: {
      cors: true,
      logging: true,
      strictMode: true
    }
  }
};

// Environment-specific overrides
const env = process.env.NODE_ENV || 'development';
if (env === 'ci') {
  module.exports.test.timeout = 30000;
  module.exports.test.groups.integration = true;
  module.exports.validation.strict = true;
}

if (env === 'production') {
  module.exports.baseUrl = 'https://api.assetmanagement.com/v1';
  module.exports.test.groups.integration = false; // Disable integration tests in production
}
