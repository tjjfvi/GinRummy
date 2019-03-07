
const { ranks, suits, cards } = require("./cards")
const { calcDeadwood } = require("./calcDeadwood");


function handle(ws, type, ...data){
	let { game } = ws;
	let { deck, phase: origPhase } = game;

	phaseSwitch: switch(game.phase){
		case ws.n:
			ws.no = null;
			let card;
			switch(type){
				case "deck":
					card = draw(deck);
					ws.s("drew", card);
					break;
				case "discard":
					card = game.discard;
					ws.no = card;
					break;
				default: break phaseSwitch;
			}
			ws.hand.push(card);
			ws.o.s("o:" + type);
			game.phase += .5;
			break;
		case ws.n + .5:
			switch(type){
				case "discard": {
					let [card, knock] = data;
					ws.hand.splice(ws.hand.indexOf(card), 1);
					game.discard = card;
					game.phase += .5;
					game.phase %= 2;
					ws.s("discard", game.discard);
					ws.o.s("discard", game.discard);
					if(!knock) break;
				}
				case "knock": {
					let d1 = calcDeadwood(ws.hand);
					if(d1.deadwoodTotal > 10)
						break;
					let d2 = calcDeadwood(ws.o.hand, d1);
					let diff = d1.deadwoodTotal - d2.deadwoodTotal;
					if(diff > 0)
						ws.score += diff + (d1.deadwoodTotal === 0 && (25 + (ws.hand.length === 11 && 7)));
					else
						ws.o.score += 25 - diff
					let msg = ["end", ...(a => ws.n === 0 ? a : a.reverse())([{ score: ws.score, ...d1 }, { score: ws.o.score, ...d2 }])];
					game.phase = -1;
					ws.s(...msg);
					ws.o.s(...msg);
				}
			}
			break;
		case -1:
			if(type !== "ok")
				break;
			ws.ok = true;
			if(!ws.o.ok) {
				break;
			}
			ws.ok = false;
			ws.o.ok = false;
			if(ws.score > 100 || ws.o.score > 100) {
				ws.s("fin");
				ws.o.s("fin");
				break;
			}

			setup(...(ws.n ? [ws, ws.o] : [ws.o, ws]));
			break;
	}

	if(game.phase !== origPhase) {
		ws.s("phase", game.phase);
		ws.o.s("phase", game.phase);
	}
}

function setup(ws1, ws2){
	let deck = cards.slice();
	let discard = "?";
	let initCard = draw(deck);
	let [h1, h2] = [0,0].map(() => [...Array(10)].map(() => draw(deck)));
	h1.push(initCard);
	let game = ws1.game = ws2.game = { deck, discard, phase: .5, 0: ws1, 1: ws2 };
	ws1.n = 0;
	ws2.n = 1;
	ws1.hand = h1;
	ws2.hand = h2;
	ws1.score |= 0;
	ws2.score |= 0;

	ws1.s("start");
	ws1.s("n", ws1.n);
	ws1.s("hand", h1);
	ws1.s("discard", discard);
	ws1.s("phase", game.phase);
	ws1.s("initCard", initCard);

	ws2.s("start");
	ws2.s("n", ws2.n);
	ws2.s("hand", h2);
	ws2.s("discard", discard);
	ws2.s("phase", game.phase);
	ws2.s("initCard", initCard);
}

function draw(deck){
	return deck.splice(Math.floor(Math.random() * deck.length) * 0, 1)[0];
}

module.exports = { setup, handle };
