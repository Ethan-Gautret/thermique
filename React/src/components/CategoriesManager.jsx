import { useEffect, useState } from 'react';
import categoryService from '../services/category';

export default function CategoriesManager({ onCategorySelect, selectedCategoryId }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        icon: '📁',
        color: '#6366f1'
    });

    const loadCategories = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await categoryService.getCategories();
            setCategories(response.data?.data || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Impossible de charger les catégories');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await categoryService.createCategory(
                formData.name,
                formData.description,
                formData.icon,
                formData.color
            );
            setFormData({ name: '', description: '', icon: '📁', color: '#6366f1' });
            setShowForm(false);
            await loadCategories();
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur lors de la création');
        }
    };

    const handleDelete = async (categoryId) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette catégorie?')) {
            return;
        }
        try {
            await categoryService.deleteCategory(categoryId);
            await loadCategories();
            if (selectedCategoryId === categoryId) {
                onCategorySelect(null);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur lors de la suppression');
        }
    };

    return (
        <div className="categories-manager">
            <div className="categories-header">
                <h3>Catégories</h3>
                <button
                    type="button"
                    className="btn-primary-small"
                    onClick={() => setShowForm(!showForm)}
                >
                    {showForm ? '✕ Annuler' : '+ Nouvelle'}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {showForm && (
                <form onSubmit={handleSubmit} className="category-form">
                    <input
                        type="text"
                        placeholder="Nom de la catégorie"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        maxLength={120}
                    />
                    <textarea
                        placeholder="Description (optionnel)"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        maxLength={255}
                        rows={2}
                    />
                    <div className="form-row">
                        <input
                            type="text"
                            placeholder="Icône"
                            value={formData.icon}
                            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                            maxLength={2}
                            style={{ flex: '0 0 60px' }}
                        />
                        <input
                            type="color"
                            value={formData.color}
                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        />
                    </div>
                    <button type="submit" className="btn-primary">Créer</button>
                </form>
            )}

            {loading ? (
                <p>Chargement...</p>
            ) : categories.length === 0 ? (
                <p className="empty-state">Aucune catégorie créée</p>
            ) : (
                <div className="categories-list">
                    <button
                        key="all"
                        className={`category-item ${!selectedCategoryId ? 'active' : ''}`}
                        onClick={() => onCategorySelect(null)}
                    >
                        <span>Tous les équipements</span>
                    </button>
                    {categories.map((cat) => (
                        <div key={cat.id} className="category-item-container">
                            <button
                                className={`category-item ${selectedCategoryId === cat.id ? 'active' : ''}`}
                                onClick={() => onCategorySelect(cat.id)}
                            >
                                <span style={{ fontSize: '1.2em' }}>{cat.icon}</span>
                                <span>{cat.name}</span>
                            </button>
                            <button
                                className="btn-delete-mini"
                                onClick={() => handleDelete(cat.id)}
                                title="Supprimer"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
