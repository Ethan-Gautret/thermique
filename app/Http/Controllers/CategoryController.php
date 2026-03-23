<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class CategoryController extends Controller
{
    /**
     * Obtenir toutes les catégories de l'utilisateur
     */
    public function index(Request $request)
    {
        try {
            $userId = Auth::id();
            
            if (!$userId) {
                Log::warning('Unauthenticated access to categories endpoint', [
                    'headers' => $request->headers->all(),
                ]);
                return response()->json([
                    'message' => 'Unauthenticated',
                ], 401);
            }

            $categories = Category::where('user_id', $userId)
                ->orderBy('order')
                ->orderBy('name')
                ->get();

            return response()->json([
                'data' => $categories,
                'message' => 'Catégories récupérées avec succès',
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching categories', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Erreur: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Créer une nouvelle catégorie
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:7',
            'order' => 'nullable|integer',
        ]);

        try {
            $validated['user_id'] = Auth::id();

            if (!isset($validated['icon'])) {
                $validated['icon'] = '📁';
            }
            if (!isset($validated['color'])) {
                $validated['color'] = '#6366f1';
            }
            if (!isset($validated['order'])) {
                $validated['order'] = 0;
            }

            $category = Category::create($validated);

            return response()->json([
                'data' => $category,
                'message' => 'Catégorie créée avec succès',
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error creating category', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'Erreur: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mettre à jour une catégorie
     */
    public function update(Request $request, Category $category)
    {
        // Vérifier que l'utilisateur possède cette catégorie
        if ($category->user_id !== Auth::id()) {
            return response()->json([
                'message' => 'Non autorisé',
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:7',
            'order' => 'nullable|integer',
        ]);

        try {
            $category->update($validated);

            return response()->json([
                'data' => $category,
                'message' => 'Catégorie mise à jour avec succès',
            ]);
        } catch (\Exception $e) {
            Log::error('Error updating category', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'Erreur: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Supprimer une catégorie
     */
    public function destroy(Category $category)
    {
        // Vérifier que l'utilisateur possède cette catégorie
        if ($category->user_id !== Auth::id()) {
            return response()->json([
                'message' => 'Non autorisé',
            ], 403);
        }

        try {
            $category->delete();

            return response()->json([
                'message' => 'Catégorie supprimée avec succès',
            ]);
        } catch (\Exception $e) {
            Log::error('Error deleting category', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'Erreur: ' . $e->getMessage(),
            ], 500);
        }
    }
}
