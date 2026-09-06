import { collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, doc, writeBatch, getDocs, limit } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { db, messaging } from '../firebase/config';

/**
 * Register FCM token for a user.
 * @param {string} userId 
 */
export const registerFCMToken = async (userId) => {
    try {
        const token = await getToken(messaging, {
            vapidKey: 'BAVYFlSUWhcjRY28lRhF9f7Ad71f57uu1OG1oXgxYqr_ClMHd5H0_4_RxOE2axr-X2keasoRBThUiOCop7eQqxg'
        });
        if (token) {
            await updateDoc(doc(db, 'users', userId), {
                fcmToken: token,
                pushEnabled: true
            });
            return token;
        }
    } catch (error) {
        console.error("Error registering FCM token:", error);
    }
    return null;
};

/**
 * Create a new notification for a specific user or all users.
 * @param {string} userId - The ID of the user (or 'all' for broadcast).
 * @param {Object} notification - The notification data { title, message, type, link }.
 */
export const createNotification = async (userId, { title, message, type = 'info', link = '' }) => {
    try {
        const notifData = {
            userId,
            title,
            message,
            type,
            link,
            read: false,
            created_at: new Date().toISOString()
        };

        if (userId === 'all') {
            // For broadcast, we could store it once and check against a "last_cleared" date,
            // but for simplicity in a small app, we'll just create a 'broadcast' record 
            // and the UI will show it to everyone.
            await addDoc(collection(db, 'notifications'), { ...notifData, userId: 'broadcast' });
        } else {
            await addDoc(collection(db, 'notifications'), notifData);
        }
    } catch (error) {
        console.error("Error creating notification:", error);
    }
};

/**
 * Mark a single notification as read.
 */
export const markAsRead = async (notificationId) => {
    try {
        await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
};

/**
 * Mark all user notifications as read.
 */
export const markAllAsRead = async (userId) => {
    try {
        const q = query(
            collection(db, 'notifications'),
            where('userId', 'in', [userId, 'broadcast']),
            where('read', '==', false)
        );
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach((d) => {
            batch.update(d.ref, { read: true });
        });
        await batch.commit();
    } catch (error) {
        console.error("Error marking all as read:", error);
    }
};
