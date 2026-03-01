import React, { useState, useEffect } from 'react';
import { collection, query, addDoc, updateDoc, deleteDoc, doc, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const CourseEditor = ({ course, onBack }) => {
    const [items, setItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddMenu, setShowAddMenu] = useState(false);

    // Editing state
    const [editTitle, setEditTitle] = useState('');
    const [editVideo, setEditVideo] = useState('');
    const [editImage, setEditImage] = useState('');
    const [editBody, setEditBody] = useState('');
    const [saving, setSaving] = useState(false);

    // Normalize Video URL
    const normalizeVideoUrl = (url) => {
        if (!url) return '';

        // YouTube regular and short URLs
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const ytMatch = url.match(ytRegex);
        if (ytMatch && ytMatch[1]) {
            return `https://www.youtube.com/embed/${ytMatch[1]}`;
        }

        // Vimeo
        const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i;
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch && vimeoMatch[1]) {
            return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }

        return url;
    };

    useEffect(() => {
        if (!course?.id) return;

        const q = query(collection(db, 'courses', course.id, 'content'), orderBy('order', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(fetchedItems);
            setLoading(false);

            // Auto-select first page if none selected
            if (!selectedItem && fetchedItems.length > 0) {
                const firstPage = fetchedItems.find(i => i.type === 'page');
                if (firstPage) {
                    handleSelectItem(firstPage);
                }
            }
        });

        return () => unsubscribe();
    }, [course?.id]);

    const handleSelectItem = (item) => {
        setSelectedItem(item);
        setEditTitle(item.title || '');
        setEditVideo(item.video_url || '');
        setEditImage(item.image_url || '');
        setEditBody(item.body || '');
    };

    const handleAddItem = async (type) => {
        setShowAddMenu(false);
        try {
            const newItem = {
                title: type === 'folder' ? 'New Folder' : 'New Page',
                type,
                order: items.length,
                created_at: new Date().toISOString()
            };
            if (type === 'page') {
                newItem.video_url = '';
                newItem.image_url = '';
                newItem.body = '';
            }
            const docRef = await addDoc(collection(db, 'courses', course.id, 'content'), newItem);
            handleSelectItem({ id: docRef.id, ...newItem });
        } catch (error) {
            console.error("Error adding item:", error);
        }
    };

    const handleSave = async () => {
        if (!selectedItem) return;
        setSaving(true);
        try {
            const normalizedVideo = normalizeVideoUrl(editVideo);
            await updateDoc(doc(db, 'courses', course.id, 'content', selectedItem.id), {
                title: editTitle,
                video_url: normalizedVideo,
                image_url: editImage,
                body: editBody,
                updated_at: new Date().toISOString()
            });
            // Update local state for video if changed
            setEditVideo(normalizedVideo);
        } catch (error) {
            console.error("Error saving item:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            await deleteDoc(doc(db, 'courses', course.id, 'content', itemId));
            if (selectedItem?.id === itemId) {
                setSelectedItem(null);
            }
        } catch (error) {
            console.error("Error deleting item:", error);
        }
    };

    const quillModules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike', 'blockquote'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link', 'image', 'video'],
            [{ 'color': [] }, { 'background': [] }],
            ['clean']
        ],
    };

    if (loading) return <div>Loading course content...</div>;

    return (
        <div className="course-editor-layout" style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 250px)' }}>
            {/* Sidebar */}
            <div className="editor-sidebar" style={{ width: '300px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="btn-ghost" onClick={onBack} style={{ padding: '0.25rem 0.5rem' }}>&larr; Back</button>
                    <div style={{ position: 'relative' }}>
                        <button className="btn-outline" onClick={() => setShowAddMenu(!showAddMenu)} style={{ padding: '0.25rem 0.5rem' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        {showAddMenu && (
                            <div className="card" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 60, padding: '0.5rem', width: '150px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}>
                                <div className="btn-ghost" style={{ padding: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'block' }} onClick={() => handleAddItem('page')}>Add Page</div>
                                <div className="btn-ghost" style={{ padding: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'block' }} onClick={() => handleAddItem('folder')}>Add Folder</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="sidebar-items" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {items.map(item => (
                        <div
                            key={item.id}
                            onClick={() => handleSelectItem(item)}
                            style={{
                                padding: '0.75rem',
                                borderRadius: 'var(--radius)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '0.5rem',
                                backgroundColor: selectedItem?.id === item.id ? '#f3f4f6' : 'transparent',
                                border: selectedItem?.id === item.id ? '1px solid var(--border-color)' : '1px solid transparent',
                                fontWeight: item.type === 'folder' ? '600' : '400'
                            }}
                        >
                            {item.type === 'folder' ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            )}
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                            <button className="btn-ghost" style={{ padding: '2px', color: 'var(--danger-color)' }} onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="editor-main" style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
                {selectedItem ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Edit {selectedItem.type.charAt(0).toUpperCase() + selectedItem.type.slice(1)}</h3>
                            <button className="btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Title</label>
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder="Enter title..."
                            />
                        </div>

                        {selectedItem.type === 'page' && (
                            <>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Video URL (YouTube/Vimeo)</label>
                                    <input
                                        type="text"
                                        value={editVideo}
                                        onChange={(e) => setEditVideo(e.target.value)}
                                        placeholder="https://www.youtube.com/watch?v=..."
                                    />
                                    {editVideo && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Normalized: {normalizeVideoUrl(editVideo)}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Image URL</label>
                                    <input
                                        type="text"
                                        value={editImage}
                                        onChange={(e) => setEditImage(e.target.value)}
                                        placeholder="https://..."
                                    />
                                    {editImage && <img src={editImage} alt="Preview" style={{ marginTop: '1rem', maxWidth: '200px', borderRadius: 'var(--radius)' }} />}
                                </div>

                                <div className="quill-editor-wrapper">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Content / Description</label>
                                    <ReactQuill
                                        theme="snow"
                                        value={editBody}
                                        onChange={setEditBody}
                                        modules={quillModules}
                                        style={{ height: '300px', marginBottom: '50px' }}
                                    />
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '1rem' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <p>Select a page or folder to edit its content</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourseEditor;
