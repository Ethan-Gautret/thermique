import api from './api';

export const categoryService = {
    // Récupérer toutes les catégories
    getCategories: () =>
        api.get('/categories'),

    // Créer une nouvelle catégorie
    createCategory: (name, description = '', icon = '📁', color = '#6366f1') =>
        api.post('/categories', {
            name,
            description,
            icon,
            color,
        }).then((res) => res.data),

    // Mettre à jour une catégorie
    updateCategory: (categoryId, name, description = '', icon = '📁', color = '#6366f1') =>
        api.put(`/categories/${categoryId}`, {
            name,
            description,
            icon,
            color,
        }).then((res) => res.data),

    // Supprimer une catégorie
    deleteCategory: (categoryId) =>
        api.delete(`/categories/${categoryId}`).then((res) => res.data),
};

export default categoryService;
