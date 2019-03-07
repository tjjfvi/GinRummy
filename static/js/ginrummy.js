
const animationDuration = 1000;
const { calcDeadwood, value } = require("../../calcDeadwood");

module.exports = class {

	constructor(root){
		const { ko, $ } = root.globals;
		const { ws } = root;
		const self = this;
		const ginrummy = self;

		const cards = [];
		let pauseAnimation = false;
		let zIndex = 0;

		const Card = createCard();

		self._deckCard = ko.observable();

		self.n = ko.observable();
		self.oHand = ko.observableArray();
		self.hand = ko.observableArray();
		self.phase = ko.observable();
		self.discard = ko.observable();
		self.no = ko.observable();
		self.willKnock = ko.observable(false);

		self.score = ko.observable(0);
		self.oScore = ko.observable(0);

		self.deadwoodCalc = ko.computed(() => {
			let calc = calcDeadwood(self.hand().map(c => c.identity))
			calc.deadwood = calc.deadwood.map(c => Card.find(c));
			return calc;
		});
		self._deadwoodTotal = ko.observable();
		self.deadwoodTotal = ko.computed(() => self._deadwoodTotal() || self.deadwoodCalc().deadwoodTotal);
		self._deadwood = ko.observable();
		self.deadwood = ko.computed(() => self._deadwood() || self.deadwoodCalc().deadwood);

		self.oDeadwoodTotal = ko.observable("???");
		self.oDeadwood = ko.observable([]);

		self.melds = ko.observable([]);
		self.oMelds = ko.observable([]);

		self.canDraw = ko.computed(() => self.phase() === self.n());
		self.canDiscard = ko.computed(() => self.phase() === self.n() + .5);

		self.ok = ko.observable(false);

		self.drawDeck = () => {
			if(!self.canDraw()) return;
			ws.s("move", "deck");
			self.hand.push(new Card("?"));
			self.no(null);
		}

		self.drawDiscard = () => {
			if(!self.canDraw()) return;
			ws.s("move", "discard");
			self.hand.push(self.discard());
			self.no(self.discard());
			self.discard(null);
		}

		self.discardCard = card => {
			if(!self.canDiscard() || card.identity === "?" || card === self.no()) return;
			self.hand.remove(card);
			self.discard(card);
			ws.s("move", "discard", card.identity, self.willKnock());
			self.willKnock(false);
		}

		self.knock = () => {
			if(self.deadwoodTotal() > 0)
				return self.willKnock(!self.willKnock());
			ws.s("move", "knock");
		}

		self.sendOk = () => {
			self.ok(true);
			ws.s("move", "ok");
		}

		self.value = value;

		root.on("ws", ({ type, data }) => {
			if(type === "hand")
				self.hand(data[0].map(c => new Card(c)));
			if(type === "phase")
				self.phase(data[0]);
			if(type === "n")
				self.n(data[0]);
			if(type === "initCard") {
				if(self.n() === 1)
					self.oHand.push(new Card(data[0]));
				Card.find(data[0]).public = true;
			} if(type === "discard") {
				if(self.phase() === (self.n() + 1) % 2 + .5)
					self.oHand.remove((
						self.oHand().find(c => c.identity === data[0]) ||
						self.oHand().find(c => c.identity === "?")
					).reveal(data[0]));
				self.discard(data[0] === "?" ? null : Card.find(data[0]));
				if(self.discard())
					self.discard().public = true;
			}
			if(type === "drew") {
				self.hand().find(c => c.identity === "?").reveal(data[0]);
				self.hand.splice(-1, 1, Card.find(data[0]));
			} if(type === "o:deck")
				self.oHand.push(new Card("?"));
			if(type === "o:discard") {
				self.oHand.push(self.discard())
				self.discard(null)
			}

			if(type === "end") {
				self.ok(false);
				let [s1, s2] = data;
				let s  = self.n() === 0 ? s1 : s2;
				let oS = self.n() !== 0 ? s1 : s2;

				let m = (a, b) => a.map(c => b.find(d => d.identity === c) || new Card(c, Card.find(c).$trackee, true));
				let mm = (a, b) => a.map(c => m(c, b));

				[].concat(...oS.melds, oS.deadwood).reduce((i, c) => {
					if([].concat(self.oHand(),self.hand()).some(d => d.identity === c))
						return i;
					console.log(self.oHand());
					self.oHand().find(c => c.identity === "?").reveal(c);
					return ++i;
				}, 0);

				self.score(s.score);
				self._deadwood(m(s.deadwood, self.hand()));
				self.melds(mm(s.melds, self.hand()));
				self._deadwoodTotal(s.deadwoodTotal);
				self.oScore(oS.score);
				self.oDeadwood(m(oS.deadwood, self.oHand()));
				self.oMelds(mm(oS.melds, self.oHand()));
				self.oDeadwoodTotal(oS.deadwoodTotal);

				self.hand([]);
				self.oHand([]);
			}

			if(type === "start") {
				$("._card").addClass("old");
				cards.map(c => c.old = true);
				self._deckCard(new Card("?"));
				self.oMelds([]);
				self.melds([]);
				self._deadwood([]);
				self._deadwoodTotal(0);
				self.oDeadwoodTotal("???");
				self.oDeadwood([]);
				self.phase(-42);
				self.oHand([...Array(10)].map(() => new Card("?")));
				pauseAnimation = true;
				setTimeout(() => {
					console.log(self._deckCard().$trackee);
					cards.splice(0, cards.length, ...cards.filter(c => !c.old));
					$("._card.old").addClass("hide").offset($(".deck").offset());
					setTimeout(() => {
						$("._card.old").remove();
						pauseAnimation = false;
						animate();
					}, 400);
				}, 0);
			}

			if(type === "fin") {
				$("body").addClass("fin").html(`You ${
					self.score() > self.oScore() ?
						"won!" :
					self.score() === self.oScore() ?
						"tied." :
						"lost."
				}<br>${self.score()} — ${self.oScore()}`);
			}
		})

		function animate(){
			if(pauseAnimation) return;
			cards.forEach(c => c.update());
			window.requestAnimationFrame(animate);
		}

		function genId(){
			return "card-" + require("crypto").randomBytes(4).toString("hex");
		}

		function createCard(){ return class Card {
			constructor(identity, source=$(".deck"), phantom){
				cards.push(this);
				this.public = false;
				this.phantom = phantom;
				this.identity = identity;
				this.identityO = ko.observable(identity);
				this.$trackee = null;
				this.$tracker = $("<div>")
					.addClass("_card hide")
					.attr("data-card", this.identity)
					.offset(source.offset())
					.append($("<div>").text("👁"))
					.css("z-index", ++zIndex)
					.appendTo(".ginrummy")
				;
			}

			update(){
				let ease = n => (3*n**2 + 2*n**3)/5;

				let offset = (this.$trackee || { offset: () => {} }).offset() || { left: 0, top: 0 };

				let hide = offset.left === 0 && offset.top === 0;

				this.$tracker
					.attr("data-card", this.identity)
					.toggleClass("inHand", !!this.$trackee && !!this.$trackee.parents(".hand").length)
					.toggleClass("inDeadwood", !!this.$trackee && !!this.$trackee.parents(".deadwood").length)
					.toggleClass("phantom", !!this.phantom)
					.toggleClass("public", !!this.public)
					.toggleClass("hide", this.identity === "?")
					.css("opacity", hide ? 0 : "")

				if(!hide)
					this.$tracker.offset(offset);
			}

			reveal(identity){
				this.identityO(this.identity = identity);
				return this;
			}

			hide(){
				this.identity = "?";
				return this;
			}

			track($el){
				this.$trackee = $el;
				this.$tracker.css("z-index", ++zIndex);
				return this;
			}

			static find(identity){
				return cards.find(c => c.identity === identity) || new Card(identity);
			}
		} }

		ko.bindingHandlers.card = {
			init: el => $(el).addClass("card"),
			update: (el, valueAccessor) => {
				let card = ko.unwrap(valueAccessor());
				if(card) card.track($(el).attr("data-card", card.identityO()));
			}
		}

		window.requestAnimationFrame(animate);
	}

}
