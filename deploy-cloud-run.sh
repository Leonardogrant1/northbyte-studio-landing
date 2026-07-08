#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
SERVICE_NAME=""
IS_DEV=false

for arg in "$@"; do
case $arg in
--dev)
IS_DEV=true
shift
;;
*)
SERVICE_NAME="$arg"
shift
;;
esac
done

# Check if service name is provided
if [ -z "$SERVICE_NAME" ]; then
echo -e "${RED}❌ Please specify a service name.${NC}"
echo "Usage: ./deploy-cloud-run.sh <service-name> [--dev]"
exit 1
fi

# Set service name based on environment
if [ "$IS_DEV" = true ]; then
DEPLOY_NAME="${SERVICE_NAME}-dev"
else
DEPLOY_NAME="${SERVICE_NAME}"
fi

# Get script directory and service directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="${SCRIPT_DIR}/cloud-run/${SERVICE_NAME}"

# Check if service directory exists
if [ ! -d "$SERVICE_DIR" ]; then
echo -e "${RED}❌ Service directory not found: ${SERVICE_DIR}${NC}"
exit 1
fi

# Check if package.json exists
PACKAGE_JSON="${SERVICE_DIR}/package.json"
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

# Extract cloudRunConfig from package.json using jq
IMAGE=$(jq -r '.cloudRunConfig.image // ""' "$PACKAGE_JSON")
REGION=$(jq -r '.cloudRunConfig.region // ""' "$PACKAGE_JSON")
MEMORY=$(jq -r '.cloudRunConfig.memory // ""' "$PACKAGE_JSON")
CPU=$(jq -r '.cloudRunConfig.cpu // ""' "$PACKAGE_JSON")
TIMEOUT=$(jq -r '.cloudRunConfig.timeout // ""' "$PACKAGE_JSON")
MAX_INSTANCES=$(jq -r '.cloudRunConfig["max-instances"] // ""' "$PACKAGE_JSON")
MIN_INSTANCES=$(jq -r '.cloudRunConfig["min-instances"] // ""' "$PACKAGE_JSON")
CONCURRENCY=$(jq -r '.cloudRunConfig.concurrency // ""' "$PACKAGE_JSON")
ALLOW_UNAUTH=$(jq -r '.cloudRunConfig["allow-unauthenticated"] // false' "$PACKAGE_JSON")

# Check if image is specified
if [ -z "$IMAGE" ]; then
echo -e "${RED}❌ No image specified in cloudRunConfig${NC}"
echo "Please add 'image' to cloudRunConfig in package.json"
exit 1
fi

echo -e "${BLUE}🏗️ Building and pushing Docker image...${NC}"

# Get version from package.json
VERSION=$(jq -r '.version' "$PACKAGE_JSON")
if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
echo -e "${RED}❌ No version found in package.json${NC}"
exit 1
fi

# Build versioned image tag
IMAGE_BASE="${IMAGE%:*}"
IMAGE_VERSIONED="${IMAGE_BASE}:${VERSION}"

echo -e "${BLUE}📦 Image: ${IMAGE_VERSIONED}${NC}"
echo -e "${BLUE}🏷️ Version: ${VERSION}${NC}"

# Get Dockerfile path
DOCKERFILE="${SERVICE_DIR}/Dockerfile"
if [ ! -f "$DOCKERFILE" ]; then
echo -e "${RED}❌ Dockerfile not found: ${DOCKERFILE}${NC}"
exit 1
fi

# Build Docker image from monorepo root (for linux/amd64 platform for Cloud Run)
echo -e "${YELLOW}🔧 Building image for linux/amd64...${NC}"
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker build --platform linux/amd64 -f "$DOCKERFILE" -t "$IMAGE_VERSIONED" "$SCRIPT_DIR"

if [ $? -ne 0 ]; then
echo -e "${RED}❌ Docker build failed${NC}"
exit 1
fi

# Also tag as latest
docker tag "$IMAGE_VERSIONED" "$IMAGE"

# Push both tags to Docker Hub
echo -e "${YELLOW}📤 Pushing to Docker Hub...${NC}"
docker push "$IMAGE_VERSIONED"
docker push "$IMAGE"

if [ $? -ne 0 ]; then
echo -e "${RED}❌ Docker push failed${NC}"
exit 1
fi

echo -e "${GREEN}✅ Image built and pushed: ${IMAGE_VERSIONED}${NC}"
echo ""
echo -e "${BLUE}🚀 Deploying ${DEPLOY_NAME} to Cloud Run...${NC}"

# Use versioned image for deployment
IMAGE="$IMAGE_VERSIONED"

# Build gcloud command
DEPLOY_CMD="gcloud run deploy ${DEPLOY_NAME} --image=${IMAGE}"

# Add optional flags
[ -n "$REGION" ] && DEPLOY_CMD="${DEPLOY_CMD} --region=${REGION}"
[ -n "$MEMORY" ] && DEPLOY_CMD="${DEPLOY_CMD} --memory=${MEMORY}"
[ -n "$CPU" ] && DEPLOY_CMD="${DEPLOY_CMD} --cpu=${CPU}"
[ -n "$TIMEOUT" ] && DEPLOY_CMD="${DEPLOY_CMD} --timeout=${TIMEOUT}"
[ -n "$MAX_INSTANCES" ] && DEPLOY_CMD="${DEPLOY_CMD} --max-instances=${MAX_INSTANCES}"
[ -n "$MIN_INSTANCES" ] && DEPLOY_CMD="${DEPLOY_CMD} --min-instances=${MIN_INSTANCES}"
[ -n "$CONCURRENCY" ] && DEPLOY_CMD="${DEPLOY_CMD} --concurrency=${CONCURRENCY}"
[ "$ALLOW_UNAUTH" = "true" ] && DEPLOY_CMD="${DEPLOY_CMD} --allow-unauthenticated"

# Check for env file
if [ "$IS_DEV" = true ]; then
ENV_FILE="${SERVICE_DIR}/.env.dev.yaml"
else
ENV_FILE="${SERVICE_DIR}/.env.yaml"
fi

if [ -f "$ENV_FILE" ]; then
echo -e "${YELLOW}📄 Using env file: ${ENV_FILE}${NC}"
DEPLOY_CMD="${DEPLOY_CMD} --env-vars-file=${ENV_FILE}"
fi

# Execute deployment
echo -e "${BLUE}🚀 Running: gcloud run deploy ${DEPLOY_NAME}...${NC}"
eval $DEPLOY_CMD

if [ $? -eq 0 ]; then
echo -e "${GREEN}✅ Successfully deployed ${DEPLOY_NAME}${NC}"
else
echo -e "${RED}❌ Deployment failed${NC}"
exit 1
fi