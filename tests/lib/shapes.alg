// Shapes module - uses export to control public interface

// Private helper
helper_scale(x, factor) => x * factor

// Public exports
area_rect = export((w, h) => w * h)
area_circle = export(r => helper_scale(r * r, 3))
perimeter_rect = export((w, h) => 2 * (w + h))
