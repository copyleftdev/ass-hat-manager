# Asset Management API Test Harness

A comprehensive test harness for validating the Asset Management API against its OpenAPI 3.1.0 specification. This test suite ensures that the API implementation adheres to the defined contract, including request/response schemas, status codes, and security requirements.

## Features

- **OpenAPI Specification Validation**: Validates the structure and content of the OpenAPI specification.
- **Schema Validation**: Validates request and response schemas against the OpenAPI specification.
- **Contract Testing**: Ensures the API implementation adheres to the defined contract.
- **Test Reports**: Generates detailed test reports in HTML and JSON formats.
- **Mock Server**: Includes a mock server for contract testing.

## Prerequisites

- Node.js 16.x or later
- npm 8.x or later

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd api-test-harness
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

Configuration is managed through the `test/config.js` file. You can override settings using environment variables:

```bash
# API base URL (default: http://localhost:3000)
export API_BASE_URL=http://localhost:3000

# Authentication
export API_TOKEN=your-token
export API_USERNAME=username
export API_PASSWORD=password
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test Groups

- **Validation Tests**: Validate the OpenAPI specification
  ```bash
  npm run test:validation
  ```

- **Schema Validation Tests**: Validate request/response schemas
  ```bash
  npm run test:schema
  ```

- **Contract Tests**: Run contract tests against the API
  ```bash
  npm run test:contract
  ```

- **Watch Mode**: Run tests in watch mode
  ```bash
  npm run test:watch
  ```

## Test Reports

Test reports are generated in the `test/reports` directory after each test run. The reports include:

- HTML report: `test/reports/test-report.html`
- JSON report: `test/reports/test-report.json`

## Writing Tests

### Validation Tests

Validation tests ensure the OpenAPI specification is valid and follows best practices. These tests are located in `test/validation/`.

### Schema Validation Tests

Schema validation tests validate request and response schemas against the OpenAPI specification. These tests are located in `test/validation/schema.validation.test.js`.

### Contract Tests

Contract tests ensure the API implementation adheres to the defined contract. These tests are located in `test/contract/`.

## Mock Server

The test harness includes a mock server for contract testing. The mock server is automatically started before contract tests and stopped after tests complete.

## Continuous Integration

To run tests in a CI environment, use the following command:

```bash
NODE_ENV=ci npm test
```

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.
