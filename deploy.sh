#!/bin/bash
# Deploy allegrolang.org
# Usage: ./deploy.sh

set -e

BUCKET="allegrolang.org"
DIST_ID="E1EAXJAVBJ20KY"

echo "Building web bundle..."
npm run build:web

# B-096: stamp the deployed version so `npm run check-deployed` can
# audit what is live (version.json is gitignored — generated per deploy).
COMMIT=$(git rev-parse HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
if [ -n "$(git status --porcelain)" ]; then DIRTY=true; else DIRTY=false; fi
cat > website/version.json <<EOF
{
  "commit": "${COMMIT}",
  "branch": "${BRANCH}",
  "deployedAt": "${DEPLOYED_AT}",
  "dirty": ${DIRTY}
}
EOF
echo "Stamped version.json: ${COMMIT} (${BRANCH}, dirty=${DIRTY})"
if [ "${BRANCH}" != "main" ] || [ "${DIRTY}" = "true" ]; then
  echo "WARNING: deploying from branch '${BRANCH}' dirty=${DIRTY} — the stamp will record it."
fi

echo "Syncing website to S3..."
aws s3 sync website/ "s3://${BUCKET}/" --delete
aws s3 cp web/dist/allegro.js "s3://${BUCKET}/allegro.js" --content-type "application/javascript"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*" --query "Invalidation.Id" --output text

echo "Done! Site will update in a few minutes."
echo "https://allegrolang.org"
