export const emojiCategories = [
  {
    name: 'Gitmoji',
    emojis: [
      { char: '✨', short: ':sparkles:' }, { char: '🐛', short: ':bug:' }, { char: '♻️', short: ':recycle:' }, { char: '🚀', short: ':rocket:' },
      { char: '⚡', short: ':zap:' }, { char: '🔥', short: ':fire:' }, { char: '🎨', short: ':art:' }, { char: '🚑', short: ':ambulance:' },
      { char: '⏪', short: ':rewind:' }, { char: '🔀', short: ':twisted_rightwards_arrows:' }
    ]
  },
  {
    name: 'Status',
    emojis: [
      { char: '✅', short: ':white_check_mark:' }, { char: '❌', short: ':x:' }, { char: '🚧', short: ':construction:' }, { char: '⚠️', short: ':warning:' },
      { char: '💡', short: ':bulb:' }, { char: 'ℹ️', short: ':information_source:' }, { char: '🛑', short: ':stop_sign:' }, { char: '🔜', short: ':soon:' }
    ]
  },
  {
    name: 'Docs',
    emojis: [
      { char: '📝', short: ':memo:' }, { char: '📚', short: ':books:' }, { char: '📖', short: ':book:' }, { char: '📦', short: ':package:' },
      { char: '🛠️', short: ':hammer_and_wrench:' }, { char: '🤝', short: ':handshake:' }, { char: '🙋', short: ':raising_hand:' }, { char: '📄', short: ':page_facing_up:' },
      { char: '📌', short: ':pushpin:' }, { char: '🔗', short: ':link:' }
    ]
  },
  {
    name: 'Infra',
    emojis: [
      { char: '🔧', short: ':wrench:' }, { char: '🔒', short: ':lock:' }, { char: '🌐', short: ':globe_with_meridians:' }, { char: '📱', short: ':iphone:' },
      { char: '🐳', short: ':whale:' }, { char: '☁️', short: ':cloud:' }, { char: '🧪', short: ':test_tube:' }, { char: '👷', short: ':construction_worker:' }
    ]
  }
];

export const emojiMap = emojiCategories.reduce((acc, cat) => {
  cat.emojis.forEach(e => { acc[e.short] = e.char; });
  return acc;
}, {
  ':smile:': '😄', ':heart:': '❤️', ':check:': '✅', ':warn:': '⚠️', ':error:': '❌'
});

export const parseEmojis = (text) => {
  return text.replace(/:[a-z0-9_+:-]+:/g, (match) => emojiMap[match] || match);
};
