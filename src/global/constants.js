

const NOTES = [
  'fa3','zfa3','sol3','zsol3','la3','zla3','si3',
  'do4','zdo4','re4','zre4','mi4',
  'fa4','zfa4','sol4','zsol4','la4','zla4','si4',
  'do5','zdo5','re5','zre5','mi5',
  'fa5','zfa5','sol5','zsol5','la5','zla5','si5',
  'do6'
];

const MIDI_TO_NOTE = {
  53: 'fa3',
  54: 'zfa3',
  55: 'sol3',
  56: 'zsol3',
  57: 'la3',
  58: 'zla3',
  59: 'si3',
  60: 'do4',
  61: 'zdo4',
  62: 're4',
  63: 'zre4',
  64: 'mi4',
  65: 'fa4',
  66: 'zfa4',
  67: 'sol4',
  68: 'zsol4',
  69: 'la4',
  70: 'zla4',
  71: 'si4',
  72: 'do5',
  73: 'zdo5',
  74: 're5',
  75: 'zre5',
  76: 'mi5',
  77: 'fa5',
  78: 'zfa5',
  79: 'sol5',
  80: 'zsol5',
  81: 'la5',
  82: 'zla5',
  83: 'si5',
  84: 'do6'
};

const FINGERS_IN_ORDER = ['thumb', 'index', 'middle', 'ring', 'pinky'];

export {
  NOTES,
  MIDI_TO_NOTE,
  FINGERS_IN_ORDER,
};
