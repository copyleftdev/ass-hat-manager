#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const testDataGenerator = require('../test/utils/testDataGenerator');
const config = require('../test/config');

// Load the OpenAPI specification
const specPath = path.resolve(__dirname, '..', config.paths.spec);
const specContent = fs.readFileSync(specPath, 'utf8');
const openApiSpec = yaml.parse(specContent);

// Generate test data for each endpoint
function generateAllTestData() {
  const testData = {};
  
  // Process each path in the OpenAPI spec
  Object.entries(openApiSpec.paths || {}).forEach(([path, pathItem]) => {
    // Process each HTTP method for the path
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return;
      
      const operationId = operation.operationId || `${method.toUpperCase()}_${path.replace(/[\{\}/-]/g, '_')}`;
      const responses = operation.responses || {};
      
      // Generate test data for each response code
      Object.keys(responses).forEach(responseCode => {
        try {
          // Skip 204 No Content responses
          if (responseCode === '204') return;
          
          // Generate test data for this endpoint and response
          const data = testDataGenerator.generateForEndpoint(path, method, responseCode);
          
          if (data) {
            // Store the test data with a descriptive key
            const testCaseKey = `${operationId}_${responseCode}`;
            testData[testCaseKey] = data;
            
            // Also save individual test data files
            testDataGenerator.saveTestData(
              `testdata_${operation.operationId || operationId}_${responseCode}`,
              data,
              'json'
            );
          }
        } catch (error) {
          console.error(`Error generating test data for ${method.toUpperCase()} ${path} (${responseCode}):`, error.message);
        }
      });
    });
  });
  
  // Save all test data to a single file
  if (Object.keys(testData).length > 0) {
    testDataGenerator.saveTestData('all_test_data', testData, 'json');
  }
  
  return testData;
}

// Run the test data generation
console.log('Generating test data...');
const allTestData = generateAllTestData();
console.log(`Generated test data for ${Object.keys(allTestData).length} test cases.`);

// Export for use in tests
module.exports = { generateAllTestData };
