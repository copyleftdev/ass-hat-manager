const path = require('path');
const fs = require('fs');
const yaml = require('yaml');

console.log('Debugging OpenAPI spec loading...');

// Define paths
const baseDir = path.resolve(__dirname, '../API Docs');
const specPath = path.join(baseDir, 'openapi.yaml');
const pathsDir = path.join(baseDir, 'paths');

// Function to load and parse YAML file
function loadYamlFile(filePath) {
  console.log(`Loading YAML file: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.parse(content);
    console.log(`Successfully parsed: ${filePath}`);
    return parsed;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

// Main function
async function main() {
  try {
    console.log('Base directory:', baseDir);
    console.log('Spec path:', specPath);
    
    // Load main spec
    const openApiSpec = loadYamlFile(specPath);
    if (!openApiSpec) {
      console.error('Failed to load main OpenAPI spec');
      return;
    }
    
    // Initialize paths if not exists
    if (!openApiSpec.paths) {
      console.log('No paths found in main spec, initializing empty paths object');
      openApiSpec.paths = {};
    }
    
    // Load paths from paths directory
    console.log('Checking for paths in:', pathsDir);
    if (fs.existsSync(pathsDir)) {
      const pathFiles = fs.readdirSync(pathsDir);
      console.log(`Found ${pathFiles.length} path files`);
      
      for (const file of pathFiles) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const filePath = path.join(pathsDir, file);
          console.log('\nProcessing path file:', file);
          
          const pathSpec = loadYamlFile(filePath);
          if (!pathSpec) continue;
          
          const pathName = '/' + path.basename(file, path.extname(file));
          console.log(`Adding path: ${pathName}`);
          openApiSpec.paths[pathName] = pathSpec;
        }
      }
    } else {
      console.log('No paths directory found');
    }
    
    // Output final structure
    console.log('\nFinal OpenAPI spec structure:');
    console.log({
      openapi: openApiSpec.openapi,
      info: openApiSpec.info,
      paths: Object.keys(openApiSpec.paths || {})
    });
    
    console.log('\nOpenAPI spec loading test completed successfully!');
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);
