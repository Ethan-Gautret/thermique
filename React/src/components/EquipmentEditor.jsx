import { useState, useEffect } from 'react';

export default function EquipmentEditor({ device, categories, onClose, onSave, onDelete, loading }) {
    const [selectedCategoryId, setSelectedCategoryId] = useState(device?.category_id || null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(device.id, selectedCategoryId);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (typeof onDelete !== 'function') {
            return;
        }

        setIsDeleting(true);
        try {
            await onDelete(device.id);
            onClose();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Modifier: {device.name}</h2>
                    <button
                        type="button"
                        className="close-button"
                        onClick={onClose}
                        aria-label="Fermer"
                    >
                        ✕
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label htmlFor="equipment-category">Catégorie</label>
                        <select
                            id="equipment-category"
                            value={selectedCategoryId || ''}
                            onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                            disabled={loading || isSaving || isDeleting}
                        >
                            <option value="">Sans catégorie</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.icon} {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="equipment-info">
                        <dl>
                            <div>
                                <dt>ID Tuya</dt>
                                <dd>{device.id}</dd>
                            </div>
                            <div>
                                <dt>Modèle</dt>
                                <dd>{device.model || '-'}</dd>
                            </div>
                            <div>
                                <dt>État</dt>
                                <dd>
                                    {device.online ? '🟢 En ligne' : '⚫ Hors ligne'}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={onClose}
                        disabled={isSaving || isDeleting}
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        className="btn-danger"
                        onClick={handleDelete}
                        disabled={isSaving || isDeleting || loading}
                    >
                        {isDeleting ? 'Suppression...' : 'Supprimer'}
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={isSaving || isDeleting || loading}
                    >
                        {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
                    </button>
                </div>
            </div>
        </div>
    );
}
