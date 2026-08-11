const { S3Client, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Configure S3 Client (assuming execution in Lambda in ap-south-1)
const s3Client = new S3Client({ region: 'ap-south-1' });

const BUCKET_NAME = 'aionion-kyc-staging-documents';
const PREFIX = 'clients/uploads/signed-pdfs/';

/**
 * Checks if the signed PDF exists in S3 for the given PAN.
 * @param {string} panNumber
 * @returns {Promise<boolean>}
 */
const checkPdfExists = async (panNumber) => {
  if (!panNumber) return false;
  const normalizedPan = panNumber.trim().toUpperCase();
  const objectKey = `${PREFIX}${normalizedPan}.pdf`;

  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });
    await s3Client.send(command);
    return true; // Exists
  } catch (error) {
    if (error.name === 'NotFound' || error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return false; // Does not exist
    }
    console.error("Error checking S3 object existence:", error);
    throw error; // Throw other errors (like 403 AccessDenied) so the API can return a 500
  }
};

/**
 * Generates a presigned URL for the signed PDF for the given PAN.
 * @param {string} panNumber
 * @returns {Promise<{ fileName: string, signedPdfUrl: string } | null>}
 */
const generatePresignedPdfUrl = async (panNumber) => {
  if (!panNumber) return null;
  const normalizedPan = panNumber.trim().toUpperCase();
  const fileName = `${normalizedPan}.pdf`;
  const objectKey = `${PREFIX}${fileName}`;

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });

    // Generate a presigned URL valid for 15 minutes (900 seconds)
    const signedPdfUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return {
      fileName,
      signedPdfUrl
    };
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return null;
  }
};

/**
 * Generates a presigned URL for any generic file path in the clients/ directory.
 * @param {string} filePath
 * @returns {Promise<string | null>}
 */
const generateGenericPresignedUrl = async (filePath) => {
  if (!filePath) return null;
  
  // Normalize the path to ensure it starts with clients/
  let objectKey = filePath;
  if (objectKey.startsWith('/')) objectKey = objectKey.substring(1);
  if (!objectKey.startsWith('clients/')) objectKey = `clients/${objectKey}`;

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    return signedUrl;
  } catch (error) {
    console.error("Error generating presigned URL for", objectKey, error);
    return null;
  }
};

module.exports = {
  checkPdfExists,
  generatePresignedPdfUrl,
  generateGenericPresignedUrl
};
