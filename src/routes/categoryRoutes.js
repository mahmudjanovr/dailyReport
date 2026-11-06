import { Router } from 'express';
import { CategoryService } from '../services/categoryService.js';
import { NotFoundError } from '../utils/errors.js';
import { createCategorySchema } from '../validators/categoryValidator.js';

const router = Router();

// POST /api/categories - Create a new category
router.post('/', (req, res, next) => {
  try {
    const validated = createCategorySchema.parse(req.body);
    const category = CategoryService.createCategory(validated);
    res.status(201).json({
      success: true,
      message: 'Toifa muvaffaqiyatli yaratildi',
      data: category,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/categories - List categories (supports ?all=true for settings)
router.get('/', (req, res, next) => {
  try {
    const includeInactive = req.query.all === 'true' || req.query.includeInactive === 'true';
    const categories = CategoryService.getAllCategories({ includeInactive });
    res.json({
      success: true,
      data: categories,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/categories/:id/toggle - Toggle category active status (visibility)
router.patch('/:id/toggle', (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      throw new NotFoundError('Noto‘g‘ri toifa identifikatori');
    }

    const current = CategoryService.getById(id);
    if (!current) {
      throw new NotFoundError(`Toifa #${id} topilmadi`);
    }

    const newActiveState = current.is_active === 1 ? 0 : 1;
    const updated = CategoryService.toggleActive(id, newActiveState);

    res.json({
      success: true,
      message: newActiveState === 1 ? 'Toifa faollashtirildi' : 'Toifa yashirildi',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
