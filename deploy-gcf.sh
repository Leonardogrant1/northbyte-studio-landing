#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
FUNCTION_NAME=""
IS_DEV=false

for arg in "$@"; do
case $arg in
--dev)
IS_DEV=true
shift
;;
*)
FUNCTION_NAME="$arg"
shift
;;
esac
done

# Check if function name is provided
if [ -z "$FUNCTION_NAME" ]; then
echo -e "${RED}❌ Please specify a function name.${NC}"
echo "Usage: ./deploy-gcf.sh <function-name> [--dev]"
exit 1
fi

# Set function name based on environment
if [ "$IS_DEV" = true ]; then
DEPLOY_NAME="${FUNCTION_NAME}-dev"
else
DEPLOY_NAME="${FUNCTION_NAME}"
fi

# Get script directory and function directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNCTION_DIR="${SCRIPT_DIR}/cloud-functions/${FUNCTION_NAME}"
DIST_DIR="${FUNCTION_DIR}/dist"

# Check if function directory exists
if [ ! -d "$FUNCTION_DIR" ]; then
echo -e "${RED}❌ Function directory not found: ${FUNCTION_DIR}${NC}"
exit 1
fi

# Check if package.json exists
PACKAGE_JSON="${FUNCTION_DIR}/package.json"
if [ ! -f "$PACKAGE_JSON" ]; then
echo -e "${RED}❌ package.json not found: ${PACKAGE_JSON}${NC}"
exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
echo -e "${RED}❌ jq is not installed. Please install it:${NC}"
echo " macOS: brew install jq"
echo " Ubuntu/Debian: sudo apt-get install jq"
exit 1
fi

echo -e "${BLUE}🚀 Deploying Cloud Function: ${DEPLOY_NAME}${NC}"

# 1. Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
pnpm install --filter "${FUNCTION_NAME}"

if [ $? -ne 0 ]; then
echo -e "${RED}❌ Failed to install dependencies${NC}"
exit 1
fi

# 2. Bundle with esbuild
echo -e "${YELLOW}🔧 Bundling with esbuild...${NC}"

# Create dist directory
mkdir -p "$DIST_DIR"

# Check if esbuild.config.ts exists
ESBUILD_CONFIG="${FUNCTION_DIR}/esbuild.config.ts"
if [ ! -f "$ESBUILD_CONFIG" ]; then
echo -e "${RED}❌ esbuild.config.ts not found: ${ESBUILD_CONFIG}${NC}"
exit 1
fi

# Run esbuild via config
cd "$FUNCTION_DIR"
tsx esbuild.config.ts

if [ $? -ne 0 ]; then
echo -e "${RED}❌ Build failed${NC}"
exit 1
fi

# 3. Create minimal package.json in dist
echo -e "${YELLOW}📝 Writing minimal package.json to dist/...${NC}"

cat > "${DIST_DIR}/package.json" << EOF
{
"name": "@functions/${DEPLOY_NAME}",
"version": "1.0.0",
"main": "index.js",
"scripts": {
"start": "node index.js",
"build": "echo \\"No build step\\""
},
"dependencies": {
"@google-cloud/functions-framework": "^3.3.0"
}
}
EOF

# 4. Check for env file
if [ "$IS_DEV" = true ]; then
ENV_FILE="${FUNCTION_DIR}/.env.dev.yaml"
else
ENV_FILE="${FUNCTION_DIR}/.env.yaml"
fi

ENV_FLAG=""
if [ -f "$ENV_FILE" ]; then
echo -e "${BLUE}📄 Using env file: ${ENV_FILE}${NC}"
ENV_FLAG="--env-vars-file=${ENV_FILE}"
else
echo -e "${YELLOW}⚠️ No env file found at ${ENV_FILE}, skipping...${NC}"
fi

# 5. Read gcfConfig from package.json and build flags
echo -e "${YELLOW}🔧 Reading gcfConfig from package.json...${NC}"

GCF_FLAGS=""
while IFS="=" read -r key value; do
if [ -n "$key" ] && [ -n "$value" ]; then
if [ "$value" = "true" ]; then
GCF_FLAGS="${GCF_FLAGS} --${key}"
else
GCF_FLAGS="${GCF_FLAGS} --${key}=${value}"
fi
fi
done < <(jq -r '.gcfConfig // {} | to_entries | .[] | "\(.key)=\(.value)"' "$PACKAGE_JSON")

# 6. Deploy function
DEPLOY_CMD="gcloud functions deploy ${DEPLOY_NAME} --source=${DIST_DIR} ${ENV_FLAG} ${GCF_FLAGS}"

echo -e "${BLUE}🚀 Running: gcloud functions deploy ${DEPLOY_NAME}...${NC}"
echo -e "${BLUE}📦 Source: ${DIST_DIR}${NC}"

eval $DEPLOY_CMD

if [ $? -eq 0 ]; then
echo -e "${GREEN}✅ Successfully deployed ${DEPLOY_NAME}${NC}"
else
echo -e "${RED}❌ Deployment failed${NC}"
exit 1
fi