#!/bin/bash
# Deploy allegrolang.org
# Usage: ./deploy.sh

set -e

BUCKET="allegrolang.org"
DIST_ID="E1EAXJAVBJ20KY"

echo "Building web bundle..."
npm run build:web

echo "Syncing website to S3..."
aws s3 sync website/ "s3://${BUCKET}/" --delete
aws s3 cp web/dist/allegro.js "s3://${BUCKET}/allegro.js" --content-type "application/javascript"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*" --query "Invalidation.Id" --output text

echo "Done! Site will update in a few minutes."
echo "https://allegrolang.org"
