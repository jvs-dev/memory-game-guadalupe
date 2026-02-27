import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const collectionId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;
const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;

const client = new Client();

if (projectId) {
  client
    .setEndpoint(endpoint)
    .setProject(projectId);
}

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export const isAppwriteConfigured = () => {
  const isValid = (val: any) => val && typeof val === 'string' && val.trim() !== '' && val !== 'undefined' && val !== 'null';
  
  const config = {
    projectId: isValid(projectId),
    databaseId: isValid(databaseId),
    collectionId: isValid(collectionId),
    bucketId: isValid(bucketId)
  };

  const allValid = config.projectId && config.databaseId && config.collectionId && config.bucketId;
  
  if (!allValid && (projectId || databaseId || collectionId || bucketId)) {
    console.warn('Appwrite está parcialmente configurado. Verifique se esqueceu alguma destas chaves:', {
      'Project ID': config.projectId ? 'OK' : 'Faltando',
      'Database ID': config.databaseId ? 'OK' : 'Faltando',
      'Collection ID': config.collectionId ? 'OK' : 'Faltando',
      'Bucket ID': config.bucketId ? 'OK' : 'Faltando'
    });
  }
  
  return allValid;
};

export interface AppwriteCard {
  cardId: string;
  fileId: string;
  imageUrl: string;
  points: number;
  author: string;
}

export const appwriteService = {
  async uploadCard(id: string, base64Image: string, points: number = 10, author: string = 'Admin') {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured. Please check your environment variables.');
    }

    // Convert base64 to blob
    const res = await fetch(base64Image);
    const blob = await res.blob();
    const file = new File([blob], `${id}.png`, { type: 'image/png' });

    // 1. Upload to Storage
    const uploadedFile = await storage.createFile(bucketId, ID.unique(), file);

    // 2. Get View URL (Raw file, no transformations to avoid plan blocks)
    const imageUrl = storage.getFileView(bucketId, uploadedFile.$id).toString();

    // 3. Save to Database
    await databases.createDocument(databaseId, collectionId, ID.unique(), {
      cardId: id,
      fileId: uploadedFile.$id,
      imageUrl: imageUrl,
      points: points,
      author: author,
    });

    return { cardId: id, imageUrl, points, author };
  },

  async getCards() {
    if (!isAppwriteConfigured()) {
      return [];
    }

    const response = await databases.listDocuments(databaseId, collectionId, [
      Query.orderDesc('$createdAt')
    ]);

    return response.documents.map(doc => {
      // Use getFileView instead of getFilePreview to avoid "image transformations blocked" error on some plans
      const imageUrl = storage.getFileView(bucketId, doc.fileId).toString();
      
      return {
        id: doc.cardId,
        image_data: imageUrl,
        appwriteId: doc.$id,
        fileId: doc.fileId,
        points: doc.points || 10,
        author: doc.author || 'Admin'
      };
    });
  },

  async getFileAsDataUrl(fileId: string) {
    if (!isAppwriteConfigured()) return null;
    try {
      // This uses the SDK's internal fetch which includes proper headers
      const result = await storage.getFileView(bucketId, fileId);
      return result.toString();
    } catch (error) {
      console.error('Erro ao obter visualização do arquivo:', error);
      return null;
    }
  },

  async deleteCard(documentId: string, fileId: string) {
    if (!isAppwriteConfigured()) return;

    await databases.deleteDocument(databaseId, collectionId, documentId);
    await storage.deleteFile(bucketId, fileId);
  }
};
