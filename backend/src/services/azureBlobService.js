import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import fs from "fs";

let blobServiceClient = null;

export function getBlobServiceClient() {
  if (!blobServiceClient) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (connectionString) {
      console.log("[AzureBlob] Initializing using Connection String");
      blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      return blobServiceClient;
    }

    const accountName = process.env.AZURE_BLOB_ACCOUNT;
    const accountKey = process.env.AZURE_BLOB_KEY;
    if (accountName) {
      const accountUrl = `https://${accountName}.blob.core.windows.net`;
      if (accountKey) {
        console.log("[AzureBlob] Initializing using Shared Key");
        const credential = new StorageSharedKeyCredential(accountName, accountKey);
        blobServiceClient = new BlobServiceClient(accountUrl, credential);
      } else {
        console.log("[AzureBlob] Initializing using DefaultAzureCredential");
        const credential = new DefaultAzureCredential();
        blobServiceClient = new BlobServiceClient(accountUrl, credential);
      }
    } else {
      console.warn("[AzureBlob] No AZURE_BLOB_ACCOUNT or Connection String found in env.");
    }
  }
  return blobServiceClient;
}

export async function uploadPDF(localPath, blobName) {
  try {
    const client = getBlobServiceClient();
    if (!client) {
      console.warn("[AzureBlob] Skipping PDF upload: Client not initialized");
      return null;
    }

    // Default container to 'interview-recordings' as specified in hr-management config
    const containerName = process.env.AZURE_BLOB_CONTAINER_RECORDINGS || "interview-recordings";
    const containerClient = client.getContainerClient(containerName);

    try {
      await containerClient.createIfNotExists();
    } catch (err) {
      console.warn(`[AzureBlob] Container creation check failed (continuing): ${err.message}`);
    }

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const fileBuffer = fs.readFileSync(localPath);

    console.log(`[AzureBlob] Uploading PDF to blob=${blobName} in container=${containerName}`);
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: { blobContentType: "application/pdf" }
    });

    console.log(`[AzureBlob] Upload complete. URL: ${blockBlobClient.url}`);
    return blockBlobClient.url;
  } catch (error) {
    console.error("[AzureBlob] Failed to upload PDF report:", error);
    return null;
  }
}
