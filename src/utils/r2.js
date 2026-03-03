import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// WARNING: Exposing these keys in the frontend is a security risk.
// Anyone who inspects your website can see these keys and access your Cloudflare R2 storage.
// For production, consider using a backend (like Firebase Functions) to generate Presigned URLs.

const R2_ENDPOINT = "https://a9dbedb9f07ac585d5b7a17748f220a7.r2.cloudflarestorage.com";
const R2_PUBLIC_URL = "https://pub-2888c5038b2c48308c61d2b4107fbc6f.r2.dev"; // Added Public Dev URL
const R2_ACCESS_KEY_ID = "011e35a8ff05084923bbfb6be8ca871c";
const R2_SECRET_ACCESS_KEY = "a0f10e88b649d67733ee948dc2ffc887a6272b8af833e1bf6edcbdeefd46b852";
const BUCKET_NAME = "seddik"; // Updated bucket name as per user request

const s3Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    forcePathStyle: true, // Important for Cloudflare R2
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

export const uploadToR2 = async (file, onProgress) => {
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`; // Remove spaces from filename

    const parallelUploads3 = new Upload({
        client: s3Client,
        params: {
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: file,
            ContentType: file.type || "video/avi", // Default to AVI as requested
        },
        queueSize: 4,
        partSize: 1024 * 1024 * 5, // 5MB
        leavePartsOnError: false,
    });

    parallelUploads3.on("httpUploadProgress", (progress) => {
        if (onProgress) {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            onProgress(percentage);
        }
    });

    await parallelUploads3.done();

    // Construct the public URL
    // Note: You need to have a custom domain or the R2 public dev URL enabled
    // The format is usually: https://pub-<hash>.r2.dev/<fileName>
    // However, since we don't have the public domain yet, I'll return the key
    // and let the user configure the base URL.
    // Use the Public URL for playback
    const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;

    // NOTE: Direct access to R2 storage endpoint usually requires authentication.
    // You should use your Public Bucket URL from Cloudflare Dashboard.
    return {
        key: fileName,
        url: publicUrl,
        bucket: BUCKET_NAME
    };
};

export const listObjectsR2 = async () => {
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");

    try {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
        });
        const data = await s3Client.send(command);

        return (data.Contents || []).map(obj => ({
            key: obj.Key,
            url: `${R2_PUBLIC_URL}/${obj.Key}`, // Use Public URL here too
            size: obj.Size,
            lastModified: obj.LastModified
        })).sort((a, b) => b.lastModified - a.lastModified); // Newest first
    } catch (error) {
        console.error("List fail:", error);
        throw error;
    }
};
