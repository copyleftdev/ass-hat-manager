const faker = require('faker');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');
const config = require('../config');

class TestDataGenerator {
  constructor() {
    // Load the OpenAPI specification
    const specPath = path.resolve(__dirname, '../..', config.paths.spec);
    const specContent = fs.readFileSync(specPath, 'utf8');
    this.openApiSpec = yaml.parse(specContent);
    this.faker = faker;
    
    // Configure faker
    this.faker.seed(42); // For deterministic results
  }
  
  /**
   * Generate test data based on a schema
   */
  generateFromSchema(schema, options = {}) {
    const {
      arrayMin = 1,
      arrayMax = 3,
    } = options;
    
    // Resolve references
    const resolvedSchema = this.resolveRefs(schema);
    
    // Handle different schema types
    if (resolvedSchema.type === 'object') {
      return this.generateObject(resolvedSchema, options);
    } else if (resolvedSchema.type === 'array') {
      return this.generateArray(resolvedSchema, { arrayMin, arrayMax });
    } else if (resolvedSchema.enum) {
      return this.faker.random.arrayElement(resolvedSchema.enum);
    } else {
      return this.generatePrimitive(resolvedSchema);
    }
  }
  
  /**
   * Generate an object based on a schema
   */
  generateObject(schema, options) {
    if (!schema.properties) return {};
    
    const result = {};
    const required = new Set(schema.required || []);
    
    // Generate each property
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      // Skip if property is not required and not in required list
      if (!required.has(propName) && this.faker.datatype.boolean()) {
        continue;
      }
      
      // Generate value for the property
      result[propName] = this.generateFromSchema(propSchema, options);
    }
    
    return result;
  }
  
  /**
   * Generate an array based on a schema
   */
  generateArray(schema, options) {
    const { arrayMin, arrayMax } = options;
    const length = this.faker.datatype.number({ min: arrayMin, max: arrayMax });
    const result = [];
    
    for (let i = 0; i < length; i++) {
      result.push(this.generateFromSchema(schema.items, options));
    }
    
    return result;
  }
  
  /**
   * Generate a primitive value based on a schema
   */
  generatePrimitive(schema) {
    const type = schema.type || 'string';
    const format = schema.format;
    
    switch (type) {
      case 'string':
        return this.generateString(schema, format);
      case 'number':
      case 'integer':
        return this.generateNumber(schema, format);
      case 'boolean':
        return this.faker.datatype.boolean();
      case 'null':
        return null;
      default:
        return this.faker.lorem.word();
    }
  }
  
  /**
   * Generate a string value based on format
   */
  generateString(schema, format) {
    const minLength = schema.minLength || 1;
    const maxLength = schema.maxLength || 100;
    
    // Handle different string formats
    switch (format) {
      case 'date-time':
        return this.faker.date.recent().toISOString();
      case 'date':
        return this.faker.date.recent().toISOString().split('T')[0];
      case 'time':
        return this.faker.date.recent().toISOString().split('T')[1].split('.')[0];
      case 'email':
        return this.faker.internet.email();
      case 'hostname':
        return this.faker.internet.domainName();
      case 'ipv4':
        return this.faker.internet.ip();
      case 'ipv6':
        return this.faker.internet.ipv6();
      case 'uri':
        return this.faker.internet.url();
      case 'uuid':
        return this.faker.datatype.uuid();
      case 'password':
        return this.faker.internet.password(12);
      case 'binary':
        return this.faker.image.dataUri();
      default:
        // Handle patterns if defined
        if (schema.pattern) {
          if (schema.pattern === '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
            return this.faker.datatype.uuid();
          }
        }
        
        // Default to a random string with specified length constraints
        return this.faker.lorem.words(this.faker.datatype.number({ min: 1, max: 5 }))
          .substring(0, maxLength)
          .padEnd(minLength, 'x');
    }
  }
  
  /**
   * Generate a number value based on format
   */
  generateNumber(schema, format) {
    const isInteger = schema.type === 'integer';
    const min = schema.minimum !== undefined ? schema.minimum : (isInteger ? 1 : 0.1);
    const max = schema.maximum !== undefined ? schema.maximum : (isInteger ? 1000 : 1000.0);
    const multipleOf = schema.multipleOf || (isInteger ? 1 : undefined);
    
    let value;
    
    if (isInteger) {
      value = this.faker.datatype.number({ min, max });
      if (multipleOf && multipleOf !== 1) {
        value = Math.floor(value / multipleOf) * multipleOf;
      }
    } else {
      value = this.faker.datatype.float({
        min,
        max,
        precision: 0.01,
      });
      
      if (multipleOf) {
        value = Math.floor(value / multipleOf) * multipleOf;
      }
    }
    
    // Handle exclusive min/max
    if (schema.exclusiveMinimum && value <= schema.minimum) {
      value = schema.minimum + (isInteger ? 1 : 0.1);
    }
    
    if (schema.exclusiveMaximum && value >= schema.maximum) {
      value = schema.maximum - (isInteger ? 1 : 0.1);
    }
    
    return value;
  }
  
  /**
   * Resolve JSON references in the schema
   */
  resolveRefs(schema, root = null) {
    if (root === null) root = this.openApiSpec;
    
    if (schema && typeof schema === 'object') {
      if (Array.isArray(schema)) {
        return schema.map(item => this.resolveRefs(item, root));
      }
      
      if (schema.$ref) {
        // Resolve the reference
        const parts = schema.$ref.split('/').filter(Boolean);
        let ref = root;
        
        for (const part of parts) {
          ref = ref[part];
          if (ref === undefined) {
            throw new Error(`Invalid reference: ${schema.$ref}`);
          }
        }
        
        // Return a deep copy to avoid modifying the original
        return JSON.parse(JSON.stringify(ref));
      }
      
      // Process all properties
      const result = {};
      for (const [key, value] of Object.entries(schema)) {
        result[key] = this.resolveRefs(value, root);
      }
      return result;
    }
    
    return schema;
  }
  
  /**
   * Generate test data for a specific endpoint
   */
  generateForEndpoint(path, method, responseCode = '200') {
    const endpoint = this.openApiSpec.paths[path]?.[method.toLowerCase()];
    if (!endpoint) {
      throw new Error(`Endpoint ${method} ${path} not found in the OpenAPI spec`);
    }
    
    const response = endpoint.responses?.[responseCode];
    if (!response) {
      throw new Error(`Response code ${responseCode} not found for ${method} ${path}`);
    }
    
    // Get the first content type (usually application/json)
    const contentType = response.content ? Object.keys(response.content)[0] : null;
    const schema = contentType ? response.content[contentType].schema : null;
    
    if (!schema) {
      return null; // No schema defined for this response
    }
    
    return this.generateFromSchema(schema);
  }
  
  /**
   * Save generated test data to a file
   */
  saveTestData(filename, data, format = 'json') {
    const dir = path.resolve(__dirname, '../data');
    const filePath = path.join(dir, `${filename}.${format}`);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save in the specified format
    const content = format === 'yaml' 
      ? yaml.stringify(data, { indent: 2 })
      : JSON.stringify(data, null, 2);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Test data saved to ${filePath}`);
  }
}

module.exports = new TestDataGenerator();
