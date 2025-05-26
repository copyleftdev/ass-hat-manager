// Global test setup
const chai = require('chai');
const chaiHttp = require('chai-http');

// Add chai plugins
chai.use(chaiHttp);

// Global test timeout (10 seconds)
chai.config.timeout = 10000;

// Make expect available globally
const { expect } = chai;
global.expect = expect;

// Export chai with plugins for use in tests
global.chai = chai;
