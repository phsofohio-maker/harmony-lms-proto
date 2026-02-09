#!/bin/bash

###############################################################################
# Firestore Security Rules Test Setup
# 
# This script:
# 1. Installs required dependencies
# 2. Configures Firebase emulators
# 3. Provides commands to run tests
# 
# Usage: chmod +x test-rules-setup.sh && ./test-rules-setup.sh
###############################################################################

echo "🔧 Setting up Firestore Security Rules Testing Environment..."
echo ""

# Step 1: Install testing dependencies
echo "📦 Installing test dependencies..."
npm install --save-dev @firebase/rules-unit-testing jest @types/jest ts-jest

# Step 2: Create Jest configuration
echo "⚙️  Creating Jest configuration..."
cat > jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    'services/**/*.ts',
    'hooks/**/*.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
EOF

# Step 3: Add test scripts to package.json
echo "📝 Adding test scripts to package.json..."
echo ""
echo "Add these scripts to your package.json manually:"
echo ""
cat << 'EOF'
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:rules": "firebase emulators:exec --only firestore 'npm test'",
    "emulators": "firebase emulators:start",
    "emulators:export": "firebase emulators:export ./emulator-data"
  }
}
EOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your package.json with the scripts above"
echo "2. Start emulators: npm run emulators"
echo "3. In another terminal: npm run test:rules"
echo ""
echo "For continuous testing during development:"
echo "  npm run test:watch"
echo ""