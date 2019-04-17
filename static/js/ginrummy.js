
const animationDuration = 1000;
const { calcDeadwood, value } = require("../../calcDeadwood");
const { cards } = require("../../cards");

module.exports = class {

	constructor(root){
		this.fetchCards();

		const { ko, $ } = root.globals;
		const { ws } = root;
		const self = this;
		const ginrummy = self;

		const cards = [];
		let pauseAnimation = false;
		let zIndex = 0;
		let mPos = {};
		let clicking = false;

		const Card = createCard();

		self._deckCard = ko.observable();
		self._deckBackgroundCard = ko.observable();

		self.n = ko.observable();
		self.oHand = ko.observableArray();
		self.hand = ko.observableArray();
		self.phase = ko.observable();
		self.discard = ko.observableArray();
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

		self.drawDeck = done => {
			if(!self.canDraw()) return;
			ws.s("move", "deck");
			if(!done) self.hand.push(self._deckCard());
			self._deckCard(new Card("?"));
			self.no(null);
		}

		self.drawDiscard = done => {
			if(!self.canDraw()) return;
			ws.s("move", "discard");
			if(!done) self.hand.push(self.discard()[0]);
			self.no(self.discard()[0]);
			self.discard.splice(0, 1, null);
		}

		self.discardCard = card => {
			if(!self.canDiscard() || card.identity === "?" || card === self.no()) return;
			self.hand.remove(card);
			self.discard.unshift(card);
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

		self.pad = (a, l) => {
			a.splice(0, 0, ...[...Array((l - a.length%l)%l)].map(() => null));
			return a
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
				if(self.phase() !== self.n() + .5)
					self.discard.unshift(data[0] === "?" ? null : Card.find(data[0]));
				if(self.discard()[0])
					self.discard()[0].public = true;
			}
			if(type === "drew") {
				self.hand().find(c => c.identity === "?").reveal(data[0]);
			} if(type === "o:deck")
				self.oHand.push(new Card("?"));
			if(type === "o:discard") {
				self.oHand.push(self.discard()[0])
				self.discard.splice(0, 1, null)
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
				self._deckBackgroundCard(new Card("?"));
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

		$("body").mousemove(e => {
			mPos = {
				left: e.originalEvent.pageX,
				top:  e.originalEvent.pageY,
			};
			clicking = !!e.buttons
		});

		function animate(){
			if(pauseAnimation) return;
			cards.forEach(c => c.update());
			window.requestAnimationFrame(animate);
		}

		function createCard(){ return class Card {
			constructor(identity="?", source=$(".deck"), phantom){
				this.dragging = false;
				this.clicking = false;
				this.mOffset = {};
				this.mPos = {};
				this.was = null;
				this.back = () => {};
				this.lastGoal = 0;
				this.lastClick = 0;

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
					.append($("<img>").addClass("front").attr("src", this.image))
					.append($("<img>").addClass("back").attr("src", this.backImage))
					.append($("<div>").text("👁"))
					.css("z-index", ++zIndex)
					.mousedown(({ originalEvent: e }) => {
						this.$tracker.css("z-index", ++zIndex)
						this.clicking = true;
						clicking = true;
						this.mOffset = { top: e.layerY, left: e.layerX };
						let i = self.hand.indexOf(this);
						[this.was, this.back] =
							 ~i ?
								["hand", () => (self.hand.remove(this), self.hand.splice(i, 0, this))] :
							self._deckCard() === this ?
								["deck", () => this.$trackee = $(".deck")] :
							self.discard()[0] === this ?
								["discard", () => this.$trackee = $(".discard")] :
							[null, () => {}]
						;
						return false;
					})
					.mousemove(({ originalEvent: e }) => {
						if(!this.clicking || !this.$trackee || !(
							this.$trackee.parents(".hand").length ||
							self.phase() === self.n() && this.$trackee.is(".deck, .discard")
						))
							return;
						this.dragging = true;
					})
					.mouseup(this.mouseup = () => {
						let d = this.dragging;
						this.clicking = false;
						this.dragging = false;
						if(!this.$trackee)
							return
						if(!d) {
							if(Date.now() - this.lastClick < 500)
								this.$trackee.click();
							this.lastClick = Date.now();
							return
						}
						let goal = this.goal(true);
						if(goal && goal.is(".discard"))
							self.discardCard(this);
						else if(!~self.hand.indexOf(this))
							this.back();

						if(~self.hand().indexOf(this) && this.was !== "hand")
							self[self._deckCard() === this ? "drawDeck" : "drawDiscard"](true);
					})
					.appendTo(".ginrummy")
				;
			}

			get image() {
				return self.cards[this.identity];
			}

			get backImage(){
				return self.cards["-"];
			}

			goal(force){
				if(!this.dragging && !force)
					return;

				let insideHand = inside($(".hand"));

				if(!insideHand)
					self.hand.remove(this);

				if(inside($(".discard")) && self.phase() === self.n() + .5 && this.oldInd !== -1 && this !== self.no())
					return $(".discard");

				if(!insideHand)
					return;

				let i = $(".hand .card")
					.filter((_, el) => mPos.left < el.getBoundingClientRect().right)
					.first()
					.index();
				self.hand.remove(this);
				self.hand.splice(i, 0, this);

				function inside($el){
					let { top, left, right, bottom } = $el[0].getBoundingClientRect();
					return mPos.left >= left && mPos.left <= right && mPos.top >= top && mPos.top <= bottom;
				}
			}

			update(){
				let ease = n => (3*n**2 + 2*n**3)/5;

				let offset = (this.$trackee || { offset: () => {} }).offset() || { left: 0, top: 0 };
				let goal = this.goal();

				if(goal) this.lastGoal = Date.now();

				let hide = offset.left === 0 && offset.top === 0 && !this.dragging;

				this.$tracker
					.attr("data-card", this.identity)
					.toggleClass("transition", !this.dragging || Date.now() - this.lastGoal <= 200)
					.toggleClass("inHand", !!this.$trackee && !!this.$trackee.parents(".hand").length)
					.toggleClass("inDeadwood", !!this.$trackee && !!this.$trackee.parents(".deadwood").length)
					.toggleClass("inDiscardTrail", !!this.$trackee && !!this.$trackee.parents(".discardTrail").length)
					.toggleClass("clickable", !!this.$trackee && !!this.$trackee.is(".clickable"))
					.toggleClass("phantom", !!this.phantom)
					.toggleClass("public", !!this.public)
					.toggleClass("hide", this.identity === "?")
					.css("opacity", hide ? 0 : "")
					.css("pointer-events", hide ? "none" : "auto")
					.children(".front").attr("src", this.image)
					.children(".back").attr("src", this.backImage)

				if(!hide)
					this.$tracker.offset(goal ? goal.offset() : this.dragging ? {
						left: mPos.left - this.mOffset.left,
						top:  mPos.top  - this.mOffset.top,
					} : offset);

				if(this.clicking && !clicking)
					this.mouseup();
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
				if(card) card.track($(el));
			}
		}

		window.requestAnimationFrame(animate);
	}

	fetchCards(){
		this.cards = {};
		Promise.all(cards.concat(["-"]).map(async c => ({
			[c]: await fetch(`/cards/${c}.svg`)
				.then(r => r.blob())
				.then(b => URL.createObjectURL(b))
			,
		}))).then(cs => this.cards = Object.assign({}, ...cs));
	}

}
