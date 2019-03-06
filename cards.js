
const ranks = "A23456789XJQK".split("");
const suits = "♠♥♣♦".split("");
const cards = [].concat(...ranks.map(r => suits.map(s => r + s)));

module.exports = { ranks, suits, cards };
