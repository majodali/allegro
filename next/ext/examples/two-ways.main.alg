// A notation whose form reads what a form in force reads. The word `six`
// is a name here, and the notation makes it a number as well. The
// reading each line had is still among its readings, so the comparison
// with the grammar before lets the lines by; the last line reads two
// ways, and a text that reads two ways is refused.
capability output
use six.word
six = 7
output.write(int.text(six))
// refused: the text reads two ways
