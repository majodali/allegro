// Shapes module - uses export to control public interface

// Private helper
helper_scale(x, factor) => x * factor

// Public exports
export area_rect = (w, h) => w * h
export area_circle = r => helper_scale(r * r, 3)
export perimeter_rect = (w, h) => 2 * (w + h)
