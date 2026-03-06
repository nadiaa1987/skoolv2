import React, { useState, useEffect } from 'react';
import { collection, query, addDoc, updateDoc, deleteDoc, doc, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { uploadToR2, listObjectsR2 } from '../utils/r2';

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

    // Video Upload & Library State
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState('');
    const [showLibrary, setShowLibrary] = useState(false);
    const [libraryItems, setLibraryItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingLibrary, setLoadingLibrary] = useState(false);

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

    // Organize items into hierarchy
    const organizeItems = (flatItems) => {
        const itemMap = {};
        flatItems.forEach(item => {
            itemMap[item.id] = { ...item, children: [] };
        });
        const rootItems = [];
        flatItems.forEach(item => {
            if (item.parentId && itemMap[item.parentId]) {
                itemMap[item.parentId].children.push(itemMap[item.id]);
            } else {
                rootItems.push(itemMap[item.id]);
            }
        });
        return rootItems;
    };

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
            // Determine parentId based on current selection
            let parentId = null;
            if (selectedItem && selectedItem.type === 'folder') {
                parentId = selectedItem.id;
            } else if (selectedItem && selectedItem.parentId) {
                parentId = selectedItem.parentId;
            }

            const newItem = {
                title: type === 'folder' ? 'New Folder' : 'New Page',
                type,
                parentId,
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

    const handleVideoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file type (optional, user specifically asked for AVI)
        // if (!file.type.includes('video')) {
        //     setUploadError("Please select a valid video file.");
        //     return;
        // }

        setUploading(true);
        setUploadProgress(0);
        setUploadError('');

        try {
            const result = await uploadToR2(file, (progress) => {
                setUploadProgress(progress);
            });

            // Set the video URL to the uploaded R2 URL
            setEditVideo(result.url);
            alert("Video uploaded successfully to Cloudflare R2!");
        } catch (error) {
            console.error("Upload failed:", error);
            setUploadError("Upload failed: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const fetchLibrary = async () => {
        setLoadingLibrary(true);
        setShowLibrary(true);
        try {
            const files = await listObjectsR2();
            setLibraryItems(files);
        } catch (error) {
            console.error("Library fetch failed:", error);
            setUploadError("Could not load library.");
        } finally {
            setLoadingLibrary(false);
        }
    };

    const handleSelectLibraryItem = (url) => {
        setEditVideo(url);
        setShowLibrary(false);
    };

    const filteredLibrary = libraryItems.filter(item =>
        item.key.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

    const hierItems = organizeItems(items);

    const renderSidebarItem = (item, depth = 0, indexStr = '') => (
        <React.Fragment key={item.id}>
            <div
                onClick={() => handleSelectItem(item)}
                style={{
                    padding: '0.75rem',
                    paddingLeft: `${depth * 1.5 + 0.75}rem`,
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '0.25rem',
                    backgroundColor: selectedItem?.id === item.id ? '#f3f4f6' : 'transparent',
                    border: selectedItem?.id === item.id ? '1px solid var(--border-color)' : '1px solid transparent',
                    fontWeight: item.type === 'folder' ? '600' : '400',
                    fontSize: depth > 0 ? '0.9rem' : '1rem'
                }}
            >
                {item.type === 'folder' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                )}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {indexStr && <span style={{ marginRight: '6px', opacity: 0.7, fontWeight: 700 }}>{indexStr}</span>}
                    {item.title}
                </span>
                <button className="btn-ghost" style={{ padding: '2px', color: 'var(--danger-color)' }} onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
            {item.children && item.children.length > 0 && (
                <div className="nested-items">
                    {item.children.map((child, idx) => renderSidebarItem(child, depth + 1, `${indexStr}${idx + 1}.`))}
                </div>
            )}
        </React.Fragment>
    );

    return (
        <div className="course-editor-layout" style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 250px)' }}>
            {/* Sidebar */}
            <div className="editor-sidebar" style={{ width: '300px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="btn-ghost" onClick={onBack} style={{ padding: '0.25rem 0.5rem' }}>&larr; Back</button>
                    <div style={{ position: 'relative' }}>
                        <button className="btn-outline" onClick={() => setShowAddMenu(!showAddMenu)} title="Add Item" style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        {showAddMenu && (
                            <div className="card" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 60, padding: '0.5rem', width: '180px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}>
                                <div className="btn-ghost" style={{ padding: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'block', fontSize: '0.85rem' }} onClick={() => handleAddItem('page')}>Add Page</div>
                                <div className="btn-ghost" style={{ padding: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'block', fontSize: '0.85rem' }} onClick={() => handleAddItem('folder')}>Add Folder / Module</div>
                                {selectedItem && (
                                    <div style={{ padding: '0.5rem', borderTop: '1px solid #eee', fontSize: '0.7rem', color: '#666' }}>
                                        Adding to: {selectedItem.title}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="sidebar-items" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {hierItems.map((item, idx) => renderSidebarItem(item, 0, `${idx + 1}.`))}
                </div>
            </div>

            {/* Content Area */}
            <div className="editor-main" style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
                {selectedItem ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Edit {selectedItem.type === 'folder' ? 'Module / Folder' : 'Lesson Page'}</h3>
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

                        {selectedItem.type === 'folder' && (
                            <div style={{ backgroundColor: '#f8fafc', padding: '2rem', borderRadius: '12px', border: '1px dashed #e2e8f0', marginTop: '1rem' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" style={{ marginBottom: '1rem' }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>Manage Module Content</h4>
                                    <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>Add lessons and pages inside this folder</p>

                                    <button
                                        className="btn-primary"
                                        onClick={() => handleAddItem('page')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto', padding: '0.75rem 1.5rem' }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        Add New Lesson Here
                                    </button>
                                </div>

                                {selectedItem.children && selectedItem.children.length > 0 && (
                                    <div style={{ marginTop: '2rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Lessons in this Module ({selectedItem.children.length})
                                        </label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {selectedItem.children.map((child, idx) => (
                                                <div
                                                    key={child.id}
                                                    onClick={() => handleSelectItem(child)}
                                                    style={{ padding: '0.75rem 1rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                                                    className="btn-ghost"
                                                >
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', width: '20px' }}>{idx + 1}</span>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                    <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{child.title}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedItem.type === 'page' && (
                            <>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Video (Cloudflare R2 Upload or URL)</label>

                                    <div className="flex-col gap-1" style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="file"
                                                accept="video/*,.avi"
                                                onChange={handleVideoUpload}
                                                disabled={uploading}
                                                id="video-upload"
                                                style={{ display: 'none' }}
                                            />
                                            <label
                                                htmlFor="video-upload"
                                                className="btn-outline"
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: uploading ? 'not-allowed' : 'pointer', backgroundColor: 'white' }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                {uploading ? 'Uploading...' : 'Upload Video to R2'}
                                            </label>

                                            {uploading && (
                                                <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: 'var(--primary-color)', transition: 'width 0.3s' }}></div>
                                                </div>
                                            )}

                                            <button
                                                className="btn-outline"
                                                onClick={fetchLibrary}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white' }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                                Browse Library
                                            </button>
                                        </div>

                                        {showLibrary && (
                                            <div className="card mt-1" style={{ position: 'relative', zIndex: 100, border: '1px solid var(--border-color)', backgroundColor: 'white', maxHeight: '350px', display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 110 }}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <h4 style={{ margin: 0, fontSize: '0.9rem' }}>R2 Video Library</h4>
                                                        <button className="btn-ghost" onClick={() => setShowLibrary(false)} style={{ padding: '0.2rem' }}>&times;</button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Search videos by name..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                                                    />
                                                </div>
                                                <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
                                                    {loadingLibrary ? (
                                                        <div className="text-center p-2 text-muted">Loading...</div>
                                                    ) : filteredLibrary.length === 0 ? (
                                                        <div className="text-center p-2 text-muted">No videos found.</div>
                                                    ) : (
                                                        filteredLibrary.map(item => (
                                                            <div
                                                                key={item.key}
                                                                onClick={() => handleSelectLibraryItem(item.url)}
                                                                style={{ padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', borderBottom: '1px solid #f1f5f9' }}
                                                                className="btn-ghost"
                                                            >
                                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', wordBreak: 'break-all' }}>{item.key}</span>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(item.size / 1024 / 1024).toFixed(2)} MB • {new Date(item.lastModified).toLocaleDateString()}</span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {uploadProgress > 0 && uploading && (
                                            <p style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }}>Progress: {uploadProgress}%</p>
                                        )}

                                        {uploadError && <p style={{ fontSize: '0.8rem', color: 'var(--danger-color)' }}>{uploadError}</p>}

                                        <div style={{ marginTop: '0.5rem' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Or paste a direct URL (YouTube, Vimeo, R2):</p>
                                            <input
                                                type="text"
                                                value={editVideo}
                                                onChange={(e) => setEditVideo(e.target.value)}
                                                placeholder="https://..."
                                            />
                                        </div>
                                    </div>

                                    {editVideo && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-main)', padding: '0.5rem', backgroundColor: '#eff6ff', borderRadius: '8px' }}>
                                            <strong>Video Link:</strong> <span style={{ wordBreak: 'break-all' }}>{editVideo}</span>
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
