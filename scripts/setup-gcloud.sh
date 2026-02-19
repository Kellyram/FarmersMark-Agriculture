#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PROJECT_ID:-}" ]]; then
  echo "Set PROJECT_ID before running. Example: export PROJECT_ID=my-project-id"
  exit 1
fi

gcloud config set project "$PROJECT_ID"

gcloud services enable storage.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  documentai.googleapis.com \
  vision.googleapis.com \
  cloudfunctions.googleapis.com \
  firebase.googleapis.com

gcloud iam service-accounts create rag-functions --display-name="RAG System Functions" || true
SERVICE_ACCOUNT="rag-functions@${PROJECT_ID}.iam.gserviceaccount.com"

for role in roles/storage.admin roles/datastore.user roles/aiplatform.user roles/ml.developer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="$role"
done

BUCKET_NAME="${PROJECT_ID}-documents"
gsutil mb -p "$PROJECT_ID" -c STANDARD -l us-central1 "gs://${BUCKET_NAME}" || true
gsutil uniformbucketlevelaccess set on "gs://${BUCKET_NAME}"

echo "Setup complete for project: $PROJECT_ID"