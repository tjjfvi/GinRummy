
const { ranks, suits, cards } = require("./cards");

module.exports = { calcDeadwood, sumDeadwood, value };

function calcDeadwood(hand, playOff) {
	let best = { deadwoodTotal: Infinity }
	let paths = [{ melds: [], todo: hand.slice(), deadwood: [] }]

	playOff = playOff || { melds: [], deadwood: [], };

	for(let i = 0; paths.length; i++, i %= paths.length){
		let { melds, todo, deadwood } = path = paths[i];
		let [cur] = todo;

		if(!todo.length) {
			paths.splice(i--, 1);
			path.deadwoodTotal = sumDeadwood(deadwood);
			if(path.deadwoodTotal < best.deadwoodTotal)
				best = path;
			continue;
		}

		let set = suits
			.map(s => cur[0] + s)
			.filter(c => ~todo.indexOf(c))
			.concat(...playOff.melds.filter(m => m.every(c => c[0] === cur[0])));
		let run = [cur];
		[1, -1].forEach(d => {
			let c = cur;
			while(
				~todo.indexOf(c = ranks[ranks.indexOf(c[0]) + d] + c[1]) ||
				playOff.melds.some(m => m.every(c => c[1] === cur[1]) && ~m.indexOf(c))
			)
				run.push(c);
		})

		paths.push(...[set, run].filter(m => m.length >= 3).map(meld => {
			let newTodo = todo.slice();
			let newDeadwood = deadwood.slice();

			meld.map(c => newTodo.splice(newTodo.indexOf(c), 1));

			return { melds: [...melds, meld], todo: newTodo, deadwood: newDeadwood };
		}));

		deadwood.push(cur);
		todo.shift();
	}

	best.canKnock = best.deadwoodTotal < 10 || (best.deadwoodTotal < 20 && best.deadwood.some(c => value(c) >= best.deadwoodTotal - 10));

	return best;
}

function sumDeadwood(deadwood){
	return deadwood.map(value).reduce((a, b) => a + b, 0);
}

function value(card){
	return Math.min(ranks.indexOf(card[0]) + 1, 10);
}
