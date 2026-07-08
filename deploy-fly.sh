#!/bin/bash

# Ensure PATH includes homebrew binaries
export PATH="/opt/homebrew/bin:$PATH"

# Get the environment as an argument
ENV=$1
PROJECT=$2

echo "Deploying $PROJECT to Fly.io in $ENV environment"


# Set ENVIRONMENT + APPNAME early
if [[ $ENV == "prod" ]]; then
  ENVIRONMENT=production
  APPNAME="$PROJECT-prod"
elif [[ $ENV == "dev" ]]; then
  ENVIRONMENT=development
  APPNAME="$PROJECT-dev"
else
  echo "Unknown environment: $ENV"
  exit 1
fi


PATH_TO_PROJECT=$(pwd)/apps/$PROJECT
echo $PATH_TO_PROJECT

# Export env vars from .env file from project Directory
# This should only happen locally and not on CI/CD pipeline
if [ -f "$PATH_TO_PROJECT/.env" ]; then
  echo "Exporting environment variables from $PATH_TO_PROJECT/.env..."
  
  # Export variables while preserving spaces
  export $(grep -v '^#' "$PATH_TO_PROJECT/.env" | sed 's/^/"/;s/=/="/;s/$/"/' | xargs -d '\n')

 # Store environment variables in an array
  env_vars=()
  while IFS= read -r line; do
    if [[ ! $line =~ ^# && -n $line ]]; then
      key="${line%%=*}"
      value="${line#*=}"

      # Check if the key is ENVIRONMENT, if so, override it later
      if [[ "$key" != "ENVIRONMENT" ]]; then
        env_vars+=("${key}=${value}")
      fi
    fi
  done < "$PATH_TO_PROJECT/.env"

  # Override or add ENVIRONMENT
  env_vars+=("ENVIRONMENT=$ENVIRONMENT")


fi
 

DOCKERFILE_PATH=$PATH_TO_PROJECT/Dockerfile

if [ -f $DOCKERFILE_PATH ]; then
  echo "Dockerfile found at $DOCKERFILE_PATH"
else
  echo "Dockerfile not found at $DOCKERFILE_PATH"
  exit 1
fi
 

 # ------- This is deployment to local machine -------

# Build docker file and start the container
# docker build --progress=plain --platform=linux/amd64 -f $DOCKERFILE_PATH -t $PROJECT . --build-arg PROJECT=$PROJECT

# if [ $? -eq 0 ]; then
#   echo "Docker build successful"
# else
#   echo "Docker build failed"
#   exit 1
# fi


# Generate the environment variables arguments
# env_args=""
# for env_var in "${env_vars[@]}"; do
#   env_args+="-e ${env_var} "
# done

# docker run --platform=linux/amd64 -d -p 8080:8080 --env-file $PATH_TO_PROJECT/.env $env_args $PROJECT



# ------- This is deployment to fly.io -------


# Variable für das Betriebssystem
OS_TYPE=""

# check if operating system is Windows, MacOS or Linux
if [[ "$OSTYPE" == "msys" ]]; then
# Windows
OS_TYPE="Windows"
elif [[ "$OSTYPE" == "darwin"* ]]; then
# MacOS
OS_TYPE="MacOS"
elif [[ "$OSTYPE" == "linux-gnu" ]]; then
# Linux
OS_TYPE="Linux"
else
echo "Unknown OS. Exiting with error."
exit 1
fi

# Versuche, die jq-Version zu erhalten
jq_version=$(jq --version 2>/dev/null)

# Überprüfe, ob der Befehl erfolgreich war
if [[ $? -ne 0 ]]; then
echo "jq wird installiert"

if [[ "$OS_TYPE" == "Windows" ]]; then
# Installiere jq auf Windows
choco install jq
elif [[ "$OS_TYPE" == "MacOS" ]]; then
# Installiere jq auf MacOS
brew install jq
elif [[ "$OS_TYPE" == "Linux" ]]; then
# Installiere jq auf Linux
sudo apt-get install jq
else
echo "Unknown OS. Exiting with error."
exit 1
fi
else
echo "jq Version: $jq_version"
fi



FLY_VALUES=$(jq -r '.fly' "$PATH_TO_PROJECT/package.json")

if [ -z "$FLY_VALUES" ]; then
  echo "Error: FLY_VALUES is empty. Check if the .fly key exists in package.json."
  exit 1
fi
 

# Check if the app already exists
echo "Checking if app '$APPNAME' exists on Fly.io..."
if flyctl apps list --json | jq -e ".[] | select(.Name == \"$APPNAME\")" > /dev/null; then
  echo "App '$APPNAME' already exists. Proceeding to deployment..."
else
  echo "App '$APPNAME' does not exist. Creating a new app on Fly.io..."
  flyctl apps create --name $APPNAME -o memolib
fi

# set the secrets with env_vars array
for env_var in "${env_vars[@]}"; do
flyctl secrets set --stage $env_var --app $APPNAME
done


CONFIG_PATH="$PATH_TO_PROJECT/fly.toml"


# Überprüfen, ob der Input "dev" ist
if [ "$ENV" = "dev" ]; then
  echo "Environment is dev"
  FLY_DEPLOY_VALUES=$(jq -r '.fly["deploy-dev"]' "$PATH_TO_PROJECT/package.json")
else
  echo "Environment is prod"
  FLY_DEPLOY_VALUES=$(jq -r '.fly.deploy' "$PATH_TO_PROJECT/package.json")
fi

DEPLOY_FLAGS=""
echo "FLY_DEPLOY_VALUES: $FLY_DEPLOY_VALUES"
while read -r line; do
  echo "Processing line: $line" # Debugging-Ausgabe
  DEPLOY_FLAGS+="$line "
done < <(echo "$FLY_DEPLOY_VALUES" | jq -r 'to_entries[] | "--" + .key + " " + (.value | tostring)')

echo "DEPLOY_FLAGS: $DEPLOY_FLAGS"

# Deploy the application
echo "Deploying the application '$APPNAME' to Fly.io..."
echo "flyctl deploy --config $CONFIG_PATH --dockerfile $DOCKERFILE_PATH --build-arg PROJECT=\"$PROJECT\" $DEPLOY_FLAGS -a $APPNAME"


# log current dir
echo "Current directory: $(pwd)"

flyctl deploy --config $CONFIG_PATH --dockerfile $DOCKERFILE_PATH --build-arg PROJECT="$PROJECT" $DEPLOY_FLAGS -a $APPNAME 

if [ $? -eq 0 ]; then
  echo "Deployment successful"
  exit 0
else
  echo "Deployment failed"
  exit 1
fi